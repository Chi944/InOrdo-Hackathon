-- Read-only post-deploy reconciliation for the Prompt 10 readiness migration.
-- Expected before reopening analyze/apply routes:
--   eligible_succeeded_still_draft = 0
--   ready_invariant_violations = 0
-- Record eligible_succeeded_ready as the deployed inventory baseline.

with proposal_reconciliation as (
  select
    proposal.id,
    proposal.state,
    exists (
      select 1
      from public.analysis_requests as request
      join public.projects as project
        on project.id = request.project_id
       and project.workspace_id = request.workspace_id
       and project.workflow_generation = request.workflow_generation
      join public.impact_runs as impact_run
        on impact_run.id = request.impact_run_id
       and impact_run.workspace_id = request.workspace_id
       and impact_run.project_id = request.project_id
       and impact_run.workflow_generation = request.workflow_generation
       and impact_run.change_event_id = request.change_event_id
       and impact_run.started_by = request.requested_by
       and impact_run.state = 'completed'::public.impact_run_state
      join public.change_events as change_event
        on change_event.id = request.change_event_id
       and change_event.workspace_id = request.workspace_id
       and change_event.project_id = request.project_id
       and change_event.workflow_generation = request.workflow_generation
       and change_event.source_document_id = request.source_document_id
       and change_event.created_by = request.requested_by
       and change_event.model_name = request.model_name
       and change_event.state = 'needs_confirmation'::public.change_event_state
      where request.state = 'succeeded'::public.analysis_request_state
        and request.proposal_id = proposal.id
        and request.workspace_id = proposal.workspace_id
        and request.project_id = proposal.project_id
        and request.workflow_generation = proposal.workflow_generation
        and request.change_event_id = proposal.change_event_id
        and request.impact_run_id = proposal.impact_run_id
        and request.requested_by = proposal.created_by
        and request.model_name = proposal.model_name
    ) as has_exact_succeeded_analysis,
    (
      select pg_catalog.count(*)
      from public.proposal_actions as action
      where action.workspace_id = proposal.workspace_id
        and action.project_id = proposal.project_id
        and action.proposal_id = proposal.id
    ) as action_count,
    exists (
      select 1
      from public.proposal_actions as action
      where action.workspace_id = proposal.workspace_id
        and action.project_id = proposal.project_id
        and action.proposal_id = proposal.id
        and (
          action.workflow_generation is distinct from proposal.workflow_generation
          or action.state <> 'pending'::public.proposal_action_state
          or action.reviewed_by is not null
          or action.reviewed_at is not null
        )
    ) as has_invalid_action,
    exists (
      select 1
      from public.operation_logs as operation
      where operation.workspace_id = proposal.workspace_id
        and operation.project_id = proposal.project_id
        and operation.proposal_id = proposal.id
    ) as has_operation
  from public.action_proposals as proposal
  where proposal.state in (
    'draft'::public.proposal_state,
    'ready'::public.proposal_state
  )
), readiness_invariants as (
  select
    *,
    has_exact_succeeded_analysis
      and action_count between 1 and 8
      and not has_invalid_action
      and not has_operation as is_eligible_and_inert
  from proposal_reconciliation
)
select
  pg_catalog.count(*) filter (
    where state = 'ready'::public.proposal_state
      and is_eligible_and_inert
  ) as eligible_succeeded_ready,
  pg_catalog.count(*) filter (
    where state = 'draft'::public.proposal_state
      and is_eligible_and_inert
  ) as eligible_succeeded_still_draft,
  pg_catalog.count(*) filter (
    where state = 'ready'::public.proposal_state
      and not is_eligible_and_inert
  ) as ready_invariant_violations
from readiness_invariants;
