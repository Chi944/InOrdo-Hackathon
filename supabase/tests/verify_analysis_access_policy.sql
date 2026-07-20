-- Analysis access policy and one-use recording-grant assertions.
-- Fixtures and all state transitions are transaction-scoped and rolled back.

begin;

do $$
declare
  project_revision text;
begin
  if not exists (
    select 1
    from public.projects
    where id = '20000000-0000-4000-8000-000000000001'::uuid
  ) then
    raise exception 'analysis access verification requires the demo seed';
  end if;

  project_revision := private.compute_project_revision(
    '10000000-0000-4000-8000-000000000001'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid
  );
  perform pg_catalog.set_config(
    'inordo.analysis_policy_revision', project_revision, true
  );
  perform pg_catalog.set_config(
    'inordo.analysis_policy_disabled_hash',
    private.source_normalized_sha256('Disabled mode creates no evidence.'),
    true
  );
  perform pg_catalog.set_config(
    'inordo.analysis_policy_gateway_hash',
    private.source_normalized_sha256('Gateway fallback claim verification.'),
    true
  );
  perform pg_catalog.set_config(
    'inordo.analysis_policy_recording_hash',
    private.source_normalized_sha256('Exact recording grant verification.'),
    true
  );
  perform pg_catalog.set_config(
    'inordo.analysis_policy_unapproved_hash',
    private.source_normalized_sha256(
      'Unapproved recording model verification.'
    ),
    true
  );
  perform pg_catalog.set_config(
    'inordo.analysis_policy_mismatch_hash',
    private.source_normalized_sha256('Approved hash source.'),
    true
  );
  perform pg_catalog.set_config(
    'inordo.analysis_policy_expired_hash',
    private.source_normalized_sha256(
      'Expired recording grant verification.'
    ),
    true
  );
  perform pg_catalog.set_config(
    'inordo.analysis_policy_expired_duplicate_hash',
    private.source_normalized_sha256(
      'Expired duplicate metadata verification.'
    ),
    true
  );
  perform pg_catalog.set_config(
    'inordo.analysis_policy_rate_hash',
    private.source_normalized_sha256(
      'Rate-limited recording grant verification.'
    ),
    true
  );
  perform pg_catalog.set_config(
    'inordo.analysis_policy_cross_project_hash',
    private.source_normalized_sha256(
      'Cross-project recording grant verification.'
    ),
    true
  );
  perform pg_catalog.set_config(
    'inordo.analysis_policy_viewer_hash',
    private.source_normalized_sha256('Viewer analysis policy verification.'),
    true
  );

  insert into public.projects (
    id, workspace_id, name, slug, description, status, is_demo, created_by
  ) values (
    '20000000-0000-4000-8000-000000000002'::uuid,
    '10000000-0000-4000-8000-000000000001'::uuid,
    'Analysis policy isolation fixture',
    'analysis-policy-isolation-fixture',
    'Transaction-scoped cross-project verification fixture.',
    'active'::public.project_status,
    false,
    '00000000-0000-4000-8000-000000000101'::uuid
  );
end;
$$;

-- disabled_no_evidence
set local role service_role;
select pg_catalog.set_config(
  'request.jwt.claims', '{"role":"service_role"}', true
);
do $$
declare
  source_count bigint;
  request_count bigint;
  result jsonb;
  raw_text constant text := 'Disabled mode creates no evidence.';
  source_hash text := pg_catalog.current_setting(
    'inordo.analysis_policy_disabled_hash'
  );
begin
  select count(*) into source_count from public.source_documents;
  select count(*) into request_count from public.analysis_requests;

  result := public.begin_project_analysis_with_policy(
    '00000000-0000-4000-8000-000000000102'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    pg_catalog.current_setting('inordo.analysis_policy_revision'),
    'Disabled policy verification', 'manual_note', 'SQL verifier', raw_text,
    source_hash, null, null, 'disabled', false, false,
    'gpt-5.6-luna', 'openai/gpt-oss-20b'
  );

  if result ->> 'status' <> 'analysis_disabled'
     or result ->> 'analysis_request_id' is not null
     or result ->> 'source_document_id' is not null
     or (select count(*) from public.source_documents) <> source_count
     or (select count(*) from public.analysis_requests) <> request_count then
    raise exception 'disabled_no_evidence: %', result;
  end if;
end;
$$;
reset role;

-- auto_claim_uses_gateway_model
set local role service_role;
select pg_catalog.set_config(
  'request.jwt.claims', '{"role":"service_role"}', true
);
do $$
declare
  result jsonb;
  raw_text constant text := 'Gateway fallback claim verification.';
