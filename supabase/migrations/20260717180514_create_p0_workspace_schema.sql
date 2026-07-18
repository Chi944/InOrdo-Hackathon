-- InOrdo P0 workspace-scoped schema.
-- Dependency direction is intentionally fixed: from_item_id is the dependent
-- record and to_item_id is its upstream prerequisite or context record.

create extension if not exists pgcrypto with schema extensions;

create type public.workspace_role as enum ('owner', 'admin', 'member', 'viewer');
create type public.project_status as enum ('active', 'paused', 'completed', 'archived');
create type public.project_item_type as enum ('task', 'milestone', 'decision', 'event', 'risk', 'artifact');
create type public.project_item_status as enum ('not_started', 'in_progress', 'blocked', 'at_risk', 'completed', 'cancelled');
create type public.item_priority as enum ('low', 'medium', 'high', 'critical');
create type public.dependency_relationship as enum ('depends_on', 'requires', 'informs', 'scheduled_by');
create type public.change_event_state as enum ('needs_confirmation', 'confirmed', 'rejected', 'superseded');
create type public.impact_run_state as enum ('pending', 'completed', 'failed');
create type public.impact_severity as enum ('low', 'medium', 'high', 'critical');
create type public.proposal_state as enum ('draft', 'ready', 'partially_approved', 'approved', 'applied', 'rejected', 'superseded');
create type public.proposal_action_state as enum ('pending', 'approved', 'rejected', 'applied', 'stale');
create type public.proposal_action_type as enum ('update_item', 'create_item', 'add_dependency', 'remove_dependency');
create type public.operation_type as enum ('apply_proposal', 'undo', 'demo_reset');
create type public.operation_state as enum ('succeeded', 'failed');
create type public.operation_item_state as enum ('succeeded', 'failed', 'skipped');

create table public.profiles (
  -- Deliberately not a foreign key to auth.users: the public profile is a durable
  -- attribution record and must survive auth-account deletion. The auth trigger
  -- provisions matching IDs for real users; deterministic demo profiles have no
  -- login credential until an administrator explicitly provisions one.
  id uuid primary key,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 120),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete restrict,
  role public.workspace_role not null default 'member',
  invited_by uuid references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text,
  status public.project_status not null default 'active',
  is_demo boolean not null default false,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, slug)
);

create table public.project_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  item_key text not null check (item_key ~ '^[A-Z][A-Z0-9]*-[0-9]{2,}$'),
  item_type public.project_item_type not null,
  title text not null check (char_length(btrim(title)) between 1 and 240),
  description text,
  status public.project_item_status not null default 'not_started',
  priority public.item_priority not null default 'medium',
  owner_id uuid references public.profiles (id) on delete restrict,
  start_date date,
  due_date date,
  event_date date,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  version bigint not null default 1 check (version > 0),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_items_project_fk foreign key (workspace_id, project_id)
    references public.projects (workspace_id, id) on delete restrict,
  constraint project_items_date_order check (start_date is null or due_date is null or start_date <= due_date),
  constraint project_items_event_date_shape check (item_type = 'event' or event_date is null),
  unique (workspace_id, project_id, id),
  unique (workspace_id, project_id, item_key)
);
comment on column public.project_items.version is
  'Optimistic concurrency token. The database increments it on every actual UPDATE; callers must compare the expected version before mutation.';

create table public.item_dependencies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  from_item_id uuid not null,
  to_item_id uuid not null,
  relationship public.dependency_relationship not null default 'requires',
  rationale text,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint item_dependencies_project_fk foreign key (workspace_id, project_id)
    references public.projects (workspace_id, id) on delete restrict,
  constraint item_dependencies_from_fk foreign key (workspace_id, project_id, from_item_id)
    references public.project_items (workspace_id, project_id, id) on delete restrict,
  constraint item_dependencies_to_fk foreign key (workspace_id, project_id, to_item_id)
    references public.project_items (workspace_id, project_id, id) on delete restrict,
  constraint item_dependencies_not_self check (from_item_id <> to_item_id),
  unique (workspace_id, project_id, from_item_id, to_item_id, relationship)
);
comment on table public.item_dependencies is
  'Directed edges: from_item_id is dependent; to_item_id is the upstream prerequisite or context.';

create table public.source_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 240),
  source_kind text not null check (source_kind in ('pasted_update', 'manual_note', 'demo_fixture')),
  source_url text,
  raw_text text not null check (char_length(raw_text) between 1 and 50000),
  content_sha256 text generated always as (encode(extensions.digest(raw_text, 'sha256'), 'hex')) stored,
  occurred_at timestamptz,
  captured_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint source_documents_project_fk foreign key (workspace_id, project_id)
    references public.projects (workspace_id, id) on delete restrict,
  unique (workspace_id, project_id, id)
);
comment on table public.source_documents is
  'Immutable raw evidence and provenance. Corrections are represented by a new source document.';

