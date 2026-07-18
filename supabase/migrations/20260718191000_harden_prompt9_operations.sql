-- Prompt 9 hardening: canonical demo-baseline integrity, generation-scoped
-- analysis intake, active-only item keys, and sequence-safe compensating undo.

-- Serialization version 1 is deliberately explicit and excludes created_at so
-- a fresh deterministic seed is independent of insertion time. Each aggregate
-- is an ordered JSONB array; the exact digest input is items || '|' || edges.
create or replace function private.demo_baseline_fingerprint_v1(
  target_workspace_id uuid,
  target_project_id uuid
)
returns text
language sql
stable
set search_path = ''
as $$
  with item_payload as (
    select coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_array(
          baseline.item_id,
          baseline.workspace_id,
          baseline.item_key,
          baseline.item_type::text,
          baseline.title,
          baseline.description,
          baseline.status::text,
          baseline.priority::text,
          baseline.owner_id,
          baseline.start_date,
          baseline.due_date,
          baseline.event_date,
          baseline.metadata,
          baseline.created_by
        ) order by baseline.item_id
      )::text,
      '[]'
    ) as serialized
    from private.demo_baseline_project_items as baseline
    where baseline.workspace_id = target_workspace_id
      and baseline.project_id = target_project_id
  ),
  dependency_payload as (
    select coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_array(
          baseline.dependency_id,
          baseline.workspace_id,
          baseline.from_item_id,
          baseline.to_item_id,
          baseline.relationship::text,
          baseline.rationale,
          baseline.created_by
        ) order by baseline.dependency_id
      )::text,
      '[]'
    ) as serialized
    from private.demo_baseline_dependencies as baseline
    where baseline.workspace_id = target_workspace_id
      and baseline.project_id = target_project_id
  )
  select pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        item_payload.serialized || '|' || dependency_payload.serialized,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  )
  from item_payload
  cross join dependency_payload;
$$;

comment on function private.demo_baseline_fingerprint_v1(uuid, uuid) is
  'Canonical demo baseline fingerprint serialization v1. Ordered JSONB rows exclude created_at; item and dependency arrays are joined by one pipe byte.';

create or replace function private.guard_demo_baseline_fingerprint()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actual_fingerprint text;
begin
  if new.workflow_generation is distinct from old.workflow_generation
     and new.is_demo
     and new.slug = 'regional-climate-action-summit-2026'
     and exists (
       select 1
       from public.workspaces as workspace
       where workspace.id = new.workspace_id
         and workspace.slug = 'civic-futures-lab-demo'
     ) then
    actual_fingerprint := private.demo_baseline_fingerprint_v1(
      new.workspace_id,
      new.id
    );
    if actual_fingerprint is distinct from
       'f5fdef78150fe8eb6a87962e50e635e60927909fbf70019a2f53cee970624f8a' then
      raise exception 'demo reset baseline is unavailable'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger projects_guard_demo_baseline_fingerprint
before update of workflow_generation on public.projects
for each row execute function private.guard_demo_baseline_fingerprint();

-- Retired demo rows remain immutable history but no longer reserve a live key.
-- The project row lock in apply_project_proposal serializes key allocation.
alter table public.project_items
  drop constraint project_items_workspace_id_project_id_item_key_key;
alter table public.project_items
  add constraint project_items_item_key_length
  check (pg_catalog.char_length(item_key) <= 64);
create unique index project_items_active_item_key_uidx
  on public.project_items (workspace_id, project_id, item_key)
  where not is_demo_retired;

create index analysis_requests_generation_actor_rate_idx
  on public.analysis_requests (
    workspace_id,
    project_id,
    workflow_generation,
    requested_by,
    created_at desc
  );
create index source_documents_generation_reuse_idx
  on public.source_documents (
    workspace_id,
    project_id,
    workflow_generation,
    normalized_content_sha256,
    created_at,
    id
  );

