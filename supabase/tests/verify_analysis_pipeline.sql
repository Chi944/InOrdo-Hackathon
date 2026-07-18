-- Prompt 7 database integration assertions.
-- Run only after the Prompt 7 migration and demo seed are present. Every
-- mutation is transaction-scoped and rolled back.

begin;

do $$
declare
  project_revision text;
  item_version bigint;
  deterministic_impacts jsonb;
  completion_payload jsonb;
  rate_index integer;
begin
  if not exists (
    select 1
    from public.projects
    where id = '20000000-0000-4000-8000-000000000001'::uuid
  ) then
    raise exception 'Prompt 7 verification requires the demo seed';
  end if;

  project_revision := private.compute_project_revision(
    '10000000-0000-4000-8000-000000000001'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid
  );
  select version
  into item_version
  from public.project_items
  where id = '30000000-0000-4000-8000-000000000001'::uuid;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'item_id', path.item_id,
        'severity', 'medium',
        'depth', path.depth,
        'path_item_ids', pg_catalog.to_jsonb(path.path_item_ids),
        'explanation', 'Deterministic SQL verification impact.'
      ) order by path.depth, path.item_id
    ),
    '[]'::jsonb
  )
  into deterministic_impacts
  from private.compute_impact_paths(
    '10000000-0000-4000-8000-000000000001'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    '30000000-0000-4000-8000-000000000001'::uuid,
    5
  ) as path;

  completion_payload := pg_catalog.jsonb_build_object(
    'model_name', 'gpt-5.6-luna',
    'extraction_metadata', pg_catalog.jsonb_build_object(
      'request_id', null,
      'model_name', 'gpt-5.6-luna-provider-fixture',
      'usage', null
    ),
    'proposal_metadata', pg_catalog.jsonb_build_object(
      'request_id', null,
      'model_name', 'gpt-5.6-luna-provider-fixture',
      'usage', null
    ),
    'validation_outcome', pg_catalog.jsonb_build_object(
      'status', 'needs_review',
      'ambiguities', '[]'::jsonb,
      'unresolved_references', '[]'::jsonb,
      'warnings', '[]'::jsonb,
      'review_reasons', pg_catalog.jsonb_build_array(
        'human_approval_required'
      )
    ),
    'change', pg_catalog.jsonb_build_object(
      'target_item_id', '30000000-0000-4000-8000-000000000001',
      'field_name', 'event_date',
      'previous_value', '2026-09-12',
      'proposed_value', '2026-09-19',
      'confidence', 0.95,
      'evidence_text', '2026-09-19',
      'evidence_start_offset', 16,
      'evidence_end_offset', 26,
      'expected_item_version', item_version
    ),
    'impact', pg_catalog.jsonb_build_object(
      'max_depth', 5,
      'items', deterministic_impacts
    ),
    'proposal', pg_catalog.jsonb_build_object(
      'title', 'Verify the date change before applying it',
      'rationale', 'The source proposes a date change that requires review.',
      'actions', pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object(
          'target_item_id', '30000000-0000-4000-8000-000000000001',
          'expected_item_version', null,
          'rationale', 'A reviewer must confirm the supplied date.',
          'payload', pg_catalog.jsonb_build_object(
            'prompt_action_type', 'request_confirmation',
            'question', 'Should the summit date move to 2026-09-19?',
            'linked_impact_item_id',
              '30000000-0000-4000-8000-000000000001',
            'confidence', 0.95,
            'requires_human_input', true
          )
        )
      )
    )
  );

  if not private.is_valid_model_metadata(
    completion_payload -> 'extraction_metadata'
  ) then
    raise exception 'provider model metadata validator rejected valid metadata';
  end if;
  if not private.is_valid_model_metadata(
    (completion_payload -> 'extraction_metadata') - 'model_name'
  ) then
    raise exception 'provider model metadata rejected the legacy envelope';
  end if;
  if private.is_valid_model_metadata(
    pg_catalog.jsonb_set(
      completion_payload -> 'extraction_metadata',
      '{model_name}',
      '42'::jsonb
    )
  ) then
    raise exception 'provider model metadata accepted a non-string model name';
  end if;
  if private.is_valid_model_metadata(
    pg_catalog.jsonb_set(
      completion_payload -> 'extraction_metadata',
      '{model_name}',
      pg_catalog.to_jsonb('bad model name!'::text)
    )
  ) then
    raise exception 'provider model metadata accepted illegal model characters';
  end if;
  if private.is_valid_model_metadata(
    pg_catalog.jsonb_set(
      completion_payload -> 'extraction_metadata',
      '{model_name}',
      pg_catalog.to_jsonb(pg_catalog.repeat('x', 121))
    )
  ) then
    raise exception 'provider model metadata accepted an overlong model name';
  end if;
  if private.is_valid_model_metadata(
    (completion_payload -> 'extraction_metadata')
      || pg_catalog.jsonb_build_object('unexpected', true)
  ) then
    raise exception 'provider model metadata accepted an unknown field';
  end if;
  if private.is_valid_model_metadata(
    ((completion_payload -> 'extraction_metadata') - 'model_name')
      || pg_catalog.jsonb_build_object('unexpected', true)
  ) then
    raise exception 'legacy provider metadata accepted an unknown field';
  end if;
  if exists (
    select 1
    from pg_catalog.pg_proc as function_row
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = function_row.pronamespace
    cross join lateral pg_catalog.aclexplode(
      coalesce(
        function_row.proacl,
        pg_catalog.acldefault('f', function_row.proowner)
      )
    ) as permission
    left join pg_catalog.pg_roles as grantee
      on grantee.oid = permission.grantee
    where namespace.nspname = 'private'
      and function_row.proname = 'is_valid_model_metadata'
      and pg_catalog.pg_get_function_identity_arguments(function_row.oid)
        = 'candidate jsonb'
      and permission.privilege_type = 'EXECUTE'
      and (
        permission.grantee = 0
        or grantee.rolname in ('anon', 'authenticated', 'service_role')
      )
  ) then
    raise exception 'provider model metadata validator is directly executable';
  end if;

  perform pg_catalog.set_config(
    'inordo.prompt7_revision', project_revision, true
  );
  perform pg_catalog.set_config(
    'inordo.prompt7_success_hash',
    private.source_normalized_sha256('Summit moved to 2026-09-19.'),
    true
  );
  perform pg_catalog.set_config(
    'inordo.prompt7_failure_hash',
    private.source_normalized_sha256('Verification failure source.'),
    true
  );
  perform pg_catalog.set_config(
    'inordo.prompt7_viewer_hash',
    private.source_normalized_sha256('Viewer must not analyze.'),
    true
  );
  perform pg_catalog.set_config(
    'inordo.prompt7_anonymous_hash',
    private.source_normalized_sha256('Anonymous must not analyze.'),
    true
  );
  perform pg_catalog.set_config(
    'inordo.prompt7_expired_hash',
    private.source_normalized_sha256('Lease expiry verification.'),
    true
  );
  for rate_index in 1..4 loop
    perform pg_catalog.set_config(
      'inordo.prompt7_rate_hash_' || rate_index::text,
      private.source_normalized_sha256(
        pg_catalog.format('Rate verification %s.', rate_index)
      ),
      true
    );
  end loop;
  perform pg_catalog.set_config(
    'inordo.prompt7_result', completion_payload::text, true
  );

  if private.normalize_source_text(E'  alpha\r\n beta\t value  \n')
       <> E'alpha\nbeta value' then
    raise exception 'source normalization parity failed';
  end if;
  if not private.evidence_matches_utf16_offsets(
    'A' || pg_catalog.chr(128512) || 'BC', 'BC', 3, 5
  ) then
    raise exception 'UTF-16 evidence offset parity failed';
  end if;
  if private.evidence_matches_utf16_offsets(
    'A' || pg_catalog.chr(128512) || 'BC',
    pg_catalog.chr(128512) || 'B',
    2,
    4
  ) then
    raise exception 'split-surrogate evidence offset was accepted';
  end if;

  if has_table_privilege(
    'authenticated', 'public.source_documents', 'INSERT'
  ) then
    raise exception 'authenticated can bypass analysis source intake';
  end if;
  if has_table_privilege(
    'authenticated', 'public.analysis_requests', 'INSERT'
  ) then
    raise exception 'authenticated can insert analysis claims directly';
  end if;
  if has_table_privilege(
       'authenticated', 'public.change_events', 'UPDATE'
     ) or has_any_column_privilege(
       'authenticated', 'public.change_events', 'UPDATE'
     ) then
    raise exception 'authenticated retains direct change-event review writes';
  end if;
  if has_table_privilege(
       'authenticated', 'public.proposal_actions', 'UPDATE'
     ) or has_any_column_privilege(
       'authenticated', 'public.proposal_actions', 'UPDATE'
     ) then
    raise exception 'authenticated retains direct proposal-action review writes';
  end if;
  if exists (
    select 1
    from pg_catalog.pg_policies as policy
    where policy.schemaname = 'public'
      and policy.policyname in (
        'change_events_review_admin',
        'proposal_actions_review_admin'
      )
  ) then
    raise exception 'legacy authenticated review policy still exists';
  end if;
  if has_function_privilege(
       'anon',
       'private.promote_succeeded_analysis_proposal()',
       'EXECUTE'
     ) or has_function_privilege(
       'authenticated',
       'private.promote_succeeded_analysis_proposal()',
       'EXECUTE'
     ) or has_function_privilege(
       'service_role',
       'private.promote_succeeded_analysis_proposal()',
       'EXECUTE'
     ) then
    raise exception 'proposal readiness trigger function is directly executable';
  end if;
  if has_function_privilege(
    'authenticated',
    'public.begin_project_analysis(uuid,uuid,text,text,text,text,text,text,timestamptz,text,text)',
    'EXECUTE'
  ) then
    raise exception 'authenticated can execute server-only analysis intake';
  end if;
  if not has_function_privilege(
    'service_role',
    'public.begin_project_analysis(uuid,uuid,text,text,text,text,text,text,timestamptz,text,text)',
    'EXECUTE'
  ) then
    raise exception 'service_role lacks begin_project_analysis execution';
  end if;
  if has_function_privilege(
       'anon',
       'private.reconcile_expired_analysis_claim(uuid,uuid,text,text)',
       'EXECUTE'
     ) or has_function_privilege(
       'authenticated',
       'private.reconcile_expired_analysis_claim(uuid,uuid,text,text)',
       'EXECUTE'
     ) or not has_function_privilege(
       'service_role',
       'private.reconcile_expired_analysis_claim(uuid,uuid,text,text)',
       'EXECUTE'
     ) then
    raise exception 'analysis lease reconciliation privileges are unsafe';
  end if;
  if has_function_privilege(
       'anon',
       'private.assign_analysis_request_lease()',
       'EXECUTE'
     ) or has_function_privilege(
       'authenticated',
       'private.assign_analysis_request_lease()',
       'EXECUTE'
     ) or has_function_privilege(
       'service_role',
       'private.assign_analysis_request_lease()',
       'EXECUTE'
     ) then
    raise exception 'analysis lease trigger function is directly executable';
  end if;
