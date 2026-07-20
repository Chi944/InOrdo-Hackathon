-- Prompt 13 generation integrity: reconcile children of terminally superseded
-- proposals and fence authenticated native record mutations against reset.

begin;

-- System-driven staleness carries no invented reviewer. Human-approved actions
-- retain their real attribution when later made stale. One-sided attribution is
-- invalid in every state.
alter table public.proposal_actions
  drop constraint proposal_actions_review_shape;
alter table public.proposal_actions
  add constraint proposal_actions_review_shape check (
    (
      state = 'pending'::public.proposal_action_state
      and reviewed_by is null
      and reviewed_at is null
    )
    or (
      state = 'stale'::public.proposal_action_state
      and (
        (reviewed_by is null and reviewed_at is null)
        or (reviewed_by is not null and reviewed_at is not null)
      )
    )
    or (
      state in (
        'approved'::public.proposal_action_state,
        'rejected'::public.proposal_action_state,
        'applied'::public.proposal_action_state
      )
      and reviewed_by is not null
      and reviewed_at is not null
    )
  );

create or replace function private.reconcile_superseded_proposal_actions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- A project-item update inside apply temporarily supersedes its proposal. The
  -- deferred trigger must inspect the final parent state, not the transition
  -- snapshot, so a transaction that finishes applied/partially approved keeps
  -- its intended child states.
  if exists (
    select 1
    from public.action_proposals as proposal
    where proposal.workspace_id = new.workspace_id
      and proposal.project_id = new.project_id
      and proposal.id = new.id
      and proposal.state = 'superseded'::public.proposal_state
  ) then
    update public.proposal_actions as action
    set state = 'stale'::public.proposal_action_state
    where action.workspace_id = new.workspace_id
      and action.project_id = new.project_id
      and action.proposal_id = new.id
      and action.state in (
        'pending'::public.proposal_action_state,
        'approved'::public.proposal_action_state
      );
  end if;

  return null;
end;
$$;

revoke all on function private.reconcile_superseded_proposal_actions()
from public, anon, authenticated, service_role;

drop trigger if exists action_proposals_reconcile_superseded_actions
on public.action_proposals;
create constraint trigger action_proposals_reconcile_superseded_actions
after update of state on public.action_proposals
deferrable initially deferred
for each row
when (new.state = 'superseded'::public.proposal_state)
execute function private.reconcile_superseded_proposal_actions();

-- Historic superseded parents have no remaining executable intent. Preserve
-- applied/rejected history and real approval attribution while closing only
-- pending/approved children.
update public.proposal_actions as action
set state = 'stale'::public.proposal_action_state
from public.action_proposals as proposal
where proposal.workspace_id = action.workspace_id
  and proposal.project_id = action.project_id
  and proposal.id = action.proposal_id
  and proposal.state = 'superseded'::public.proposal_state
  and action.state in (
    'pending'::public.proposal_action_state,
    'approved'::public.proposal_action_state
  );

comment on function private.reconcile_superseded_proposal_actions() is
  'At transaction end, closes only pending/approved children of a parent whose final state is superseded; terminal action history and reviewer attribution remain intact.';

-- Only successful native mutations consume an idempotency key. The ledger is
-- server-private and append-only, allowing exact replay after reset without
-- permitting stale requests to cross the project generation fence.
create table private.project_mutation_ledger (
  workspace_id uuid not null,
  project_id uuid not null,
  actor_id uuid not null,
  mutation_type text not null check (
    mutation_type in (
      'create_project_item',
      'update_project_item',
      'create_item_dependency',
      'remove_item_dependency'
    )
  ),
  idempotency_key text not null check (
    pg_catalog.char_length(idempotency_key) between 8 and 200
    and idempotency_key ~ '^[A-Za-z0-9._:-]+$'
  ),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  workflow_generation bigint not null check (workflow_generation > 0),
  result_payload jsonb not null check (
    pg_catalog.jsonb_typeof(result_payload) = 'object'
  ),
  created_at timestamptz not null default now(),
  constraint project_mutation_ledger_pkey primary key (
    workspace_id,
    idempotency_key
  ),
  constraint project_mutation_ledger_project_fk foreign key (
    workspace_id,
    project_id
  ) references public.projects (workspace_id, id) on delete restrict,
  constraint project_mutation_ledger_actor_fk foreign key (actor_id)
    references public.profiles (id) on delete restrict
);