-- Reset starts a new workflow generation. Duplicate detection, source reuse,
-- and the rolling request budget must therefore see only the current one.
create or replace function private.begin_project_analysis_internal(
  p_project_id uuid,
  p_expected_project_revision text,
  p_title text,
  p_source_kind text,
  p_source_author text,
  p_raw_text text,
  p_normalized_content_sha256 text,
  p_occurred_at timestamptz,
  p_source_url text,
  p_model_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  actor_id uuid;
  target_workspace_id uuid;
  current_generation bigint;
  computed_source_hash text;
  current_revision text;
  existing_request public.analysis_requests%rowtype;
  source_document_id uuid;
  analysis_request_id uuid;
  recent_request_count integer;
  rate_window_started_at timestamptz;
  retry_after_seconds integer;
begin
  actor_id := (select auth.uid());
  if actor_id is null
     or coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select project.workspace_id, project.workflow_generation
  into target_workspace_id, current_generation
  from public.projects as project
  where project.id = p_project_id
  for share of project;

  if target_workspace_id is null
     or not exists (
       select 1
       from public.workspace_members as member
       where member.workspace_id = target_workspace_id
         and member.user_id = actor_id
         and member.role in (
           'owner'::public.workspace_role,
           'admin'::public.workspace_role,
           'member'::public.workspace_role
         )
     ) then
    raise exception 'project not found or access denied' using errcode = '42501';
  end if;

  if p_expected_project_revision is null
     or p_normalized_content_sha256 is null
     or p_expected_project_revision !~ '^[0-9a-f]{64}$'
     or p_normalized_content_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid analysis hash' using errcode = '22023';
  end if;
  if p_raw_text is null
     or pg_catalog.char_length(p_raw_text) not between 1 and 12000
     or pg_catalog.octet_length(p_raw_text) > 24000
     or pg_catalog.char_length(
       private.normalize_source_text(p_raw_text)
     ) < 1 then
    raise exception 'invalid source text' using errcode = '22023';
  end if;
  if p_title is null
     or p_source_author is null
     or p_source_kind not in ('pasted_update', 'manual_note')
     or p_model_name is null
     or pg_catalog.char_length(
       pg_catalog.btrim(p_title, E' \t\r\n')
     ) not between 1 and 240
      or pg_catalog.char_length(
        pg_catalog.btrim(p_source_author, E' \t\r\n')
      ) not between 1 and 120
     or pg_catalog.char_length(p_model_name) not between 1 and 120
     or p_model_name !~ '^[A-Za-z0-9._:/-]+$' then
    raise exception 'invalid source metadata' using errcode = '22023';
  end if;
  if p_source_url is not null and (
    pg_catalog.char_length(p_source_url) > 2048
    or p_source_url !~ '^https://[^[:space:]]+$'
  ) then
    raise exception 'invalid source URL' using errcode = '22023';
  end if;

  computed_source_hash := private.source_normalized_sha256(p_raw_text);
  if computed_source_hash <> p_normalized_content_sha256 then
    raise exception 'normalized source hash mismatch' using errcode = '22023';
  end if;

  -- A shared source-key lock prevents two actors from creating duplicate raw
  -- evidence. The actor lock makes the rolling rate check race-free. Locks are
  -- acquired in this fixed order in every call.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'inordo-analysis-source:' || p_project_id::text || ':'
        || p_normalized_content_sha256,
      0
    )
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'inordo-analysis-actor:' || p_project_id::text || ':' || actor_id::text,
      0
    )
  );

  current_revision := private.compute_project_revision(
    target_workspace_id,
    p_project_id
  );
  if current_revision <> p_expected_project_revision then
    raise exception 'stale project revision' using errcode = '40001';
  end if;

  select request.*
  into existing_request
  from public.analysis_requests as request
  where request.workspace_id = target_workspace_id
    and request.project_id = p_project_id
    and request.workflow_generation = current_generation
    and request.project_revision = p_expected_project_revision
    and request.normalized_content_sha256 = p_normalized_content_sha256;

  if found then
    return pg_catalog.jsonb_build_object(
      'status', 'duplicate',
      'analysis_request_id', existing_request.id,
      'source_document_id', existing_request.source_document_id,
      'state', existing_request.state::text,
      'change_event_id', existing_request.change_event_id,
      'impact_run_id', existing_request.impact_run_id,
      'proposal_id', existing_request.proposal_id,
      'retry_after_seconds', null
    );
  end if;

  select pg_catalog.count(*)::integer, min(request.created_at)
  into recent_request_count, rate_window_started_at
  from public.analysis_requests as request
  where request.workspace_id = target_workspace_id
    and request.project_id = p_project_id
    and request.workflow_generation = current_generation
    and request.requested_by = actor_id
    and request.created_at >= pg_catalog.statement_timestamp() - interval '10 minutes';

  if recent_request_count >= 5 then
    retry_after_seconds := greatest(
      1,
      least(
        600,
        pg_catalog.ceil(
          extract(
            epoch from (
              rate_window_started_at + interval '10 minutes'
              - pg_catalog.statement_timestamp()
            )
          )
        )::integer
      )
    );
    return pg_catalog.jsonb_build_object(
      'status', 'rate_limited',
      'analysis_request_id', null,
      'source_document_id', null,
      'state', null,
      'change_event_id', null,
      'impact_run_id', null,
      'proposal_id', null,
      'retry_after_seconds', retry_after_seconds
    );
  end if;

  select source.id
  into source_document_id
  from public.source_documents as source
  where source.workspace_id = target_workspace_id
    and source.project_id = p_project_id
    and source.workflow_generation = current_generation
    and source.normalized_content_sha256 = p_normalized_content_sha256
    and source.raw_text = p_raw_text
    and source.title = pg_catalog.btrim(p_title, E' \t\r\n')
    and source.source_kind = p_source_kind
    and source.source_url is not distinct from p_source_url
    and source.occurred_at is not distinct from p_occurred_at
    and source.source_author = pg_catalog.btrim(
      p_source_author,
      E' \t\r\n'
    )
    and source.captured_by = actor_id
  order by source.created_at, source.id
  limit 1;

  if source_document_id is null then
    insert into public.source_documents (
      workspace_id,
      project_id,
      title,
      source_kind,
      source_url,
      raw_text,
      occurred_at,
      captured_by,
      source_author,
      normalized_content_sha256
    ) values (
      target_workspace_id,
      p_project_id,
      pg_catalog.btrim(p_title, E' \t\r\n'),
      p_source_kind,
      p_source_url,
      p_raw_text,
      p_occurred_at,
      actor_id,
      pg_catalog.btrim(p_source_author, E' \t\r\n'),
      p_normalized_content_sha256
    )
    returning id into source_document_id;
  end if;

  insert into public.analysis_requests (
    workspace_id,
    project_id,
    source_document_id,
    project_revision,
    normalized_content_sha256,
    model_name,
    requested_by
  ) values (
    target_workspace_id,
    p_project_id,
    source_document_id,
    p_expected_project_revision,
    p_normalized_content_sha256,
    p_model_name,
    actor_id
  )
  returning id into analysis_request_id;

  return pg_catalog.jsonb_build_object(
    'status', 'claimed',
    'analysis_request_id', analysis_request_id,
    'source_document_id', source_document_id,
    'state', 'processing',
    'change_event_id', null,
    'impact_run_id', null,
    'proposal_id', null,
    'retry_after_seconds', null
  );