begin
  result := public.begin_project_analysis_with_policy(
    '00000000-0000-4000-8000-000000000102'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    pg_catalog.current_setting('inordo.analysis_policy_revision'),
    'Gateway fallback verification', 'manual_note', 'SQL verifier', raw_text,
    pg_catalog.current_setting('inordo.analysis_policy_gateway_hash'),
    null, null,
    'auto', false, true, 'gpt-5.6-luna', 'openai/gpt-oss-20b'
  );

  if result ->> 'status' <> 'claimed'
     or result ->> 'provider_route' is distinct from 'gateway_fallback'
     or result ->> 'model_name' is distinct from 'openai/gpt-oss-20b'
     or not exists (
       select 1 from public.analysis_requests as request
       where request.id = (result ->> 'analysis_request_id')::uuid
         and request.model_name = 'openai/gpt-oss-20b'
     ) then
    raise exception 'auto_claim_uses_gateway_model: %', result;
  end if;
end;
$$;
reset role;

-- Owner-only issuance returns metadata only.
do $$
declare
  result jsonb;
  raw_text constant text := 'Exact recording grant verification.';
begin
  result := private.issue_analysis_recording_grant(
    '00000000-0000-4000-8000-000000000103'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    private.source_normalized_sha256(raw_text),
    pg_catalog.statement_timestamp() + interval '10 minutes',
    '00000000-0000-4000-8000-000000000101'::uuid
  );
  if result ?& array['actor_id', 'project_id', 'normalized_content_sha256']
     or not result ?& array['grant_id', 'status', 'expires_at']
     or (
       select count(*) from pg_catalog.jsonb_object_keys(result)
     ) <> 3 then
    raise exception 'verify_returns_metadata_only: issuance leaked metadata: %', result;
  end if;
  perform pg_catalog.set_config(
    'inordo.recording_grant_id', result ->> 'grant_id', true
  );
end;
$$;

-- recording_exact_grant_claimed_once
set local role service_role;
select pg_catalog.set_config(
  'request.jwt.claims', '{"role":"service_role"}', true
);
do $$
declare
  result jsonb;
  raw_text constant text := 'Exact recording grant verification.';
begin
  result := public.begin_project_analysis_with_policy(
    '00000000-0000-4000-8000-000000000103'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    pg_catalog.current_setting('inordo.analysis_policy_revision'),
    'Exact recording grant', 'manual_note', 'SQL verifier', raw_text,
    pg_catalog.current_setting('inordo.analysis_policy_recording_hash'),
    null, null,
    'recording', true, false, 'gpt-5.6-luna', 'openai/gpt-oss-20b'
  );

  if result ->> 'status' <> 'claimed'
     or result ->> 'provider_route' <> 'openai_recording'
     or result ->> 'model_name' <> 'gpt-5.6-luna' then
    raise exception 'recording_exact_grant_claimed_once: %', result;
  end if;
  perform pg_catalog.set_config(
    'inordo.recording_request_id', result ->> 'analysis_request_id', true
  );
end;
$$;
reset role;
do $$
begin
  if not exists (
    select 1 from private.analysis_recording_grants as grant_row
    where grant_row.id = pg_catalog.current_setting(
      'inordo.recording_grant_id'
    )::uuid
      and grant_row.status = 'claimed'
      and grant_row.claimed_analysis_request_id = pg_catalog.current_setting(
        'inordo.recording_request_id'
      )::uuid
  ) then
    raise exception 'recording_exact_grant_claimed_once';
  end if;
end;
$$;

-- An unavailable duplicate still returns persisted provider metadata after the
-- wrapper reconciles its expired processing lease, without adding provenance.
do $$
declare
  expired_created_at timestamptz := pg_catalog.clock_timestamp()
    - interval '4 minutes';
  source_id uuid;
  request_id uuid;
begin
  insert into public.source_documents (
    workspace_id, project_id, title, source_kind, raw_text, captured_by,
    source_author, normalized_content_sha256, created_at
  ) values (
    '10000000-0000-4000-8000-000000000001'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    'Expired duplicate metadata', 'manual_note',
    'Expired duplicate metadata verification.',
    '00000000-0000-4000-8000-000000000106'::uuid,
    'SQL verifier',
    pg_catalog.current_setting(
      'inordo.analysis_policy_expired_duplicate_hash'
    ),
    expired_created_at
  ) returning id into source_id;

  insert into public.analysis_requests (
    workspace_id, project_id, source_document_id, project_revision,
    normalized_content_sha256, model_name, requested_by, created_at
  ) values (
    '10000000-0000-4000-8000-000000000001'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    source_id,
    pg_catalog.current_setting('inordo.analysis_policy_revision'),
    pg_catalog.current_setting(
      'inordo.analysis_policy_expired_duplicate_hash'
    ),
    'openai/gpt-oss-20b',
    '00000000-0000-4000-8000-000000000106'::uuid,
    expired_created_at
  ) returning id into request_id;

  perform pg_catalog.set_config(
    'inordo.expired_duplicate_request_id', request_id::text, true
  );