create index project_mutation_ledger_project_generation_idx
  on private.project_mutation_ledger (
    workspace_id,
    project_id,
    workflow_generation,
    created_at desc
  );

create trigger project_mutation_ledger_immutable
before update or delete on private.project_mutation_ledger
for each row execute function public.reject_immutable_change();

alter table private.project_mutation_ledger enable row level security;
revoke all on table private.project_mutation_ledger
from public, anon, authenticated, service_role;

comment on table private.project_mutation_ledger is
  'Append-only successful native-mutation receipts. Exact actor/request replay is stable across workflow-generation advances; rejected requests consume no key.';

-- Project items and dependencies remain member-readable. Generation-fenced
-- RPCs become the application write path in this expand migration, while
-- service-role table access remains available for analysis/apply/reset.
-- Expand phase: keep the legacy contributor policies and authenticated DML
-- grants until an RPC-capable production artifact is deployed and verified.
-- Removing them in this migration would make the still-live pre-RPC artifact
-- incompatible during the database-first release window. A separately
-- reviewed contract migration must remove that compatibility path only after
-- the deployed application has exercised all four RPCs successfully.
grant select on table public.project_items to authenticated;
grant select on table public.item_dependencies to authenticated;

create or replace function public.mutate_project_item_create(
  p_project_id uuid,
  p_expected_workflow_generation bigint,
  p_idempotency_key text,
  p_payload jsonb
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
  request_hash text;
  existing_ledger private.project_mutation_ledger%rowtype;
  created_item public.project_items%rowtype;
  result_payload jsonb;
  start_date_value date;
  due_date_value date;
  event_date_value date;
  owner_id_value uuid;
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
     'admin'::public.workspace_role,
     'member'::public.workspace_role
   )
  where project.id = p_project_id
  for update of project;

  if not found then
    raise exception 'project mutation authorization failed'
      using errcode = '42501';
  end if;
  if p_expected_workflow_generation is null
     or p_expected_workflow_generation <= 0
     or p_expected_workflow_generation > 9007199254740991
     or not private.is_valid_operation_idempotency_key(p_idempotency_key)
     or p_payload is null
     or not private.jsonb_object_matches(
       p_payload,
       array[
         'item_key', 'item_type', 'title', 'description', 'status',
         'priority', 'owner_id', 'start_date', 'due_date', 'event_date'
       ],
       array[
         'item_key', 'item_type', 'title', 'description', 'status',
         'priority', 'owner_id', 'start_date', 'due_date', 'event_date'
       ]
     ) then
    raise exception 'invalid project mutation request' using errcode = '23514';
  end if;

  if pg_catalog.jsonb_typeof(p_payload -> 'item_key') <> 'string'
     or pg_catalog.char_length(p_payload ->> 'item_key') > 64
     or p_payload ->> 'item_key' !~ '^[A-Z][A-Z0-9]*-[0-9]{2,}$'
     or pg_catalog.jsonb_typeof(p_payload -> 'item_type') <> 'string'
     or p_payload ->> 'item_type' not in (
       'task', 'milestone', 'decision', 'event', 'risk', 'artifact'
     ) then
    raise exception 'invalid project mutation request' using errcode = '23514';
  end if;

  if not private.is_valid_operation_item_value(
       'title', p_payload -> 'title',
       (p_payload ->> 'item_type')::public.project_item_type
     )
     or not private.is_valid_operation_item_value(
       'description', p_payload -> 'description',
       (p_payload ->> 'item_type')::public.project_item_type
     )
     or not private.is_valid_operation_item_value(
       'status', p_payload -> 'status',
       (p_payload ->> 'item_type')::public.project_item_type
     )
     or not private.is_valid_operation_item_value(
       'priority', p_payload -> 'priority',
       (p_payload ->> 'item_type')::public.project_item_type
     )
     or not private.is_valid_operation_item_value(
       'owner_id', p_payload -> 'owner_id',
       (p_payload ->> 'item_type')::public.project_item_type
     )
     or not private.is_valid_operation_item_value(
       'start_date', p_payload -> 'start_date',
       (p_payload ->> 'item_type')::public.project_item_type
     )
     or not private.is_valid_operation_item_value(
       'due_date', p_payload -> 'due_date',
       (p_payload ->> 'item_type')::public.project_item_type
     )
     or not private.is_valid_operation_item_value(
       'event_date', p_payload -> 'event_date',
       (p_payload ->> 'item_type')::public.project_item_type
     ) then
    raise exception 'invalid project mutation request' using errcode = '23514';
  end if;

  request_hash := private.operation_request_hash(
    pg_catalog.jsonb_build_object(
      'mutation_type', 'create_project_item',
      'actor_id', actor_id,
      'project_id', p_project_id,
      'expected_workflow_generation', p_expected_workflow_generation,
      'payload', p_payload
    )
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      target_workspace_id::text || ':project-mutation:' || p_idempotency_key,
      0
    )
  );

  select ledger.* into existing_ledger
  from private.project_mutation_ledger as ledger
  where ledger.workspace_id = target_workspace_id
    and ledger.idempotency_key = p_idempotency_key
  for update;
  if found then
    if existing_ledger.project_id <> p_project_id
       or existing_ledger.actor_id <> actor_id
       or existing_ledger.mutation_type <> 'create_project_item'
       or existing_ledger.request_hash <> request_hash then
      raise exception 'project mutation idempotency conflict'
        using errcode = '40001';
    end if;
    return existing_ledger.result_payload
      || pg_catalog.jsonb_build_object('status', 'duplicate');
  end if;

  owner_id_value := case
    when p_payload -> 'owner_id' = 'null'::jsonb then null
    else (p_payload ->> 'owner_id')::uuid
  end;
  if owner_id_value is not null and not exists (
    select 1
    from public.workspace_members as membership
    where membership.workspace_id = target_workspace_id
      and membership.user_id = owner_id_value
  ) then
    raise exception 'project item owner is unavailable' using errcode = '23503';
  end if;

  start_date_value := case
    when p_payload -> 'start_date' = 'null'::jsonb then null
    else (p_payload ->> 'start_date')::date
  end;
  due_date_value := case
    when p_payload -> 'due_date' = 'null'::jsonb then null
    else (p_payload ->> 'due_date')::date
  end;
  event_date_value := case
    when p_payload -> 'event_date' = 'null'::jsonb then null
    else (p_payload ->> 'event_date')::date
  end;
  if start_date_value is not null
     and due_date_value is not null
     and start_date_value > due_date_value then
    raise exception 'project item start date is after its due date'
      using errcode = '23514';
  end if;

  if p_expected_workflow_generation <> current_generation then
    raise exception 'stale project generation' using errcode = '40001';
  end if;

  begin
    insert into public.project_items (
      workspace_id, project_id, item_key, item_type, title, description,
      status, priority, owner_id, start_date, due_date, event_date, metadata,
      created_by
    ) values (
      target_workspace_id,
      p_project_id,
      p_payload ->> 'item_key',
      (p_payload ->> 'item_type')::public.project_item_type,
      pg_catalog.btrim(p_payload ->> 'title', E' \t\r\n'),
      case when p_payload -> 'description' = 'null'::jsonb
        then null else p_payload ->> 'description' end,
      (p_payload ->> 'status')::public.project_item_status,
      (p_payload ->> 'priority')::public.item_priority,
      owner_id_value,
      start_date_value,
      due_date_value,
      event_date_value,
      '{}'::jsonb,
      actor_id
    )
    returning * into created_item;
  exception when unique_violation then
    raise exception 'project item already exists' using errcode = '23505';
  end;

  result_payload := pg_catalog.jsonb_build_object(
    'status', 'succeeded',
    'workflow_generation', current_generation,
    'item', pg_catalog.to_jsonb(created_item)
  );
  insert into private.project_mutation_ledger (
    workspace_id, project_id, actor_id, mutation_type, idempotency_key,
    request_hash, workflow_generation, result_payload
  ) values (
    target_workspace_id, p_project_id, actor_id, 'create_project_item',
    p_idempotency_key, request_hash, current_generation, result_payload
  );

  return result_payload;