create table public.change_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  source_document_id uuid not null,
  subject_item_id uuid not null,
  field_name text not null check (field_name ~ '^[a-z][a-z0-9_]*$'),
  previous_value jsonb,
  proposed_value jsonb not null,
  state public.change_event_state not null default 'needs_confirmation',
  confidence numeric(5,4) check (confidence between 0 and 1),
  model_name text,
  reviewed_by uuid references public.profiles (id) on delete restrict,
  reviewed_at timestamptz,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint change_events_project_fk foreign key (workspace_id, project_id)
    references public.projects (workspace_id, id) on delete restrict,
  constraint change_events_source_fk foreign key (workspace_id, project_id, source_document_id)
    references public.source_documents (workspace_id, project_id, id) on delete restrict,
  constraint change_events_item_fk foreign key (workspace_id, project_id, subject_item_id)
    references public.project_items (workspace_id, project_id, id) on delete restrict,
  constraint change_events_review_shape check (
    (state = 'needs_confirmation' and reviewed_by is null and reviewed_at is null)
    or (state <> 'needs_confirmation' and reviewed_by is not null and reviewed_at is not null)
  ),
  unique (workspace_id, project_id, id)
);

create table public.impact_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  change_event_id uuid not null,
  state public.impact_run_state not null default 'pending',
  max_depth integer not null default 25 check (max_depth between 1 and 100),
  error_message text,
  started_by uuid not null references public.profiles (id) on delete restrict,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint impact_runs_project_fk foreign key (workspace_id, project_id)
    references public.projects (workspace_id, id) on delete restrict,
  constraint impact_runs_change_fk foreign key (workspace_id, project_id, change_event_id)
    references public.change_events (workspace_id, project_id, id) on delete restrict,
  constraint impact_runs_state_shape check (
    (state = 'pending' and completed_at is null and error_message is null)
    or (state = 'completed' and completed_at is not null and error_message is null)
    or (state = 'failed' and completed_at is not null and error_message is not null)
  ),
  unique (workspace_id, project_id, id)
);

create table public.impact_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  impact_run_id uuid not null,
  item_id uuid not null,
  severity public.impact_severity not null,
  depth integer not null check (depth >= 0),
  path_item_ids uuid[] not null check (cardinality(path_item_ids) = depth + 1),
  explanation text not null check (char_length(btrim(explanation)) > 0),
  created_at timestamptz not null default now(),
  constraint impact_items_project_fk foreign key (workspace_id, project_id)
    references public.projects (workspace_id, id) on delete restrict,
  constraint impact_items_run_fk foreign key (workspace_id, project_id, impact_run_id)
    references public.impact_runs (workspace_id, project_id, id) on delete restrict,
  constraint impact_items_item_fk foreign key (workspace_id, project_id, item_id)
    references public.project_items (workspace_id, project_id, id) on delete restrict,
  unique (workspace_id, project_id, impact_run_id, item_id)
);

create table public.action_proposals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  change_event_id uuid not null,
  impact_run_id uuid,
  state public.proposal_state not null default 'draft',
  title text not null check (char_length(btrim(title)) between 1 and 240),
  rationale text not null,
  model_name text,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint action_proposals_project_fk foreign key (workspace_id, project_id)
    references public.projects (workspace_id, id) on delete restrict,
  constraint action_proposals_change_fk foreign key (workspace_id, project_id, change_event_id)
    references public.change_events (workspace_id, project_id, id) on delete restrict,
  constraint action_proposals_impact_fk foreign key (workspace_id, project_id, impact_run_id)
    references public.impact_runs (workspace_id, project_id, id) on delete restrict,
  unique (workspace_id, project_id, id)
);

create table public.proposal_actions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  proposal_id uuid not null,
  ordinal integer not null check (ordinal > 0),
  action_type public.proposal_action_type not null,
  state public.proposal_action_state not null default 'pending',
  target_item_id uuid,
  expected_item_version bigint check (expected_item_version is null or expected_item_version > 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  rationale text not null,
  reviewed_by uuid references public.profiles (id) on delete restrict,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint proposal_actions_project_fk foreign key (workspace_id, project_id)
    references public.projects (workspace_id, id) on delete restrict,
  constraint proposal_actions_proposal_fk foreign key (workspace_id, project_id, proposal_id)
    references public.action_proposals (workspace_id, project_id, id) on delete restrict,
  constraint proposal_actions_item_fk foreign key (workspace_id, project_id, target_item_id)
    references public.project_items (workspace_id, project_id, id) on delete restrict,
  constraint proposal_actions_review_shape check (
    (state = 'pending' and reviewed_by is null and reviewed_at is null)
    or (state <> 'pending' and reviewed_by is not null and reviewed_at is not null)
  ),
  constraint proposal_actions_target_shape check (
    (action_type = 'create_item' and target_item_id is null and expected_item_version is null)
    or (action_type <> 'create_item' and target_item_id is not null)
  ),
  unique (workspace_id, project_id, proposal_id, ordinal),
  unique (workspace_id, project_id, id)
);