end;
$$;
set local role service_role;
select pg_catalog.set_config(
  'request.jwt.claims', '{"role":"service_role"}', true
);
do $$
declare
  source_count bigint;
  provenance_count bigint;
  result jsonb;
begin
  select count(*) into source_count from public.source_documents;
  select count(*) into provenance_count from public.analysis_request_sources;

  result := public.begin_project_analysis_with_policy(
    '00000000-0000-4000-8000-000000000106'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    pg_catalog.current_setting('inordo.analysis_policy_revision'),
    'Expired duplicate unavailable capture', 'manual_note',
    'Different unavailable author',
    'Expired duplicate metadata verification.',
    pg_catalog.current_setting(
      'inordo.analysis_policy_expired_duplicate_hash'
    ),
    null, null, 'disabled', false, false,
    'gpt-5.6-luna', 'openai/gpt-oss-20b'
  );

  if result ->> 'status' <> 'duplicate'
     or result ->> 'state' <> 'failed'
     or result ->> 'analysis_request_id' <>
       pg_catalog.current_setting('inordo.expired_duplicate_request_id')
     or result ->> 'provider_route' is distinct from 'gateway_fallback'
     or result ->> 'model_name' is distinct from 'openai/gpt-oss-20b'
     or (select count(*) from public.source_documents) <> source_count
     or (select count(*) from public.analysis_request_sources)
       <> provenance_count then
    raise exception 'expired_duplicate_metadata_without_capture: %', result;
  end if;
end;
$$;
reset role;

-- recording_replay_rejected
set local role service_role;
select pg_catalog.set_config(
  'request.jwt.claims', '{"role":"service_role"}', true
);
do $$
declare
  result jsonb;
  raw_text constant text := 'Exact recording grant verification.';
begin
  result := public.begin_project_analysis_with_policy(
    '00000000-0000-4000-8000-000000000103'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    pg_catalog.current_setting('inordo.analysis_policy_revision'),
    'Exact recording grant', 'manual_note', 'SQL verifier', raw_text,
    pg_catalog.current_setting('inordo.analysis_policy_recording_hash'),
    null, null,
    'recording', true, false, 'gpt-5.6-luna', 'openai/gpt-oss-20b'
  );
  if result ->> 'status' <> 'duplicate'
     or result ->> 'analysis_request_id' <>
       pg_catalog.current_setting('inordo.recording_request_id') then
    raise exception 'recording_replay_rejected: %', result;
  end if;
end;
$$;
reset role;

-- duplicate_does_not_consume_second_grant
do $$
declare
  result jsonb;
  raw_text constant text := 'Exact recording grant verification.';
begin
  result := private.issue_analysis_recording_grant(
    '00000000-0000-4000-8000-000000000103'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    private.source_normalized_sha256(raw_text),
    pg_catalog.statement_timestamp() + interval '10 minutes',
    '00000000-0000-4000-8000-000000000101'::uuid
  );
  perform pg_catalog.set_config(
    'inordo.second_recording_grant_id', result ->> 'grant_id', true
  );
end;
$$;
set local role service_role;
select pg_catalog.set_config(
  'request.jwt.claims', '{"role":"service_role"}', true
);
do $$
declare
  result jsonb;
  raw_text constant text := 'Exact recording grant verification.';
begin
  result := public.begin_project_analysis_with_policy(
    '00000000-0000-4000-8000-000000000103'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    pg_catalog.current_setting('inordo.analysis_policy_revision'),
    'Exact recording grant', 'manual_note', 'SQL verifier', raw_text,
    pg_catalog.current_setting('inordo.analysis_policy_recording_hash'),
    null, null,
    'recording', true, false, 'gpt-5.6-luna', 'openai/gpt-oss-20b'
  );
  if result ->> 'status' <> 'duplicate' then
    raise exception 'duplicate_does_not_consume_second_grant: %', result;
  end if;
end;
$$;
reset role;
do $$
begin
  if not exists (
    select 1 from private.analysis_recording_grants as grant_row
    where grant_row.id = pg_catalog.current_setting(
      'inordo.second_recording_grant_id'
    )::uuid
      and grant_row.status = 'available'
  ) then
    raise exception 'duplicate_does_not_consume_second_grant';
  end if;