end;
$$;

set local role service_role;
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000102',
  true
);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"role":"service_role"}',
  true
);

do $$
declare
  begin_result jsonb;
begin
  begin_result := public.begin_project_analysis(
    '00000000-0000-4000-8000-000000000102'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    pg_catalog.current_setting('inordo.prompt7_revision'),
    'Prompt 7 SQL verification',
    'manual_note',
    'SQL verifier',
    'Summit moved to 2026-09-19.',
    pg_catalog.current_setting('inordo.prompt7_success_hash'),
    null,
    null,
    'gpt-5.6-luna'
  );
  if begin_result ->> 'status' <> 'claimed'
     or begin_result ->> 'state' <> 'processing' then
    raise exception 'analysis claim failed: %', begin_result;
  end if;
  if not exists (
    select 1
    from public.analysis_requests as request
    where request.id = (begin_result ->> 'analysis_request_id')::uuid
      and request.lease_expires_at = request.created_at + interval '3 minutes'
  ) then
    raise exception 'analysis claim did not receive the fixed three-minute lease';
  end if;
  perform pg_catalog.set_config(
    'inordo.prompt7_request_id',
    begin_result ->> 'analysis_request_id',
    true
  );
end;
$$;

do $$
declare
  completion_result jsonb;
  persisted_impact_count integer;
  expected_impact_count integer;
  item_date date;
  proposal_action_id uuid;