create table public.operation_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  operation_type public.operation_type not null,
  state public.operation_state not null,
  idempotency_key text not null check (char_length(btrim(idempotency_key)) between 8 and 200),
  proposal_id uuid,
  reverses_operation_id uuid,
  initiated_by uuid not null references public.profiles (id) on delete restrict,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz not null default now(),
  constraint operation_logs_project_fk foreign key (workspace_id, project_id)
    references public.projects (workspace_id, id) on delete restrict,
  constraint operation_logs_proposal_fk foreign key (workspace_id, project_id, proposal_id)
    references public.action_proposals (workspace_id, project_id, id) on delete restrict,
  constraint operation_logs_reverse_fk foreign key (workspace_id, project_id, reverses_operation_id)
    references public.operation_logs (workspace_id, project_id, id) on delete restrict,
  constraint operation_logs_state_shape check (
    (state = 'succeeded' and error_message is null)
    or (state = 'failed' and error_message is not null)
  ),
  constraint operation_logs_reverse_shape check (
    (operation_type = 'undo' and reverses_operation_id is not null)
    or (operation_type <> 'undo' and reverses_operation_id is null)
  ),
  unique (workspace_id, idempotency_key),
  unique (workspace_id, project_id, id)
);
comment on table public.operation_logs is
  'Append-only operation headers. Undo is a compensating operation that references history; history is never deleted.';

create table public.operation_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  operation_id uuid not null,
  proposal_action_id uuid,
  item_id uuid,
  ordinal integer not null check (ordinal > 0),
  state public.operation_item_state not null,
  before_state jsonb,
  after_state jsonb,
  expected_item_version bigint check (expected_item_version is null or expected_item_version > 0),
  resulting_item_version bigint check (resulting_item_version is null or resulting_item_version > 0),
  reversible boolean not null default false,
  reverse_payload jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  constraint operation_items_project_fk foreign key (workspace_id, project_id)
    references public.projects (workspace_id, id) on delete restrict,
  constraint operation_items_operation_fk foreign key (workspace_id, project_id, operation_id)
    references public.operation_logs (workspace_id, project_id, id) on delete restrict,
  constraint operation_items_action_fk foreign key (workspace_id, project_id, proposal_action_id)
    references public.proposal_actions (workspace_id, project_id, id) on delete restrict,
  constraint operation_items_item_fk foreign key (workspace_id, project_id, item_id)
    references public.project_items (workspace_id, project_id, id) on delete restrict,
  constraint operation_items_state_shape check (
    (state = 'failed' and error_message is not null)
    or (state <> 'failed' and error_message is null)
  ),
  constraint operation_items_version_shape check (
    resulting_item_version is null
    or expected_item_version is null
    or resulting_item_version > expected_item_version
  ),
  constraint operation_items_reverse_shape check (
    (reversible and reverse_payload is not null and before_state is not null)
    or (not reversible and reverse_payload is null)
  ),
  unique (workspace_id, project_id, operation_id, ordinal)
);
comment on table public.operation_items is
  'Append-only per-action before/after snapshots supporting attribution and compensating undo.';

create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  actor_id uuid references public.profiles (id) on delete restrict,
  event_type text not null check (event_type ~ '^[a-z][a-z0-9_.]*$'),
  entity_type text not null check (entity_type ~ '^[a-z][a-z0-9_]*$'),
  entity_id uuid not null,
  summary text not null check (char_length(btrim(summary)) between 1 and 500),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now(),
  constraint activity_events_project_fk foreign key (workspace_id, project_id)
    references public.projects (workspace_id, id) on delete restrict
);
comment on table public.activity_events is
  'Append-only, workspace-scoped dashboard activity; it is supplemental audit context, not authorization state.';