end;
$$;

-- recording_unapproved_model_rejected_without_claim
do $$
declare
  result jsonb;
  raw_text constant text := 'Unapproved recording model verification.';
begin
  result := private.issue_analysis_recording_grant(
    '00000000-0000-4000-8000-000000000104'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    private.source_normalized_sha256(raw_text),
    pg_catalog.statement_timestamp() + interval '10 minutes',
    '00000000-0000-4000-8000-000000000101'::uuid
  );
  perform pg_catalog.set_config(
    'inordo.unapproved_model_grant_id', result ->> 'grant_id', true
  );
  perform pg_catalog.set_config(
    'inordo.unapproved_model_grant_count',
    (select count(*)::text from private.analysis_recording_grants),
    true
  );
end;
$$;
set local role service_role;
select pg_catalog.set_config(
  'request.jwt.claims', '{"role":"service_role"}', true
);
do $$
declare
  raw_text constant text := 'Unapproved recording model verification.';
begin
  begin
    perform public.begin_project_analysis_with_policy(
      '00000000-0000-4000-8000-000000000104'::uuid,
      '20000000-0000-4000-8000-000000000001'::uuid,
      pg_catalog.current_setting('inordo.analysis_policy_revision'),
      'Unapproved recording model', 'manual_note', 'SQL verifier', raw_text,
      pg_catalog.current_setting('inordo.analysis_policy_unapproved_hash'),
      null, null,
      'recording', true, false, 'gpt-5.6-luna-preview',
      'openai/gpt-oss-20b'
    );
    raise exception 'recording_unapproved_model_rejected_without_claim';
  exception
    when invalid_parameter_value then null;
  end;
end;
$$;
reset role;
do $$
begin
  if not exists (
    select 1 from private.analysis_recording_grants as grant_row
    where grant_row.id = pg_catalog.current_setting(
      'inordo.unapproved_model_grant_id'
    )::uuid
      and grant_row.status = 'available'
  ) or (select count(*) from private.analysis_recording_grants) <>
    pg_catalog.current_setting(
      'inordo.unapproved_model_grant_count'
    )::bigint then
    raise exception 'recording_unapproved_model_rejected_without_claim';
  end if;
end;
$$;

-- recording_hash_mismatch_rolls_back_evidence
do $$
declare
  result jsonb;
  approved_text constant text := 'Approved hash source.';
begin
  result := private.issue_analysis_recording_grant(
    '00000000-0000-4000-8000-000000000105'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    private.source_normalized_sha256(approved_text),
    pg_catalog.statement_timestamp() + interval '10 minutes',
    '00000000-0000-4000-8000-000000000101'::uuid
  );
  perform pg_catalog.set_config(
    'inordo.hash_mismatch_grant_id', result ->> 'grant_id', true
  );
  perform pg_catalog.set_config(
    'inordo.hash_mismatch_grant_count',
    (select count(*)::text from private.analysis_recording_grants),
    true
  );
end;
$$;
set local role service_role;
select pg_catalog.set_config(
  'request.jwt.claims', '{"role":"service_role"}', true
);
do $$
declare
  source_count bigint;
  request_count bigint;
  approved_hash text := pg_catalog.current_setting(
    'inordo.analysis_policy_mismatch_hash'
  );
begin
  select count(*) into source_count from public.source_documents;
  select count(*) into request_count from public.analysis_requests;
  begin
    perform public.begin_project_analysis_with_policy(
      '00000000-0000-4000-8000-000000000105'::uuid,
      '20000000-0000-4000-8000-000000000001'::uuid,
      pg_catalog.current_setting('inordo.analysis_policy_revision'),
      'Hash mismatch', 'manual_note', 'SQL verifier', 'Different raw source.',
      approved_hash, null, null, 'recording', true, false,
      'gpt-5.6-luna', 'openai/gpt-oss-20b'
    );
    raise exception 'recording_hash_mismatch_rolls_back_evidence';
  exception
    when invalid_parameter_value then null;
  end;
  if (select count(*) from public.source_documents) <> source_count
     or (select count(*) from public.analysis_requests) <> request_count then
    raise exception 'recording_hash_mismatch_rolls_back_evidence';
  end if;
end;
$$;
reset role;
do $$
begin
  if not exists (
    select 1 from private.analysis_recording_grants as grant_row
    where grant_row.id = pg_catalog.current_setting(
      'inordo.hash_mismatch_grant_id'
    )::uuid
      and grant_row.status = 'available'
  ) or (select count(*) from private.analysis_recording_grants) <>
    pg_catalog.current_setting(
      'inordo.hash_mismatch_grant_count'
    )::bigint then
    raise exception 'recording_hash_mismatch_rolls_back_evidence';
  end if;
