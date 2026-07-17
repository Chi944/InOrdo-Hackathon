-- Least-privilege authorization for the InOrdo P0 schema.
-- Membership predicates are SECURITY DEFINER to avoid recursive RLS evaluation
-- on workspace_members. They expose booleans only, pin search_path to empty,
-- qualify every object, and reject calls without an authenticated auth.uid().

create schema if not exists private;
revoke all on schema private from public;

create or replace function private.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = target_workspace_id
        and wm.user_id = (select auth.uid())
    );
$$;

create or replace function private.can_manage_records(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = target_workspace_id
        and wm.user_id = (select auth.uid())
        and wm.role in ('owner'::public.workspace_role, 'admin'::public.workspace_role, 'member'::public.workspace_role)
    );
$$;

create or replace function private.can_administer_workspace(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = target_workspace_id
        and wm.user_id = (select auth.uid())
        and wm.role in ('owner'::public.workspace_role, 'admin'::public.workspace_role)
    );
$$;

create or replace function private.is_workspace_owner(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = target_workspace_id
        and wm.user_id = (select auth.uid())
        and wm.role = 'owner'::public.workspace_role
    );
$$;

create or replace function private.can_manage_membership_row(
  target_workspace_id uuid,
  target_role public.workspace_role
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and (
      private.is_workspace_owner(target_workspace_id)
      or (
        target_role in ('member'::public.workspace_role, 'viewer'::public.workspace_role)
        and exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = target_workspace_id
            and wm.user_id = (select auth.uid())
            and wm.role = 'admin'::public.workspace_role
        )
      )
    );
$$;

create or replace function private.shares_workspace(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.workspace_members mine
      join public.workspace_members theirs on theirs.workspace_id = mine.workspace_id
      where mine.user_id = (select auth.uid())
        and theirs.user_id = target_user_id
    );
$$;

