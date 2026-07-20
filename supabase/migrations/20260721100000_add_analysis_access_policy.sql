-- Gate analysis provider selection inside the same transaction that claims the
-- immutable evidence and request. Recording grants are deliberately private,
-- exact-input-bound, short lived, and one use.

create table private.analysis_recording_grants (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete restrict,
  normalized_content_sha256 text not null check (
    normalized_content_sha256 ~ '^[0-9a-f]{64}$'
  ),
  expires_at timestamptz not null,
  status text not null default 'available' check (
    status in ('available', 'claimed', 'revoked')
  ),
  created_at timestamptz not null default statement_timestamp(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  claimed_at timestamptz,
  claimed_analysis_request_id uuid
    references public.analysis_requests(id) on delete restrict,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete restrict,
  constraint analysis_recording_grant_window check (
    expires_at > created_at
    and expires_at <= created_at + interval '15 minutes'
  ),
  constraint analysis_recording_grant_state check (
    (
      status = 'available'
      and claimed_at is null
      and claimed_analysis_request_id is null
      and revoked_at is null
      and revoked_by is null
    )
    or (
      status = 'claimed'
      and claimed_at is not null
      and claimed_analysis_request_id is not null
      and revoked_at is null
      and revoked_by is null
    )
    or (
      status = 'revoked'
      and claimed_at is null
      and claimed_analysis_request_id is null
      and revoked_at is not null
      and revoked_by is not null
    )
  )
);

create unique index analysis_recording_grants_one_available_idx
  on private.analysis_recording_grants (
    actor_id, project_id, normalized_content_sha256
  ) where status = 'available';

create index analysis_recording_grants_claim_lookup_idx
  on private.analysis_recording_grants (
    actor_id, project_id, normalized_content_sha256, status, expires_at
  );

create unique index analysis_recording_grants_claimed_request_idx
  on private.analysis_recording_grants (claimed_analysis_request_id)
  where claimed_analysis_request_id is not null;

comment on table private.analysis_recording_grants is
  'Private one-use recording authorizations. Metadata is retained through 11 November 2026 UTC and requires a separately reviewed purge after that date.';

create function private.guard_analysis_recording_grant_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.actor_id is distinct from old.actor_id
     or new.project_id is distinct from old.project_id
     or new.normalized_content_sha256 is distinct from old.normalized_content_sha256
     or new.expires_at is distinct from old.expires_at
     or new.created_at is distinct from old.created_at
     or new.created_by is distinct from old.created_by then
    raise exception 'analysis recording grant identity is immutable'
      using errcode = '23514';
  end if;

  if old.status <> 'available'
     or new.status not in ('claimed', 'revoked') then
    raise exception 'invalid analysis recording grant transition'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger analysis_recording_grants_guard_update
before update on private.analysis_recording_grants
for each row execute function private.guard_analysis_recording_grant_update();

revoke all on table private.analysis_recording_grants
  from public, anon, authenticated, service_role;
revoke all on function private.guard_analysis_recording_grant_update()
  from public, anon, authenticated, service_role;

create function private.issue_analysis_recording_grant(
  p_actor_id uuid,
  p_project_id uuid,
  p_normalized_content_sha256 text,
  p_expires_at timestamptz,
  p_created_by uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  target_workspace_id uuid;
  grant_row private.analysis_recording_grants%rowtype;
begin
  select project.workspace_id
  into target_workspace_id
  from public.projects as project
  inner join public.workspace_members as creator_membership
    on creator_membership.workspace_id = project.workspace_id
   and creator_membership.user_id = p_created_by
   and creator_membership.role = 'owner'::public.workspace_role
  inner join public.workspace_members as actor_membership
    on actor_membership.workspace_id = project.workspace_id
   and actor_membership.user_id = p_actor_id
   and actor_membership.role in (
     'owner'::public.workspace_role,
     'admin'::public.workspace_role,
     'member'::public.workspace_role
   )
  where project.id = p_project_id;

  if target_workspace_id is null then
    raise exception 'recording grant subject not found or access denied'
      using errcode = '42501';
  end if;
  if p_normalized_content_sha256 is null
     or p_normalized_content_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid recording grant hash' using errcode = '22023';
  end if;
  if p_expires_at is null
     or p_expires_at <= pg_catalog.statement_timestamp()
     or p_expires_at > pg_catalog.statement_timestamp() + interval '15 minutes' then
    raise exception 'invalid recording grant expiry' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'inordo-analysis-recording-grant:' || p_actor_id::text || ':'
        || p_project_id::text || ':' || p_normalized_content_sha256,
      0
    )
  );

  update private.analysis_recording_grants as existing_grant
  set status = 'revoked',
      revoked_at = pg_catalog.clock_timestamp(),
      revoked_by = p_created_by
  where existing_grant.actor_id = p_actor_id
    and existing_grant.project_id = p_project_id
    and existing_grant.normalized_content_sha256 = p_normalized_content_sha256
    and existing_grant.status = 'available'
    and existing_grant.expires_at <= pg_catalog.statement_timestamp();

  insert into private.analysis_recording_grants (
    actor_id,
    project_id,
    normalized_content_sha256,
    expires_at,
    created_by
  ) values (
    p_actor_id,
    p_project_id,
    p_normalized_content_sha256,
    p_expires_at,
    p_created_by
  )
  returning * into grant_row;

  return pg_catalog.jsonb_build_object(
    'grant_id', grant_row.id,
    'status', grant_row.status,
    'expires_at', grant_row.expires_at
  );