create index workspace_members_user_idx on public.workspace_members (user_id, workspace_id);
create index workspace_members_invited_by_idx on public.workspace_members (invited_by) where invited_by is not null;
create index workspaces_created_by_idx on public.workspaces (created_by);
create index projects_workspace_status_idx on public.projects (workspace_id, status, updated_at desc);
create index projects_created_by_idx on public.projects (created_by);
create index project_items_project_status_due_idx on public.project_items (workspace_id, project_id, status, due_date);
create index project_items_project_type_idx on public.project_items (workspace_id, project_id, item_type);
create index project_items_owner_idx on public.project_items (owner_id) where owner_id is not null;
create index project_items_created_by_idx on public.project_items (created_by);
create index item_dependencies_from_idx on public.item_dependencies (workspace_id, project_id, from_item_id);
create index item_dependencies_to_idx on public.item_dependencies (workspace_id, project_id, to_item_id);
create index item_dependencies_created_by_idx on public.item_dependencies (created_by);
create index source_documents_project_order_idx on public.source_documents (workspace_id, project_id, created_at desc);
create index source_documents_hash_idx on public.source_documents (workspace_id, project_id, content_sha256);
create index source_documents_captured_by_idx on public.source_documents (captured_by);
create index change_events_source_idx on public.change_events (workspace_id, project_id, source_document_id, created_at desc);
create index change_events_subject_idx on public.change_events (workspace_id, project_id, subject_item_id, created_at desc);
create index change_events_created_by_idx on public.change_events (created_by);
create index change_events_reviewed_by_idx on public.change_events (reviewed_by) where reviewed_by is not null;
create index impact_runs_change_idx on public.impact_runs (workspace_id, project_id, change_event_id, started_at desc);
create index impact_runs_started_by_idx on public.impact_runs (started_by);
create index impact_items_item_idx on public.impact_items (workspace_id, project_id, item_id);
create index action_proposals_status_idx on public.action_proposals (workspace_id, project_id, state, updated_at desc);
create index action_proposals_change_idx on public.action_proposals (workspace_id, project_id, change_event_id);
create index action_proposals_impact_idx on public.action_proposals (workspace_id, project_id, impact_run_id) where impact_run_id is not null;
create index action_proposals_created_by_idx on public.action_proposals (created_by);
create index proposal_actions_status_idx on public.proposal_actions (workspace_id, project_id, proposal_id, state, ordinal);
create index proposal_actions_item_idx on public.proposal_actions (workspace_id, project_id, target_item_id) where target_item_id is not null;
create index proposal_actions_reviewed_by_idx on public.proposal_actions (reviewed_by) where reviewed_by is not null;
create index operation_logs_project_order_idx on public.operation_logs (workspace_id, project_id, created_at desc);
create index operation_logs_proposal_idx on public.operation_logs (workspace_id, project_id, proposal_id) where proposal_id is not null;
create index operation_logs_initiated_by_idx on public.operation_logs (initiated_by);
create index operation_logs_reverse_idx on public.operation_logs (workspace_id, project_id, reverses_operation_id) where reverses_operation_id is not null;
create index operation_items_operation_idx on public.operation_items (workspace_id, project_id, operation_id, ordinal);
create index operation_items_action_idx on public.operation_items (workspace_id, project_id, proposal_action_id) where proposal_action_id is not null;
create index operation_items_item_idx on public.operation_items (workspace_id, project_id, item_id) where item_id is not null;
create index activity_events_project_order_idx on public.activity_events (workspace_id, project_id, created_at desc);
create index activity_events_actor_idx on public.activity_events (actor_id) where actor_id is not null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.bump_project_item_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.version := old.version + 1;
  return new;
end;
$$;

create or replace function public.reject_immutable_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '55000';
end;
$$;

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
  if old.role = 'owner'::public.workspace_role then
    if tg_op = 'DELETE'
       or (tg_op = 'UPDATE' and new.role <> 'owner'::public.workspace_role) then
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
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger workspaces_set_updated_at before update on public.workspaces
for each row execute function public.set_updated_at();
create trigger workspace_members_set_updated_at before update on public.workspace_members
for each row execute function public.set_updated_at();
create trigger workspace_members_protect_final_owner
before update or delete on public.workspace_members
for each row execute function public.protect_final_workspace_owner();
create trigger projects_set_updated_at before update on public.projects
for each row execute function public.set_updated_at();
create trigger project_items_bump_version before update on public.project_items
for each row execute function public.bump_project_item_version();
create trigger change_events_set_updated_at before update on public.change_events
for each row execute function public.set_updated_at();
create trigger action_proposals_set_updated_at before update on public.action_proposals
for each row execute function public.set_updated_at();
create trigger proposal_actions_set_updated_at before update on public.proposal_actions
for each row execute function public.set_updated_at();

create trigger source_documents_immutable before update or delete on public.source_documents
for each row execute function public.reject_immutable_change();
create trigger operation_logs_immutable before update or delete on public.operation_logs
for each row execute function public.reject_immutable_change();
create trigger operation_items_immutable before update or delete on public.operation_items
for each row execute function public.reject_immutable_change();
create trigger activity_events_immutable before update or delete on public.activity_events
for each row execute function public.reject_immutable_change();

revoke all on function public.set_updated_at() from public;
revoke all on function public.bump_project_item_version() from public;
revoke all on function public.reject_immutable_change() from public;
revoke all on function public.protect_final_workspace_owner() from public;