end;
$$;

create or replace function public.mutate_project_item_update(
  p_project_id uuid,
  p_item_id uuid,
  p_expected_version bigint,
  p_expected_workflow_generation bigint,
  p_idempotency_key text,
  p_patch jsonb
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
  request_hash text;
  existing_ledger private.project_mutation_ledger%rowtype;
  current_item public.project_items%rowtype;
  updated_item public.project_items%rowtype;
  result_payload jsonb;
  patch_field text;
  final_item_key text;
  final_item_type public.project_item_type;
  final_title text;
  final_description text;
  final_status public.project_item_status;
  final_priority public.item_priority;
  final_owner_id uuid;
  final_start_date date;
  final_due_date date;
  final_event_date date;
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
     'admin'::public.workspace_role,
     'member'::public.workspace_role
   )
  where project.id = p_project_id
  for update of project;

  if not found then
    raise exception 'project mutation authorization failed'
      using errcode = '42501';
  end if;
  if p_item_id is null
     or p_expected_version is null
     or p_expected_version <= 0
     or p_expected_workflow_generation is null
     or p_expected_workflow_generation <= 0
     or p_expected_workflow_generation > 9007199254740991
     or not private.is_valid_operation_idempotency_key(p_idempotency_key)
     or p_patch is null
     or not private.jsonb_object_matches(
       p_patch,
       array[
         'item_key', 'item_type', 'title', 'description', 'status',
         'priority', 'owner_id', 'start_date', 'due_date', 'event_date'
       ],
       array[]::text[]
     )
     or (
       select pg_catalog.count(*)
       from pg_catalog.jsonb_object_keys(p_patch)
     ) not between 1 and 10 then
    raise exception 'invalid project mutation request' using errcode = '23514';
  end if;

  request_hash := private.operation_request_hash(
    pg_catalog.jsonb_build_object(
      'mutation_type', 'update_project_item',
      'actor_id', actor_id,
      'project_id', p_project_id,
      'item_id', p_item_id,
      'expected_version', p_expected_version,
      'expected_workflow_generation', p_expected_workflow_generation,
      'patch', p_patch
    )
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      target_workspace_id::text || ':project-mutation:' || p_idempotency_key,
      0
    )
  );

  select ledger.* into existing_ledger
  from private.project_mutation_ledger as ledger
  where ledger.workspace_id = target_workspace_id
    and ledger.idempotency_key = p_idempotency_key
  for update;
  if found then
    if existing_ledger.project_id <> p_project_id
       or existing_ledger.actor_id <> actor_id
       or existing_ledger.mutation_type <> 'update_project_item'
       or existing_ledger.request_hash <> request_hash then
      raise exception 'project mutation idempotency conflict'
        using errcode = '40001';
    end if;
    return existing_ledger.result_payload
      || pg_catalog.jsonb_build_object('status', 'duplicate');
  end if;

  if p_expected_workflow_generation <> current_generation then
    raise exception 'stale project generation' using errcode = '40001';
  end if;

  select item.* into current_item
  from public.project_items as item
  where item.workspace_id = target_workspace_id
    and item.project_id = p_project_id
    and item.id = p_item_id
    and not item.is_demo_retired
  for update;
  if not found then
    raise exception 'project item is unavailable' using errcode = '23503';
  end if;
  if current_item.version <> p_expected_version then
    raise exception 'stale project item version' using errcode = '40001';
  end if;

  if p_patch ? 'item_key' and (
    pg_catalog.jsonb_typeof(p_patch -> 'item_key') <> 'string'
    or pg_catalog.char_length(p_patch ->> 'item_key') > 64
    or p_patch ->> 'item_key' !~ '^[A-Z][A-Z0-9]*-[0-9]{2,}$'
  ) then
    raise exception 'invalid project mutation request' using errcode = '23514';
  end if;
  if p_patch ? 'item_type' and (
    pg_catalog.jsonb_typeof(p_patch -> 'item_type') <> 'string'
    or p_patch ->> 'item_type' not in (
      'task', 'milestone', 'decision', 'event', 'risk', 'artifact'
    )
  ) then
    raise exception 'invalid project mutation request' using errcode = '23514';
  end if;

  final_item_type := case when p_patch ? 'item_type'
    then (p_patch ->> 'item_type')::public.project_item_type
    else current_item.item_type end;

  for patch_field in
    select supplied.key
    from pg_catalog.jsonb_object_keys(p_patch) as supplied(key)
  loop
    if patch_field not in ('item_key', 'item_type')
       and not private.is_valid_operation_item_value(
         patch_field,
         p_patch -> patch_field,
         final_item_type
       ) then
      raise exception 'invalid project mutation request'
        using errcode = '23514';
    end if;
  end loop;

  final_item_key := case when p_patch ? 'item_key'
    then p_patch ->> 'item_key' else current_item.item_key end;
  final_title := case when p_patch ? 'title'
    then pg_catalog.btrim(p_patch ->> 'title', E' \t\r\n')
    else current_item.title end;
  final_description := case when p_patch ? 'description'
    then case when p_patch -> 'description' = 'null'::jsonb
      then null else p_patch ->> 'description' end
    else current_item.description end;
  final_status := case when p_patch ? 'status'
    then (p_patch ->> 'status')::public.project_item_status
    else current_item.status end;
  final_priority := case when p_patch ? 'priority'
    then (p_patch ->> 'priority')::public.item_priority
    else current_item.priority end;
  final_owner_id := case when p_patch ? 'owner_id'
    then case when p_patch -> 'owner_id' = 'null'::jsonb
      then null else (p_patch ->> 'owner_id')::uuid end
    else current_item.owner_id end;
  final_start_date := case when p_patch ? 'start_date'
    then case when p_patch -> 'start_date' = 'null'::jsonb
      then null else (p_patch ->> 'start_date')::date end
    else current_item.start_date end;
  final_due_date := case when p_patch ? 'due_date'
    then case when p_patch -> 'due_date' = 'null'::jsonb
      then null else (p_patch ->> 'due_date')::date end
    else current_item.due_date end;
  final_event_date := case when p_patch ? 'event_date'
    then case when p_patch -> 'event_date' = 'null'::jsonb
      then null else (p_patch ->> 'event_date')::date end
    else current_item.event_date end;

  if final_item_key is null
     or pg_catalog.char_length(final_item_key) > 64
     or final_item_key !~ '^[A-Z][A-Z0-9]*-[0-9]{2,}$' then
    raise exception 'invalid project mutation request' using errcode = '23514';
  end if;

  if final_owner_id is not null and not exists (
    select 1
    from public.workspace_members as membership
    where membership.workspace_id = target_workspace_id
      and membership.user_id = final_owner_id
  ) then
    raise exception 'project item owner is unavailable' using errcode = '23503';
  end if;
  if final_start_date is not null
     and final_due_date is not null
     and final_start_date > final_due_date then
    raise exception 'project item start date is after its due date'
      using errcode = '23514';
  end if;
  if final_item_type <> 'event'::public.project_item_type
     and final_event_date is not null then
    raise exception 'non-event project item cannot have an event date'
      using errcode = '23514';
  end if;

  begin
    update public.project_items as item
    set item_key = final_item_key,
        item_type = final_item_type,
        title = final_title,
        description = final_description,
        status = final_status,
        priority = final_priority,
        owner_id = final_owner_id,
        start_date = final_start_date,
        due_date = final_due_date,
        event_date = final_event_date
    where item.workspace_id = target_workspace_id
      and item.project_id = p_project_id
      and item.id = p_item_id
    returning * into updated_item;
  exception when unique_violation then
    raise exception 'project item already exists' using errcode = '23505';
  end;

  result_payload := pg_catalog.jsonb_build_object(
    'status', 'succeeded',
    'workflow_generation', current_generation,
    'item', pg_catalog.to_jsonb(updated_item)
  );
  insert into private.project_mutation_ledger (
    workspace_id, project_id, actor_id, mutation_type, idempotency_key,
    request_hash, workflow_generation, result_payload
  ) values (
    target_workspace_id, p_project_id, actor_id, 'update_project_item',
    p_idempotency_key, request_hash, current_generation, result_payload
  );

  return result_payload;