begin
  perform pg_catalog.set_config(
    'request.jwt.claims', '{"role":"service_role"}', true
  );
  completion_result := public.complete_project_analysis(
    '00000000-0000-4000-8000-000000000102'::uuid,
    pg_catalog.current_setting('inordo.prompt7_request_id')::uuid,
    pg_catalog.current_setting('inordo.prompt7_revision'),
    pg_catalog.current_setting('inordo.prompt7_result')::jsonb
  );
  if completion_result ->> 'status' <> 'succeeded'
     or completion_result ->> 'state' <> 'succeeded' then
    raise exception 'analysis completion failed: %', completion_result;
  end if;

  select event_date
  into item_date
  from public.project_items
  where id = '30000000-0000-4000-8000-000000000001'::uuid;
  if item_date is distinct from date '2026-09-12' then
    raise exception 'analysis directly mutated the project item';
  end if;

  if not exists (
    select 1
    from public.change_events
    where id = (completion_result ->> 'change_event_id')::uuid
      and state = 'needs_confirmation'::public.change_event_state
  ) then
    raise exception 'change event is not awaiting confirmation';
  end if;
  if not exists (
    select 1
    from public.analysis_requests as request
    where request.id = (
        completion_result ->> 'analysis_request_id'
      )::uuid
      and request.result_metadata #>> '{extraction_metadata,model_name}'
        = 'gpt-5.6-luna-provider-fixture'
      and request.result_metadata #>> '{proposal_metadata,model_name}'
        = 'gpt-5.6-luna-provider-fixture'
  ) then
    raise exception 'provider-returned model names were not persisted';
  end if;
  if not exists (
    select 1
    from public.action_proposals
    where id = (completion_result ->> 'proposal_id')::uuid
      and state = 'ready'::public.proposal_state
  ) then
    raise exception 'proposal is not ready but inert';
  end if;
  if exists (
    select 1
    from public.proposal_actions
    where proposal_id = (completion_result ->> 'proposal_id')::uuid
      and (
        state <> 'pending'::public.proposal_action_state
        or reviewed_by is not null
        or reviewed_at is not null
      )
  ) then
    raise exception 'proposal readiness reviewed or activated an action';
  end if;
  if exists (
    select 1
    from public.operation_logs
    where proposal_id = (completion_result ->> 'proposal_id')::uuid
  ) then
    raise exception 'proposal readiness created an operation';
  end if;
  if not exists (
    select 1
    from public.proposal_actions
    where proposal_id = (completion_result ->> 'proposal_id')::uuid
      and state = 'pending'::public.proposal_action_state
      and action_type = 'request_confirmation'::public.proposal_action_type
  ) then
    raise exception 'pending confirmation action was not persisted';
  end if;

  select pg_catalog.count(*)::integer
  into persisted_impact_count
  from public.impact_items
  where impact_run_id = (completion_result ->> 'impact_run_id')::uuid;
  expected_impact_count := pg_catalog.jsonb_array_length(
    pg_catalog.current_setting('inordo.prompt7_result')::jsonb
      -> 'impact' -> 'items'
  );
  if persisted_impact_count <> expected_impact_count then
    raise exception 'persisted impact set differs from deterministic set';
  end if;

  select action.id
  into strict proposal_action_id
  from public.proposal_actions as action
  where action.proposal_id = (completion_result ->> 'proposal_id')::uuid;

  perform pg_catalog.set_config(
    'inordo.prompt7_source_document_id',
    completion_result ->> 'source_document_id',
    true
  );
  perform pg_catalog.set_config(
    'inordo.prompt7_change_event_id',
    completion_result ->> 'change_event_id',
    true
  );
  perform pg_catalog.set_config(
    'inordo.prompt7_impact_run_id',
    completion_result ->> 'impact_run_id',
    true
  );
  perform pg_catalog.set_config(
    'inordo.prompt7_proposal_id',
    completion_result ->> 'proposal_id',
    true
  );
  perform pg_catalog.set_config(
    'inordo.prompt7_proposal_action_id',
    proposal_action_id::text,
    true
  );