end;
$$;

-- recording_expired_rolls_back_evidence
do $$
declare
  raw_text constant text := 'Expired recording grant verification.';
  grant_id uuid;
begin
  insert into private.analysis_recording_grants (
    actor_id, project_id, normalized_content_sha256, expires_at,
    created_at, created_by
  ) values (
    '00000000-0000-4000-8000-000000000106'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    private.source_normalized_sha256(raw_text),
    pg_catalog.statement_timestamp() - interval '1 minute',
    pg_catalog.statement_timestamp() - interval '10 minutes',
    '00000000-0000-4000-8000-000000000101'::uuid
  ) returning id into grant_id;
  perform pg_catalog.set_config(
    'inordo.expired_recording_grant_id', grant_id::text, true
  );
  perform pg_catalog.set_config(
    'inordo.expired_recording_grant_count',
    (select count(*)::text from private.analysis_recording_grants),
    true
  );
end;
$$;
set local role service_role;
select pg_catalog.set_config(
  'request.jwt.claims', '{"role":"service_role"}', true
);
do $$
declare
  source_count bigint;
  request_count bigint;
  result jsonb;
  raw_text constant text := 'Expired recording grant verification.';
begin
  select count(*) into source_count from public.source_documents;
  select count(*) into request_count from public.analysis_requests;
  result := public.begin_project_analysis_with_policy(
    '00000000-0000-4000-8000-000000000106'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    pg_catalog.current_setting('inordo.analysis_policy_revision'),
    'Expired recording grant', 'manual_note', 'SQL verifier', raw_text,
    pg_catalog.current_setting('inordo.analysis_policy_expired_hash'),
    null, null,
    'recording', true, false, 'gpt-5.6-luna', 'openai/gpt-oss-20b'
  );
  if result ->> 'status' <> 'recording_unavailable'
     or (select count(*) from public.source_documents) <> source_count
     or (select count(*) from public.analysis_requests) <> request_count then
    raise exception 'recording_expired_rolls_back_evidence: %', result;
  end if;
end;
$$;
reset role;
do $$
begin
  if not exists (
    select 1 from private.analysis_recording_grants as grant_row
    where grant_row.id = pg_catalog.current_setting(
      'inordo.expired_recording_grant_id'
    )::uuid
      and grant_row.status = 'available'
  ) or (select count(*) from private.analysis_recording_grants) <>
    pg_catalog.current_setting(
      'inordo.expired_recording_grant_count'
    )::bigint then
    raise exception 'recording_expired_rolls_back_evidence';
  end if;
end;
$$;

-- Disabled/unavailable duplicates must not add distinct captures.
set local role service_role;
select pg_catalog.set_config(
  'request.jwt.claims', '{"role":"service_role"}', true
);
do $$
declare
  capture_count bigint;
  result jsonb;
  raw_text constant text := 'Gateway fallback claim verification.';
begin
  select count(*) into capture_count from public.source_documents;

  result := public.begin_project_analysis_with_policy(
    '00000000-0000-4000-8000-000000000102'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    pg_catalog.current_setting('inordo.analysis_policy_revision'),
    'Disabled duplicate distinct capture', 'manual_note', 'Different author',
    raw_text, pg_catalog.current_setting('inordo.analysis_policy_gateway_hash'),
    null, null,
    'disabled', false, false, 'gpt-5.6-luna', 'openai/gpt-oss-20b'
  );
  if result ->> 'status' <> 'duplicate'
     or (select count(*) from public.source_documents) <> capture_count then
    raise exception 'disabled_duplicate_no_new_capture: %', result;
  end if;

  perform pg_catalog.set_config(
    'request.jwt.claims', '{"role":"service_role"}', true
  );
  result := public.begin_project_analysis_with_policy(
    '00000000-0000-4000-8000-000000000102'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    pg_catalog.current_setting('inordo.analysis_policy_revision'),
    'Recording unavailable duplicate capture', 'manual_note',
    'Different author', raw_text,
    pg_catalog.current_setting('inordo.analysis_policy_gateway_hash'),
    null, null, 'recording', false, false,
    'gpt-5.6-luna', 'openai/gpt-oss-20b'
  );
  if result ->> 'status' <> 'duplicate'
     or (select count(*) from public.source_documents) <> capture_count then
    raise exception 'recording_unavailable_duplicate_no_new_capture: %', result;
  end if;

  perform pg_catalog.set_config(
    'request.jwt.claims', '{"role":"service_role"}', true
  );
  result := public.begin_project_analysis_with_policy(
    '00000000-0000-4000-8000-000000000102'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    pg_catalog.current_setting('inordo.analysis_policy_revision'),
    'Fallback unavailable duplicate capture', 'manual_note',
    'Different author', raw_text,
    pg_catalog.current_setting('inordo.analysis_policy_gateway_hash'),
    null, null, 'auto', false, false,
    'gpt-5.6-luna', 'openai/gpt-oss-20b'
  );
  if result ->> 'status' <> 'duplicate'
     or (select count(*) from public.source_documents) <> capture_count then
    raise exception 'fallback_unavailable_duplicate_no_new_capture: %', result;
  end if;