end;
$$;

create or replace function public.mutate_project_dependency_create(
  p_project_id uuid,
  p_expected_workflow_generation bigint,
  p_idempotency_key text,
  p_payload jsonb
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
  request_hash text;
  existing_ledger private.project_mutation_ledger%rowtype;
  created_dependency public.item_dependencies%rowtype;
  result_payload jsonb;
  from_item_id_value uuid;
  to_item_id_value uuid;
  endpoint_count integer;
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
     'admin'::public.workspace_role,
     'member'::public.workspace_role
   )
  where project.id = p_project_id
  for update of project;

  if not found then
    raise exception 'project mutation authorization failed'
      using errcode = '42501';
  end if;
  if p_expected_workflow_generation is null
     or p_expected_workflow_generation <= 0
     or p_expected_workflow_generation > 9007199254740991
     or not private.is_valid_operation_idempotency_key(p_idempotency_key)
     or p_payload is null
     or not private.jsonb_object_matches(
       p_payload,
       array['from_item_id', 'to_item_id', 'relationship', 'rationale'],
       array['from_item_id', 'to_item_id', 'relationship', 'rationale']
     )
     or pg_catalog.jsonb_typeof(p_payload -> 'from_item_id') <> 'string'
     or not private.is_uuid_text(p_payload ->> 'from_item_id')
     or pg_catalog.jsonb_typeof(p_payload -> 'to_item_id') <> 'string'
     or not private.is_uuid_text(p_payload ->> 'to_item_id')
     or pg_catalog.jsonb_typeof(p_payload -> 'relationship') <> 'string'
     or p_payload ->> 'relationship' not in (
       'depends_on', 'requires', 'informs', 'scheduled_by'
     )
     or not (
       p_payload -> 'rationale' = 'null'::jsonb
       or (
         pg_catalog.jsonb_typeof(p_payload -> 'rationale') = 'string'
         and pg_catalog.char_length(
           pg_catalog.btrim(p_payload ->> 'rationale', E' \t\r\n')
         ) between 1 and 2000
       )
     ) then
    raise exception 'invalid project mutation request' using errcode = '23514';
  end if;

  from_item_id_value := (p_payload ->> 'from_item_id')::uuid;
  to_item_id_value := (p_payload ->> 'to_item_id')::uuid;
  if from_item_id_value = to_item_id_value then
    raise exception 'dependency cannot reference itself' using errcode = '23514';
  end if;

  request_hash := private.operation_request_hash(
    pg_catalog.jsonb_build_object(
      'mutation_type', 'create_item_dependency',
      'actor_id', actor_id,
      'project_id', p_project_id,
      'expected_workflow_generation', p_expected_workflow_generation,
      'payload', p_payload
    )
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      target_workspace_id::text || ':project-mutation:' || p_idempotency_key,
      0
    )
  );

  select ledger.* into existing_ledger
  from private.project_mutation_ledger as ledger
  where ledger.workspace_id = target_workspace_id
    and ledger.idempotency_key = p_idempotency_key
  for update;
  if found then
    if existing_ledger.project_id <> p_project_id
       or existing_ledger.actor_id <> actor_id
       or existing_ledger.mutation_type <> 'create_item_dependency'
       or existing_ledger.request_hash <> request_hash then
      raise exception 'project mutation idempotency conflict'
        using errcode = '40001';
    end if;
    return existing_ledger.result_payload
      || pg_catalog.jsonb_build_object('status', 'duplicate');
  end if;

  if p_expected_workflow_generation <> current_generation then
    raise exception 'stale project generation' using errcode = '40001';
  end if;

  select pg_catalog.count(*)::integer into endpoint_count
  from public.project_items as item
  where item.workspace_id = target_workspace_id
    and item.project_id = p_project_id
    and item.id in (from_item_id_value, to_item_id_value)
    and not item.is_demo_retired;
  if endpoint_count <> 2 then
    raise exception 'dependency endpoint is unavailable' using errcode = '23503';
  end if;

  begin
    insert into public.item_dependencies (
      workspace_id, project_id, from_item_id, to_item_id, relationship,
      rationale, created_by
    ) values (
      target_workspace_id,
      p_project_id,
      from_item_id_value,
      to_item_id_value,
      (p_payload ->> 'relationship')::public.dependency_relationship,
      case when p_payload -> 'rationale' = 'null'::jsonb
        then null
        else pg_catalog.btrim(p_payload ->> 'rationale', E' \t\r\n')
      end,
      actor_id
    )
    returning * into created_dependency;
  exception when unique_violation then
    raise exception 'dependency already exists' using errcode = '23505';
  end;

  result_payload := pg_catalog.jsonb_build_object(
    'status', 'succeeded',
    'workflow_generation', current_generation,
    'dependency', pg_catalog.to_jsonb(created_dependency)
  );
  insert into private.project_mutation_ledger (
    workspace_id, project_id, actor_id, mutation_type, idempotency_key,
    request_hash, workflow_generation, result_payload
  ) values (
    target_workspace_id, p_project_id, actor_id, 'create_item_dependency',
    p_idempotency_key, request_hash, current_generation, result_payload
  );

  return result_payload;