end;
$$;

-- A succeeded state cannot make an incomplete draft actionable. The rejected
-- statement rolls back while the deliberately anomalous draft remains inert.
do $$
declare
  anomalous_proposal_id uuid;
  anomalous_request_id uuid;
  anomalous_request_state public.analysis_request_state;
  anomalous_proposal_state public.proposal_state;
begin
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
    '10000000-0000-4000-8000-000000000001'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    pg_catalog.current_setting('inordo.prompt7_change_event_id')::uuid,
    pg_catalog.current_setting('inordo.prompt7_impact_run_id')::uuid,
    'draft'::public.proposal_state,
    'Incomplete SQL verification proposal',
    'This draft intentionally has no actions.',
    'gpt-5.6-luna',
    '00000000-0000-4000-8000-000000000102'::uuid
  )
  returning id into anomalous_proposal_id;

  insert into public.analysis_requests (
    workspace_id,
    project_id,
    source_document_id,
    project_revision,
    normalized_content_sha256,
    model_name,
    state,
    requested_by
  ) values (
    '10000000-0000-4000-8000-000000000001'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    pg_catalog.current_setting('inordo.prompt7_source_document_id')::uuid,
    pg_catalog.current_setting('inordo.prompt7_revision'),
    pg_catalog.repeat('a', 64),
    'gpt-5.6-luna',
    'processing'::public.analysis_request_state,
    '00000000-0000-4000-8000-000000000102'::uuid
  )
  returning id into anomalous_request_id;

  begin
    update public.analysis_requests
    set state = 'succeeded'::public.analysis_request_state,
        change_event_id = pg_catalog.current_setting(
          'inordo.prompt7_change_event_id'
        )::uuid,
        impact_run_id = pg_catalog.current_setting(
          'inordo.prompt7_impact_run_id'
        )::uuid,
        proposal_id = anomalous_proposal_id,
        result_metadata = '{}'::jsonb,
        finished_at = pg_catalog.statement_timestamp()
    where id = anomalous_request_id;

    raise exception 'incomplete analysis proposal was promoted';
  exception
    when check_violation then
      if sqlerrm <> 'completed analysis proposal is not ready for review' then
        raise;
      end if;
  end;

  select request.state
  into strict anomalous_request_state
  from public.analysis_requests as request
  where request.id = anomalous_request_id;
  select proposal.state
  into strict anomalous_proposal_state
  from public.action_proposals as proposal
  where proposal.id = anomalous_proposal_id;

  if anomalous_request_state <> 'processing'::public.analysis_request_state
     or anomalous_proposal_state <> 'draft'::public.proposal_state
     or exists (
       select 1
       from public.proposal_actions as action
       where action.proposal_id = anomalous_proposal_id
     )
     or exists (
       select 1
       from public.operation_logs as operation
       where operation.proposal_id = anomalous_proposal_id
     ) then
    raise exception 'incomplete analysis draft did not remain quarantined';
  end if;