end;
$$;

-- Allocate task and risk keys from active records only. Reset-retired history
-- can retain its original key without influencing the next live key.
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
  next_item_number numeric;
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

  select coalesce(
    pg_catalog.jsonb_agg(input.value order by input.value ->> 'action_id'),
    '[]'::jsonb
  )
  into normalized_human_inputs
  from pg_catalog.jsonb_array_elements(
    case
      when pg_catalog.jsonb_typeof(p_human_inputs) = 'array'
        then p_human_inputs
      else '[]'::jsonb
    end
  ) as input(value);

  request_hash := private.operation_request_hash(
    pg_catalog.jsonb_build_object(
      'operation_type', 'apply_proposal',
      'project_id', p_project_id,
      'proposal_id', p_proposal_id,
      'selected_action_ids', selected_ids_json,
      'human_inputs', normalized_human_inputs
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
      select item.* into target_item
      from public.project_items as item
      where item.workspace_id = target_workspace_id
        and item.project_id = p_project_id
        and item.id = action_row.target_item_id
        and not item.is_demo_retired;
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
          'version', target_item.version
        ),
        pg_catalog.jsonb_build_object(
          'field_name', action_row.payload ->> 'field_name',
          'value', after_value,
          'version', resulting_version
        ),
        target_item.version, resulting_version, true,
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
          )::numeric
        ),
        0
      ) + 1
      into next_item_number
      from public.project_items as item
      where item.workspace_id = target_workspace_id
        and item.project_id = p_project_id
        and not item.is_demo_retired
        and item.item_key ~ ('^' || item_prefix || '-[0-9]+$');
      created_item_key := item_prefix || '-'
        || case
          when next_item_number < 10
            then '0' || next_item_number::text
          else next_item_number::text
        end;

      if pg_catalog.char_length(created_item_key) > 64 then
        raise exception 'automatic item key space exhausted'
          using errcode = '22023';
      end if;

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