end;
$$;
reset role;

-- rate_limit_does_not_consume_grant
do $$
declare
  rate_index integer;
  fixture_source_id uuid;
  result jsonb;
  raw_text constant text := 'Rate-limited recording grant verification.';
begin
  for rate_index in 1..5 loop
    insert into public.source_documents (
      workspace_id, project_id, title, source_kind, raw_text, captured_by,
      source_author, normalized_content_sha256
    ) values (
      '10000000-0000-4000-8000-000000000001'::uuid,
      '20000000-0000-4000-8000-000000000001'::uuid,
      pg_catalog.format('Rate fixture %s', rate_index),
      'manual_note', pg_catalog.format('Rate fixture source %s.', rate_index),
      '00000000-0000-4000-8000-000000000107'::uuid, 'SQL verifier',
      private.source_normalized_sha256(
        pg_catalog.format('Rate fixture source %s.', rate_index)
      )
    ) returning id into fixture_source_id;

    insert into public.analysis_requests (
      workspace_id, project_id, source_document_id, project_revision,
      normalized_content_sha256, model_name, requested_by
    ) values (
      '10000000-0000-4000-8000-000000000001'::uuid,
      '20000000-0000-4000-8000-000000000001'::uuid,
      fixture_source_id,
      pg_catalog.current_setting('inordo.analysis_policy_revision'),
      private.source_normalized_sha256(
        pg_catalog.format('Rate fixture source %s.', rate_index)
      ),
      'openai/gpt-oss-20b',
      '00000000-0000-4000-8000-000000000107'::uuid
    );
  end loop;

  result := private.issue_analysis_recording_grant(
    '00000000-0000-4000-8000-000000000107'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    private.source_normalized_sha256(raw_text),
    pg_catalog.statement_timestamp() + interval '10 minutes',
    '00000000-0000-4000-8000-000000000101'::uuid
  );
  perform pg_catalog.set_config(
    'inordo.rate_limit_grant_id', result ->> 'grant_id', true
  );
end;
$$;
set local role service_role;
select pg_catalog.set_config(
  'request.jwt.claims', '{"role":"service_role"}', true
);
do $$
declare
  source_count bigint;
  request_count bigint;
  result jsonb;
  raw_text constant text := 'Rate-limited recording grant verification.';
begin
  select count(*) into source_count from public.source_documents;
  select count(*) into request_count from public.analysis_requests;
  result := public.begin_project_analysis_with_policy(
    '00000000-0000-4000-8000-000000000107'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    pg_catalog.current_setting('inordo.analysis_policy_revision'),
    'Rate-limited recording grant', 'manual_note', 'SQL verifier', raw_text,
    pg_catalog.current_setting('inordo.analysis_policy_rate_hash'), null, null,
    'recording', true, false, 'gpt-5.6-luna', 'openai/gpt-oss-20b'
  );
  if result ->> 'status' <> 'rate_limited'
     or (select count(*) from public.source_documents) <> source_count
     or (select count(*) from public.analysis_requests) <> request_count then
    raise exception 'rate_limit_does_not_consume_grant: %', result;
  end if;
end;
$$;
reset role;
do $$
begin
  if not exists (
    select 1 from private.analysis_recording_grants as grant_row
    where grant_row.id = pg_catalog.current_setting(
      'inordo.rate_limit_grant_id'
    )::uuid
      and grant_row.status = 'available'
  ) then
    raise exception 'rate_limit_does_not_consume_grant';
  end if;
end;
$$;

-- cross_project_grant_denied
do $$
declare
  result jsonb;
  raw_text constant text := 'Cross-project recording grant verification.';