end;
$$;

create function private.revoke_analysis_recording_grant(
  p_grant_id uuid,
  p_revoked_by uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  grant_row private.analysis_recording_grants%rowtype;
begin
  select grant_record.*
  into grant_row
  from private.analysis_recording_grants as grant_record
  inner join public.projects as project
    on project.id = grant_record.project_id
  inner join public.workspace_members as owner_membership
    on owner_membership.workspace_id = project.workspace_id
   and owner_membership.user_id = p_revoked_by
   and owner_membership.role = 'owner'::public.workspace_role
  where grant_record.id = p_grant_id
    and grant_record.status = 'available'
  for update of grant_record;

  if not found then
    raise exception 'recording grant not found or access denied'
      using errcode = '42501';
  end if;

  update private.analysis_recording_grants as grant_record
  set status = 'revoked',
      revoked_at = pg_catalog.clock_timestamp(),
      revoked_by = p_revoked_by
  where grant_record.id = grant_row.id
    and grant_record.status = 'available'
  returning grant_record.* into grant_row;

  if not found then
    raise exception 'recording grant transition invariant failed'
      using errcode = '55000';
  end if;

  return pg_catalog.jsonb_build_object(
    'grant_id', grant_row.id,
    'status', grant_row.status,
    'expires_at', grant_row.expires_at
  );
end;
$$;

create function private.verify_analysis_recording_grant(
  p_grant_id uuid,
  p_verified_by uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  grant_row private.analysis_recording_grants%rowtype;
  claim_consistent boolean;
begin
  select grant_record.*
  into grant_row
  from private.analysis_recording_grants as grant_record
  inner join public.projects as project
    on project.id = grant_record.project_id
  inner join public.workspace_members as owner_membership
    on owner_membership.workspace_id = project.workspace_id
   and owner_membership.user_id = p_verified_by
   and owner_membership.role = 'owner'::public.workspace_role
  where grant_record.id = p_grant_id
  for update of grant_record;

  if not found then
    raise exception 'recording grant not found or access denied'
      using errcode = '42501';
  end if;

  claim_consistent := grant_row.status = 'claimed'
    and exists (
      select 1
      from public.analysis_requests as request
      where request.id = grant_row.claimed_analysis_request_id
        and request.requested_by = grant_row.actor_id
        and request.project_id = grant_row.project_id
        and request.normalized_content_sha256
          = grant_row.normalized_content_sha256
        and request.model_name = 'gpt-5.6-luna'
    );

  return pg_catalog.jsonb_build_object(
    'grant_id', grant_row.id,
    'status', grant_row.status,
    'expires_at', grant_row.expires_at,
    'claim_consistent', claim_consistent
  );
end;
$$;

revoke all on function private.issue_analysis_recording_grant(
  uuid, uuid, text, timestamptz, uuid
) from public, anon, authenticated, service_role;
revoke all on function private.revoke_analysis_recording_grant(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.verify_analysis_recording_grant(uuid, uuid)
  from public, anon, authenticated, service_role;

create function private.begin_project_analysis_with_policy_internal(
  p_project_id uuid,
  p_expected_project_revision text,
  p_title text,
  p_source_kind text,
  p_source_author text,
  p_raw_text text,
  p_normalized_content_sha256 text,
  p_occurred_at timestamptz,
  p_source_url text,
  p_analysis_mode text,
  p_recording_ready boolean,
  p_gateway_ready boolean,
  p_recording_model_name text,
  p_gateway_model_name text
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
  selected_provider_route text;
  selected_model_name text;
  selected_grant_id uuid;
  claimed_grant_count integer;
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
     or pg_catalog.char_length(private.normalize_source_text(p_raw_text)) < 1 then
    raise exception 'invalid source text' using errcode = '22023';
  end if;
  if p_title is null
     or p_source_author is null
     or p_source_kind not in ('pasted_update', 'manual_note')
     or pg_catalog.char_length(
       pg_catalog.btrim(p_title, E' \t\r\n')
     ) not between 1 and 240
     or pg_catalog.char_length(
       pg_catalog.btrim(p_source_author, E' \t\r\n')
     ) not between 1 and 120 then
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

  -- This source-key then actor-key order must match every analysis claim path.
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
    selected_provider_route := case existing_request.model_name
      when 'gpt-5.6-luna' then 'openai_recording'
      when 'openai/gpt-oss-20b' then 'gateway_fallback'
      else null
    end;
    return pg_catalog.jsonb_build_object(
      'status', 'duplicate',
      'analysis_request_id', existing_request.id,
      'source_document_id', existing_request.source_document_id,
      'state', existing_request.state::text,
      'change_event_id', existing_request.change_event_id,
      'impact_run_id', existing_request.impact_run_id,
      'proposal_id', existing_request.proposal_id,
      'retry_after_seconds', null,
      'provider_route', selected_provider_route,
      'model_name', existing_request.model_name
    );
  end if;

  select pg_catalog.count(*)::integer, min(request.created_at)
  into recent_request_count, rate_window_started_at
  from public.analysis_requests as request
  where request.workspace_id = target_workspace_id
    and request.project_id = p_project_id
    and request.workflow_generation = current_generation
    and request.requested_by = actor_id
    and request.created_at >= pg_catalog.statement_timestamp()
      - interval '10 minutes';

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
      'retry_after_seconds', retry_after_seconds,
      'provider_route', null,
      'model_name', null
    );
  end if;

  if p_recording_model_name is distinct from 'gpt-5.6-luna'
     or p_gateway_model_name is distinct from 'openai/gpt-oss-20b' then
    raise exception 'invalid analysis provider policy' using errcode = '22023';
  end if;

  if coalesce(p_analysis_mode, '') not in ('recording', 'auto') then
    return pg_catalog.jsonb_build_object(
      'status', 'analysis_disabled',
      'analysis_request_id', null,
      'source_document_id', null,
      'state', null,
      'change_event_id', null,
      'impact_run_id', null,
      'proposal_id', null,
      'retry_after_seconds', null,
      'provider_route', null,
      'model_name', null
    );
  end if;

  if p_analysis_mode = 'recording' then
    if coalesce(p_recording_ready, false) is not true then
      return pg_catalog.jsonb_build_object(
        'status', 'recording_unavailable',
        'analysis_request_id', null,
        'source_document_id', null,
        'state', null,
        'change_event_id', null,
        'impact_run_id', null,
        'proposal_id', null,
        'retry_after_seconds', null,
        'provider_route', null,
        'model_name', null
      );
    end if;

    select grant_record.id
    into selected_grant_id
    from private.analysis_recording_grants as grant_record
    where grant_record.actor_id = actor_id
      and grant_record.project_id = p_project_id
      and grant_record.normalized_content_sha256
        = p_normalized_content_sha256
      and grant_record.status = 'available'
      and grant_record.expires_at > pg_catalog.statement_timestamp()
    order by grant_record.expires_at, grant_record.id
    limit 1
    for update of grant_record;

    if selected_grant_id is null then
      return pg_catalog.jsonb_build_object(
        'status', 'recording_unavailable',
        'analysis_request_id', null,
        'source_document_id', null,
        'state', null,
        'change_event_id', null,
        'impact_run_id', null,
        'proposal_id', null,
        'retry_after_seconds', null,
        'provider_route', null,
        'model_name', null
      );
    end if;
    selected_provider_route := 'openai_recording';
    selected_model_name := p_recording_model_name;
  elsif coalesce(p_gateway_ready, false) is not true then
    return pg_catalog.jsonb_build_object(
      'status', 'fallback_unavailable',
      'analysis_request_id', null,
      'source_document_id', null,
      'state', null,
      'change_event_id', null,
      'impact_run_id', null,
      'proposal_id', null,
      'retry_after_seconds', null,
      'provider_route', null,
      'model_name', null
    );
  else
    selected_provider_route := 'gateway_fallback';
    selected_model_name := p_gateway_model_name;
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
    selected_model_name,
    actor_id
  )
  returning id into analysis_request_id;

  if selected_provider_route = 'openai_recording' then
    update private.analysis_recording_grants as grant_record
    set status = 'claimed',
        claimed_at = pg_catalog.clock_timestamp(),
        claimed_analysis_request_id = analysis_request_id
    where grant_record.id = selected_grant_id
      and grant_record.status = 'available';
    get diagnostics claimed_grant_count = row_count;
    if claimed_grant_count <> 1 then
      raise exception 'analysis recording grant claim invariant failed'
        using errcode = '55000';
    end if;
  end if;

  return pg_catalog.jsonb_build_object(
    'status', 'claimed',
    'analysis_request_id', analysis_request_id,
    'source_document_id', source_document_id,
    'state', 'processing',
    'change_event_id', null,
    'impact_run_id', null,
    'proposal_id', null,
    'retry_after_seconds', null,
    'provider_route', selected_provider_route,
    'model_name', selected_model_name
  );
end;
$$;

create function public.begin_project_analysis_with_policy(
  p_actor_id uuid,
  p_project_id uuid,
  p_expected_project_revision text,
  p_title text,
  p_source_kind text,
  p_source_author text,
  p_raw_text text,
  p_normalized_content_sha256 text,
  p_occurred_at timestamptz,
  p_source_url text,
  p_analysis_mode text,
  p_recording_ready boolean,
  p_gateway_ready boolean,
  p_recording_model_name text,
  p_gateway_model_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  begin_result jsonb;
  linked_request_id uuid;
  target_workspace_id uuid;
  request_generation bigint;
  request_model_name text;
  request_provider_route text;
  capture_source_document_id uuid;
  configuration_ready boolean;
begin
  if p_actor_id is null
     or coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'server authorization required' using errcode = '42501';
  end if;

  perform pg_catalog.set_config(
    'request.jwt.claim.sub',
    p_actor_id::text,
    true
  );
  perform pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object(
      'sub', p_actor_id,
      'role', 'authenticated',
      'is_anonymous', false
    )::text,
    true
  );

  begin_result := private.begin_project_analysis_with_policy_internal(
    p_project_id,
    p_expected_project_revision,
    p_title,
    p_source_kind,
    p_source_author,
    p_raw_text,
    p_normalized_content_sha256,
    p_occurred_at,
    p_source_url,
    p_analysis_mode,
    p_recording_ready,
    p_gateway_ready,
    p_recording_model_name,
    p_gateway_model_name
  );

  if begin_result ->> 'status' = 'duplicate'
     and begin_result ->> 'state' = 'processing' then
    begin_result := private.reconcile_expired_analysis_claim(
      p_project_id,
      (begin_result ->> 'analysis_request_id')::uuid,
      p_expected_project_revision,
      p_normalized_content_sha256
    );
  end if;

  linked_request_id := (begin_result ->> 'analysis_request_id')::uuid;
  if linked_request_id is null then
    return begin_result;
  end if;

  select
    request.workspace_id,
    request.workflow_generation,
    request.model_name
  into target_workspace_id, request_generation, request_model_name
  from public.analysis_requests as request
  where request.id = linked_request_id
    and request.project_id = p_project_id
    and request.project_revision = p_expected_project_revision
    and request.normalized_content_sha256 = p_normalized_content_sha256;

  if not found then
    raise exception 'analysis provenance claim mismatch' using errcode = '55000';
  end if;

  request_provider_route := case request_model_name
    when 'gpt-5.6-luna' then 'openai_recording'
    when 'openai/gpt-oss-20b' then 'gateway_fallback'
    else null
  end;
  begin_result := begin_result || pg_catalog.jsonb_build_object(
    'provider_route', request_provider_route,
    'model_name', request_model_name
  );

  configuration_ready := (
    p_recording_model_name = 'gpt-5.6-luna'
    and p_gateway_model_name = 'openai/gpt-oss-20b'
    and (
      (
        p_analysis_mode = 'recording'
        and coalesce(p_recording_ready, false)
      )
      or (
        p_analysis_mode = 'auto'
        and coalesce(p_gateway_ready, false)
      )
    )
  );
  if not coalesce(configuration_ready, false) then
    return begin_result;
  end if;

  select source.id
  into capture_source_document_id
  from public.source_documents as source
  where source.workspace_id = target_workspace_id
    and source.project_id = p_project_id
    and source.workflow_generation = request_generation
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
    and source.captured_by = p_actor_id
  order by source.created_at, source.id
  limit 1;

  if capture_source_document_id is null then
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
      p_actor_id,
      pg_catalog.btrim(p_source_author, E' \t\r\n'),
      p_normalized_content_sha256
    )
    returning id into capture_source_document_id;
  end if;

  insert into public.analysis_request_sources (
    workspace_id,
    project_id,
    analysis_request_id,
    source_document_id
  ) values (
    target_workspace_id,
    p_project_id,
    linked_request_id,
    capture_source_document_id
  )
  on conflict do nothing;

  return pg_catalog.jsonb_set(
    begin_result,
    '{source_document_id}',
    pg_catalog.to_jsonb(capture_source_document_id),
    true
  );
end;
$$;

revoke all on function public.begin_project_analysis(
  uuid, uuid, text, text, text, text, text, text, timestamptz, text, text
) from service_role;
revoke all on function private.begin_project_analysis_internal(
  uuid, text, text, text, text, text, text, timestamptz, text, text
) from service_role;
revoke all on function private.reconcile_expired_analysis_claim(
  uuid, uuid, text, text
) from public, anon, authenticated, service_role;
revoke all on function private.begin_project_analysis_with_policy_internal(
  uuid, text, text, text, text, text, text, timestamptz, text, text,
  boolean, boolean, text, text
) from public, anon, authenticated, service_role;
revoke all on function public.begin_project_analysis_with_policy(
  uuid, uuid, text, text, text, text, text, text, timestamptz, text, text,
  boolean, boolean, text, text
) from public, anon, authenticated;

grant execute on function public.begin_project_analysis_with_policy(
  uuid, uuid, text, text, text, text, text, text, timestamptz, text, text,
  boolean, boolean, text, text
) to service_role;

comment on function public.begin_project_analysis_with_policy(
  uuid, uuid, text, text, text, text, text, text, timestamptz, text, text,
  boolean, boolean, text, text
) is
  'Service-role-only atomic analysis policy boundary. Provider selection occurs before evidence writes; recording consumes one exact private grant in the claim transaction.';
