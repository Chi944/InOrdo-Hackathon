-- Prompt 9: atomic human-approved operations, append-only audit, compensating
-- undo, and a history-preserving deterministic demo reset.

alter table public.projects
  add column workflow_generation bigint not null default 1
    check (workflow_generation > 0);

alter table public.project_items
  add column is_demo_retired boolean not null default false;

alter table public.source_documents
  add column workflow_generation bigint not null default 1
    check (workflow_generation > 0);
alter table public.analysis_requests
  add column workflow_generation bigint not null default 1
    check (workflow_generation > 0);
alter table public.change_events
  add column workflow_generation bigint not null default 1
    check (workflow_generation > 0);
alter table public.impact_runs
  add column workflow_generation bigint not null default 1
    check (workflow_generation > 0);
alter table public.impact_items
  add column workflow_generation bigint not null default 1
    check (workflow_generation > 0);
alter table public.action_proposals
  add column workflow_generation bigint not null default 1
    check (workflow_generation > 0);
alter table public.proposal_actions
  add column workflow_generation bigint not null default 1
    check (workflow_generation > 0);
alter table public.operation_logs
  add column workflow_generation bigint not null default 1
    check (workflow_generation > 0),
  add column request_hash text,
  add column result_metadata jsonb,
  add column error_code text,
  add column reversible boolean not null default false;
alter table public.operation_items
  add column workflow_generation bigint not null default 1
    check (workflow_generation > 0),
  add column error_code text;
alter table public.activity_events
  add column workflow_generation bigint not null default 1
    check (workflow_generation > 0);

-- The existing audit trigger correctly rejects application updates. Disable it
-- only for this one migration-owned legacy backfill, then restore it before any
-- new operation path exists. A transaction failure rolls both changes back.
alter table public.operation_logs disable trigger operation_logs_immutable;

update public.operation_logs
set request_hash = pg_catalog.encode(
      extensions.digest(pg_catalog.convert_to(id::text, 'UTF8'), 'sha256'),
      'hex'
    ),
    result_metadata = pg_catalog.jsonb_build_object('legacy', true),
    error_code = case when state = 'failed' then 'legacy_failure' else null end;

alter table public.operation_logs enable trigger operation_logs_immutable;

alter table public.operation_logs
  alter column request_hash set not null,
  alter column result_metadata set not null,
  add constraint operation_logs_request_hash_shape check (
    request_hash ~ '^[0-9a-f]{64}$'
  ),
  add constraint operation_logs_result_metadata_shape check (
    pg_catalog.jsonb_typeof(result_metadata) = 'object'
  ),
  add constraint operation_logs_error_code_shape check (
    (state = 'succeeded' and error_code is null)
    or (
      state = 'failed'
      and error_code is not null
      and error_code ~ '^[a-z][a-z0-9_]*$'
    )
  );

alter table public.operation_items
  add constraint operation_items_error_code_shape check (
    (state = 'failed' and error_code is not null)
    or (state <> 'failed' and error_code is null)
  );

create unique index operation_logs_one_successful_undo_idx
  on public.operation_logs (
    workspace_id,
    project_id,
    reverses_operation_id
  )
  where operation_type = 'undo'
    and state = 'succeeded';
create index operation_logs_generation_order_idx
  on public.operation_logs (
    workspace_id,
    project_id,
    workflow_generation,
    created_at desc,
    id desc
  );
create index operation_logs_reset_rate_idx
  on public.operation_logs (
    workspace_id,
    project_id,
    operation_type,
    created_at desc
  )
  where operation_type = 'demo_reset'
    and state = 'succeeded';
create index project_items_active_demo_idx
  on public.project_items (workspace_id, project_id, item_key)
  where not is_demo_retired;
create index source_documents_generation_idx
  on public.source_documents (
    workspace_id,
    project_id,
    workflow_generation,
    created_at desc
  );
create index impact_runs_generation_idx
  on public.impact_runs (
    workspace_id,
    project_id,
    workflow_generation,
    started_at desc
  );
create index action_proposals_generation_idx
  on public.action_proposals (
    workspace_id,
    project_id,
    workflow_generation,
    updated_at desc
  );

create or replace function private.assign_project_workflow_generation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_generation bigint;
begin
  select project.workflow_generation
  into current_generation
  from public.projects as project
  where project.workspace_id = new.workspace_id
    and project.id = new.project_id;

  if current_generation is null then
    raise exception 'project generation is unavailable' using errcode = '23503';
  end if;
  new.workflow_generation := current_generation;
  return new;
end;
$$;

create trigger source_documents_assign_generation
before insert on public.source_documents
for each row execute function private.assign_project_workflow_generation();
create trigger analysis_requests_assign_generation
before insert on public.analysis_requests
for each row execute function private.assign_project_workflow_generation();
create trigger change_events_assign_generation
before insert on public.change_events
for each row execute function private.assign_project_workflow_generation();
create trigger impact_runs_assign_generation
before insert on public.impact_runs
for each row execute function private.assign_project_workflow_generation();
create trigger impact_items_assign_generation
before insert on public.impact_items
for each row execute function private.assign_project_workflow_generation();
create trigger action_proposals_assign_generation
before insert on public.action_proposals
for each row execute function private.assign_project_workflow_generation();
create trigger proposal_actions_assign_generation
before insert on public.proposal_actions
for each row execute function private.assign_project_workflow_generation();
create trigger operation_logs_assign_generation
before insert on public.operation_logs
for each row execute function private.assign_project_workflow_generation();
create trigger operation_items_assign_generation
before insert on public.operation_items
for each row execute function private.assign_project_workflow_generation();
create trigger activity_events_assign_generation
before insert on public.activity_events
for each row execute function private.assign_project_workflow_generation();

create table private.demo_baseline_project_items (
  project_id uuid not null,
  item_id uuid not null,
  workspace_id uuid not null,
  item_key text not null,
  item_type public.project_item_type not null,
  title text not null,
  description text,
  status public.project_item_status not null,
  priority public.item_priority not null,
  owner_id uuid,
  start_date date,
  due_date date,
  event_date date,
  metadata jsonb not null,
  created_by uuid not null,
  created_at timestamptz not null,
  primary key (project_id, item_id),
  unique (project_id, item_key)
);

create table private.demo_baseline_dependencies (
  project_id uuid not null,
  dependency_id uuid not null,
  workspace_id uuid not null,
  from_item_id uuid not null,
  to_item_id uuid not null,
  relationship public.dependency_relationship not null,
  rationale text,
  created_by uuid not null,
  created_at timestamptz not null,
  primary key (project_id, dependency_id),
  unique (
    project_id,
    from_item_id,
    to_item_id,
    relationship
  )
);

insert into private.demo_baseline_project_items (
  project_id, item_id, workspace_id, item_key, item_type, title, description,
  status, priority, owner_id, start_date, due_date, event_date, metadata,
  created_by, created_at
)
select
  item.project_id, item.id, item.workspace_id, item.item_key, item.item_type,
  item.title, item.description, item.status, item.priority, item.owner_id,
  item.start_date, item.due_date, item.event_date, item.metadata,
  item.created_by, item.created_at
from public.project_items as item
join public.projects as project
  on project.workspace_id = item.workspace_id
 and project.id = item.project_id
join public.workspaces as workspace
  on workspace.id = project.workspace_id
where project.is_demo
  and project.slug = 'regional-climate-action-summit-2026'
  and workspace.slug = 'civic-futures-lab-demo';

insert into private.demo_baseline_dependencies (
  project_id, dependency_id, workspace_id, from_item_id, to_item_id,
  relationship, rationale, created_by, created_at
)
select
  dependency.project_id, dependency.id, dependency.workspace_id,
  dependency.from_item_id, dependency.to_item_id, dependency.relationship,
  dependency.rationale, dependency.created_by, dependency.created_at
from public.item_dependencies as dependency
join public.projects as project
  on project.workspace_id = dependency.workspace_id
 and project.id = dependency.project_id
join public.workspaces as workspace
  on workspace.id = project.workspace_id
where project.is_demo
  and project.slug = 'regional-climate-action-summit-2026'
  and workspace.slug = 'civic-futures-lab-demo';

revoke all on table private.demo_baseline_project_items
  from public, anon, authenticated, service_role;