end;
$$;

do $$
declare
  duplicate_result jsonb;
begin
  perform pg_catalog.set_config(
    'request.jwt.claims', '{"role":"service_role"}', true
  );
  duplicate_result := public.begin_project_analysis(
    '00000000-0000-4000-8000-000000000102'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    pg_catalog.current_setting('inordo.prompt7_revision'),
    'Prompt 7 SQL verification',
    'manual_note',
    'SQL verifier',
    'Summit moved to 2026-09-19.',
    pg_catalog.current_setting('inordo.prompt7_success_hash'),
    null,
    null,
    'gpt-5.6-luna'
  );
  if duplicate_result ->> 'status' <> 'duplicate'
     or duplicate_result ->> 'state' <> 'succeeded' then
    raise exception 'succeeded duplicate was not suppressed: %', duplicate_result;
  end if;
end;
$$;

do $$
declare
  begin_result jsonb;
  failure_result jsonb;
begin
  perform pg_catalog.set_config(
    'request.jwt.claims', '{"role":"service_role"}', true
  );
  begin_result := public.begin_project_analysis(
    '00000000-0000-4000-8000-000000000102'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    pg_catalog.current_setting('inordo.prompt7_revision'),
    'Prompt 7 failure verification',
    'manual_note',
    'SQL verifier',
    'Verification failure source.',
    pg_catalog.current_setting('inordo.prompt7_failure_hash'),
    null,
    null,
    'gpt-5.6-luna'
  );
  if begin_result ->> 'status' <> 'claimed' then
    raise exception 'failure-path claim failed: %', begin_result;
  end if;

  perform pg_catalog.set_config(
    'request.jwt.claims', '{"role":"service_role"}', true
  );
  failure_result := public.fail_project_analysis(
    '00000000-0000-4000-8000-000000000102'::uuid,
    (begin_result ->> 'analysis_request_id')::uuid,
    'extraction',
    'model_timeout',
    'req_prompt7_verification'
  );
  if failure_result ->> 'status' <> 'failed'
     or failure_result ->> 'state' <> 'failed' then
    raise exception 'failure-path finalization failed: %', failure_result;
  end if;