end;
$$;

create or replace function public.mutate_project_dependency_remove(
  p_project_id uuid,
  p_dependency_id uuid,
  p_expected_workflow_generation bigint,
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
  request_hash text;
  existing_ledger private.project_mutation_ledger%rowtype;
  target_dependency public.item_dependencies%rowtype;
  result_payload jsonb;
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
     'admin'::public.workspace_role,
     'member'::public.workspace_role
   )
  where project.id = p_project_id
  for update of project;

  if not found then
    raise exception 'project mutation authorization failed'
      using errcode = '42501';
  end if;
  if p_dependency_id is null
     or p_expected_workflow_generation is null
     or p_expected_workflow_generation <= 0
     or p_expected_workflow_generation > 9007199254740991
     or not private.is_valid_operation_idempotency_key(p_idempotency_key) then
    raise exception 'invalid project mutation request' using errcode = '23514';
  end if;

  request_hash := private.operation_request_hash(
    pg_catalog.jsonb_build_object(
      'mutation_type', 'remove_item_dependency',
      'actor_id', actor_id,
      'project_id', p_project_id,
      'dependency_id', p_dependency_id,
      'expected_workflow_generation', p_expected_workflow_generation
    )
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      target_workspace_id::text || ':project-mutation:' || p_idempotency_key,
      0
    )
  );

  select ledger.* into existing_ledger
  from private.project_mutation_ledger as ledger
  where ledger.workspace_id = target_workspace_id
    and ledger.idempotency_key = p_idempotency_key
  for update;
  if found then
    if existing_ledger.project_id <> p_project_id
       or existing_ledger.actor_id <> actor_id
       or existing_ledger.mutation_type <> 'remove_item_dependency'
       or existing_ledger.request_hash <> request_hash then
      raise exception 'project mutation idempotency conflict'
        using errcode = '40001';
    end if;
    return existing_ledger.result_payload
      || pg_catalog.jsonb_build_object('status', 'duplicate');
  end if;

  if p_expected_workflow_generation <> current_generation then
    raise exception 'stale project generation' using errcode = '40001';
  end if;

  select dependency.* into target_dependency
  from public.item_dependencies as dependency
  where dependency.workspace_id = target_workspace_id
    and dependency.project_id = p_project_id
    and dependency.id = p_dependency_id
  for update;
  if not found then
    raise exception 'dependency is unavailable' using errcode = '23503';
  end if;

  delete from public.item_dependencies as dependency
  where dependency.workspace_id = target_workspace_id
    and dependency.project_id = p_project_id
    and dependency.id = p_dependency_id;

  result_payload := pg_catalog.jsonb_build_object(
    'status', 'succeeded',
    'workflow_generation', current_generation,
    'dependency_id', target_dependency.id
  );
  insert into private.project_mutation_ledger (
    workspace_id, project_id, actor_id, mutation_type, idempotency_key,
    request_hash, workflow_generation, result_payload
  ) values (
    target_workspace_id, p_project_id, actor_id, 'remove_item_dependency',
    p_idempotency_key, request_hash, current_generation, result_payload
  );

  return result_payload;