create or replace function private.record_undo_conflict(
  target_workspace_id uuid,
  target_project_id uuid,
  target_idempotency_key text,
  target_request_hash text,
  target_proposal_id uuid,
  target_reverses_operation_id uuid,
  actor_id uuid,
  safe_conflicts jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  operation_id uuid;
begin
  if pg_catalog.jsonb_typeof(safe_conflicts) <> 'array'
     or pg_catalog.jsonb_array_length(safe_conflicts) > 50
     or exists (
       select 1
       from pg_catalog.jsonb_array_elements(safe_conflicts) as conflict(value)
       where not private.jsonb_object_matches(
         conflict.value,
         array['item_id', 'expected_version', 'actual_version', 'reason'],
         array['item_id', 'expected_version', 'actual_version', 'reason']
       )
       or not private.is_uuid_text(conflict.value ->> 'item_id')
       or pg_catalog.jsonb_typeof(conflict.value -> 'expected_version')
         <> 'number'
       or conflict.value ->> 'expected_version' !~ '^[0-9]+$'
       or not (
         conflict.value -> 'actual_version' = 'null'::jsonb
         or (
           pg_catalog.jsonb_typeof(conflict.value -> 'actual_version')
             = 'number'
           and conflict.value ->> 'actual_version' ~ '^[0-9]+$'
         )
       )
       or conflict.value ->> 'reason' not in (
         'item_missing', 'version_mismatch', 'state_mismatch'
       )
     ) then
    raise exception 'invalid undo conflict metadata' using errcode = '22023';
  end if;

  insert into public.operation_logs (
    workspace_id, project_id, operation_type, state, idempotency_key,
    request_hash, proposal_id, reverses_operation_id, initiated_by,
    error_message, error_code, result_metadata, reversible
  ) values (
    target_workspace_id, target_project_id, 'undo', 'failed',
    target_idempotency_key, target_request_hash, target_proposal_id,
    target_reverses_operation_id, actor_id,
    'The operation was rejected without changing project data.',
    'undo_conflict',
    pg_catalog.jsonb_build_object(
      'error_code', 'undo_conflict',
      'conflicts', safe_conflicts
    ),
    false
  )
  returning id into operation_id;

  return pg_catalog.jsonb_build_object(
    'status', 'failed',
    'operation_id', operation_id,
    'error_code', 'undo_conflict',
    'conflicts', safe_conflicts
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
  safe_conflicts jsonb;
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
      return pg_catalog.jsonb_strip_nulls(
        pg_catalog.jsonb_build_object(
          'status', 'failed',
          'operation_id', existing_operation.id,
          'error_code', existing_operation.error_code,
          'conflicts', existing_operation.result_metadata -> 'conflicts'
        )
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

  select pg_catalog.count(*)::integer into original_item_count
  from public.operation_items as operation_item
  where operation_item.workspace_id = target_workspace_id
    and operation_item.project_id = p_project_id
    and operation_item.operation_id = p_operation_id
    and operation_item.state = 'succeeded'
    and operation_item.reversible;
  if original_item_count not between 1 and 50
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

  -- Lock each target once, in UUID order. Validation below compares the final
  -- version plus only the last applied value for each item/field pair. Earlier
  -- values are intentionally not required to equal the final row state.
  perform item.id
  from public.project_items as item
  where item.workspace_id = target_workspace_id
    and item.project_id = p_project_id
    and item.id in (
      select operation_item.item_id
      from public.operation_items as operation_item
      where operation_item.workspace_id = target_workspace_id
        and operation_item.project_id = p_project_id
        and operation_item.operation_id = p_operation_id
    )
  order by item.id
  for update of item;

  with original_items as (
    select operation_item.*
    from public.operation_items as operation_item
    where operation_item.workspace_id = target_workspace_id
      and operation_item.project_id = p_project_id
      and operation_item.operation_id = p_operation_id
  ),
  expected_items as (
    select
      original.item_id,
      pg_catalog.max(original.resulting_item_version) as expected_version
    from original_items as original
    group by original.item_id
  ),
  latest_fields as (
    select distinct on (
      original.item_id,
      original.after_state ->> 'field_name'
    )
      original.item_id,
      original.after_state ->> 'field_name' as field_name,
      original.after_state -> 'value' as expected_value
    from original_items as original
    order by
      original.item_id,
      original.after_state ->> 'field_name',
      original.ordinal desc,
      original.id desc
  ),
  conflicts as (
    select
      expected.item_id,
      expected.expected_version,
      item.version as actual_version,
      case
        when item.id is null then 'item_missing'
        when item.version <> expected.expected_version then 'version_mismatch'
        else 'state_mismatch'
      end as reason
    from expected_items as expected
    left join public.project_items as item
      on item.workspace_id = target_workspace_id
     and item.project_id = p_project_id
     and item.id = expected.item_id
     and not item.is_demo_retired
    where item.id is null
       or item.version <> expected.expected_version
       or exists (
         select 1
         from latest_fields as field
         where field.item_id = expected.item_id
           and private.current_project_item_field_value(
             target_workspace_id,
             p_project_id,
             expected.item_id,
             field.field_name
           ) is distinct from field.expected_value
       )
  )
  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'item_id', conflict.item_id::text,
        'expected_version', conflict.expected_version,
        'actual_version', conflict.actual_version,
        'reason', conflict.reason
      ) order by conflict.item_id
    ),
    '[]'::jsonb
  )
  into safe_conflicts
  from conflicts as conflict;

  if pg_catalog.jsonb_array_length(safe_conflicts) > 0 then
    return private.record_undo_conflict(
      target_workspace_id,
      p_project_id,
      p_idempotency_key,
      request_hash,
      original_operation.proposal_id,
      p_operation_id,
      actor_id,
      safe_conflicts
    );
  end if;

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

  -- The target rows remain locked after preflight. Reversing in exact opposite
  -- ordinal order safely supports multiple updates to one item, including
  -- repeated writes to the same field, while versions remain monotonic.
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

revoke all on function private.demo_baseline_fingerprint_v1(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.guard_demo_baseline_fingerprint()
  from public, anon, authenticated, service_role;
revoke all on function private.record_undo_conflict(
  uuid, uuid, text, text, uuid, uuid, uuid, jsonb
) from public, anon, authenticated, service_role;
revoke all on function private.begin_project_analysis_internal(
  uuid, text, text, text, text, text, text, timestamptz, text, text
) from public, anon, authenticated, service_role;
revoke all on function private.apply_project_proposal_internal(
  uuid, uuid, uuid[], jsonb, text
) from public, anon, authenticated, service_role;
revoke all on function private.undo_project_operation_internal(
  uuid, uuid, text
) from public, anon, authenticated, service_role;

grant usage on schema private to service_role;
grant execute on function private.begin_project_analysis_internal(
  uuid, text, text, text, text, text, text, timestamptz, text, text
) to service_role;
grant execute on function private.apply_project_proposal_internal(
  uuid, uuid, uuid[], jsonb, text
) to service_role;
grant execute on function private.undo_project_operation_internal(
  uuid, uuid, text
) to service_role;
