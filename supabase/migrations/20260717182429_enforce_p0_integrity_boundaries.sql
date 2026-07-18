-- Lock record identity and attribution while preserving intentionally mutable
-- domain fields. This trigger is generic but accepts only static column names
-- supplied by each trigger declaration below.
create or replace function public.reject_immutable_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  immutable_column text;
begin
  foreach immutable_column in array pg_catalog.string_to_array(tg_argv[0], ',')
  loop
    if (pg_catalog.to_jsonb(new) -> immutable_column)
       is distinct from (pg_catalog.to_jsonb(old) -> immutable_column) then
      raise exception '% is immutable on %', immutable_column, tg_table_name
        using errcode = '23514';
    end if;
  end loop;
  return new;
end;
$$;

create trigger profiles_protect_identity
before update on public.profiles
for each row execute function public.reject_immutable_columns('id,created_at');
create trigger workspaces_protect_identity
before update on public.workspaces
for each row execute function public.reject_immutable_columns('id,created_by,created_at');
create trigger workspace_members_protect_identity
before update on public.workspace_members
for each row execute function public.reject_immutable_columns('workspace_id,user_id,invited_by,created_at');
create trigger projects_protect_identity
before update on public.projects
for each row execute function public.reject_immutable_columns('id,workspace_id,is_demo,created_by,created_at');
create trigger project_items_00_protect_identity
before update on public.project_items
for each row execute function public.reject_immutable_columns('id,workspace_id,project_id,version,created_by,created_at');
create trigger item_dependencies_protect_identity
before update on public.item_dependencies
for each row execute function public.reject_immutable_columns('id,workspace_id,project_id,from_item_id,to_item_id,created_by,created_at');
create trigger change_events_protect_evidence
before update on public.change_events
for each row execute function public.reject_immutable_columns('id,workspace_id,project_id,source_document_id,subject_item_id,field_name,previous_value,proposed_value,confidence,model_name,created_by,created_at');
create trigger impact_runs_protect_identity
before update on public.impact_runs
for each row execute function public.reject_immutable_columns('id,workspace_id,project_id,change_event_id,max_depth,started_by,started_at');
create trigger impact_items_immutable
before update or delete on public.impact_items
for each row execute function public.reject_immutable_change();
create trigger action_proposals_protect_draft
before update on public.action_proposals
for each row execute function public.reject_immutable_columns('id,workspace_id,project_id,change_event_id,impact_run_id,title,rationale,model_name,created_by,created_at');
create trigger proposal_actions_protect_draft
before update on public.proposal_actions
for each row execute function public.reject_immutable_columns('id,workspace_id,project_id,proposal_id,ordinal,action_type,target_item_id,expected_item_version,payload,rationale,created_at');

-- Human reviewers may only move an unreviewed record into an explicit review
-- outcome. The database supplies their identity and timestamp; callers cannot
-- forge either field. Server-only workflows may subsequently supersede records.
create or replace function public.guard_change_event_review()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.state is not distinct from old.state then
    if new.reviewed_by is distinct from old.reviewed_by
       or new.reviewed_at is distinct from old.reviewed_at then
      raise exception 'review attribution requires a state transition'
        using errcode = '23514';
    end if;
    return new;
  end if;

  if current_user = 'authenticated' then
    if old.state <> 'needs_confirmation'::public.change_event_state
       or new.state not in (
         'confirmed'::public.change_event_state,
         'rejected'::public.change_event_state
       ) then
      raise exception 'invalid human change-event review transition'
        using errcode = '23514';
    end if;
    new.reviewed_by := (select auth.uid());
    new.reviewed_at := now();
  elsif not (
    (old.state = 'needs_confirmation'::public.change_event_state and new.state in (
      'confirmed'::public.change_event_state,
      'rejected'::public.change_event_state,
      'superseded'::public.change_event_state
    ))
    or (old.state in (
      'confirmed'::public.change_event_state,
      'rejected'::public.change_event_state
    ) and new.state = 'superseded'::public.change_event_state)
  ) then
    raise exception 'invalid change-event state transition' using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.guard_proposal_action_review()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.state is not distinct from old.state then
    if new.reviewed_by is distinct from old.reviewed_by
       or new.reviewed_at is distinct from old.reviewed_at then
      raise exception 'review attribution requires a state transition'
        using errcode = '23514';
    end if;
    return new;
  end if;

  if current_user = 'authenticated' then
    if old.state <> 'pending'::public.proposal_action_state
       or new.state not in (
         'approved'::public.proposal_action_state,
         'rejected'::public.proposal_action_state
       ) then
      raise exception 'invalid human proposal-action review transition'
        using errcode = '23514';
    end if;
    new.reviewed_by := (select auth.uid());
    new.reviewed_at := now();
  elsif not (
    (old.state = 'pending'::public.proposal_action_state and new.state in (
      'approved'::public.proposal_action_state,
      'rejected'::public.proposal_action_state,
      'stale'::public.proposal_action_state
    ))
    or (old.state = 'approved'::public.proposal_action_state and new.state in (
      'applied'::public.proposal_action_state,
      'stale'::public.proposal_action_state
    ))
  ) then
    raise exception 'invalid proposal-action state transition' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger change_events_guard_review
before update on public.change_events
for each row execute function public.guard_change_event_review();
create trigger proposal_actions_guard_review
before update on public.proposal_actions
for each row execute function public.guard_proposal_action_review();