revoke all on table private.demo_baseline_dependencies
  from public, anon, authenticated, service_role;

create or replace function private.compute_project_revision(
  target_workspace_id uuid,
  target_project_id uuid
)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  project_generation bigint;
  item_count integer;
  edge_count integer;
  canonical_items text;
  canonical_edges text;
  canonical_graph text;
begin
  select project.workflow_generation
  into project_generation
  from public.projects as project
  where project.workspace_id = target_workspace_id
    and project.id = target_project_id;
  if project_generation is null then
    raise exception 'project revision is unavailable' using errcode = '23503';
  end if;

  select
    pg_catalog.count(*)::integer,
    coalesce(
      pg_catalog.string_agg(
        item.id::text || ':' || item.version::text,
        E'\n' order by item.id::text collate "C"
      ),
      ''
    )
  into item_count, canonical_items
  from public.project_items as item
  where item.workspace_id = target_workspace_id
    and item.project_id = target_project_id
    and not item.is_demo_retired
    and item.status in (
      'not_started'::public.project_item_status,
      'in_progress'::public.project_item_status,
      'blocked'::public.project_item_status,
      'at_risk'::public.project_item_status
    );

  if item_count > 200 then
    raise exception 'project graph exceeds the supported item bound'
      using errcode = '54000';
  end if;

  with active_items as (
    select item.id
    from public.project_items as item
    where item.workspace_id = target_workspace_id
      and item.project_id = target_project_id
      and not item.is_demo_retired
      and item.status in (
        'not_started'::public.project_item_status,
        'in_progress'::public.project_item_status,
        'blocked'::public.project_item_status,
        'at_risk'::public.project_item_status
      )
  ),
  normalized_edges as (
    select distinct dependency.from_item_id, dependency.to_item_id
    from public.item_dependencies as dependency
    join active_items as dependent on dependent.id = dependency.from_item_id
    join active_items as upstream on upstream.id = dependency.to_item_id
    where dependency.workspace_id = target_workspace_id
      and dependency.project_id = target_project_id
      and dependency.from_item_id <> dependency.to_item_id
  )
  select
    pg_catalog.count(*)::integer,
    coalesce(
      pg_catalog.string_agg(
        edge.from_item_id::text || ':' || edge.to_item_id::text,
        E'\n' order by
          edge.from_item_id::text collate "C",
          edge.to_item_id::text collate "C"
      ),
      ''
    )
  into edge_count, canonical_edges
  from normalized_edges as edge;

  if edge_count > 1000 then
    raise exception 'project graph exceeds the supported dependency bound'
      using errcode = '54000';
  end if;

  canonical_graph := 'impact-graph-v2' || E'\ngeneration\n'
    || project_generation::text || E'\nitems\n'
    || canonical_items || E'\nedges\n' || canonical_edges;

  return pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(canonical_graph, 'UTF8'),
      'sha256'
    ),
    'hex'
  );
end;
$$;

comment on column public.projects.workflow_generation is
  'Monotonic reset generation. Current P0 views default to this generation; prior immutable audit rows remain available as archived history.';
comment on column public.project_items.is_demo_retired is
  'History-preserving demo reset marker. Retired nonbaseline items are hidden from canonical project-record views and never hard-deleted by reset.';
comment on table private.demo_baseline_project_items is
  'Server-private deterministic reset snapshot for the named synthetic demo project.';

drop policy project_items_select_member on public.project_items;
drop policy project_items_insert_contributor on public.project_items;
drop policy project_items_update_contributor on public.project_items;
drop policy project_items_delete_contributor on public.project_items;
create policy project_items_select_member on public.project_items
for select to authenticated
using (
  private.is_workspace_member(workspace_id)
  and not is_demo_retired
);
create policy project_items_insert_contributor on public.project_items
for insert to authenticated
with check (
  private.can_manage_records(workspace_id)
  and created_by = (select auth.uid())
  and not is_demo_retired
);
create policy project_items_update_contributor on public.project_items
for update to authenticated
using (
  private.can_manage_records(workspace_id)
  and not is_demo_retired
)
with check (
  private.can_manage_records(workspace_id)
  and not is_demo_retired
);
create policy project_items_delete_contributor on public.project_items
for delete to authenticated
using (
  private.can_manage_records(workspace_id)
  and not is_demo_retired
);

revoke insert, update on table public.projects from authenticated;
grant insert (
  id, workspace_id, name, slug, description, status, created_by
) on table public.projects to authenticated;
grant update (
  name, slug, description, status
) on table public.projects to authenticated;

revoke insert, update on table public.project_items from authenticated;
grant insert (
  id, workspace_id, project_id, item_key, item_type, title, description,
  status, priority, owner_id, start_date, due_date, event_date, metadata,
  created_by
) on table public.project_items to authenticated;
grant update (
  item_key, item_type, title, description, status, priority, owner_id,
  start_date, due_date, event_date, metadata
) on table public.project_items to authenticated;

create or replace function private.guard_active_dependency_items()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.project_items as item
    where item.workspace_id = new.workspace_id
      and item.project_id = new.project_id
      and item.id = new.from_item_id
      and not item.is_demo_retired
  ) or not exists (
    select 1
    from public.project_items as item
    where item.workspace_id = new.workspace_id
      and item.project_id = new.project_id
      and item.id = new.to_item_id
      and not item.is_demo_retired
  ) then
    raise exception 'dependency endpoint is unavailable' using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger item_dependencies_guard_active_items
before insert or update on public.item_dependencies
for each row execute function private.guard_active_dependency_items();

create or replace function private.operation_request_hash(payload jsonb)
returns text
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(payload::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  );
$$;

create or replace function private.is_valid_operation_idempotency_key(
  candidate text
)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select candidate is not null
    and pg_catalog.char_length(candidate) between 8 and 200
    and candidate ~ '^[A-Za-z0-9._:-]+$';
$$;