create or replace function private.can_bootstrap_workspace_member(
  target_workspace_id uuid,
  target_user_id uuid,
  target_role public.workspace_role
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and (select auth.uid()) = target_user_id
    and target_role = 'owner'::public.workspace_role
    and exists (
      select 1
      from public.workspaces w
      where w.id = target_workspace_id
        and w.created_by = (select auth.uid())
    )
    and not exists (
      select 1 from public.workspace_members wm where wm.workspace_id = target_workspace_id
    );
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(
      coalesce(
        nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
        nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
        'InOrdo user'
      ),
      120
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.is_workspace_member(uuid) from public;
revoke all on function private.can_manage_records(uuid) from public;
revoke all on function private.can_administer_workspace(uuid) from public;
revoke all on function private.is_workspace_owner(uuid) from public;
revoke all on function private.can_manage_membership_row(uuid, public.workspace_role) from public;
revoke all on function private.shares_workspace(uuid) from public;
revoke all on function private.can_bootstrap_workspace_member(uuid, uuid, public.workspace_role) from public;
revoke all on function private.handle_new_user() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_workspace_member(uuid) to authenticated;
grant execute on function private.can_manage_records(uuid) to authenticated;
grant execute on function private.can_administer_workspace(uuid) to authenticated;
grant execute on function private.is_workspace_owner(uuid) to authenticated;
grant execute on function private.can_manage_membership_row(uuid, public.workspace_role) to authenticated;
grant execute on function private.shares_workspace(uuid) to authenticated;
grant execute on function private.can_bootstrap_workspace_member(uuid, uuid, public.workspace_role) to authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.projects enable row level security;
alter table public.project_items enable row level security;
alter table public.item_dependencies enable row level security;
alter table public.source_documents enable row level security;
alter table public.change_events enable row level security;
alter table public.impact_runs enable row level security;
alter table public.impact_items enable row level security;
alter table public.action_proposals enable row level security;
alter table public.proposal_actions enable row level security;
alter table public.operation_logs enable row level security;
alter table public.operation_items enable row level security;
alter table public.activity_events enable row level security;

create policy profiles_select_workspace_peers on public.profiles
for select to authenticated
using (id = (select auth.uid()) or private.shares_workspace(id));
create policy profiles_update_self on public.profiles
for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy workspaces_select_member on public.workspaces
for select to authenticated
using (private.is_workspace_member(id));
create policy workspaces_insert_authenticated on public.workspaces
for insert to authenticated
with check ((select auth.uid()) is not null and created_by = (select auth.uid()));
create policy workspaces_update_admin on public.workspaces
for update to authenticated
using (private.can_administer_workspace(id))
with check (private.can_administer_workspace(id));

create policy workspace_members_select_member on public.workspace_members
for select to authenticated
using (private.is_workspace_member(workspace_id));
create policy workspace_members_insert_admin_or_bootstrap on public.workspace_members
for insert to authenticated
with check (
  private.can_manage_membership_row(workspace_id, role)
  or private.can_bootstrap_workspace_member(workspace_id, user_id, role)
);
create policy workspace_members_update_admin on public.workspace_members
for update to authenticated
using (private.can_manage_membership_row(workspace_id, role))
with check (private.can_manage_membership_row(workspace_id, role));
create policy workspace_members_delete_admin on public.workspace_members
for delete to authenticated
using (private.can_manage_membership_row(workspace_id, role));

create policy projects_select_member on public.projects
for select to authenticated using (private.is_workspace_member(workspace_id));
create policy projects_insert_contributor on public.projects
for insert to authenticated with check (private.can_manage_records(workspace_id) and created_by = (select auth.uid()));
create policy projects_update_contributor on public.projects
for update to authenticated using (private.can_manage_records(workspace_id)) with check (private.can_manage_records(workspace_id));
create policy projects_delete_contributor on public.projects
for delete to authenticated using (private.can_administer_workspace(workspace_id));

create policy project_items_select_member on public.project_items
for select to authenticated using (private.is_workspace_member(workspace_id));
create policy project_items_insert_contributor on public.project_items
for insert to authenticated with check (private.can_manage_records(workspace_id) and created_by = (select auth.uid()));
create policy project_items_update_contributor on public.project_items
for update to authenticated using (private.can_manage_records(workspace_id)) with check (private.can_manage_records(workspace_id));
create policy project_items_delete_contributor on public.project_items
for delete to authenticated using (private.can_manage_records(workspace_id));

create policy item_dependencies_select_member on public.item_dependencies
for select to authenticated using (private.is_workspace_member(workspace_id));
create policy item_dependencies_insert_contributor on public.item_dependencies
for insert to authenticated with check (private.can_manage_records(workspace_id) and created_by = (select auth.uid()));
create policy item_dependencies_update_contributor on public.item_dependencies
for update to authenticated using (private.can_manage_records(workspace_id)) with check (private.can_manage_records(workspace_id));
create policy item_dependencies_delete_contributor on public.item_dependencies
for delete to authenticated using (private.can_manage_records(workspace_id));

create policy source_documents_select_member on public.source_documents
for select to authenticated using (private.is_workspace_member(workspace_id));
create policy source_documents_insert_contributor on public.source_documents
for insert to authenticated with check (private.can_manage_records(workspace_id) and captured_by = (select auth.uid()));

create policy change_events_select_member on public.change_events
for select to authenticated using (private.is_workspace_member(workspace_id));
create policy change_events_insert_admin on public.change_events
for insert to authenticated with check (private.can_administer_workspace(workspace_id) and created_by = (select auth.uid()));
create policy change_events_update_admin on public.change_events
for update to authenticated using (private.can_administer_workspace(workspace_id)) with check (private.can_administer_workspace(workspace_id));

create policy impact_runs_select_member on public.impact_runs
for select to authenticated using (private.is_workspace_member(workspace_id));
create policy impact_runs_insert_admin on public.impact_runs
for insert to authenticated with check (private.can_administer_workspace(workspace_id) and started_by = (select auth.uid()));
create policy impact_runs_update_admin on public.impact_runs
for update to authenticated using (private.can_administer_workspace(workspace_id)) with check (private.can_administer_workspace(workspace_id));

create policy impact_items_select_member on public.impact_items
for select to authenticated using (private.is_workspace_member(workspace_id));
create policy impact_items_insert_admin on public.impact_items
for insert to authenticated with check (private.can_administer_workspace(workspace_id));
create policy impact_items_update_admin on public.impact_items
for update to authenticated using (private.can_administer_workspace(workspace_id)) with check (private.can_administer_workspace(workspace_id));
create policy impact_items_delete_admin on public.impact_items
for delete to authenticated using (private.can_administer_workspace(workspace_id));

create policy action_proposals_select_member on public.action_proposals
for select to authenticated using (private.is_workspace_member(workspace_id));
create policy action_proposals_insert_admin on public.action_proposals
for insert to authenticated with check (private.can_administer_workspace(workspace_id) and created_by = (select auth.uid()));
create policy action_proposals_update_admin on public.action_proposals
for update to authenticated using (private.can_administer_workspace(workspace_id)) with check (private.can_administer_workspace(workspace_id));

create policy proposal_actions_select_member on public.proposal_actions
for select to authenticated using (private.is_workspace_member(workspace_id));
create policy proposal_actions_insert_admin on public.proposal_actions
for insert to authenticated with check (private.can_administer_workspace(workspace_id));
create policy proposal_actions_update_admin on public.proposal_actions
for update to authenticated using (private.can_administer_workspace(workspace_id)) with check (private.can_administer_workspace(workspace_id));

create policy operation_logs_select_member on public.operation_logs
for select to authenticated using (private.is_workspace_member(workspace_id));
create policy operation_logs_insert_admin on public.operation_logs
for insert to authenticated with check (private.can_administer_workspace(workspace_id) and initiated_by = (select auth.uid()));

create policy operation_items_select_member on public.operation_items
for select to authenticated using (private.is_workspace_member(workspace_id));
create policy operation_items_insert_admin on public.operation_items
for insert to authenticated with check (private.can_administer_workspace(workspace_id));

create policy activity_events_select_member on public.activity_events
for select to authenticated using (private.is_workspace_member(workspace_id));
create policy activity_events_insert_admin on public.activity_events
for insert to authenticated with check (
  private.can_administer_workspace(workspace_id)
  and (actor_id is null or actor_id = (select auth.uid()))
);

-- Current Supabase projects revoke new public-table access by default. These
-- explicit grants expose only authenticated operations; RLS remains mandatory.
revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;
grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.workspaces to authenticated;
grant select, insert, update, delete on table public.workspace_members to authenticated;
grant select, insert, update, delete on table public.projects to authenticated;
grant select, insert, update, delete on table public.project_items to authenticated;
grant select, insert, update, delete on table public.item_dependencies to authenticated;
grant select, insert on table public.source_documents to authenticated;
grant select, insert, update on table public.change_events to authenticated;
grant select, insert, update on table public.impact_runs to authenticated;
grant select, insert, update, delete on table public.impact_items to authenticated;
grant select, insert, update on table public.action_proposals to authenticated;
grant select, insert, update on table public.proposal_actions to authenticated;
grant select, insert on table public.operation_logs to authenticated;
grant select, insert on table public.operation_items to authenticated;
grant select, insert on table public.activity_events to authenticated;

grant usage on type public.workspace_role to authenticated;
grant usage on type public.project_status to authenticated;
grant usage on type public.project_item_type to authenticated;
grant usage on type public.project_item_status to authenticated;
grant usage on type public.item_priority to authenticated;
grant usage on type public.dependency_relationship to authenticated;
grant usage on type public.change_event_state to authenticated;
grant usage on type public.impact_run_state to authenticated;
grant usage on type public.impact_severity to authenticated;
grant usage on type public.proposal_state to authenticated;
grant usage on type public.proposal_action_state to authenticated;
grant usage on type public.proposal_action_type to authenticated;
grant usage on type public.operation_type to authenticated;
grant usage on type public.operation_state to authenticated;
grant usage on type public.operation_item_state to authenticated;
