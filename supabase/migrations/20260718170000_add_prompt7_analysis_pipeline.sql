-- Prompt 7 analysis intake and inert proposal persistence.
--
-- The workflow is intentionally two phase. begin_project_analysis persists the
-- immutable evidence and reserves one analysis key before any model call.
-- complete_project_analysis accepts only validated, inert proposal data and
-- commits all derived rows atomically. Neither RPC mutates project records.

create type public.analysis_request_state as enum (
  'processing',
  'succeeded',
  'failed'
);

alter type public.proposal_action_type
  add value if not exists 'request_confirmation';

alter table public.source_documents
  add column source_author text,
  add column normalized_content_sha256 text,
  add constraint source_documents_author_shape check (
    source_author is null
    or pg_catalog.char_length(pg_catalog.btrim(source_author)) between 1 and 120
  ),
  add constraint source_documents_normalized_hash_shape check (
    normalized_content_sha256 is null
    or normalized_content_sha256 ~ '^[0-9a-f]{64}$'
  );

alter table public.change_events
  add column evidence_text text,
  add column evidence_start_offset integer,
  add column evidence_end_offset integer,
  add column review_context jsonb not null default pg_catalog.jsonb_build_object(),
  add constraint change_events_evidence_text_shape check (
    evidence_text is null
    or pg_catalog.char_length(pg_catalog.btrim(evidence_text)) between 1 and 2000
  ),
  add constraint change_events_evidence_offsets_shape check (
    (
      evidence_start_offset is null
      and evidence_end_offset is null
    )
    or (
      evidence_start_offset is not null
      and evidence_end_offset is not null
      and evidence_start_offset >= 0
      and evidence_end_offset > evidence_start_offset
      and evidence_text is not null
    )
  ),
  add constraint change_events_review_context_shape check (
    pg_catalog.jsonb_typeof(review_context) = 'object'
  );

create table public.analysis_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  source_document_id uuid not null,
  project_revision text not null check (
    project_revision ~ '^[0-9a-f]{64}$'
  ),
  normalized_content_sha256 text not null check (
    normalized_content_sha256 ~ '^[0-9a-f]{64}$'
  ),
  model_name text not null check (
    pg_catalog.char_length(model_name) between 1 and 120
    and model_name ~ '^[A-Za-z0-9._:/-]+$'
  ),
  state public.analysis_request_state not null default 'processing',
  requested_by uuid not null references public.profiles (id) on delete restrict,
  change_event_id uuid,
  impact_run_id uuid,
  proposal_id uuid,
  result_metadata jsonb,
  failure_stage text check (
    failure_stage is null
    or failure_stage in ('extraction', 'proposal', 'persistence')
  ),
  failure_code text check (
    failure_code is null
    or failure_code in (
      'model_timeout',
      'model_unavailable',
      'model_invalid_output',
      'stale_project_revision',
      'validation_failed',
      'analysis_cancelled',
      'internal_error'
    )
  ),
  failure_provider_request_id text check (
    failure_provider_request_id is null
    or (
      pg_catalog.char_length(failure_provider_request_id) between 1 and 200
      and failure_provider_request_id ~ '^[A-Za-z0-9_-]+$'
    )
  ),
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint analysis_requests_project_fk foreign key (workspace_id, project_id)
    references public.projects (workspace_id, id) on delete restrict,
  constraint analysis_requests_source_fk foreign key (
    workspace_id,
    project_id,
    source_document_id
  ) references public.source_documents (workspace_id, project_id, id)
    on delete restrict,
  constraint analysis_requests_change_fk foreign key (
    workspace_id,
    project_id,
    change_event_id
  ) references public.change_events (workspace_id, project_id, id)
    on delete restrict,
  constraint analysis_requests_impact_fk foreign key (
    workspace_id,
    project_id,
    impact_run_id
  ) references public.impact_runs (workspace_id, project_id, id)
    on delete restrict,
  constraint analysis_requests_proposal_fk foreign key (
    workspace_id,
    project_id,
    proposal_id
  ) references public.action_proposals (workspace_id, project_id, id)
    on delete restrict,
  constraint analysis_requests_state_shape check (
    (
      state = 'processing'
      and finished_at is null
      and failure_stage is null
      and failure_code is null
      and failure_provider_request_id is null
      and change_event_id is null
      and impact_run_id is null
      and proposal_id is null
      and result_metadata is null
    )
    or (
      state = 'succeeded'
      and finished_at is not null
      and failure_stage is null
      and failure_code is null
      and failure_provider_request_id is null
      and change_event_id is not null
      and impact_run_id is not null
      and proposal_id is not null
      and result_metadata is not null
      and pg_catalog.jsonb_typeof(result_metadata) = 'object'
    )
    or (
      state = 'failed'
      and finished_at is not null
      and failure_stage is not null
      and failure_code is not null
      and change_event_id is null
      and impact_run_id is null
      and proposal_id is null
      and result_metadata is null
    )
  ),
  unique (workspace_id, project_id, id),
  unique (
    workspace_id,
    project_id,
    project_revision,
    normalized_content_sha256
  )
);

comment on table public.analysis_requests is
  'One pre-model analysis claim per normalized source and impact-graph-v1 revision. Claims contain no raw model output and are terminal after success or failure.';
comment on column public.proposal_actions.action_type is
  'Prompt 7 mapping: update_item_field -> update_item; create_task/create_risk -> create_item with payload.item_type; request_confirmation -> request_confirmation.';

create index source_documents_project_normalized_hash_idx
  on public.source_documents (
    workspace_id,
    project_id,
    normalized_content_sha256,
    created_at
  )
  where normalized_content_sha256 is not null;
create index analysis_requests_actor_rate_idx
  on public.analysis_requests (
    workspace_id,
    project_id,
    requested_by,
    created_at desc
  );
create index analysis_requests_source_idx
  on public.analysis_requests (workspace_id, project_id, source_document_id);
create index analysis_requests_requested_by_idx
  on public.analysis_requests (requested_by);
create index analysis_requests_change_idx
  on public.analysis_requests (workspace_id, project_id, change_event_id)
  where change_event_id is not null;
create index analysis_requests_impact_idx
  on public.analysis_requests (workspace_id, project_id, impact_run_id)
  where impact_run_id is not null;
create index analysis_requests_proposal_idx
  on public.analysis_requests (workspace_id, project_id, proposal_id)
  where proposal_id is not null;

create or replace function private.normalize_source_text(source_text text)
returns text
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  with normalized as (
    select normalize(
      pg_catalog.replace(
        pg_catalog.replace(source_text, E'\r\n', E'\n'),
        E'\r',
        E'\n'
      ),
      NFC
    ) as value
  ),
  lines as (
    select
      line_number,
      pg_catalog.regexp_replace(
        pg_catalog.btrim(line, E' \t'),
        E'[ \t]+',
        ' ',
        'g'
      ) as value
    from normalized,
    lateral pg_catalog.regexp_split_to_table(normalized.value, E'\n')
      with ordinality as split(line, line_number)
  )
  select pg_catalog.btrim(
    coalesce(
      pg_catalog.string_agg(lines.value, E'\n' order by lines.line_number),
      ''
    ),
    E' \t\n'
  )
  from lines;
$$;

create or replace function private.source_normalized_sha256(source_text text)
returns text
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(private.normalize_source_text(source_text), 'UTF8'),
      'sha256'
    ),
    'hex'
  );
$$;

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
  item_count integer;
  edge_count integer;
  canonical_items text;
  canonical_edges text;
  canonical_graph text;
begin
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
    join active_items as dependent
      on dependent.id = dependency.from_item_id
    join active_items as upstream
      on upstream.id = dependency.to_item_id
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

  -- Byte-for-byte parity with computeImpactGraphRevision in context.ts.
  canonical_graph := 'impact-graph-v1' || E'\nitems\n'
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

