-- Keep the database authorization boundary aligned with the application guard:
-- Supabase anonymous Auth users assume the `authenticated` Postgres role, so
-- auth.uid() alone is not proof of an accepted InOrdo identity.

alter table public.project_items
  add constraint project_items_owner_workspace_member_fk
  foreign key (workspace_id, owner_id)
  references public.workspace_members (workspace_id, user_id)
  on delete restrict;

create index project_items_workspace_owner_idx
  on public.project_items (workspace_id, owner_id)
  where owner_id is not null;

create or replace function private.is_non_anonymous_user()
returns boolean
language sql
stable
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true';
$$;

create or replace function private.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_non_anonymous_user()
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
  select private.is_non_anonymous_user()
    and exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = target_workspace_id
        and wm.user_id = (select auth.uid())
        and wm.role in (
          'owner'::public.workspace_role,
          'admin'::public.workspace_role,
          'member'::public.workspace_role
        )
    );
$$;

create or replace function private.can_administer_workspace(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_non_anonymous_user()
    and exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = target_workspace_id
        and wm.user_id = (select auth.uid())
        and wm.role in (
          'owner'::public.workspace_role,
          'admin'::public.workspace_role
        )
    );
$$;

create or replace function private.is_workspace_owner(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_non_anonymous_user()
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
  select private.is_non_anonymous_user()
    and (
      private.is_workspace_owner(target_workspace_id)
      or (
        target_role in (
          'member'::public.workspace_role,
          'viewer'::public.workspace_role
        )
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
  select private.is_non_anonymous_user()
    and exists (
      select 1
      from public.workspace_members mine
      join public.workspace_members theirs
        on theirs.workspace_id = mine.workspace_id
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
  select private.is_non_anonymous_user()
    and (select auth.uid()) = target_user_id
    and target_role = 'owner'::public.workspace_role
    and exists (
      select 1
      from public.workspaces w
      where w.id = target_workspace_id
        and w.created_by = (select auth.uid())
    )
    and not exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = target_workspace_id
    );
$$;

alter policy profiles_select_workspace_peers on public.profiles
using (
  private.is_non_anonymous_user()
  and (id = (select auth.uid()) or private.shares_workspace(id))
);

alter policy profiles_update_self on public.profiles
using (private.is_non_anonymous_user() and id = (select auth.uid()))
with check (private.is_non_anonymous_user() and id = (select auth.uid()));

alter policy workspaces_insert_authenticated on public.workspaces
with check (
  private.is_non_anonymous_user()
  and created_by = (select auth.uid())
);

revoke all on function private.is_non_anonymous_user() from public, anon;
grant execute on function private.is_non_anonymous_user() to authenticated;