begin
  result := private.issue_analysis_recording_grant(
    '00000000-0000-4000-8000-000000000103'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    private.source_normalized_sha256(raw_text),
    pg_catalog.statement_timestamp() + interval '10 minutes',
    '00000000-0000-4000-8000-000000000101'::uuid
  );
  perform pg_catalog.set_config(
    'inordo.cross_project_grant_id', result ->> 'grant_id', true
  );
  perform pg_catalog.set_config(
    'inordo.cross_project_revision',
    private.compute_project_revision(
      '10000000-0000-4000-8000-000000000001'::uuid,
      '20000000-0000-4000-8000-000000000002'::uuid
    ),
    true
  );
end;
$$;
set local role service_role;
select pg_catalog.set_config(
  'request.jwt.claims', '{"role":"service_role"}', true
);
do $$
declare
  result jsonb;
  raw_text constant text := 'Cross-project recording grant verification.';
begin
  result := public.begin_project_analysis_with_policy(
    '00000000-0000-4000-8000-000000000103'::uuid,
    '20000000-0000-4000-8000-000000000002'::uuid,
    pg_catalog.current_setting('inordo.cross_project_revision'),
    'Cross-project recording grant', 'manual_note', 'SQL verifier', raw_text,
    pg_catalog.current_setting('inordo.analysis_policy_cross_project_hash'),
    null, null,
    'recording', true, false, 'gpt-5.6-luna', 'openai/gpt-oss-20b'
  );
  if result ->> 'status' <> 'recording_unavailable' then
    raise exception 'cross_project_grant_denied: %', result;
  end if;
end;
$$;
reset role;
do $$
begin
  if not exists (
    select 1 from private.analysis_recording_grants as grant_row
    where grant_row.id = pg_catalog.current_setting(
      'inordo.cross_project_grant_id'
    )::uuid
      and grant_row.status = 'available'
  ) then
    raise exception 'cross_project_grant_denied';
  end if;
end;
$$;

-- grant_identity_and_terminal_state_are_immutable
do $$
declare
  original_actor uuid;
begin
  select actor_id into original_actor
  from private.analysis_recording_grants
  where id = pg_catalog.current_setting('inordo.recording_grant_id')::uuid;

  begin
    update private.analysis_recording_grants
    set actor_id = '00000000-0000-4000-8000-000000000104'::uuid
    where id = pg_catalog.current_setting('inordo.second_recording_grant_id')::uuid;
    raise exception 'grant_identity_and_terminal_state_are_immutable';
  exception
    when check_violation then null;
  end;

  begin
    update private.analysis_recording_grants
    set claimed_at = claimed_at
    where id = pg_catalog.current_setting('inordo.recording_grant_id')::uuid;
    raise exception 'grant_identity_and_terminal_state_are_immutable';
  exception
    when check_violation then null;
  end;

  if original_actor is distinct from (
    select actor_id from private.analysis_recording_grants
    where id = pg_catalog.current_setting('inordo.recording_grant_id')::uuid
  ) then
    raise exception 'grant_identity_and_terminal_state_are_immutable';
  end if;
end;
$$;

-- owner_only_issue_revoke_and_verify and verify_returns_metadata_only
do $$
declare
  verification jsonb;
  revoked jsonb;
begin
  begin
    perform private.issue_analysis_recording_grant(
      '00000000-0000-4000-8000-000000000103'::uuid,
      '20000000-0000-4000-8000-000000000001'::uuid,
      pg_catalog.repeat('f', 64),
      pg_catalog.statement_timestamp() + interval '10 minutes',
      '00000000-0000-4000-8000-000000000102'::uuid
    );
    raise exception 'owner_only_issue_revoke_and_verify';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform private.verify_analysis_recording_grant(
      pg_catalog.current_setting('inordo.recording_grant_id')::uuid,
      '00000000-0000-4000-8000-000000000102'::uuid
    );
    raise exception 'owner_only_issue_revoke_and_verify';
  exception
    when insufficient_privilege then null;
  end;

  verification := private.verify_analysis_recording_grant(
    pg_catalog.current_setting('inordo.recording_grant_id')::uuid,
    '00000000-0000-4000-8000-000000000101'::uuid
  );
  if (
       select count(*) from pg_catalog.jsonb_object_keys(verification)
     ) <> 4
     or not verification ?& array[
       'grant_id', 'status', 'expires_at', 'claim_consistent'
     ]
     or verification ?| array[
       'actor_id', 'project_id', 'normalized_content_sha256',
       'claimed_analysis_request_id'
     ]
     or (verification ->> 'claim_consistent')::boolean is not true then
    raise exception 'verify_returns_metadata_only: %', verification;
  end if;

  begin
    perform private.revoke_analysis_recording_grant(
      pg_catalog.current_setting('inordo.second_recording_grant_id')::uuid,
      '00000000-0000-4000-8000-000000000102'::uuid
    );
    raise exception 'owner_only_issue_revoke_and_verify';
  exception
    when insufficient_privilege then null;
  end;

  revoked := private.revoke_analysis_recording_grant(
    pg_catalog.current_setting('inordo.second_recording_grant_id')::uuid,
    '00000000-0000-4000-8000-000000000101'::uuid
  );
  if (
       select count(*) from pg_catalog.jsonb_object_keys(revoked)
     ) <> 3
     or revoked ->> 'status' <> 'revoked' then
    raise exception 'owner_only_issue_revoke_and_verify: %', revoked;
  end if;