-- Serialize owner removal/demotion on the workspace parent. Without this lock,
-- two concurrent owner changes could each observe the other owner and commit a
-- workspace with no owner.
create or replace function public.protect_final_workspace_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and (new.workspace_id <> old.workspace_id or new.user_id <> old.user_id) then
    raise exception 'workspace membership identity is immutable' using errcode = '23514';
  end if;

  if old.role = 'owner'::public.workspace_role
     and (
       tg_op = 'DELETE'
       or (tg_op = 'UPDATE' and new.role <> 'owner'::public.workspace_role)
     ) then
    perform 1
    from public.workspaces w
    where w.id = old.workspace_id
    for update;

    if not exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = old.workspace_id
        and wm.user_id <> old.user_id
        and wm.role = 'owner'::public.workspace_role
    ) then
      raise exception 'a workspace must retain at least one owner' using errcode = '23514';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Derived model results and append-only operation/activity audit are written
-- only by server-side orchestration. Authenticated humans retain review updates.
drop policy if exists change_events_insert_admin on public.change_events;
drop policy if exists change_events_update_admin on public.change_events;
create policy change_events_review_admin on public.change_events
for update to authenticated
using ((select private.can_administer_workspace(workspace_id)))
with check (
  (select private.can_administer_workspace(workspace_id))
  and state in ('confirmed'::public.change_event_state, 'rejected'::public.change_event_state)
  and reviewed_by = (select auth.uid())
);

drop policy if exists impact_runs_insert_admin on public.impact_runs;
drop policy if exists impact_runs_update_admin on public.impact_runs;
drop policy if exists impact_items_insert_admin on public.impact_items;
drop policy if exists impact_items_update_admin on public.impact_items;
drop policy if exists impact_items_delete_admin on public.impact_items;
drop policy if exists action_proposals_insert_admin on public.action_proposals;
drop policy if exists action_proposals_update_admin on public.action_proposals;
drop policy if exists proposal_actions_insert_admin on public.proposal_actions;
drop policy if exists proposal_actions_update_admin on public.proposal_actions;
create policy proposal_actions_review_admin on public.proposal_actions
for update to authenticated
using ((select private.can_administer_workspace(workspace_id)))
with check (
  (select private.can_administer_workspace(workspace_id))
  and state in ('approved'::public.proposal_action_state, 'rejected'::public.proposal_action_state)
  and reviewed_by = (select auth.uid())
);
drop policy if exists operation_logs_insert_admin on public.operation_logs;
drop policy if exists operation_items_insert_admin on public.operation_items;
drop policy if exists activity_events_insert_admin on public.activity_events;

revoke insert, update, delete on table public.change_events from authenticated;
grant update (state, reviewed_by, reviewed_at) on table public.change_events to authenticated;
revoke insert, update, delete on table public.impact_runs from authenticated;
revoke insert, update, delete on table public.impact_items from authenticated;
revoke insert, update, delete on table public.action_proposals from authenticated;
revoke insert, update, delete on table public.proposal_actions from authenticated;
grant update (state, reviewed_by, reviewed_at) on table public.proposal_actions to authenticated;
revoke insert, update, delete on table public.operation_logs from authenticated;
revoke insert, update, delete on table public.operation_items from authenticated;
revoke insert, update, delete on table public.activity_events from authenticated;

-- Explicit server-only object privileges are required on newly created Supabase
-- projects. The service role bypasses RLS but does not bypass SQL grants.
grant select, insert, update on table public.profiles to service_role;
grant select, insert, update, delete on table public.workspaces to service_role;
grant select, insert, update, delete on table public.workspace_members to service_role;
grant select, insert, update, delete on table public.projects to service_role;
grant select, insert, update, delete on table public.project_items to service_role;
grant select, insert, update, delete on table public.item_dependencies to service_role;
grant select, insert on table public.source_documents to service_role;
grant select, insert, update on table public.change_events to service_role;
grant select, insert, update on table public.impact_runs to service_role;
grant select, insert on table public.impact_items to service_role;
grant select, insert, update on table public.action_proposals to service_role;
grant select, insert, update on table public.proposal_actions to service_role;
grant select, insert on table public.operation_logs to service_role;
grant select, insert on table public.operation_items to service_role;
grant select, insert on table public.activity_events to service_role;

grant usage on type public.workspace_role to service_role;
grant usage on type public.project_status to service_role;
grant usage on type public.project_item_type to service_role;
grant usage on type public.project_item_status to service_role;
grant usage on type public.item_priority to service_role;
grant usage on type public.dependency_relationship to service_role;
grant usage on type public.change_event_state to service_role;
grant usage on type public.impact_run_state to service_role;
grant usage on type public.impact_severity to service_role;
grant usage on type public.proposal_state to service_role;
grant usage on type public.proposal_action_state to service_role;
grant usage on type public.proposal_action_type to service_role;
grant usage on type public.operation_type to service_role;
grant usage on type public.operation_state to service_role;
grant usage on type public.operation_item_state to service_role;

-- The unique operation-item key already provides this exact index prefix.
drop index if exists public.operation_items_operation_idx;

-- Supabase may assign direct API-role grants when functions are created or
-- replaced; none of these trigger functions is an RPC surface.
revoke all on function public.reject_immutable_columns() from public, anon, authenticated, service_role;
revoke all on function public.guard_change_event_review() from public, anon, authenticated, service_role;
revoke all on function public.guard_proposal_action_review() from public, anon, authenticated, service_role;
revoke all on function public.protect_final_workspace_owner() from public, anon, authenticated, service_role;