end;
$$;

do $$
declare
  rate_index integer;
  begin_result jsonb;
  duplicate_result jsonb;
begin
  for rate_index in 1..2 loop
    perform pg_catalog.set_config(
      'request.jwt.claims', '{"role":"service_role"}', true
    );
    begin_result := public.begin_project_analysis(
      '00000000-0000-4000-8000-000000000102'::uuid,
      '20000000-0000-4000-8000-000000000001'::uuid,
      pg_catalog.current_setting('inordo.prompt7_revision'),
      pg_catalog.format('Prompt 7 rate verification %s', rate_index),
      'manual_note',
      'SQL verifier',
      pg_catalog.format('Rate verification %s.', rate_index),
      pg_catalog.current_setting(
        'inordo.prompt7_rate_hash_' || rate_index::text
      ),
      null,
      null,
      'gpt-5.6-luna'
    );
    if begin_result ->> 'status' <> 'claimed' then
      raise exception 'rate setup claim failed: %', begin_result;
    end if;
    if rate_index = 1 then
      perform pg_catalog.set_config(
        'request.jwt.claims', '{"role":"service_role"}', true
      );
      duplicate_result := public.begin_project_analysis(
        '00000000-0000-4000-8000-000000000102'::uuid,
        '20000000-0000-4000-8000-000000000001'::uuid,
        pg_catalog.current_setting('inordo.prompt7_revision'),
        pg_catalog.format('Prompt 7 rate verification %s', rate_index),
        'manual_note',
        'SQL verifier',
        pg_catalog.format('Rate verification %s.', rate_index),
        pg_catalog.current_setting(
          'inordo.prompt7_rate_hash_' || rate_index::text
        ),
        null,
        null,
        'gpt-5.6-luna'
      );
      if duplicate_result ->> 'status' <> 'duplicate'
         or duplicate_result ->> 'state' <> 'processing'
         or (duplicate_result ->> 'retry_after_seconds')::integer
           not between 1 and 180 then
        raise exception 'active lease replay was not safely suppressed: %',
          duplicate_result;
      end if;
    end if;
  end loop;

  perform pg_catalog.set_config(
    'request.jwt.claims', '{"role":"service_role"}', true
  );
  begin_result := public.begin_project_analysis(
    '00000000-0000-4000-8000-000000000102'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    pg_catalog.current_setting('inordo.prompt7_revision'),
    'Prompt 7 rate verification 3',
    'manual_note',
    'SQL verifier',
    'Rate verification 3.',
    pg_catalog.current_setting('inordo.prompt7_rate_hash_3'),
    null,
    null,
    'gpt-5.6-luna'
  );
  if begin_result ->> 'status' <> 'rate_limited'
     or (begin_result ->> 'retry_after_seconds')::integer not between 1 and 600 then
    raise exception 'rate limit did not fail closed: %', begin_result;
  end if;