create or replace function private.jsonb_object_matches(
  candidate jsonb,
  allowed_keys text[],
  required_keys text[]
)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select pg_catalog.jsonb_typeof(candidate) = 'object'
    and candidate ?& required_keys
    and not exists (
      select 1
      from pg_catalog.jsonb_object_keys(candidate) as supplied(key)
      where not (supplied.key = any(allowed_keys))
    );
$$;

create or replace function private.is_uuid_text(candidate text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select candidate ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
$$;

-- JavaScript string offsets are UTF-16 code-unit offsets. PostgreSQL text
-- positions count Unicode code points, so validate evidence spans explicitly
-- against the API contract instead of mixing the two units.
create or replace function private.evidence_matches_utf16_offsets(
  source_text text,
  evidence_text text,
  start_offset integer,
  end_offset integer
)
returns boolean
language plpgsql
immutable
strict
parallel safe
set search_path = ''
as $$
declare
  source_character_length integer := pg_catalog.char_length(source_text);
  character_position integer := 1;
  code_unit_offset integer := 0;
  code_unit_width integer;
  start_character_position integer;
  end_character_position integer;
  current_character text;
begin
  if start_offset < 0 or end_offset <= start_offset then
    return false;
  end if;

  while character_position <= source_character_length loop
    if code_unit_offset = start_offset then
      start_character_position := character_position;
    end if;
    if code_unit_offset = end_offset then
      end_character_position := character_position;
      exit;
    end if;

    current_character := pg_catalog.substr(
      source_text,
      character_position,
      1
    );
    code_unit_width := case
      when pg_catalog.ascii(current_character) > 65535 then 2
      else 1
    end;

    if (code_unit_offset < start_offset
        and code_unit_offset + code_unit_width > start_offset)
       or (code_unit_offset < end_offset
        and code_unit_offset + code_unit_width > end_offset) then
      return false;
    end if;

    code_unit_offset := code_unit_offset + code_unit_width;
    character_position := character_position + 1;
  end loop;

  if start_character_position is null
     and code_unit_offset = start_offset then
    start_character_position := source_character_length + 1;
  end if;
  if end_character_position is null
     and code_unit_offset = end_offset then
    end_character_position := source_character_length + 1;
  end if;

  return start_character_position is not null
    and end_character_position is not null
    and pg_catalog.substr(
      source_text,
      start_character_position,
      end_character_position - start_character_position
    ) = evidence_text;
end;
$$;

create or replace function private.is_iso_date_json(candidate jsonb)
returns boolean
language plpgsql
stable
parallel safe
set search_path = ''
as $$
declare
  parsed_date date;
  date_text text;
begin
  if candidate is null or candidate = 'null'::jsonb then
    return true;
  end if;
  if pg_catalog.jsonb_typeof(candidate) <> 'string' then
    return false;
  end if;
  date_text := candidate #>> '{}';
  if date_text !~ '^\d{4}-\d{2}-\d{2}$' then
    return false;
  end if;
  begin
    parsed_date := date_text::date;
  exception when others then
    return false;
  end;
  return pg_catalog.to_char(parsed_date, 'YYYY-MM-DD') = date_text;
end;
$$;

create or replace function private.is_bounded_string_array(
  candidate jsonb,
  maximum_items integer,
  maximum_length integer
)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select pg_catalog.jsonb_typeof(candidate) = 'array'
    and pg_catalog.jsonb_array_length(candidate) <= maximum_items
    and not exists (
      select 1
      from pg_catalog.jsonb_array_elements(candidate) as element(value)
      where pg_catalog.jsonb_typeof(element.value) <> 'string'
        or pg_catalog.char_length(
          pg_catalog.btrim(element.value #>> '{}')
        ) not between 1 and maximum_length
    );
$$;

create or replace function private.is_valid_model_metadata(candidate jsonb)
returns boolean
language plpgsql
immutable
parallel safe
set search_path = ''
as $$
declare
  usage_data jsonb;
  input_tokens numeric;
  cached_input_tokens numeric;
  cache_write_input_tokens numeric;
  output_tokens numeric;
  reasoning_output_tokens numeric;
  total_tokens numeric;
begin
  if not private.jsonb_object_matches(
      candidate,
      array['request_id', 'usage'],
      array['request_id', 'usage']
    )
    or not (
      candidate -> 'request_id' = 'null'::jsonb
      or (
        pg_catalog.jsonb_typeof(candidate -> 'request_id') = 'string'
        and pg_catalog.char_length(candidate ->> 'request_id') between 1 and 200
        and candidate ->> 'request_id' ~ '^[A-Za-z0-9_-]+$'
      )
    ) then
    return false;
  end if;

  usage_data := candidate -> 'usage';
  if usage_data = 'null'::jsonb then
    return true;
  end if;
  if not private.jsonb_object_matches(
      usage_data,
      array[
        'input_tokens',
        'cached_input_tokens',
        'cache_write_input_tokens',
        'output_tokens',
        'reasoning_output_tokens',
        'total_tokens'
      ],
      array[
        'input_tokens',
        'cached_input_tokens',
        'cache_write_input_tokens',
        'output_tokens',
        'reasoning_output_tokens',
        'total_tokens'
      ]
    )
    or exists (
      select 1
      from pg_catalog.jsonb_each(usage_data) as token_field(key, value)
      where pg_catalog.jsonb_typeof(token_field.value) <> 'number'
        or token_field.value #>> '{}' !~ '^\d+$'
    ) then
    return false;
  end if;

  input_tokens := (usage_data ->> 'input_tokens')::numeric;
  cached_input_tokens := (usage_data ->> 'cached_input_tokens')::numeric;
  cache_write_input_tokens := (
    usage_data ->> 'cache_write_input_tokens'
  )::numeric;
  output_tokens := (usage_data ->> 'output_tokens')::numeric;
  reasoning_output_tokens := (
    usage_data ->> 'reasoning_output_tokens'
  )::numeric;
  total_tokens := (usage_data ->> 'total_tokens')::numeric;
  return input_tokens between 0 and 1000000
    and cached_input_tokens between 0 and input_tokens
    and cache_write_input_tokens between 0 and input_tokens
    and output_tokens between 0 and 1000000
    and reasoning_output_tokens between 0 and output_tokens
    and total_tokens between 0 and 2000000
    and total_tokens = input_tokens + output_tokens;
exception when others then
  return false;
end;
$$;

create or replace function private.current_project_item_field_value(
  target_workspace_id uuid,
  target_project_id uuid,
  target_item_id uuid,
  target_field_name text
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select case target_field_name
    when 'title' then pg_catalog.to_jsonb(item.title)
    when 'description' then coalesce(
      pg_catalog.to_jsonb(item.description),
      'null'::jsonb
    )
    when 'status' then pg_catalog.to_jsonb(item.status::text)
    when 'priority' then pg_catalog.to_jsonb(item.priority::text)
    when 'owner_id' then coalesce(
      pg_catalog.to_jsonb(item.owner_id::text),
      'null'::jsonb
    )
    when 'start_date' then coalesce(
      pg_catalog.to_jsonb(item.start_date::text),
      'null'::jsonb
    )
    when 'due_date' then coalesce(
      pg_catalog.to_jsonb(item.due_date::text),
      'null'::jsonb
    )
    when 'event_date' then coalesce(
      pg_catalog.to_jsonb(item.event_date::text),
      'null'::jsonb
    )
    else null
  end
  from public.project_items as item
  where item.workspace_id = target_workspace_id
    and item.project_id = target_project_id
    and item.id = target_item_id;
$$;

create or replace function private.compute_impact_paths(
  target_workspace_id uuid,
  target_project_id uuid,
  changed_item_id uuid,
  maximum_depth integer
)
returns table (
  item_id uuid,
  depth integer,
  path_item_ids uuid[]
)
language plpgsql
stable
set search_path = ''
as $$
declare
  queue jsonb := '[]'::jsonb;
  seen jsonb := '{}'::jsonb;
  queue_index integer := 0;
  current_entry jsonb;
  current_item_id uuid;
  current_depth integer;
  current_path jsonb;
  neighbor_id uuid;
  next_path jsonb;
begin
  if maximum_depth < 0 or maximum_depth > 20 then
    raise exception 'invalid impact depth' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.project_items as item
    where item.workspace_id = target_workspace_id
      and item.project_id = target_project_id
      and item.id = changed_item_id
      and item.status in (
        'not_started'::public.project_item_status,
        'in_progress'::public.project_item_status,
        'blocked'::public.project_item_status,
        'at_risk'::public.project_item_status
      )
  ) then
    return;
  end if;

  queue := pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_build_object(
      'item_id', changed_item_id::text,
      'depth', 0,
      'path', pg_catalog.jsonb_build_array(changed_item_id::text)
    )
  );
  seen := pg_catalog.jsonb_build_object(changed_item_id::text, true);

  while queue_index < pg_catalog.jsonb_array_length(queue) loop
    current_entry := queue -> queue_index;
    queue_index := queue_index + 1;
    current_item_id := (current_entry ->> 'item_id')::uuid;
    current_depth := (current_entry ->> 'depth')::integer;
    current_path := current_entry -> 'path';

    if current_depth >= maximum_depth then
      continue;
    end if;

    for neighbor_id in
      select distinct dependency.from_item_id
      from public.item_dependencies as dependency
      join public.project_items as dependent
        on dependent.workspace_id = dependency.workspace_id
       and dependent.project_id = dependency.project_id
       and dependent.id = dependency.from_item_id
       and dependent.status in (
         'not_started'::public.project_item_status,
         'in_progress'::public.project_item_status,
         'blocked'::public.project_item_status,
         'at_risk'::public.project_item_status
       )
      where dependency.workspace_id = target_workspace_id
        and dependency.project_id = target_project_id
        and dependency.to_item_id = current_item_id
        and dependency.from_item_id <> dependency.to_item_id
      order by dependency.from_item_id
    loop
      if not (seen ? neighbor_id::text) then
        next_path := current_path
          || pg_catalog.jsonb_build_array(neighbor_id::text);
        seen := seen || pg_catalog.jsonb_build_object(neighbor_id::text, true);
        queue := queue || pg_catalog.jsonb_build_array(
          pg_catalog.jsonb_build_object(
            'item_id', neighbor_id::text,
            'depth', current_depth + 1,
            'path', next_path
          )
        );
        if pg_catalog.jsonb_array_length(queue) > 200 then
          raise exception 'project graph exceeds the supported item bound'
            using errcode = '54000';
        end if;
      end if;
    end loop;
  end loop;

  return query
  select
    (entry.value ->> 'item_id')::uuid,
    (entry.value ->> 'depth')::integer,
    array(
      select path_element.value::uuid
      from pg_catalog.jsonb_array_elements_text(
        entry.value -> 'path'
      ) with ordinality as path_element(value, position)
      order by path_element.position
    )
  from pg_catalog.jsonb_array_elements(queue) as entry(value)
  where (entry.value ->> 'depth')::integer > 0
  order by
    (entry.value ->> 'depth')::integer,
    (entry.value ->> 'item_id')::text collate "C";
end;
$$;

create or replace function private.guard_analysis_request_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.workspace_id is distinct from old.workspace_id
     or new.project_id is distinct from old.project_id
     or new.source_document_id is distinct from old.source_document_id
     or new.project_revision is distinct from old.project_revision
     or new.normalized_content_sha256 is distinct from old.normalized_content_sha256
     or new.model_name is distinct from old.model_name
     or new.requested_by is distinct from old.requested_by
     or new.created_at is distinct from old.created_at then
    raise exception 'analysis request identity is immutable'
      using errcode = '23514';
  end if;

  if old.state <> 'processing'::public.analysis_request_state
     or new.state not in (
       'succeeded'::public.analysis_request_state,
       'failed'::public.analysis_request_state
     ) then
    raise exception 'invalid analysis request transition'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger analysis_requests_guard_transition
before update on public.analysis_requests
for each row execute function private.guard_analysis_request_transition();

create trigger analysis_requests_reject_delete
before delete on public.analysis_requests
for each row execute function public.reject_immutable_change();

create trigger change_events_protect_prompt7_evidence
before update on public.change_events
for each row execute function public.reject_immutable_columns(
  'evidence_text,evidence_start_offset,evidence_end_offset,review_context'
);

create or replace function public.begin_project_analysis(
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

  select project.workspace_id
  into target_workspace_id
  from public.projects as project
  where project.id = p_project_id;

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

create or replace function public.complete_project_analysis(
  p_analysis_request_id uuid,
  p_expected_project_revision text,
  p_result jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  actor_id uuid;
  request_row public.analysis_requests%rowtype;
  source_raw_text text;
  current_revision text;
  model_name text;
  extraction_metadata jsonb;
  proposal_metadata jsonb;
  validation_outcome jsonb;
  change_data jsonb;
  impact_data jsonb;
  proposal_data jsonb;
  review_context jsonb;
  subject_item_id uuid;
  subject_item_type public.project_item_type;
  subject_item_version bigint;
  expected_subject_item_version bigint;
  field_name text;
  previous_value jsonb;
  proposed_value jsonb;
  current_value jsonb;
  confidence numeric;
  evidence_text text;
  evidence_start_offset integer;
  evidence_end_offset integer;
  maximum_depth integer;
  impact_entry jsonb;
  impact_item_id uuid;
  impact_depth integer;
  impact_path jsonb;
  impact_path_ids uuid[];
  impact_path_length integer;
  impact_index integer;
  seen_impact_ids uuid[] := '{}'::uuid[];
  impact_sets_differ boolean;
  action_entry jsonb;
  action_payload jsonb;
  prompt_action_type text;
  target_item_id uuid;
  expected_item_version bigint;
  target_item_type public.project_item_type;
  target_item_version bigint;
  linked_impact_item_id uuid;
  action_confidence numeric;
  action_requires_human_input boolean;
  action_field_name text;
  action_proposed_value jsonb;
  create_owner_id uuid;
  current_start_date date;
  current_due_date date;
  proposed_date date;
  create_start_date date;
  create_due_date date;
  persisted_change_event_id uuid;
  persisted_impact_run_id uuid;
  persisted_proposal_id uuid;
  action_ordinal integer;
  database_action_type public.proposal_action_type;
  completion_time timestamptz := pg_catalog.statement_timestamp();
begin
  actor_id := (select auth.uid());
  if actor_id is null
     or coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select request.*
  into request_row
  from public.analysis_requests as request
  where request.id = p_analysis_request_id
  for update;

  if not found
     or request_row.requested_by <> actor_id
     or not exists (
       select 1
       from public.workspace_members as member
       where member.workspace_id = request_row.workspace_id
         and member.user_id = actor_id
         and member.role in (
           'owner'::public.workspace_role,
           'admin'::public.workspace_role,
           'member'::public.workspace_role
         )
     ) then
    raise exception 'analysis request not found or access denied'
      using errcode = '42501';
  end if;

  if request_row.state = 'succeeded'::public.analysis_request_state then
    return pg_catalog.jsonb_build_object(
      'status', 'duplicate_succeeded',
      'analysis_request_id', request_row.id,
      'source_document_id', request_row.source_document_id,
      'change_event_id', request_row.change_event_id,
      'impact_run_id', request_row.impact_run_id,
      'proposal_id', request_row.proposal_id,
      'state', request_row.state::text
    );
  end if;
  if request_row.state <> 'processing'::public.analysis_request_state then
    raise exception 'analysis request is not processing' using errcode = '55000';
  end if;

  if p_expected_project_revision is null
     or p_expected_project_revision !~ '^[0-9a-f]{64}$'
     or p_expected_project_revision <> request_row.project_revision then
    raise exception 'analysis revision mismatch' using errcode = '40001';
  end if;

  -- Prompt 5 record writes take ROW EXCLUSIVE table locks. Holding SHARE here
  -- prevents any item/dependency insert, update, or delete from racing the
  -- revision check and the atomic derived-record commit below.
  lock table public.project_items, public.item_dependencies in share mode;

  current_revision := private.compute_project_revision(
    request_row.workspace_id,
    request_row.project_id
  );
  if current_revision <> request_row.project_revision then
    raise exception 'stale project revision' using errcode = '40001';
  end if;

  if p_result is null
     or pg_catalog.octet_length(p_result::text) > 250000
     or not private.jsonb_object_matches(
       p_result,
       array[
         'model_name',
         'extraction_metadata',
         'proposal_metadata',
         'validation_outcome',
         'change',
         'impact',
         'proposal'
       ],
       array[
         'model_name',
         'extraction_metadata',
         'proposal_metadata',
         'validation_outcome',
         'change',
         'impact',
         'proposal'
       ]
     ) then
    raise exception 'invalid analysis result shape' using errcode = '22023';
  end if;

  if pg_catalog.jsonb_typeof(p_result -> 'model_name') <> 'string'
     or pg_catalog.char_length(p_result ->> 'model_name') not between 1 and 120
     or p_result ->> 'model_name' !~ '^[A-Za-z0-9._:/-]+$' then
    raise exception 'invalid model name' using errcode = '22023';
  end if;
  model_name := p_result ->> 'model_name';
  if model_name <> request_row.model_name then
    raise exception 'analysis model does not match the claimed model'
      using errcode = '22023';
  end if;

  extraction_metadata := p_result -> 'extraction_metadata';
  proposal_metadata := p_result -> 'proposal_metadata';
  if not private.is_valid_model_metadata(extraction_metadata)
     or not private.is_valid_model_metadata(proposal_metadata) then
    raise exception 'invalid model metadata' using errcode = '22023';
  end if;

  validation_outcome := p_result -> 'validation_outcome';
  if not private.jsonb_object_matches(
      validation_outcome,
      array[
        'status',
        'ambiguities',
        'unresolved_references',
        'warnings',
        'review_reasons'
      ],
      array[
        'status',
        'ambiguities',
        'unresolved_references',
        'warnings',
        'review_reasons'
      ]
    )
    or pg_catalog.jsonb_typeof(validation_outcome -> 'status') <> 'string'
    or validation_outcome ->> 'status' not in ('needs_review', 'valid')
    or not private.is_bounded_string_array(
      validation_outcome -> 'ambiguities', 25, 500
    )
    or not private.is_bounded_string_array(
      validation_outcome -> 'unresolved_references', 25, 500
    )
    or not private.is_bounded_string_array(
      validation_outcome -> 'warnings', 25, 500
    )
    or not private.is_bounded_string_array(
      validation_outcome -> 'review_reasons', 25, 500
    ) then
    raise exception 'invalid validation outcome' using errcode = '22023';
  end if;

  review_context := pg_catalog.jsonb_build_object(
    'ambiguities', validation_outcome -> 'ambiguities',
    'unresolved_references', validation_outcome -> 'unresolved_references',
    'warnings', validation_outcome -> 'warnings',
    'review_reasons', validation_outcome -> 'review_reasons'
  );

  change_data := p_result -> 'change';
  if not private.jsonb_object_matches(
      change_data,
      array[
        'target_item_id',
        'field_name',
        'previous_value',
        'proposed_value',
        'confidence',
        'evidence_text',
        'evidence_start_offset',
        'evidence_end_offset',
        'expected_item_version'
      ],
      array[
        'target_item_id',
        'field_name',
        'previous_value',
        'proposed_value',
        'confidence',
        'evidence_text',
        'evidence_start_offset',
        'evidence_end_offset',
        'expected_item_version'
      ]
    )
    or pg_catalog.jsonb_typeof(change_data -> 'target_item_id') <> 'string'
    or not private.is_uuid_text(change_data ->> 'target_item_id')
    or pg_catalog.jsonb_typeof(change_data -> 'field_name') <> 'string'
    or change_data ->> 'field_name' not in (
      'title',
      'description',
      'status',
      'priority',
      'owner_id',
      'start_date',
      'due_date',
      'event_date'
    )
    or pg_catalog.jsonb_typeof(change_data -> 'confidence') <> 'number'
    or pg_catalog.jsonb_typeof(change_data -> 'expected_item_version') <> 'number'
    or change_data ->> 'expected_item_version' !~ '^\d+$' then
    raise exception 'invalid proposed change shape' using errcode = '22023';
  end if;

  subject_item_id := (change_data ->> 'target_item_id')::uuid;
  expected_subject_item_version := (
    change_data ->> 'expected_item_version'
  )::bigint;
  field_name := change_data ->> 'field_name';
  previous_value := change_data -> 'previous_value';
  proposed_value := change_data -> 'proposed_value';
  confidence := (change_data ->> 'confidence')::numeric;
  if confidence < 0 or confidence > 1 then
    raise exception 'invalid change confidence' using errcode = '22023';
  end if;

  select item.item_type, item.version
  into subject_item_type, subject_item_version
  from public.project_items as item
  where item.workspace_id = request_row.workspace_id
    and item.project_id = request_row.project_id
    and item.id = subject_item_id
    and item.status in (
      'not_started'::public.project_item_status,
      'in_progress'::public.project_item_status,
      'blocked'::public.project_item_status,
      'at_risk'::public.project_item_status
    );
  if not found
     or expected_subject_item_version < 1
     or subject_item_version <> expected_subject_item_version then
    raise exception 'change subject is not an active project item'
      using errcode = '40001';
  end if;

  current_value := private.current_project_item_field_value(
    request_row.workspace_id,
    request_row.project_id,
    subject_item_id,
    field_name
  );
  if current_value is distinct from previous_value then
    raise exception 'change previous value is stale or noncanonical'
      using errcode = '40001';
  end if;
  if current_value is not distinct from proposed_value then
    raise exception 'proposed change does not change canonical state'
      using errcode = '22023';
  end if;

  if (
    field_name = 'title'
    and (
      pg_catalog.jsonb_typeof(proposed_value) <> 'string'
      or pg_catalog.char_length(
        pg_catalog.btrim(proposed_value #>> '{}')
      ) not between 1 and 240
    )
  ) or (
    field_name = 'description'
    and proposed_value <> 'null'::jsonb
    and (
      pg_catalog.jsonb_typeof(proposed_value) <> 'string'
      or pg_catalog.char_length(proposed_value #>> '{}') > 10000
    )
  ) or (
    field_name = 'status'
    and (
      pg_catalog.jsonb_typeof(proposed_value) <> 'string'
      or proposed_value #>> '{}' not in (
        'not_started',
        'in_progress',
        'blocked',
        'at_risk',
        'completed',
        'cancelled'
      )
    )
  ) or (
    field_name = 'priority'
    and (
      pg_catalog.jsonb_typeof(proposed_value) <> 'string'
      or proposed_value #>> '{}' not in ('low', 'medium', 'high', 'critical')
    )
  ) or (
    field_name = 'owner_id'
    and not (
      proposed_value = 'null'::jsonb
      or (
        pg_catalog.jsonb_typeof(proposed_value) = 'string'
        and private.is_uuid_text(proposed_value #>> '{}')
        and exists (
          select 1
          from public.workspace_members as proposed_owner
          where proposed_owner.workspace_id = request_row.workspace_id
            and proposed_owner.user_id::text = pg_catalog.lower(
              proposed_value #>> '{}'
            )
        )
      )
    )
  ) or (
    field_name in ('start_date', 'due_date', 'event_date')
    and not private.is_iso_date_json(proposed_value)
  ) or (
    field_name = 'event_date'
    and subject_item_type <> 'event'::public.project_item_type
  ) then
    raise exception 'invalid proposed field value' using errcode = '22023';
  end if;

  if field_name in ('start_date', 'due_date') then
    select item.start_date, item.due_date
    into current_start_date, current_due_date
    from public.project_items as item
    where item.workspace_id = request_row.workspace_id
      and item.project_id = request_row.project_id
      and item.id = subject_item_id;
    proposed_date := case
      when proposed_value = 'null'::jsonb then null
      else (proposed_value #>> '{}')::date
    end;
    if field_name = 'start_date' then
      current_start_date := proposed_date;
    else
      current_due_date := proposed_date;
    end if;
    if current_start_date is not null
       and current_due_date is not null
       and current_start_date > current_due_date then
      raise exception 'proposed dates are out of order' using errcode = '22023';
    end if;
  end if;

  if pg_catalog.jsonb_typeof(change_data -> 'evidence_text') = 'string'
     and pg_catalog.char_length(
       pg_catalog.btrim(change_data ->> 'evidence_text')
     ) between 1 and 2000 then
    evidence_text := change_data ->> 'evidence_text';
  else
    raise exception 'invalid evidence text' using errcode = '22023';
  end if;

  if (change_data -> 'evidence_start_offset' = 'null'::jsonb)
     <> (change_data -> 'evidence_end_offset' = 'null'::jsonb) then
    raise exception 'evidence offsets must both be null or both be integers'
      using errcode = '22023';
  end if;
  if change_data -> 'evidence_start_offset' <> 'null'::jsonb then
    if pg_catalog.jsonb_typeof(change_data -> 'evidence_start_offset') <> 'number'
       or pg_catalog.jsonb_typeof(change_data -> 'evidence_end_offset') <> 'number'
       or change_data ->> 'evidence_start_offset' !~ '^\d+$'
       or change_data ->> 'evidence_end_offset' !~ '^\d+$' then
      raise exception 'invalid evidence offsets' using errcode = '22023';
    end if;
    evidence_start_offset := (change_data ->> 'evidence_start_offset')::integer;
    evidence_end_offset := (change_data ->> 'evidence_end_offset')::integer;
  end if;

  select source.raw_text
  into source_raw_text
  from public.source_documents as source
  where source.workspace_id = request_row.workspace_id
    and source.project_id = request_row.project_id
    and source.id = request_row.source_document_id;

  if evidence_text is not null
     and pg_catalog.strpos(source_raw_text, evidence_text) = 0 then
    raise exception 'evidence text is not present in the source'
      using errcode = '22023';
  end if;
  if evidence_start_offset is not null
     and not private.evidence_matches_utf16_offsets(
       source_raw_text,
       evidence_text,
       evidence_start_offset,
       evidence_end_offset
     ) then
    raise exception 'evidence offsets do not identify the evidence text'
      using errcode = '22023';
  end if;

  impact_data := p_result -> 'impact';
  if not private.jsonb_object_matches(
      impact_data,
      array['max_depth', 'items'],
      array['max_depth', 'items']
    )
    or pg_catalog.jsonb_typeof(impact_data -> 'max_depth') <> 'number'
    or impact_data ->> 'max_depth' !~ '^\d+$'
    or pg_catalog.jsonb_typeof(impact_data -> 'items') <> 'array'
    or pg_catalog.jsonb_array_length(impact_data -> 'items') > 199 then
    raise exception 'invalid impact result shape' using errcode = '22023';
  end if;
  maximum_depth := (impact_data ->> 'max_depth')::integer;
  if maximum_depth < 1 or maximum_depth > 20 then
    raise exception 'invalid maximum impact depth' using errcode = '22023';
  end if;

  for impact_entry in
    select element.value
    from pg_catalog.jsonb_array_elements(impact_data -> 'items')
      with ordinality as element(value, position)
    order by element.position
  loop
    if not private.jsonb_object_matches(
        impact_entry,
        array[
          'item_id',
          'severity',
          'depth',
          'path_item_ids',
          'explanation'
        ],
        array[
          'item_id',
          'severity',
          'depth',
          'path_item_ids',
          'explanation'
        ]
      )
      or pg_catalog.jsonb_typeof(impact_entry -> 'item_id') <> 'string'
      or not private.is_uuid_text(impact_entry ->> 'item_id')
      or pg_catalog.jsonb_typeof(impact_entry -> 'severity') <> 'string'
      or impact_entry ->> 'severity' not in ('low', 'medium', 'high', 'critical')
      or pg_catalog.jsonb_typeof(impact_entry -> 'depth') <> 'number'
      or impact_entry ->> 'depth' !~ '^\d+$'
      or pg_catalog.jsonb_typeof(impact_entry -> 'path_item_ids') <> 'array'
      or pg_catalog.jsonb_typeof(impact_entry -> 'explanation') <> 'string'
      or pg_catalog.char_length(
        pg_catalog.btrim(impact_entry ->> 'explanation')
      ) not between 1 and 1000 then
      raise exception 'invalid impact item shape' using errcode = '22023';
    end if;

    impact_item_id := (impact_entry ->> 'item_id')::uuid;
    impact_depth := (impact_entry ->> 'depth')::integer;
    impact_path := impact_entry -> 'path_item_ids';
    impact_path_length := pg_catalog.jsonb_array_length(impact_path);

    if impact_depth < 1
       or impact_depth > maximum_depth
       or impact_path_length <> impact_depth + 1
       or impact_path_length > 21
       or impact_item_id = any(seen_impact_ids) then
      raise exception 'invalid or duplicate impact path' using errcode = '22023';
    end if;
    seen_impact_ids := pg_catalog.array_append(seen_impact_ids, impact_item_id);

    if exists (
      select 1
      from pg_catalog.jsonb_array_elements(impact_path) as path_element(value)
      where pg_catalog.jsonb_typeof(path_element.value) <> 'string'
        or not private.is_uuid_text(path_element.value #>> '{}')
    ) then
      raise exception 'impact path contains an invalid item ID'
        using errcode = '22023';
    end if;

    impact_path_ids := array(
      select path_element.value::uuid
      from pg_catalog.jsonb_array_elements_text(impact_path)
        with ordinality as path_element(value, position)
      order by path_element.position
    );
    if impact_path_ids[1] <> subject_item_id
       or impact_path_ids[impact_path_length] <> impact_item_id
       or (
         select pg_catalog.count(*)
         from (
           select distinct path_id
           from pg_catalog.unnest(impact_path_ids) as path_id
         ) as distinct_path
       ) <> impact_path_length then
      raise exception 'impact path endpoints or uniqueness are invalid'
        using errcode = '22023';
    end if;

    select pg_catalog.count(*)::integer
    into impact_index
    from public.project_items as item
    where item.workspace_id = request_row.workspace_id
      and item.project_id = request_row.project_id
      and item.id = any(impact_path_ids)
      and item.status in (
        'not_started'::public.project_item_status,
        'in_progress'::public.project_item_status,
        'blocked'::public.project_item_status,
        'at_risk'::public.project_item_status
      );
    if impact_index <> impact_path_length then
      raise exception 'impact path crosses an inactive or foreign item'
        using errcode = '22023';
    end if;

    for hop_index in 1..impact_path_length - 1 loop
      if not exists (
        select 1
        from public.item_dependencies as dependency
        where dependency.workspace_id = request_row.workspace_id
          and dependency.project_id = request_row.project_id
          and dependency.to_item_id = impact_path_ids[hop_index]
          and dependency.from_item_id = impact_path_ids[hop_index + 1]
      ) then
        raise exception 'impact path contains a non-edge or reversed edge'
          using errcode = '22023';
      end if;
    end loop;
  end loop;

  with provided as (
    select
      (element.value ->> 'item_id')::uuid as item_id,
      (element.value ->> 'depth')::integer as depth,
      array(
        select path_element.value::uuid
        from pg_catalog.jsonb_array_elements_text(
          element.value -> 'path_item_ids'
        ) with ordinality as path_element(value, position)
        order by path_element.position
      ) as path_item_ids
    from pg_catalog.jsonb_array_elements(impact_data -> 'items') as element(value)
  ),
  expected as (
    select path.item_id, path.depth, path.path_item_ids
    from private.compute_impact_paths(
      request_row.workspace_id,
      request_row.project_id,
      subject_item_id,
      maximum_depth
    ) as path
  ),
  differences as (
    (
      select expected.item_id, expected.depth, expected.path_item_ids
      from expected
      except all
      select provided.item_id, provided.depth, provided.path_item_ids
      from provided
    )
    union all
    (
      select provided.item_id, provided.depth, provided.path_item_ids
      from provided
      except all
      select expected.item_id, expected.depth, expected.path_item_ids
      from expected
      )
    )
  select exists (select 1 from differences)
  into impact_sets_differ;

  if impact_sets_differ then
    raise exception 'impact items do not match deterministic traversal'
      using errcode = '22023';
  end if;

  proposal_data := p_result -> 'proposal';
  if not private.jsonb_object_matches(
      proposal_data,
      array['title', 'rationale', 'actions'],
      array['title', 'rationale', 'actions']
    )
    or pg_catalog.jsonb_typeof(proposal_data -> 'title') <> 'string'
    or pg_catalog.char_length(
      pg_catalog.btrim(proposal_data ->> 'title')
    ) not between 1 and 240
    or pg_catalog.jsonb_typeof(proposal_data -> 'rationale') <> 'string'
    or pg_catalog.char_length(
      pg_catalog.btrim(proposal_data ->> 'rationale')
    ) not between 1 and 2000
    or pg_catalog.jsonb_typeof(proposal_data -> 'actions') <> 'array'
    or pg_catalog.jsonb_array_length(proposal_data -> 'actions') not between 1 and 8 then
    raise exception 'invalid proposal shape' using errcode = '22023';
  end if;

  for action_entry in
    select element.value
    from pg_catalog.jsonb_array_elements(proposal_data -> 'actions')
      with ordinality as element(value, position)
    order by element.position
  loop
    if not private.jsonb_object_matches(
        action_entry,
        array[
          'target_item_id',
          'expected_item_version',
          'rationale',
          'payload'
        ],
        array[
          'target_item_id',
          'expected_item_version',
          'rationale',
          'payload'
        ]
      )
      or pg_catalog.jsonb_typeof(action_entry -> 'rationale') <> 'string'
      or pg_catalog.char_length(
        pg_catalog.btrim(action_entry ->> 'rationale')
      ) not between 1 and 1000
      or pg_catalog.jsonb_typeof(action_entry -> 'payload') <> 'object' then
      raise exception 'invalid proposal action shape' using errcode = '22023';
    end if;

    action_payload := action_entry -> 'payload';
    if pg_catalog.jsonb_typeof(action_payload -> 'prompt_action_type') <> 'string'
       or pg_catalog.jsonb_typeof(action_payload -> 'linked_impact_item_id') <> 'string'
       or not private.is_uuid_text(
         action_payload ->> 'linked_impact_item_id'
       )
       or pg_catalog.jsonb_typeof(action_payload -> 'confidence') <> 'number'
       or pg_catalog.jsonb_typeof(
         action_payload -> 'requires_human_input'
       ) <> 'boolean' then
      raise exception 'invalid proposal action payload' using errcode = '22023';
    end if;

    prompt_action_type := action_payload ->> 'prompt_action_type';
    linked_impact_item_id := (
      action_payload ->> 'linked_impact_item_id'
    )::uuid;
    action_confidence := (action_payload ->> 'confidence')::numeric;
    action_requires_human_input := (
      action_payload ->> 'requires_human_input'
    )::boolean;
    if action_confidence < 0 or action_confidence > 1 then
      raise exception 'invalid proposal action confidence'
        using errcode = '22023';
    end if;
    if action_confidence < 0.8 and not action_requires_human_input then
      raise exception 'low-confidence action requires human input'
        using errcode = '22023';
    end if;

    if linked_impact_item_id <> subject_item_id
       and not exists (
         select 1
         from pg_catalog.jsonb_array_elements(
           impact_data -> 'items'
         ) as linked_impact(value)
         where linked_impact.value ->> 'item_id'
           = linked_impact_item_id::text
       ) then
      raise exception 'proposal action links to an unknown impact item'
        using errcode = '22023';
    end if;

    if prompt_action_type = 'update_item_field' then
      if not private.jsonb_object_matches(
          action_payload,
          array[
            'prompt_action_type',
            'field_name',
            'proposed_value',
            'linked_impact_item_id',
            'confidence',
            'requires_human_input'
          ],
          array[
            'prompt_action_type',
            'field_name',
            'proposed_value',
            'linked_impact_item_id',
            'confidence',
            'requires_human_input'
          ]
        )
        or pg_catalog.jsonb_typeof(action_entry -> 'target_item_id') <> 'string'
        or not private.is_uuid_text(action_entry ->> 'target_item_id')
        or pg_catalog.jsonb_typeof(
          action_entry -> 'expected_item_version'
        ) <> 'number'
        or action_entry ->> 'expected_item_version' !~ '^\d+$'
        or pg_catalog.jsonb_typeof(action_payload -> 'field_name') <> 'string'
        or action_payload ->> 'field_name' not in (
          'title',
          'description',
          'status',
          'priority',
          'owner_id',
          'start_date',
          'due_date',
          'event_date'
        ) then
        raise exception 'invalid update action contract' using errcode = '22023';
      end if;

      target_item_id := (action_entry ->> 'target_item_id')::uuid;
      expected_item_version := (
        action_entry ->> 'expected_item_version'
      )::bigint;
      action_field_name := action_payload ->> 'field_name';
      action_proposed_value := action_payload -> 'proposed_value';
      if expected_item_version < 1
         or (
           target_item_id <> subject_item_id
           and not exists (
             select 1
             from pg_catalog.jsonb_array_elements(
               impact_data -> 'items'
             ) as target_impact(value)
             where target_impact.value ->> 'item_id' = target_item_id::text
           )
         ) then
        raise exception 'update action target is inconsistent'
          using errcode = '22023';
      end if;

      select item.item_type, item.version
      into target_item_type, target_item_version
      from public.project_items as item
      where item.workspace_id = request_row.workspace_id
        and item.project_id = request_row.project_id
        and item.id = target_item_id;
      if not found or target_item_version <> expected_item_version then
        raise exception 'update action target is stale or outside the project'
          using errcode = '40001';
      end if;
      if private.current_project_item_field_value(
          request_row.workspace_id,
          request_row.project_id,
          target_item_id,
          action_field_name
        ) is not distinct from action_proposed_value then
        raise exception 'update action does not change canonical state'
          using errcode = '22023';
      end if;

      if (
        action_field_name = 'title'
        and (
          pg_catalog.jsonb_typeof(action_proposed_value) <> 'string'
          or pg_catalog.char_length(
            pg_catalog.btrim(action_proposed_value #>> '{}')
          ) not between 1 and 240
        )
      ) or (
        action_field_name = 'description'
        and action_proposed_value <> 'null'::jsonb
        and (
          pg_catalog.jsonb_typeof(action_proposed_value) <> 'string'
          or pg_catalog.char_length(action_proposed_value #>> '{}') > 10000
        )
      ) or (
        action_field_name = 'status'
        and (
          pg_catalog.jsonb_typeof(action_proposed_value) <> 'string'
          or action_proposed_value #>> '{}' not in (
            'not_started',
            'in_progress',
            'blocked',
            'at_risk',
            'completed',
            'cancelled'
          )
        )
      ) or (
        action_field_name = 'priority'
        and (
          pg_catalog.jsonb_typeof(action_proposed_value) <> 'string'
          or action_proposed_value #>> '{}' not in (
            'low', 'medium', 'high', 'critical'
          )
        )
      ) or (
        action_field_name = 'owner_id'
        and not (
          action_proposed_value = 'null'::jsonb
          or (
            pg_catalog.jsonb_typeof(action_proposed_value) = 'string'
            and private.is_uuid_text(action_proposed_value #>> '{}')
            and exists (
              select 1
              from public.workspace_members as proposed_owner
              where proposed_owner.workspace_id = request_row.workspace_id
                and proposed_owner.user_id::text = pg_catalog.lower(
                  action_proposed_value #>> '{}'
                )
            )
          )
        )
      ) or (
        action_field_name in ('start_date', 'due_date', 'event_date')
        and not private.is_iso_date_json(action_proposed_value)
      ) or (
        action_field_name = 'event_date'
        and target_item_type <> 'event'::public.project_item_type
      ) then
        raise exception 'invalid update action field value'
          using errcode = '22023';
      end if;

      if action_field_name in ('start_date', 'due_date') then
        select item.start_date, item.due_date
        into current_start_date, current_due_date
        from public.project_items as item
        where item.workspace_id = request_row.workspace_id
          and item.project_id = request_row.project_id
          and item.id = target_item_id;
        proposed_date := case
          when action_proposed_value = 'null'::jsonb then null
          else (action_proposed_value #>> '{}')::date
        end;
        if action_field_name = 'start_date' then
          current_start_date := proposed_date;
        else
          current_due_date := proposed_date;
        end if;
        if current_start_date is not null
           and current_due_date is not null
           and current_start_date > current_due_date then
          raise exception 'proposed dates are out of order'
            using errcode = '22023';
        end if;
      end if;

    elsif prompt_action_type in ('create_task', 'create_risk') then
      if not private.jsonb_object_matches(
          action_payload,
          array[
            'prompt_action_type',
            'item_type',
            'title',
            'description',
            'priority',
            'owner_id',
            'start_date',
            'due_date',
            'linked_impact_item_id',
            'confidence',
            'requires_human_input'
          ],
          array[
            'prompt_action_type',
            'item_type',
            'title',
            'description',
            'priority',
            'owner_id',
            'start_date',
            'due_date',
            'linked_impact_item_id',
            'confidence',
            'requires_human_input'
          ]
        )
        or action_entry -> 'target_item_id' <> 'null'::jsonb
        or action_entry -> 'expected_item_version' <> 'null'::jsonb
        or pg_catalog.jsonb_typeof(action_payload -> 'item_type') <> 'string'
        or action_payload ->> 'item_type' <> (
          case prompt_action_type
            when 'create_task' then 'task'
            else 'risk'
          end
        )
        or pg_catalog.jsonb_typeof(action_payload -> 'title') <> 'string'
        or pg_catalog.char_length(
          pg_catalog.btrim(action_payload ->> 'title')
        ) not between 1 and 240
        or (
          action_payload -> 'description' <> 'null'::jsonb
          and (
            pg_catalog.jsonb_typeof(action_payload -> 'description') <> 'string'
            or pg_catalog.char_length(
              action_payload ->> 'description'
            ) > 10000
          )
        )
        or pg_catalog.jsonb_typeof(action_payload -> 'priority') <> 'string'
        or action_payload ->> 'priority' not in (
          'low', 'medium', 'high', 'critical'
        )
        or not private.is_iso_date_json(action_payload -> 'start_date')
        or not private.is_iso_date_json(action_payload -> 'due_date') then
        raise exception 'invalid create action contract' using errcode = '22023';
      end if;

      create_owner_id := null;
      if action_payload -> 'owner_id' <> 'null'::jsonb then
        if pg_catalog.jsonb_typeof(action_payload -> 'owner_id') <> 'string'
           or not private.is_uuid_text(action_payload ->> 'owner_id') then
          raise exception 'invalid proposed owner ID' using errcode = '22023';
        end if;
        create_owner_id := (action_payload ->> 'owner_id')::uuid;
        if not exists (
          select 1
          from public.workspace_members as proposed_owner
          where proposed_owner.workspace_id = request_row.workspace_id
            and proposed_owner.user_id = create_owner_id
        ) then
          raise exception 'proposed owner is outside the workspace'
            using errcode = '22023';
        end if;
      end if;

      create_start_date := case
        when action_payload -> 'start_date' = 'null'::jsonb then null
        else (action_payload ->> 'start_date')::date
      end;
      create_due_date := case
        when action_payload -> 'due_date' = 'null'::jsonb then null
        else (action_payload ->> 'due_date')::date
      end;
      if create_start_date is not null
         and create_due_date is not null
         and create_start_date > create_due_date then
        raise exception 'proposed dates are out of order' using errcode = '22023';
      end if;

    elsif prompt_action_type = 'request_confirmation' then
      if not private.jsonb_object_matches(
          action_payload,
          array[
            'prompt_action_type',
            'question',
            'linked_impact_item_id',
            'confidence',
            'requires_human_input'
          ],
          array[
            'prompt_action_type',
            'question',
            'linked_impact_item_id',
            'confidence',
            'requires_human_input'
          ]
        )
        or pg_catalog.jsonb_typeof(action_entry -> 'target_item_id') <> 'string'
        or not private.is_uuid_text(action_entry ->> 'target_item_id')
        or action_entry -> 'expected_item_version' <> 'null'::jsonb
        or pg_catalog.jsonb_typeof(action_payload -> 'question') <> 'string'
        or pg_catalog.char_length(
          pg_catalog.btrim(action_payload ->> 'question')
        ) not between 1 and 1000
        or not action_requires_human_input then
        raise exception 'invalid confirmation action contract'
          using errcode = '22023';
      end if;
      target_item_id := (action_entry ->> 'target_item_id')::uuid;
      if target_item_id <> subject_item_id
         and not exists (
           select 1
           from pg_catalog.jsonb_array_elements(
             impact_data -> 'items'
           ) as target_impact(value)
           where target_impact.value ->> 'item_id' = target_item_id::text
         ) then
        raise exception 'confirmation target is inconsistent'
          using errcode = '22023';
      end if;
    else
      raise exception 'unsupported Prompt 7 action type' using errcode = '22023';
    end if;
  end loop;

  insert into public.change_events (
    workspace_id,
    project_id,
    source_document_id,
    subject_item_id,
    field_name,
    previous_value,
    proposed_value,
    state,
    confidence,
    model_name,
    evidence_text,
    evidence_start_offset,
    evidence_end_offset,
    review_context,
    created_by
  ) values (
    request_row.workspace_id,
    request_row.project_id,
    request_row.source_document_id,
    subject_item_id,
    field_name,
    previous_value,
    proposed_value,
    'needs_confirmation',
    confidence,
    model_name,
    evidence_text,
    evidence_start_offset,
    evidence_end_offset,
    review_context,
    actor_id
  )
  returning id into persisted_change_event_id;

  insert into public.impact_runs (
    workspace_id,
    project_id,
    change_event_id,
    state,
    max_depth,
    started_by,
    completed_at
  ) values (
    request_row.workspace_id,
    request_row.project_id,
    persisted_change_event_id,
    'completed',
    maximum_depth,
    actor_id,
    completion_time
  )
  returning id into persisted_impact_run_id;

  insert into public.impact_items (
    workspace_id,
    project_id,
    impact_run_id,
    item_id,
    severity,
    depth,
    path_item_ids,
    explanation
  )
  select
    request_row.workspace_id,
    request_row.project_id,
    persisted_impact_run_id,
    (element.value ->> 'item_id')::uuid,
    (element.value ->> 'severity')::public.impact_severity,
    (element.value ->> 'depth')::integer,
    array(
      select path_element.value::uuid
      from pg_catalog.jsonb_array_elements_text(
        element.value -> 'path_item_ids'
      ) with ordinality as path_element(value, position)
      order by path_element.position
    ),
    pg_catalog.btrim(element.value ->> 'explanation')
  from pg_catalog.jsonb_array_elements(impact_data -> 'items')
    with ordinality as element(value, position)
  order by element.position;

  insert into public.action_proposals (
    workspace_id,
    project_id,
    change_event_id,
    impact_run_id,
    state,
    title,
    rationale,
    model_name,
    created_by
  ) values (
    request_row.workspace_id,
    request_row.project_id,
    persisted_change_event_id,
    persisted_impact_run_id,
    'draft',
    pg_catalog.btrim(proposal_data ->> 'title'),
    pg_catalog.btrim(proposal_data ->> 'rationale'),
    model_name,
    actor_id
  )
  returning id into persisted_proposal_id;

  action_ordinal := 0;
  for action_entry in
    select element.value
    from pg_catalog.jsonb_array_elements(proposal_data -> 'actions')
      with ordinality as element(value, position)
    order by element.position
  loop
    action_ordinal := action_ordinal + 1;
    action_payload := action_entry -> 'payload';
    prompt_action_type := action_payload ->> 'prompt_action_type';
    database_action_type := case prompt_action_type
      when 'update_item_field' then 'update_item'::public.proposal_action_type
      when 'create_task' then 'create_item'::public.proposal_action_type
      when 'create_risk' then 'create_item'::public.proposal_action_type
      when 'request_confirmation' then 'request_confirmation'::public.proposal_action_type
      else null
    end;

    target_item_id := case
      when action_entry -> 'target_item_id' = 'null'::jsonb then null
      else (action_entry ->> 'target_item_id')::uuid
    end;
    expected_item_version := case
      when action_entry -> 'expected_item_version' = 'null'::jsonb then null
      else (action_entry ->> 'expected_item_version')::bigint
    end;

    insert into public.proposal_actions (
      workspace_id,
      project_id,
      proposal_id,
      ordinal,
      action_type,
      state,
      target_item_id,
      expected_item_version,
      payload,
      rationale
    ) values (
      request_row.workspace_id,
      request_row.project_id,
      persisted_proposal_id,
      action_ordinal,
      database_action_type,
      'pending',
      target_item_id,
      expected_item_version,
      action_payload,
      pg_catalog.btrim(action_entry ->> 'rationale')
    );
  end loop;

  update public.analysis_requests
  set state = 'succeeded',
      change_event_id = persisted_change_event_id,
      impact_run_id = persisted_impact_run_id,
      proposal_id = persisted_proposal_id,
      result_metadata = pg_catalog.jsonb_build_object(
        'model_name', model_name,
        'extraction_metadata', extraction_metadata,
        'proposal_metadata', proposal_metadata,
        'validation_outcome', validation_outcome
      ),
      finished_at = completion_time
  where id = request_row.id;

  return pg_catalog.jsonb_build_object(
    'status', 'succeeded',
    'analysis_request_id', request_row.id,
    'source_document_id', request_row.source_document_id,
    'change_event_id', persisted_change_event_id,
    'impact_run_id', persisted_impact_run_id,
    'proposal_id', persisted_proposal_id,
    'state', 'succeeded'
  );
end;
$$;

create or replace function public.fail_project_analysis(
  p_analysis_request_id uuid,
  p_failure_stage text,
  p_failure_code text,
  p_failure_provider_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  actor_id uuid;
  request_row public.analysis_requests%rowtype;
begin
  actor_id := (select auth.uid());
  if actor_id is null
     or coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select request.*
  into request_row
  from public.analysis_requests as request
  where request.id = p_analysis_request_id
  for update;

  if not found
     or request_row.requested_by <> actor_id
     or not exists (
       select 1
       from public.workspace_members as member
       where member.workspace_id = request_row.workspace_id
         and member.user_id = actor_id
         and member.role in (
           'owner'::public.workspace_role,
           'admin'::public.workspace_role,
           'member'::public.workspace_role
         )
     ) then
    raise exception 'analysis request not found or access denied'
      using errcode = '42501';
  end if;

  if p_failure_stage is null
     or p_failure_code is null
     or p_failure_stage not in ('extraction', 'proposal', 'persistence')
     or p_failure_code not in (
       'model_timeout',
       'model_unavailable',
       'model_invalid_output',
       'stale_project_revision',
       'validation_failed',
       'analysis_cancelled',
       'internal_error'
     )
     or not (
       p_failure_provider_request_id is null
       or (
         pg_catalog.char_length(p_failure_provider_request_id) between 1 and 200
         and p_failure_provider_request_id ~ '^[A-Za-z0-9_-]+$'
       )
     ) then
    raise exception 'invalid failure metadata' using errcode = '22023';
  end if;

  if request_row.state = 'failed'::public.analysis_request_state then
    return pg_catalog.jsonb_build_object(
      'status', 'duplicate_failed',
      'analysis_request_id', request_row.id,
      'source_document_id', request_row.source_document_id,
      'state', request_row.state::text
    );
  end if;
  if request_row.state <> 'processing'::public.analysis_request_state then
    raise exception 'analysis request is not processing' using errcode = '55000';
  end if;

  update public.analysis_requests
  set state = 'failed',
      failure_stage = p_failure_stage,
      failure_code = p_failure_code,
      failure_provider_request_id = p_failure_provider_request_id,
      finished_at = pg_catalog.statement_timestamp()
  where id = request_row.id;

  return pg_catalog.jsonb_build_object(
    'status', 'failed',
    'analysis_request_id', request_row.id,
    'source_document_id', request_row.source_document_id,
    'state', 'failed'
  );
end;
$$;

alter table public.analysis_requests enable row level security;

create policy analysis_requests_select_member on public.analysis_requests
for select to authenticated
using ((select private.is_workspace_member(workspace_id)));

-- Source intake now goes through begin_project_analysis so duplicate and rate
-- enforcement cannot be bypassed by an authenticated table insert.
drop policy if exists source_documents_insert_contributor
  on public.source_documents;
revoke insert on table public.source_documents from authenticated;

revoke all on table public.analysis_requests from anon, authenticated;
grant select on table public.analysis_requests to authenticated;
grant select, insert, update on table public.analysis_requests to service_role;

grant usage on type public.analysis_request_state to authenticated, service_role;

revoke all on function private.normalize_source_text(text)
  from public, anon, authenticated, service_role;
revoke all on function private.source_normalized_sha256(text)
  from public, anon, authenticated, service_role;
revoke all on function private.compute_project_revision(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.jsonb_object_matches(jsonb, text[], text[])
  from public, anon, authenticated, service_role;
revoke all on function private.is_uuid_text(text)
  from public, anon, authenticated, service_role;
revoke all on function private.evidence_matches_utf16_offsets(
  text,
  text,
  integer,
  integer
) from public, anon, authenticated, service_role;
revoke all on function private.is_iso_date_json(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.is_bounded_string_array(jsonb, integer, integer)
  from public, anon, authenticated, service_role;
revoke all on function private.is_valid_model_metadata(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.current_project_item_field_value(
  uuid,
  uuid,
  uuid,
  text
) from public, anon, authenticated, service_role;
revoke all on function private.compute_impact_paths(uuid, uuid, uuid, integer)
  from public, anon, authenticated, service_role;
revoke all on function private.guard_analysis_request_transition()
  from public, anon, authenticated, service_role;

revoke all on function public.begin_project_analysis(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  text,
  text
) from public, anon, authenticated, service_role;
revoke all on function public.complete_project_analysis(uuid, text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.fail_project_analysis(uuid, text, text, text)
  from public, anon, authenticated, service_role;

grant execute on function public.begin_project_analysis(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  text,
  text
) to authenticated;
grant execute on function public.complete_project_analysis(uuid, text, jsonb)
  to authenticated;
grant execute on function public.fail_project_analysis(uuid, text, text, text)
  to authenticated;