end;
$$;

-- Function and table privileges close every bypass path.
do $$
begin
  if has_function_privilege(
    'service_role',
    'public.begin_project_analysis(uuid,uuid,text,text,text,text,text,text,timestamptz,text,text)',
    'EXECUTE'
  ) then
    raise exception 'direct_legacy_begin_denied_to_service_role';
  end if;
  if has_function_privilege(
    'service_role',
    'private.begin_project_analysis_internal(uuid,text,text,text,text,text,text,timestamptz,text,text)',
    'EXECUTE'
  ) then
    raise exception 'direct_legacy_internal_denied_to_service_role';
  end if;
  if has_function_privilege(
    'service_role',
    'private.begin_project_analysis_with_policy_internal(uuid,text,text,text,text,text,text,timestamptz,text,text,boolean,boolean,text,text)',
    'EXECUTE'
  ) then
    raise exception 'direct_policy_internal_denied_to_service_role';
  end if;
  if has_function_privilege(
    'service_role',
    'private.reconcile_expired_analysis_claim(uuid,uuid,text,text)',
    'EXECUTE'
  ) then
    raise exception 'direct_reconcile_denied_to_service_role';
  end if;
  if has_function_privilege(
       'authenticated',
       'public.begin_project_analysis_with_policy(uuid,uuid,text,text,text,text,text,text,timestamptz,text,text,boolean,boolean,text,text)',
       'EXECUTE'
     ) or has_function_privilege(
       'anon',
       'public.begin_project_analysis_with_policy(uuid,uuid,text,text,text,text,text,text,timestamptz,text,text,boolean,boolean,text,text)',
       'EXECUTE'
     ) then
    raise exception 'authenticated_and_anon_policy_rpc_denied';
  end if;
  if not has_function_privilege(
    'service_role',
    'public.begin_project_analysis_with_policy(uuid,uuid,text,text,text,text,text,text,timestamptz,text,text,boolean,boolean,text,text)',
    'EXECUTE'
  ) then
    raise exception 'service_role policy wrapper execution missing';
  end if;
  if has_table_privilege(
       'service_role', 'private.analysis_recording_grants', 'SELECT'
     ) or has_table_privilege(
       'service_role', 'private.analysis_recording_grants', 'UPDATE'
     ) then
    raise exception 'service_role can access recording grant rows directly';
  end if;
  if has_function_privilege(
       'service_role',
       'private.issue_analysis_recording_grant(uuid,uuid,text,timestamptz,uuid)',
       'EXECUTE'
     ) or has_function_privilege(
       'service_role',
       'private.revoke_analysis_recording_grant(uuid,uuid)',
       'EXECUTE'
     ) or has_function_privilege(
       'service_role',
       'private.verify_analysis_recording_grant(uuid,uuid)',
       'EXECUTE'
     ) then
    raise exception 'owner_only_issue_revoke_and_verify';
  end if;
  if pg_catalog.pg_get_functiondef(
       'private.verify_analysis_recording_grant(uuid,uuid)'::regprocedure
     ) !~* 'for[[:space:]]+update[[:space:]]+of[[:space:]]+grant_record' then
    raise exception 'verify_grant_reads_under_tuple_lock';
  end if;
end;
$$;

-- viewer_analysis_denied
set local role service_role;
select pg_catalog.set_config(
  'request.jwt.claims', '{"role":"service_role"}', true
);
do $$
declare
  raw_text constant text := 'Viewer analysis policy verification.';
begin
  begin
    perform public.begin_project_analysis_with_policy(
      '00000000-0000-4000-8000-000000000108'::uuid,
      '20000000-0000-4000-8000-000000000001'::uuid,
      pg_catalog.current_setting('inordo.analysis_policy_revision'),
      'Viewer analysis policy', 'manual_note', 'SQL verifier', raw_text,
      pg_catalog.current_setting('inordo.analysis_policy_viewer_hash'),
      null, null,
      'auto', false, true, 'gpt-5.6-luna', 'openai/gpt-oss-20b'
    );
    raise exception 'viewer_analysis_denied';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;
reset role;

rollback;