create or replace function private.is_valid_operation_item_value(
  field_name text,
  candidate jsonb,
  item_type public.project_item_type
)
returns boolean
language plpgsql
stable
set search_path = ''
as $$
begin
  case field_name
    when 'title' then
      return pg_catalog.jsonb_typeof(candidate) = 'string'
        and pg_catalog.char_length(pg_catalog.btrim(candidate #>> '{}'))
          between 1 and 240;
    when 'description' then
      return candidate = 'null'::jsonb
        or (
          pg_catalog.jsonb_typeof(candidate) = 'string'
          and pg_catalog.char_length(candidate #>> '{}') <= 10000
        );
    when 'status' then
      return pg_catalog.jsonb_typeof(candidate) = 'string'
        and candidate #>> '{}' in (
          'not_started', 'in_progress', 'blocked', 'at_risk',
          'completed', 'cancelled'
        );
    when 'priority' then
      return pg_catalog.jsonb_typeof(candidate) = 'string'
        and candidate #>> '{}' in ('low', 'medium', 'high', 'critical');
    when 'owner_id' then
      return candidate = 'null'::jsonb
        or (
          pg_catalog.jsonb_typeof(candidate) = 'string'
          and private.is_uuid_text(candidate #>> '{}')
        );
    when 'start_date', 'due_date' then
      return private.is_iso_date_json(candidate);
    when 'event_date' then
      return private.is_iso_date_json(candidate)
        and (candidate = 'null'::jsonb or item_type = 'event');
    else
      return false;
  end case;
end;
$$;

create or replace function private.update_allowlisted_project_item_field(
  target_workspace_id uuid,
  target_project_id uuid,
  target_item_id uuid,
  field_name text,
  field_value jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  resulting_version bigint;
begin
  update public.project_items as item
  set
    title = case
      when field_name = 'title' then field_value #>> '{}'
      else item.title
    end,
    description = case
      when field_name = 'description' then case
        when field_value = 'null'::jsonb then null
        else field_value #>> '{}'
      end
      else item.description
    end,
    status = case
      when field_name = 'status'
        then (field_value #>> '{}')::public.project_item_status
      else item.status
    end,
    priority = case
      when field_name = 'priority'
        then (field_value #>> '{}')::public.item_priority
      else item.priority
    end,
    owner_id = case
      when field_name = 'owner_id' then case
        when field_value = 'null'::jsonb then null
        else (field_value #>> '{}')::uuid
      end
      else item.owner_id
    end,
    start_date = case
      when field_name = 'start_date' then case
        when field_value = 'null'::jsonb then null
        else (field_value #>> '{}')::date
      end
      else item.start_date
    end,
    due_date = case
      when field_name = 'due_date' then case
        when field_value = 'null'::jsonb then null
        else (field_value #>> '{}')::date
      end
      else item.due_date
    end,
    event_date = case
      when field_name = 'event_date' then case
        when field_value = 'null'::jsonb then null
        else (field_value #>> '{}')::date
      end
      else item.event_date
    end
  where item.workspace_id = target_workspace_id
    and item.project_id = target_project_id
    and item.id = target_item_id
    and not item.is_demo_retired
  returning item.version into resulting_version;

  if resulting_version is null then
    raise exception 'operation target is unavailable' using errcode = '40001';
  end if;
  return resulting_version;
end;
$$;

create or replace function private.record_operation_failure(
  target_workspace_id uuid,
  target_project_id uuid,
  target_operation_type public.operation_type,
  target_idempotency_key text,
  target_request_hash text,
  target_proposal_id uuid,
  target_reverses_operation_id uuid,
  actor_id uuid,
  safe_error_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  operation_id uuid;
begin
  insert into public.operation_logs (
    workspace_id, project_id, operation_type, state, idempotency_key,
    request_hash, proposal_id, reverses_operation_id, initiated_by,
    error_message, error_code, result_metadata, reversible
  ) values (
    target_workspace_id, target_project_id, target_operation_type, 'failed',
    target_idempotency_key, target_request_hash, target_proposal_id,
    target_reverses_operation_id, actor_id,
    'The operation was rejected without changing project data.',
    safe_error_code,
    pg_catalog.jsonb_build_object('error_code', safe_error_code),
    false
  )
  returning id into operation_id;

  return pg_catalog.jsonb_build_object(
    'status', 'failed',
    'operation_id', operation_id,
    'error_code', safe_error_code
  );
end;
$$;

create or replace function private.apply_project_proposal_internal(
  p_project_id uuid,
  p_proposal_id uuid,
  p_selected_action_ids uuid[],
  p_human_inputs jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  actor_id uuid := (select auth.uid());
  target_workspace_id uuid;
  current_generation bigint;
  proposal_row public.action_proposals%rowtype;
  action_row public.proposal_actions%rowtype;
  target_item public.project_items%rowtype;
  existing_operation public.operation_logs%rowtype;
  request_hash text;
  selected_ids_json jsonb;
  normalized_human_inputs jsonb;
  human_input jsonb;
  selected_count integer;
  matched_count integer;
  operation_id uuid;
  resulting_version bigint;
  before_value jsonb;
  after_value jsonb;
  operation_ordinal integer := 0;
  created_item_id uuid;
  created_item_key text;
  item_prefix text;
  next_item_number integer;
  all_reversible boolean := true;
  pending_count integer;
  proposed_start_date date;
  proposed_due_date date;
begin
  if actor_id is null
     or coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select project.workspace_id, project.workflow_generation
  into target_workspace_id, current_generation
  from public.projects as project
  join public.workspace_members as membership
    on membership.workspace_id = project.workspace_id
   and membership.user_id = actor_id
   and membership.role in (
     'owner'::public.workspace_role,
     'admin'::public.workspace_role
   )
  where project.id = p_project_id
  for update of project;

  if target_workspace_id is null then
    raise exception 'operation authorization failed' using errcode = '42501';
  end if;
  if not private.is_valid_operation_idempotency_key(p_idempotency_key) then
    raise exception 'invalid operation request' using errcode = '22023';
  end if;

  select proposal.* into proposal_row
  from public.action_proposals as proposal
  where proposal.workspace_id = target_workspace_id
    and proposal.project_id = p_project_id
    and proposal.id = p_proposal_id
    and proposal.workflow_generation = current_generation
  for update;
  if not found then
    raise exception 'operation authorization failed' using errcode = '42501';
  end if;

  select
    coalesce(pg_catalog.jsonb_agg(selected.id order by selected.id), '[]'::jsonb),
    pg_catalog.count(*)::integer
  into selected_ids_json, selected_count
  from pg_catalog.unnest(coalesce(p_selected_action_ids, array[]::uuid[]))
    as selected(id);

  request_hash := private.operation_request_hash(
    pg_catalog.jsonb_build_object(
      'operation_type', 'apply_proposal',
      'project_id', p_project_id,
      'proposal_id', p_proposal_id,
      'selected_action_ids', selected_ids_json,
      'human_inputs', coalesce(p_human_inputs, 'null'::jsonb)
    )
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      target_workspace_id::text || ':' || p_idempotency_key,
      0
    )
  );
  select operation.* into existing_operation
  from public.operation_logs as operation
  where operation.workspace_id = target_workspace_id
    and operation.idempotency_key = p_idempotency_key
  for update;
  if found then
    if existing_operation.operation_type <> 'apply_proposal'
       or existing_operation.project_id <> p_project_id
       or existing_operation.proposal_id is distinct from p_proposal_id
       or existing_operation.request_hash <> request_hash then
      raise exception 'operation idempotency conflict' using errcode = '40001';
    end if;
    if existing_operation.state = 'failed' then
      return pg_catalog.jsonb_build_object(
        'status', 'failed',
        'operation_id', existing_operation.id,
        'error_code', existing_operation.error_code
      );
    end if;
    return pg_catalog.jsonb_build_object(
      'status', 'duplicate',
      'operation_id', existing_operation.id,
      'applied_action_ids',
        existing_operation.result_metadata -> 'applied_action_ids'
    );
  end if;

  if selected_count not between 1 and 50
     or selected_count <> (
       select pg_catalog.count(distinct selected.id)::integer
       from pg_catalog.unnest(
         coalesce(p_selected_action_ids, array[]::uuid[])
       ) as selected(id)
     ) then
    return private.record_operation_failure(
      target_workspace_id, p_project_id, 'apply_proposal',
      p_idempotency_key, request_hash, p_proposal_id, null, actor_id,
      'invalid_action'
    );
  end if;

  if p_human_inputs is null
     or pg_catalog.jsonb_typeof(p_human_inputs) <> 'array'
     or pg_catalog.jsonb_array_length(p_human_inputs) > 50
     or exists (
       select 1
       from pg_catalog.jsonb_array_elements(p_human_inputs) as input(value)
       where not private.jsonb_object_matches(
         input.value,
         array['action_id', 'confirmed', 'response'],
         array['action_id', 'confirmed', 'response']
       )
       or not private.is_uuid_text(input.value ->> 'action_id')
       or input.value -> 'confirmed' <> 'true'::jsonb
       or pg_catalog.jsonb_typeof(input.value -> 'response') <> 'string'
       or pg_catalog.char_length(
         pg_catalog.btrim(input.value ->> 'response')
       ) not between 1 and 2000
     ) then
    return private.record_operation_failure(
      target_workspace_id, p_project_id, 'apply_proposal',
      p_idempotency_key, request_hash, p_proposal_id, null, actor_id,
      'invalid_payload'
    );
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(input.value order by input.value ->> 'action_id'),
    '[]'::jsonb
  )
  into normalized_human_inputs
  from pg_catalog.jsonb_array_elements(p_human_inputs) as input(value);

  if (select pg_catalog.count(*)
      from pg_catalog.jsonb_array_elements(normalized_human_inputs))
     <> (select pg_catalog.count(distinct input.value ->> 'action_id')
         from pg_catalog.jsonb_array_elements(normalized_human_inputs)
           as input(value))
     or exists (
       select 1
       from pg_catalog.jsonb_array_elements(normalized_human_inputs)
         as input(value)
       where not ((input.value ->> 'action_id')::uuid = any(
         p_selected_action_ids
       ))
     ) then
    return private.record_operation_failure(
      target_workspace_id, p_project_id, 'apply_proposal',
      p_idempotency_key, request_hash, p_proposal_id, null, actor_id,
      'invalid_payload'
    );
  end if;

  perform action.id
  from public.proposal_actions as action
  where action.workspace_id = target_workspace_id
    and action.project_id = p_project_id
    and action.proposal_id = p_proposal_id
    and action.id = any(p_selected_action_ids)
  order by action.id
  for update;
  select pg_catalog.count(*)::integer into matched_count
  from public.proposal_actions as action
  where action.workspace_id = target_workspace_id
    and action.project_id = p_project_id
    and action.proposal_id = p_proposal_id
    and action.id = any(p_selected_action_ids);
  if matched_count <> selected_count
     or proposal_row.state not in (
       'ready'::public.proposal_state,
       'partially_approved'::public.proposal_state
     ) then
    return private.record_operation_failure(
      target_workspace_id, p_project_id, 'apply_proposal',
      p_idempotency_key, request_hash, p_proposal_id, null, actor_id,
      'invalid_action'
    );
  end if;

  perform item.id
  from public.project_items as item
  join public.proposal_actions as action
    on action.workspace_id = item.workspace_id
   and action.project_id = item.project_id
   and action.target_item_id = item.id
  where action.workspace_id = target_workspace_id
    and action.project_id = p_project_id
    and action.proposal_id = p_proposal_id
    and action.id = any(p_selected_action_ids)
  order by item.id
  for update of item;

  for action_row in
    select action.*
    from public.proposal_actions as action
    where action.workspace_id = target_workspace_id
      and action.project_id = p_project_id
      and action.proposal_id = p_proposal_id
      and action.id = any(p_selected_action_ids)
    order by action.ordinal, action.id
  loop
    if action_row.state <> 'pending'
       or action_row.workflow_generation <> current_generation then
      return private.record_operation_failure(
        target_workspace_id, p_project_id, 'apply_proposal',
        p_idempotency_key, request_hash, p_proposal_id, null, actor_id,
        'invalid_action'
      );
    end if;

    select input.value into human_input
    from pg_catalog.jsonb_array_elements(normalized_human_inputs)
      as input(value)
    where input.value ->> 'action_id' = action_row.id::text;

    if pg_catalog.jsonb_typeof(action_row.payload -> 'requires_human_input')
         <> 'boolean'
       or (
         action_row.payload -> 'requires_human_input' = 'true'::jsonb
         and human_input is null
       ) then
      return private.record_operation_failure(
        target_workspace_id, p_project_id, 'apply_proposal',
        p_idempotency_key, request_hash, p_proposal_id, null, actor_id,
        'human_input_required'
      );
    end if;
    if action_row.payload -> 'requires_human_input' = 'false'::jsonb
       and human_input is not null then
      return private.record_operation_failure(
        target_workspace_id, p_project_id, 'apply_proposal',
        p_idempotency_key, request_hash, p_proposal_id, null, actor_id,
        'invalid_payload'
      );
    end if;

    if pg_catalog.jsonb_typeof(action_row.payload -> 'confidence') <> 'number'
       or (action_row.payload ->> 'confidence')::numeric not between 0 and 1
       or not private.is_uuid_text(
         action_row.payload ->> 'linked_impact_item_id'
       )
       or not exists (
         select 1 from public.project_items as linked_item
         where linked_item.workspace_id = target_workspace_id
           and linked_item.project_id = p_project_id
           and linked_item.id = (
             action_row.payload ->> 'linked_impact_item_id'
           )::uuid
           and not linked_item.is_demo_retired
       ) then
      return private.record_operation_failure(
        target_workspace_id, p_project_id, 'apply_proposal',
        p_idempotency_key, request_hash, p_proposal_id, null, actor_id,
        'invalid_payload'
      );
    end if;

    if action_row.action_type = 'update_item' then
      if not private.jsonb_object_matches(
           action_row.payload,
           array[
             'prompt_action_type', 'field_name', 'proposed_value',
             'linked_impact_item_id', 'confidence', 'requires_human_input'
           ],
           array[
             'prompt_action_type', 'field_name', 'proposed_value',
             'linked_impact_item_id', 'confidence', 'requires_human_input'
           ]
         )
         or action_row.payload ->> 'prompt_action_type' <> 'update_item_field'
         or action_row.target_item_id is null
         or action_row.expected_item_version is null then
        return private.record_operation_failure(
          target_workspace_id, p_project_id, 'apply_proposal',
          p_idempotency_key, request_hash, p_proposal_id, null, actor_id,
          'invalid_payload'
        );
      end if;

      select item.* into target_item
      from public.project_items as item
      where item.workspace_id = target_workspace_id
        and item.project_id = p_project_id
        and item.id = action_row.target_item_id
        and not item.is_demo_retired;
      if not found
         or target_item.version <> action_row.expected_item_version then
        return private.record_operation_failure(
          target_workspace_id, p_project_id, 'apply_proposal',
          p_idempotency_key, request_hash, p_proposal_id, null, actor_id,
          'stale_target'
        );
      end if;
      if not private.is_valid_operation_item_value(
        action_row.payload ->> 'field_name',
        action_row.payload -> 'proposed_value',
        target_item.item_type
      ) then
        return private.record_operation_failure(
          target_workspace_id, p_project_id, 'apply_proposal',
          p_idempotency_key, request_hash, p_proposal_id, null, actor_id,
          'invalid_payload'
        );
      end if;
      if action_row.payload ->> 'field_name' = 'owner_id'
         and action_row.payload -> 'proposed_value' <> 'null'::jsonb
         and not exists (
           select 1 from public.workspace_members as membership
           where membership.workspace_id = target_workspace_id
             and membership.user_id = (
               action_row.payload ->> 'proposed_value'
             )::uuid
         ) then
        return private.record_operation_failure(
          target_workspace_id, p_project_id, 'apply_proposal',
          p_idempotency_key, request_hash, p_proposal_id, null, actor_id,
          'invalid_payload'
        );
      end if;
      proposed_start_date := case
        when action_row.payload ->> 'field_name' = 'start_date' then case
          when action_row.payload -> 'proposed_value' = 'null'::jsonb then null
          else (action_row.payload ->> 'proposed_value')::date
        end
        else target_item.start_date
      end;
      proposed_due_date := case
        when action_row.payload ->> 'field_name' = 'due_date' then case
          when action_row.payload -> 'proposed_value' = 'null'::jsonb then null
          else (action_row.payload ->> 'proposed_value')::date
        end
        else target_item.due_date
      end;
      if proposed_start_date is not null
         and proposed_due_date is not null
         and proposed_start_date > proposed_due_date then
        return private.record_operation_failure(
          target_workspace_id, p_project_id, 'apply_proposal',
          p_idempotency_key, request_hash, p_proposal_id, null, actor_id,
          'invalid_payload'
        );
      end if;
    elsif action_row.action_type = 'create_item' then
      all_reversible := false;
      if not private.jsonb_object_matches(
           action_row.payload,
           array[
             'prompt_action_type', 'item_type', 'title', 'description',
             'priority', 'owner_id', 'start_date', 'due_date',
             'linked_impact_item_id', 'confidence', 'requires_human_input'
           ],
           array[
             'prompt_action_type', 'item_type', 'title', 'description',
             'priority', 'owner_id', 'start_date', 'due_date',
             'linked_impact_item_id', 'confidence', 'requires_human_input'
           ]
         )
         or action_row.target_item_id is not null
         or action_row.expected_item_version is not null
         or not (
           (action_row.payload ->> 'prompt_action_type' = 'create_task'
             and action_row.payload ->> 'item_type' = 'task')
           or
           (action_row.payload ->> 'prompt_action_type' = 'create_risk'
             and action_row.payload ->> 'item_type' = 'risk')
         )
         or pg_catalog.jsonb_typeof(action_row.payload -> 'title') <> 'string'
         or pg_catalog.char_length(
           pg_catalog.btrim(action_row.payload ->> 'title')
         ) not between 1 and 240
         or not (
           action_row.payload -> 'description' = 'null'::jsonb
           or (
             pg_catalog.jsonb_typeof(action_row.payload -> 'description')
               = 'string'
             and pg_catalog.char_length(
               action_row.payload ->> 'description'
             ) <= 10000
           )
         )
         or action_row.payload ->> 'priority'
           not in ('low', 'medium', 'high', 'critical')
         or not private.is_iso_date_json(action_row.payload -> 'start_date')
         or not private.is_iso_date_json(action_row.payload -> 'due_date')
         or not (
           action_row.payload -> 'owner_id' = 'null'::jsonb
           or private.is_uuid_text(action_row.payload ->> 'owner_id')
         ) then
        return private.record_operation_failure(
          target_workspace_id, p_project_id, 'apply_proposal',
          p_idempotency_key, request_hash, p_proposal_id, null, actor_id,
          'invalid_payload'
        );
      end if;
      if action_row.payload -> 'owner_id' <> 'null'::jsonb
         and not exists (
           select 1 from public.workspace_members as membership
           where membership.workspace_id = target_workspace_id
             and membership.user_id = (
               action_row.payload ->> 'owner_id'
             )::uuid
         ) then
        return private.record_operation_failure(
          target_workspace_id, p_project_id, 'apply_proposal',
          p_idempotency_key, request_hash, p_proposal_id, null, actor_id,
          'invalid_payload'
        );
      end if;
      proposed_start_date := case
        when action_row.payload -> 'start_date' = 'null'::jsonb then null
        else (action_row.payload ->> 'start_date')::date
      end;
      proposed_due_date := case
        when action_row.payload -> 'due_date' = 'null'::jsonb then null
        else (action_row.payload ->> 'due_date')::date
      end;
      if proposed_start_date is not null
         and proposed_due_date is not null
         and proposed_start_date > proposed_due_date then
        return private.record_operation_failure(
          target_workspace_id, p_project_id, 'apply_proposal',
          p_idempotency_key, request_hash, p_proposal_id, null, actor_id,
          'invalid_payload'
        );
      end if;
    elsif action_row.action_type = 'request_confirmation' then
      all_reversible := false;
      if not private.jsonb_object_matches(
           action_row.payload,
           array[
             'prompt_action_type', 'question', 'linked_impact_item_id',
             'confidence', 'requires_human_input'
           ],
           array[
             'prompt_action_type', 'question', 'linked_impact_item_id',
             'confidence', 'requires_human_input'
           ]
         )
         or action_row.payload ->> 'prompt_action_type'
           <> 'request_confirmation'
         or action_row.payload -> 'requires_human_input' <> 'true'::jsonb
         or action_row.target_item_id is null
         or action_row.expected_item_version is not null
         or pg_catalog.jsonb_typeof(action_row.payload -> 'question')
           <> 'string'
         or pg_catalog.char_length(
           pg_catalog.btrim(action_row.payload ->> 'question')
         ) not between 1 and 1000
         or not exists (
           select 1 from public.project_items as item
           where item.workspace_id = target_workspace_id
             and item.project_id = p_project_id
             and item.id = action_row.target_item_id
             and not item.is_demo_retired
         ) then
        return private.record_operation_failure(
          target_workspace_id, p_project_id, 'apply_proposal',
          p_idempotency_key, request_hash, p_proposal_id, null, actor_id,
          'invalid_payload'
        );
      end if;
    else
      return private.record_operation_failure(
        target_workspace_id, p_project_id, 'apply_proposal',
        p_idempotency_key, request_hash, p_proposal_id, null, actor_id,
        'invalid_action'
      );
    end if;
  end loop;

  insert into public.operation_logs (
    workspace_id, project_id, operation_type, state, idempotency_key,
    request_hash, proposal_id, initiated_by, result_metadata, reversible
  ) values (
    target_workspace_id, p_project_id, 'apply_proposal', 'succeeded',
    p_idempotency_key, request_hash, p_proposal_id, actor_id,
    pg_catalog.jsonb_build_object(
      'applied_action_ids', selected_ids_json
    ),
    all_reversible
  )
  returning id into operation_id;

  for action_row in
    select action.*
    from public.proposal_actions as action
    where action.workspace_id = target_workspace_id
      and action.project_id = p_project_id
      and action.proposal_id = p_proposal_id
      and action.id = any(p_selected_action_ids)
    order by action.ordinal, action.id
  loop
    operation_ordinal := operation_ordinal + 1;
    select input.value into human_input
    from pg_catalog.jsonb_array_elements(normalized_human_inputs)
      as input(value)
    where input.value ->> 'action_id' = action_row.id::text;

    update public.proposal_actions
    set state = 'approved', reviewed_by = actor_id, reviewed_at = now()
    where id = action_row.id;

    if action_row.action_type = 'update_item' then
      before_value := private.current_project_item_field_value(
        target_workspace_id,
        p_project_id,
        action_row.target_item_id,
        action_row.payload ->> 'field_name'
      );
      resulting_version := private.update_allowlisted_project_item_field(
        target_workspace_id,
        p_project_id,
        action_row.target_item_id,
        action_row.payload ->> 'field_name',
        action_row.payload -> 'proposed_value'
      );
      after_value := private.current_project_item_field_value(
        target_workspace_id,
        p_project_id,
        action_row.target_item_id,
        action_row.payload ->> 'field_name'
      );

      insert into public.operation_items (
        workspace_id, project_id, operation_id, proposal_action_id, item_id,
        ordinal, state, before_state, after_state, expected_item_version,
        resulting_item_version, reversible, reverse_payload
      ) values (
        target_workspace_id, p_project_id, operation_id, action_row.id,
        action_row.target_item_id, operation_ordinal, 'succeeded',
        pg_catalog.jsonb_build_object(
          'field_name', action_row.payload ->> 'field_name',
          'value', before_value,
          'version', action_row.expected_item_version
        ),
        pg_catalog.jsonb_build_object(
          'field_name', action_row.payload ->> 'field_name',
          'value', after_value,
          'version', resulting_version
        ),
        action_row.expected_item_version, resulting_version, true,
        pg_catalog.jsonb_build_object(
          'field_name', action_row.payload ->> 'field_name',
          'value', before_value,
          'expected_after_value', after_value,
          'expected_version', resulting_version
        )
      );
    elsif action_row.action_type = 'create_item' then
      item_prefix := case action_row.payload ->> 'item_type'
        when 'task' then 'TSK'
        else 'RSK'
      end;
      select coalesce(
        pg_catalog.max(
          pg_catalog.regexp_replace(
            item.item_key,
            '^.*-',
            ''
          )::integer
        ),
        0
      ) + 1
      into next_item_number
      from public.project_items as item
      where item.workspace_id = target_workspace_id
        and item.project_id = p_project_id
        and item.item_key ~ ('^' || item_prefix || '-[0-9]+$');
      created_item_key := item_prefix || '-'
        || pg_catalog.lpad(next_item_number::text, 2, '0');

      insert into public.project_items (
        workspace_id, project_id, item_key, item_type, title, description,
        status, priority, owner_id, start_date, due_date, metadata, created_by
      ) values (
        target_workspace_id, p_project_id, created_item_key,
        (action_row.payload ->> 'item_type')::public.project_item_type,
        action_row.payload ->> 'title',
        case when action_row.payload -> 'description' = 'null'::jsonb
          then null else action_row.payload ->> 'description' end,
        'not_started',
        (action_row.payload ->> 'priority')::public.item_priority,
        case when action_row.payload -> 'owner_id' = 'null'::jsonb
          then null else (action_row.payload ->> 'owner_id')::uuid end,
        case when action_row.payload -> 'start_date' = 'null'::jsonb
          then null else (action_row.payload ->> 'start_date')::date end,
        case when action_row.payload -> 'due_date' = 'null'::jsonb
          then null else (action_row.payload ->> 'due_date')::date end,
        '{}'::jsonb,
        actor_id
      )
      returning id, version into created_item_id, resulting_version;

      insert into public.operation_items (
        workspace_id, project_id, operation_id, proposal_action_id, item_id,
        ordinal, state, after_state, resulting_item_version, reversible
      ) values (
        target_workspace_id, p_project_id, operation_id, action_row.id,
        created_item_id, operation_ordinal, 'succeeded',
        pg_catalog.jsonb_build_object(
          'item_id', created_item_id,
          'item_key', created_item_key,
          'item_type', action_row.payload ->> 'item_type',
          'version', resulting_version
        ),
        resulting_version, false
      );
    else
      insert into public.activity_events (
        workspace_id, project_id, actor_id, event_type, entity_type,
        entity_id, summary, details
      ) values (
        target_workspace_id, p_project_id, actor_id,
        'proposal.confirmation_recorded', 'proposal_action', action_row.id,
        'A reviewer recorded the requested confirmation.',
        pg_catalog.jsonb_build_object(
          'confirmed', true,
          'response', human_input ->> 'response'
        )
      );
      insert into public.operation_items (
        workspace_id, project_id, operation_id, proposal_action_id, item_id,
        ordinal, state, after_state, reversible
      ) values (
        target_workspace_id, p_project_id, operation_id, action_row.id,
        action_row.target_item_id, operation_ordinal, 'succeeded',
        pg_catalog.jsonb_build_object('confirmation_recorded', true),
        false
      );
    end if;

    update public.proposal_actions
    set state = 'applied'
    where id = action_row.id;
  end loop;

  select pg_catalog.count(*)::integer into pending_count
  from public.proposal_actions as action
  where action.workspace_id = target_workspace_id
    and action.project_id = p_project_id
    and action.proposal_id = p_proposal_id
    and action.state = 'pending';
  update public.action_proposals
  set state = case when pending_count = 0
    then 'applied'::public.proposal_state
    else 'partially_approved'::public.proposal_state
  end
  where id = p_proposal_id;

  update public.change_events
  set state = 'confirmed', reviewed_by = actor_id, reviewed_at = now()
  where workspace_id = target_workspace_id
    and project_id = p_project_id
    and id = proposal_row.change_event_id
    and state = 'needs_confirmation';

  insert into public.activity_events (
    workspace_id, project_id, actor_id, event_type, entity_type, entity_id,
    summary, details
  ) values (
    target_workspace_id, p_project_id, actor_id,
    'proposal.actions_applied', 'operation', operation_id,
    'Approved recovery actions were applied.',
    pg_catalog.jsonb_build_object(
      'proposal_id', p_proposal_id,
      'action_count', selected_count,
      'reversible', all_reversible
    )
  );

  return pg_catalog.jsonb_build_object(
    'status', 'succeeded',
    'operation_id', operation_id,
    'applied_action_ids', selected_ids_json
  );
end;
$$;

create or replace function private.undo_project_operation_internal(
  p_project_id uuid,
  p_operation_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  actor_id uuid := (select auth.uid());
  target_workspace_id uuid;
  current_generation bigint;
  original_operation public.operation_logs%rowtype;
  existing_operation public.operation_logs%rowtype;
  original_item public.operation_items%rowtype;
  target_item public.project_items%rowtype;
  request_hash text;
  operation_id uuid;
  operation_ordinal integer := 0;
  before_value jsonb;
  after_value jsonb;
  resulting_version bigint;
  original_item_count integer;
begin
  if actor_id is null
     or coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select project.workspace_id, project.workflow_generation
  into target_workspace_id, current_generation
  from public.projects as project
  join public.workspace_members as membership
    on membership.workspace_id = project.workspace_id
   and membership.user_id = actor_id
   and membership.role in (
     'owner'::public.workspace_role,
     'admin'::public.workspace_role
   )
  where project.id = p_project_id
  for update of project;
  if target_workspace_id is null then
    raise exception 'operation authorization failed' using errcode = '42501';
  end if;
  if not private.is_valid_operation_idempotency_key(p_idempotency_key) then
    raise exception 'invalid operation request' using errcode = '22023';
  end if;

  select operation.* into original_operation
  from public.operation_logs as operation
  where operation.workspace_id = target_workspace_id
    and operation.project_id = p_project_id
    and operation.id = p_operation_id
  for update;
  if not found then
    raise exception 'operation authorization failed' using errcode = '42501';
  end if;

  request_hash := private.operation_request_hash(
    pg_catalog.jsonb_build_object(
      'operation_type', 'undo',
      'project_id', p_project_id,
      'operation_id', p_operation_id
    )
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      target_workspace_id::text || ':' || p_idempotency_key,
      0
    )
  );
  select operation.* into existing_operation
  from public.operation_logs as operation
  where operation.workspace_id = target_workspace_id
    and operation.idempotency_key = p_idempotency_key
  for update;
  if found then
    if existing_operation.operation_type <> 'undo'
       or existing_operation.project_id <> p_project_id
       or existing_operation.reverses_operation_id is distinct from p_operation_id
       or existing_operation.request_hash <> request_hash then
      raise exception 'operation idempotency conflict' using errcode = '40001';
    end if;
    if existing_operation.state = 'failed' then
      return pg_catalog.jsonb_build_object(
        'status', 'failed',
        'operation_id', existing_operation.id,
        'error_code', existing_operation.error_code
      );
    end if;
    return pg_catalog.jsonb_build_object(
      'status', 'duplicate',
      'operation_id', existing_operation.id,
      'reverses_operation_id', p_operation_id
    );
  end if;

  if original_operation.operation_type <> 'apply_proposal'
     or original_operation.state <> 'succeeded'
     or not original_operation.reversible
     or original_operation.workflow_generation <> current_generation
     or exists (
       select 1 from public.operation_logs as reversal
       where reversal.workspace_id = target_workspace_id
         and reversal.project_id = p_project_id
         and reversal.operation_type = 'undo'
         and reversal.state = 'succeeded'
         and reversal.reverses_operation_id = p_operation_id
     ) then
    return private.record_operation_failure(
      target_workspace_id, p_project_id, 'undo', p_idempotency_key,
      request_hash, original_operation.proposal_id, p_operation_id, actor_id,
      'not_reversible'
    );
  end if;

  perform item.id
  from public.project_items as item
  join public.operation_items as operation_item
    on operation_item.workspace_id = item.workspace_id
   and operation_item.project_id = item.project_id
   and operation_item.item_id = item.id
  where operation_item.workspace_id = target_workspace_id
    and operation_item.project_id = p_project_id
    and operation_item.operation_id = p_operation_id
  order by item.id
  for update of item;

  select pg_catalog.count(*)::integer into original_item_count
  from public.operation_items as operation_item
  where operation_item.workspace_id = target_workspace_id
    and operation_item.project_id = p_project_id
    and operation_item.operation_id = p_operation_id
    and operation_item.state = 'succeeded'
    and operation_item.reversible;
  if original_item_count = 0
     or original_item_count <> (
       select pg_catalog.count(*)::integer
       from public.operation_items as operation_item
       where operation_item.workspace_id = target_workspace_id
         and operation_item.project_id = p_project_id
         and operation_item.operation_id = p_operation_id
     ) then
    return private.record_operation_failure(
      target_workspace_id, p_project_id, 'undo', p_idempotency_key,
      request_hash, original_operation.proposal_id, p_operation_id, actor_id,
      'not_reversible'
    );
  end if;

  for original_item in
    select operation_item.*
    from public.operation_items as operation_item
    where operation_item.workspace_id = target_workspace_id
      and operation_item.project_id = p_project_id
      and operation_item.operation_id = p_operation_id
    order by operation_item.ordinal desc, operation_item.id desc
  loop
    select item.* into target_item
    from public.project_items as item
    where item.workspace_id = target_workspace_id
      and item.project_id = p_project_id
      and item.id = original_item.item_id
      and not item.is_demo_retired;
    if not found
       or target_item.version <> original_item.resulting_item_version
       or private.current_project_item_field_value(
         target_workspace_id,
         p_project_id,
         original_item.item_id,
         original_item.after_state ->> 'field_name'
       ) is distinct from original_item.after_state -> 'value' then
      return private.record_operation_failure(
        target_workspace_id, p_project_id, 'undo', p_idempotency_key,
        request_hash, original_operation.proposal_id, p_operation_id, actor_id,
        'undo_conflict'
      );
    end if;
  end loop;

  insert into public.operation_logs (
    workspace_id, project_id, operation_type, state, idempotency_key,
    request_hash, proposal_id, reverses_operation_id, initiated_by,
    result_metadata, reversible
  ) values (
    target_workspace_id, p_project_id, 'undo', 'succeeded',
    p_idempotency_key, request_hash, original_operation.proposal_id,
    p_operation_id, actor_id,
    pg_catalog.jsonb_build_object('reverses_operation_id', p_operation_id),
    false
  )
  returning id into operation_id;

  for original_item in
    select operation_item.*
    from public.operation_items as operation_item
    where operation_item.workspace_id = target_workspace_id
      and operation_item.project_id = p_project_id
      and operation_item.operation_id = p_operation_id
    order by operation_item.ordinal desc, operation_item.id desc
  loop
    operation_ordinal := operation_ordinal + 1;
    before_value := private.current_project_item_field_value(
      target_workspace_id,
      p_project_id,
      original_item.item_id,
      original_item.reverse_payload ->> 'field_name'
    );
    select item.* into target_item
    from public.project_items as item
    where item.workspace_id = target_workspace_id
      and item.project_id = p_project_id
      and item.id = original_item.item_id;
    resulting_version := private.update_allowlisted_project_item_field(
      target_workspace_id,
      p_project_id,
      original_item.item_id,
      original_item.reverse_payload ->> 'field_name',
      original_item.reverse_payload -> 'value'
    );
    after_value := private.current_project_item_field_value(
      target_workspace_id,
      p_project_id,
      original_item.item_id,
      original_item.reverse_payload ->> 'field_name'
    );

    insert into public.operation_items (
      workspace_id, project_id, operation_id, proposal_action_id, item_id,
      ordinal, state, before_state, after_state, expected_item_version,
      resulting_item_version, reversible
    ) values (
      target_workspace_id, p_project_id, operation_id,
      original_item.proposal_action_id, original_item.item_id,
      operation_ordinal, 'succeeded',
      pg_catalog.jsonb_build_object(
        'field_name', original_item.reverse_payload ->> 'field_name',
        'value', before_value,
        'version', target_item.version
      ),
      pg_catalog.jsonb_build_object(
        'field_name', original_item.reverse_payload ->> 'field_name',
        'value', after_value,
        'version', resulting_version
      ),
      target_item.version, resulting_version, false
    );
  end loop;

  insert into public.activity_events (
    workspace_id, project_id, actor_id, event_type, entity_type, entity_id,
    summary, details
  ) values (
    target_workspace_id, p_project_id, actor_id,
    'operation.undone', 'operation', operation_id,
    'An approved project operation was undone.',
    pg_catalog.jsonb_build_object(
      'reverses_operation_id', p_operation_id,
      'item_count', original_item_count
    )
  );

  return pg_catalog.jsonb_build_object(
    'status', 'succeeded',
    'operation_id', operation_id,
    'reverses_operation_id', p_operation_id
  );
end;
$$;

create or replace function private.reset_demo_project_internal(
  p_project_id uuid,
  p_project_slug text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  actor_id uuid := (select auth.uid());
  target_workspace_id uuid;
  current_generation bigint;
  existing_operation public.operation_logs%rowtype;
  request_hash text;
  operation_id uuid;
  baseline_item_count integer;
  baseline_dependency_count integer;
begin
  if actor_id is null
     or coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select project.workspace_id, project.workflow_generation
  into target_workspace_id, current_generation
  from public.projects as project
  join public.workspace_members as membership
    on membership.workspace_id = project.workspace_id
   and membership.user_id = actor_id
   and membership.role in (
     'owner'::public.workspace_role,
     'admin'::public.workspace_role
   )
  where project.id = p_project_id
    and project.is_demo
    and project.slug = p_project_slug
  for update of project;
  if target_workspace_id is null then
    raise exception 'demo reset authorization failed' using errcode = '42501';
  end if;
  if not private.is_valid_operation_idempotency_key(p_idempotency_key) then
    raise exception 'invalid operation request' using errcode = '22023';
  end if;

  select pg_catalog.count(*)::integer into baseline_item_count
  from private.demo_baseline_project_items as baseline
  where baseline.workspace_id = target_workspace_id
    and baseline.project_id = p_project_id;
  select pg_catalog.count(*)::integer into baseline_dependency_count
  from private.demo_baseline_dependencies as baseline
  where baseline.workspace_id = target_workspace_id
    and baseline.project_id = p_project_id;
  if baseline_item_count <> 24 or baseline_dependency_count <> 26 then
    raise exception 'demo reset baseline is unavailable' using errcode = '42501';
  end if;

  request_hash := private.operation_request_hash(
    pg_catalog.jsonb_build_object(
      'operation_type', 'demo_reset',
      'project_id', p_project_id,
      'project_slug', p_project_slug
    )
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      target_workspace_id::text || ':' || p_idempotency_key,
      0
    )
  );
  select operation.* into existing_operation
  from public.operation_logs as operation
  where operation.workspace_id = target_workspace_id
    and operation.idempotency_key = p_idempotency_key
  for update;
  if found then
    if existing_operation.operation_type <> 'demo_reset'
       or existing_operation.project_id <> p_project_id
       or existing_operation.request_hash <> request_hash then
      raise exception 'operation idempotency conflict' using errcode = '40001';
    end if;
    if existing_operation.state = 'failed' then
      return pg_catalog.jsonb_build_object(
        'status', 'failed',
        'operation_id', existing_operation.id,
        'error_code', existing_operation.error_code
      );
    end if;
    return pg_catalog.jsonb_build_object(
      'status', 'duplicate',
      'operation_id', existing_operation.id,
      'project_id', p_project_id
    );
  end if;

  if exists (
    select 1 from public.operation_logs as recent_reset
    where recent_reset.workspace_id = target_workspace_id
      and recent_reset.project_id = p_project_id
      and recent_reset.operation_type = 'demo_reset'
      and recent_reset.state = 'succeeded'
      and recent_reset.created_at > now() - interval '60 seconds'
  ) then
    return private.record_operation_failure(
      target_workspace_id, p_project_id, 'demo_reset', p_idempotency_key,
      request_hash, null, null, actor_id, 'rate_limited'
    );
  end if;

  insert into public.operation_logs (
    workspace_id, project_id, operation_type, state, idempotency_key,
    request_hash, initiated_by, result_metadata, reversible
  ) values (
    target_workspace_id, p_project_id, 'demo_reset', 'succeeded',
    p_idempotency_key, request_hash, actor_id,
    pg_catalog.jsonb_build_object('project_id', p_project_id),
    false
  )
  returning id into operation_id;

  update public.project_items as item
  set status = 'cancelled', is_demo_retired = true
  where item.workspace_id = target_workspace_id
    and item.project_id = p_project_id
    and not exists (
      select 1
      from private.demo_baseline_project_items as baseline
      where baseline.project_id = p_project_id
        and baseline.item_id = item.id
    )
    and (
      not item.is_demo_retired
      or item.status <> 'cancelled'::public.project_item_status
    );

  insert into public.project_items (
    id, workspace_id, project_id, item_key, item_type, title, description,
    status, priority, owner_id, start_date, due_date, event_date, metadata,
    created_by, created_at, is_demo_retired
  )
  select
    baseline.item_id, baseline.workspace_id, baseline.project_id,
    baseline.item_key, baseline.item_type, baseline.title,
    baseline.description, baseline.status, baseline.priority,
    baseline.owner_id, baseline.start_date, baseline.due_date,
    baseline.event_date, baseline.metadata, baseline.created_by,
    baseline.created_at, false
  from private.demo_baseline_project_items as baseline
  where baseline.workspace_id = target_workspace_id
    and baseline.project_id = p_project_id
  on conflict (id) do update
  set
    workspace_id = excluded.workspace_id,
    project_id = excluded.project_id,
    item_key = excluded.item_key,
    item_type = excluded.item_type,
    title = excluded.title,
    description = excluded.description,
    status = excluded.status,
    priority = excluded.priority,
    owner_id = excluded.owner_id,
    start_date = excluded.start_date,
    due_date = excluded.due_date,
    event_date = excluded.event_date,
    metadata = excluded.metadata,
    created_by = excluded.created_by,
    created_at = excluded.created_at,
    is_demo_retired = false
  where public.project_items.workspace_id = excluded.workspace_id
    and public.project_items.project_id = excluded.project_id
    and (
      public.project_items.item_key,
      public.project_items.item_type,
      public.project_items.title,
      public.project_items.description,
      public.project_items.status,
      public.project_items.priority,
      public.project_items.owner_id,
      public.project_items.start_date,
      public.project_items.due_date,
      public.project_items.event_date,
      public.project_items.metadata,
      public.project_items.created_by,
      public.project_items.created_at,
      public.project_items.is_demo_retired
    ) is distinct from (
      excluded.item_key,
      excluded.item_type,
      excluded.title,
      excluded.description,
      excluded.status,
      excluded.priority,
      excluded.owner_id,
      excluded.start_date,
      excluded.due_date,
      excluded.event_date,
      excluded.metadata,
      excluded.created_by,
      excluded.created_at,
      false
    );

  delete from public.item_dependencies as dependency
  where dependency.workspace_id = target_workspace_id
    and dependency.project_id = p_project_id;
  insert into public.item_dependencies (
    id, workspace_id, project_id, from_item_id, to_item_id, relationship,
    rationale, created_by, created_at
  )
  select
    baseline.dependency_id, baseline.workspace_id, baseline.project_id,
    baseline.from_item_id, baseline.to_item_id, baseline.relationship,
    baseline.rationale, baseline.created_by, baseline.created_at
  from private.demo_baseline_dependencies as baseline
  where baseline.workspace_id = target_workspace_id
    and baseline.project_id = p_project_id
  order by baseline.dependency_id;

  insert into public.activity_events (
    workspace_id, project_id, actor_id, event_type, entity_type, entity_id,
    summary, details
  ) values (
    target_workspace_id, p_project_id, actor_id,
    'demo.reset_completed', 'operation', operation_id,
    'The synthetic demo project was restored to its deterministic baseline.',
    pg_catalog.jsonb_build_object(
      'previous_generation', current_generation,
      'next_generation', current_generation + 1,
      'baseline_item_count', baseline_item_count,
      'baseline_dependency_count', baseline_dependency_count
    )
  );

  update public.projects
  set workflow_generation = current_generation + 1
  where workspace_id = target_workspace_id
    and id = p_project_id;

  return pg_catalog.jsonb_build_object(
    'status', 'succeeded',
    'operation_id', operation_id,
    'project_id', p_project_id
  );
end;
$$;

create function public.apply_project_proposal(
  p_actor_id uuid,
  p_project_id uuid,
  p_proposal_id uuid,
  p_selected_action_ids uuid[],
  p_human_inputs jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  original_sub text := pg_catalog.current_setting(
    'request.jwt.claim.sub', true
  );
  original_claims text := pg_catalog.current_setting(
    'request.jwt.claims', true
  );
  result jsonb;
begin
  if p_actor_id is null
     or coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'server authorization required' using errcode = '42501';
  end if;
  perform pg_catalog.set_config('request.jwt.claim.sub', p_actor_id::text, true);
  perform pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object(
      'sub', p_actor_id,
      'role', 'authenticated',
      'is_anonymous', false
    )::text,
    true
  );
  begin
    result := private.apply_project_proposal_internal(
      p_project_id,
      p_proposal_id,
      p_selected_action_ids,
      p_human_inputs,
      p_idempotency_key
    );
  exception when others then
    perform pg_catalog.set_config(
      'request.jwt.claim.sub', coalesce(original_sub, ''), true
    );
    perform pg_catalog.set_config(
      'request.jwt.claims', coalesce(original_claims, '{}'), true
    );
    raise;
  end;
  perform pg_catalog.set_config(
    'request.jwt.claim.sub', coalesce(original_sub, ''), true
  );
  perform pg_catalog.set_config(
    'request.jwt.claims', coalesce(original_claims, '{}'), true
  );
  return result;
end;
$$;

create function public.undo_project_operation(
  p_actor_id uuid,
  p_project_id uuid,
  p_operation_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  original_sub text := pg_catalog.current_setting(
    'request.jwt.claim.sub', true
  );
  original_claims text := pg_catalog.current_setting(
    'request.jwt.claims', true
  );
  result jsonb;
begin
  if p_actor_id is null
     or coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'server authorization required' using errcode = '42501';
  end if;
  perform pg_catalog.set_config('request.jwt.claim.sub', p_actor_id::text, true);
  perform pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object(
      'sub', p_actor_id,
      'role', 'authenticated',
      'is_anonymous', false
    )::text,
    true
  );
  begin
    result := private.undo_project_operation_internal(
      p_project_id,
      p_operation_id,
      p_idempotency_key
    );
  exception when others then
    perform pg_catalog.set_config(
      'request.jwt.claim.sub', coalesce(original_sub, ''), true
    );
    perform pg_catalog.set_config(
      'request.jwt.claims', coalesce(original_claims, '{}'), true
    );
    raise;
  end;
  perform pg_catalog.set_config(
    'request.jwt.claim.sub', coalesce(original_sub, ''), true
  );
  perform pg_catalog.set_config(
    'request.jwt.claims', coalesce(original_claims, '{}'), true
  );
  return result;
end;
$$;

create function public.reset_demo_project(
  p_actor_id uuid,
  p_project_id uuid,
  p_project_slug text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  original_sub text := pg_catalog.current_setting(
    'request.jwt.claim.sub', true
  );
  original_claims text := pg_catalog.current_setting(
    'request.jwt.claims', true
  );
  result jsonb;
begin
  if p_actor_id is null
     or coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'server authorization required' using errcode = '42501';
  end if;
  perform pg_catalog.set_config('request.jwt.claim.sub', p_actor_id::text, true);
  perform pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object(
      'sub', p_actor_id,
      'role', 'authenticated',
      'is_anonymous', false
    )::text,
    true
  );
  begin
    result := private.reset_demo_project_internal(
      p_project_id,
      p_project_slug,
      p_idempotency_key
    );
  exception when others then
    perform pg_catalog.set_config(
      'request.jwt.claim.sub', coalesce(original_sub, ''), true
    );
    perform pg_catalog.set_config(
      'request.jwt.claims', coalesce(original_claims, '{}'), true
    );
    raise;
  end;
  perform pg_catalog.set_config(
    'request.jwt.claim.sub', coalesce(original_sub, ''), true
  );
  perform pg_catalog.set_config(
    'request.jwt.claims', coalesce(original_claims, '{}'), true
  );
  return result;
end;
$$;

revoke all on function private.assign_project_workflow_generation()
  from public, anon, authenticated, service_role;
revoke all on function private.guard_active_dependency_items()
  from public, anon, authenticated, service_role;
revoke all on function private.operation_request_hash(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.is_valid_operation_idempotency_key(text)
  from public, anon, authenticated, service_role;
revoke all on function private.is_valid_operation_item_value(
  text, jsonb, public.project_item_type
) from public, anon, authenticated, service_role;
revoke all on function private.update_allowlisted_project_item_field(
  uuid, uuid, uuid, text, jsonb
) from public, anon, authenticated, service_role;
revoke all on function private.record_operation_failure(
  uuid, uuid, public.operation_type, text, text, uuid, uuid, uuid, text
) from public, anon, authenticated, service_role;
revoke all on function private.apply_project_proposal_internal(
  uuid, uuid, uuid[], jsonb, text
) from public, anon, authenticated, service_role;
revoke all on function private.undo_project_operation_internal(
  uuid, uuid, text
) from public, anon, authenticated, service_role;
revoke all on function private.reset_demo_project_internal(
  uuid, text, text
) from public, anon, authenticated, service_role;

grant usage on schema private to service_role;
grant execute on function private.apply_project_proposal_internal(
  uuid, uuid, uuid[], jsonb, text
) to service_role;
grant execute on function private.undo_project_operation_internal(
  uuid, uuid, text
) to service_role;
grant execute on function private.reset_demo_project_internal(
  uuid, text, text
) to service_role;

revoke all on function public.apply_project_proposal(
  uuid, uuid, uuid, uuid[], jsonb, text
) from public, anon, authenticated, service_role;
revoke all on function public.undo_project_operation(
  uuid, uuid, uuid, text
) from public, anon, authenticated, service_role;
revoke all on function public.reset_demo_project(
  uuid, uuid, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.apply_project_proposal(
  uuid, uuid, uuid, uuid[], jsonb, text
) to service_role;
grant execute on function public.undo_project_operation(
  uuid, uuid, uuid, text
) to service_role;
grant execute on function public.reset_demo_project(
  uuid, uuid, text, text
) to service_role;

comment on function public.apply_project_proposal(
  uuid, uuid, uuid, uuid[], jsonb, text
) is
  'Server-only, constrained selective approval wrapper. It accepts no table names, SQL, arbitrary patches, credentials, or external destinations.';
comment on function public.undo_project_operation(uuid, uuid, uuid, text) is
  'Server-only compensating undo wrapper. It restores only audited allowlisted item fields when current version and after-state still match.';
comment on function public.reset_demo_project(uuid, uuid, text, text) is
  'Server-only named demo reset wrapper. The reset secret remains in the application server and is never an RPC parameter.';