end;
$$;

revoke all on function public.mutate_project_item_create(
  uuid, bigint, text, jsonb
) from public, anon, authenticated, service_role;
revoke all on function public.mutate_project_item_update(
  uuid, uuid, bigint, bigint, text, jsonb
) from public, anon, authenticated, service_role;
revoke all on function public.mutate_project_dependency_create(
  uuid, bigint, text, jsonb
) from public, anon, authenticated, service_role;
revoke all on function public.mutate_project_dependency_remove(
  uuid, uuid, bigint, text
) from public, anon, authenticated, service_role;

grant execute on function public.mutate_project_item_create(
  uuid, bigint, text, jsonb
) to authenticated;
grant execute on function public.mutate_project_item_update(
  uuid, uuid, bigint, bigint, text, jsonb
) to authenticated;
grant execute on function public.mutate_project_dependency_create(
  uuid, bigint, text, jsonb
) to authenticated;
grant execute on function public.mutate_project_dependency_remove(
  uuid, uuid, bigint, text
) to authenticated;

comment on function public.mutate_project_item_create(
  uuid, bigint, text, jsonb
) is
  'Authenticated contributor RPC: locks the project, replays exact successful requests, fences stale workflow generations, and atomically creates one validated item plus an immutable receipt.';
comment on function public.mutate_project_item_update(
  uuid, uuid, bigint, bigint, text, jsonb
) is
  'Authenticated contributor RPC: generation- and version-fenced allowlisted item patch with exact idempotent replay.';
comment on function public.mutate_project_dependency_create(
  uuid, bigint, text, jsonb
) is
  'Authenticated contributor RPC: generation-fenced same-project dependency creation with exact idempotent replay.';
comment on function public.mutate_project_dependency_remove(
  uuid, uuid, bigint, text
) is
  'Authenticated contributor RPC: generation-fenced dependency removal with exact idempotent replay.';

commit;