end;
$$;

-- An exact replay lazily reconciles a deliberately expired fixture once. The
-- immutable source remains, no derived record appears, and a late worker can
-- no longer complete the terminal request.
do $$
declare
  expired_created_at timestamptz := pg_catalog.clock_timestamp()
    - interval '4 minutes';
  expired_hash text := pg_catalog.current_setting(
    'inordo.prompt7_expired_hash'
  );
  expired_request_id uuid;
  expired_source_id uuid;
  expired_completion_result jsonb;
  first_replay jsonb;
  second_replay jsonb;
begin
  insert into public.source_documents (
    workspace_id,
    project_id,
    title,
    source_kind,
    raw_text,
    captured_by,
    source_author,
    normalized_content_sha256,
    created_at
  ) values (
    '10000000-0000-4000-8000-000000000001'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    'Expired analysis lease verification',
    'manual_note',
    'Lease expiry verification.',
    '00000000-0000-4000-8000-000000000102'::uuid,
    'SQL verifier',
    expired_hash,
    expired_created_at
  ) returning id into expired_source_id;

  insert into public.analysis_requests (
    workspace_id,
    project_id,
    source_document_id,
    project_revision,
    normalized_content_sha256,
    model_name,
    requested_by,
    created_at
  ) values (
    '10000000-0000-4000-8000-000000000001'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    expired_source_id,
    pg_catalog.current_setting('inordo.prompt7_revision'),
    expired_hash,
    'gpt-5.6-luna',
    '00000000-0000-4000-8000-000000000102'::uuid,
    expired_created_at
  ) returning id into expired_request_id;

  if not exists (
    select 1
    from public.analysis_requests as request
    where request.id = expired_request_id
      and request.lease_expires_at = expired_created_at + interval '3 minutes'
  ) then
    raise exception 'expired fixture lease was not assigned from creation time';
  end if;

  expired_completion_result := pg_catalog.jsonb_set(
    pg_catalog.jsonb_set(
      pg_catalog.jsonb_set(
        pg_catalog.current_setting('inordo.prompt7_result')::jsonb,
        '{change,evidence_text}',
        pg_catalog.to_jsonb('Lease'::text)
      ),
      '{change,evidence_start_offset}',
      '0'::jsonb
    ),
    '{change,evidence_end_offset}',
    '5'::jsonb
  );

  perform pg_catalog.set_config(
    'request.jwt.claims', '{"role":"service_role"}', true
  );
  begin
    perform public.complete_project_analysis(
      '00000000-0000-4000-8000-000000000102'::uuid,
      expired_request_id,
      pg_catalog.current_setting('inordo.prompt7_revision'),
      expired_completion_result
    );
    raise exception 'expired processing claim completed without reconciliation';
  exception
    when object_not_in_prerequisite_state then null;
  end;

  if not exists (
    select 1
    from public.analysis_requests as request
    where request.id = expired_request_id
      and request.state = 'processing'::public.analysis_request_state
      and request.change_event_id is null
      and request.impact_run_id is null
      and request.proposal_id is null
  ) or exists (
    select 1
    from public.change_events as event
    where event.source_document_id = expired_source_id
  ) then
    raise exception 'expired completion did not roll back every derived write';
  end if;

  perform pg_catalog.set_config(
    'request.jwt.claims', '{"role":"service_role"}', true
  );
  first_replay := public.begin_project_analysis(
    '00000000-0000-4000-8000-000000000102'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    pg_catalog.current_setting('inordo.prompt7_revision'),
    'Expired analysis lease verification',
    'manual_note',
    'SQL verifier',
    'Lease expiry verification.',
    expired_hash,
    null,
    null,
    'gpt-5.6-luna'
  );

  perform pg_catalog.set_config(
    'request.jwt.claims', '{"role":"service_role"}', true
  );
  second_replay := public.begin_project_analysis(
    '00000000-0000-4000-8000-000000000102'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    pg_catalog.current_setting('inordo.prompt7_revision'),
    'Expired analysis lease verification',
    'manual_note',
    'SQL verifier',
    'Lease expiry verification.',
    expired_hash,
    null,
    null,
    'gpt-5.6-luna'
  );

  if first_replay ->> 'status' <> 'duplicate'
     or first_replay ->> 'state' <> 'failed'
     or first_replay ->> 'analysis_request_id' <> expired_request_id::text
     or first_replay ->> 'source_document_id' <> expired_source_id::text
     or second_replay is distinct from first_replay then
    raise exception 'expired claim reconciliation was not stable: %, %',
      first_replay,
      second_replay;
  end if;

  if not exists (
    select 1
    from public.analysis_requests as request
    where request.id = expired_request_id
      and request.state = 'failed'::public.analysis_request_state
      and request.failure_stage = 'persistence'
      and request.failure_code = 'analysis_cancelled'
      and request.failure_provider_request_id is null
      and request.finished_at is not null
      and request.change_event_id is null
      and request.impact_run_id is null
      and request.proposal_id is null
      and request.result_metadata is null
  ) or not exists (
    select 1
    from public.source_documents as source
    where source.id = expired_source_id
      and source.raw_text = 'Lease expiry verification.'
  ) then
    raise exception 'expired claim did not fail closed while preserving evidence';
  end if;

  perform pg_catalog.set_config(
    'request.jwt.claims', '{"role":"service_role"}', true
  );
  begin
    perform public.complete_project_analysis(
      '00000000-0000-4000-8000-000000000102'::uuid,
      expired_request_id,
      pg_catalog.current_setting('inordo.prompt7_revision'),
      '{}'::jsonb
    );
    raise exception 'late analysis completion unexpectedly overwrote failure';
  exception
    when object_not_in_prerequisite_state then null;
  end;
