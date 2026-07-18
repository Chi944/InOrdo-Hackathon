-- A succeeded analysis has already passed application postvalidation and the
-- database's independent finalization checks. Promote its complete, inert
-- proposal to the state accepted by the human-approval operation only after
-- every pending action has been inserted in the same transaction.

create or replace function private.promote_succeeded_analysis_proposal()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.state <> 'succeeded'::public.analysis_request_state
     or new.change_event_id is null
     or new.impact_run_id is null
     or new.proposal_id is null then
    raise exception 'succeeded analysis is missing derived records'
      using errcode = '23514';
  end if;

  perform proposal.id
  from public.action_proposals as proposal
  where proposal.id = new.proposal_id
    and proposal.workspace_id = new.workspace_id
    and proposal.project_id = new.project_id
    and proposal.workflow_generation = new.workflow_generation
    and proposal.change_event_id = new.change_event_id
    and proposal.impact_run_id = new.impact_run_id
    and proposal.created_by = new.requested_by
    and proposal.model_name = new.model_name
    and proposal.state = 'draft'::public.proposal_state
    and exists (
      select 1
      from public.projects as project
      where project.id = new.project_id
        and project.workspace_id = new.workspace_id
        and project.workflow_generation = new.workflow_generation
    )
    and exists (
      select 1
      from public.impact_runs as impact_run
      where impact_run.id = new.impact_run_id
        and impact_run.workspace_id = new.workspace_id
        and impact_run.project_id = new.project_id
        and impact_run.workflow_generation = new.workflow_generation
        and impact_run.change_event_id = new.change_event_id
        and impact_run.started_by = new.requested_by
        and impact_run.state = 'completed'::public.impact_run_state
    )
    and (
      select pg_catalog.count(*)
      from public.proposal_actions as action
      where action.workspace_id = new.workspace_id
        and action.project_id = new.project_id
        and action.proposal_id = new.proposal_id
    ) between 1 and 8
    and exists (
      select 1
      from public.change_events as change_event
      where change_event.id = new.change_event_id
        and change_event.workspace_id = new.workspace_id
        and change_event.project_id = new.project_id
        and change_event.workflow_generation = new.workflow_generation
        and change_event.source_document_id = new.source_document_id
        and change_event.created_by = new.requested_by
        and change_event.model_name = new.model_name
        and change_event.state = 'needs_confirmation'::public.change_event_state
    )
    and not exists (
      select 1
      from public.proposal_actions as action
      where action.workspace_id = new.workspace_id
        and action.project_id = new.project_id
        and action.proposal_id = new.proposal_id
        and (
          action.workflow_generation is distinct from new.workflow_generation
          or action.state <> 'pending'::public.proposal_action_state
          or action.reviewed_by is not null
          or action.reviewed_at is not null
        )
    )
    and not exists (
      select 1
      from public.operation_logs as operation
      where operation.workspace_id = new.workspace_id
        and operation.project_id = new.project_id
        and operation.proposal_id = new.proposal_id
    )
  for update;

  if not found then
    raise exception 'completed analysis proposal is not ready for review'
      using errcode = '23514';
  end if;

  update public.action_proposals
  set state = 'ready'::public.proposal_state
  where id = new.proposal_id
    and state = 'draft'::public.proposal_state;

  return new;
end;
$$;

drop trigger if exists analysis_requests_promote_proposal_ready
  on public.analysis_requests;
create trigger analysis_requests_promote_proposal_ready
after update of state, change_event_id, impact_run_id, proposal_id
on public.analysis_requests
for each row
when (
  old.state is distinct from new.state
  and new.state = 'succeeded'::public.analysis_request_state
)
execute function private.promote_succeeded_analysis_proposal();

-- The application has no direct review writer. Remove the legacy authenticated
-- review surfaces before the backfill so no browser review can race its pending
-- action checks. The migration transaction keeps the DDL and backfill atomic.
drop policy if exists change_events_review_admin on public.change_events;
drop policy if exists proposal_actions_review_admin on public.proposal_actions;
revoke update on table public.change_events from authenticated;
revoke update (state, reviewed_by, reviewed_at)
  on table public.change_events from authenticated;
revoke update on table public.proposal_actions from authenticated;
revoke update (state, reviewed_by, reviewed_at)
  on table public.proposal_actions from authenticated;

-- Existing successful analyses were finalized under the same all-or-nothing
-- contract. Bring only complete, untouched draft proposals across the boundary;
-- mismatched, reviewed, or previously attempted drafts stay quarantined.
update public.action_proposals as proposal
set state = 'ready'::public.proposal_state
from public.analysis_requests as request
where request.state = 'succeeded'::public.analysis_request_state
  and request.proposal_id = proposal.id
  and request.workspace_id = proposal.workspace_id
  and request.project_id = proposal.project_id
  and request.workflow_generation = proposal.workflow_generation
  and request.change_event_id = proposal.change_event_id
  and request.impact_run_id = proposal.impact_run_id
  and request.requested_by = proposal.created_by
  and request.model_name = proposal.model_name
  and proposal.state = 'draft'::public.proposal_state
  and exists (
    select 1
    from public.projects as project
    where project.id = request.project_id
      and project.workspace_id = request.workspace_id
      and project.workflow_generation = request.workflow_generation
  )
  and exists (
    select 1
    from public.impact_runs as impact_run
    where impact_run.id = request.impact_run_id
      and impact_run.workspace_id = request.workspace_id
      and impact_run.project_id = request.project_id
      and impact_run.workflow_generation = request.workflow_generation
      and impact_run.change_event_id = request.change_event_id
      and impact_run.started_by = request.requested_by
      and impact_run.state = 'completed'::public.impact_run_state
  )
  and (
    select pg_catalog.count(*)
    from public.proposal_actions as action
    where action.workspace_id = request.workspace_id
      and action.project_id = request.project_id
      and action.proposal_id = request.proposal_id
  ) between 1 and 8
  and exists (
    select 1
    from public.change_events as change_event
    where change_event.id = request.change_event_id
      and change_event.workspace_id = request.workspace_id
      and change_event.project_id = request.project_id
      and change_event.workflow_generation = request.workflow_generation
      and change_event.source_document_id = request.source_document_id
      and change_event.created_by = request.requested_by
      and change_event.model_name = request.model_name
      and change_event.state = 'needs_confirmation'::public.change_event_state
  )
  and not exists (
    select 1
    from public.proposal_actions as action
    where action.workspace_id = request.workspace_id
      and action.project_id = request.project_id
      and action.proposal_id = request.proposal_id
      and (
        action.workflow_generation is distinct from request.workflow_generation
        or action.state <> 'pending'::public.proposal_action_state
        or action.reviewed_by is not null
        or action.reviewed_at is not null
      )
  )
  and not exists (
    select 1
    from public.operation_logs as operation
    where operation.workspace_id = request.workspace_id
      and operation.project_id = request.project_id
      and operation.proposal_id = request.proposal_id
  );

revoke all on function private.promote_succeeded_analysis_proposal()
  from public, anon, authenticated, service_role;

comment on function private.promote_succeeded_analysis_proposal() is
  'Moves only a fully finalized succeeded-analysis proposal from draft to ready; actions remain inert pending explicit human selection and authorized apply.';