end;
$$;

reset role;

set local role service_role;
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000108',
  true
);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"role":"service_role"}',
  true
);

do $$
begin
  begin
    perform public.begin_project_analysis(
      '00000000-0000-4000-8000-000000000108'::uuid,
      '20000000-0000-4000-8000-000000000001'::uuid,
      pg_catalog.current_setting('inordo.prompt7_revision'),
      'Viewer rejection verification',
      'manual_note',
      'SQL verifier',
      'Viewer must not analyze.',
      pg_catalog.current_setting('inordo.prompt7_viewer_hash'),
      null,
      null,
      'gpt-5.6-luna'
    );
    raise exception 'viewer analysis unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;

set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000102',
  true
);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000102","role":"authenticated","is_anonymous":true}',
  true
);

do $$
begin
  begin
    perform public.begin_project_analysis(
      '00000000-0000-4000-8000-000000000102'::uuid,
      '20000000-0000-4000-8000-000000000001'::uuid,
      pg_catalog.current_setting('inordo.prompt7_revision'),
      'Anonymous rejection verification',
      'manual_note',
      'SQL verifier',
      'Anonymous must not analyze.',
      pg_catalog.current_setting('inordo.prompt7_anonymous_hash'),
      null,
      null,
      'gpt-5.6-luna'
    );
    raise exception 'anonymous analysis unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;

set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000102',
  true
);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000102","role":"authenticated","is_anonymous":false}',
  true
);

-- Browser clients can read review state through RLS, but only the authorized
-- server operation may atomically attribute and apply a selected action.
do $$
begin
  begin
    update public.change_events
    set state = 'rejected'::public.change_event_state,
        reviewed_by = '00000000-0000-4000-8000-000000000102'::uuid,
        reviewed_at = pg_catalog.statement_timestamp()
    where id = pg_catalog.current_setting(
      'inordo.prompt7_change_event_id'
    )::uuid;
    raise exception 'authenticated directly reviewed a change event';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.proposal_actions
    set state = 'approved'::public.proposal_action_state,
        reviewed_by = '00000000-0000-4000-8000-000000000102'::uuid,
        reviewed_at = pg_catalog.statement_timestamp()
    where id = pg_catalog.current_setting(
      'inordo.prompt7_proposal_action_id'
    )::uuid;
    raise exception 'authenticated directly reviewed a proposal action';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;
rollback;
