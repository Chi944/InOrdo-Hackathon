-- Prompt 13 evidence provenance and proposal-context regressions.
-- Requires the migrations and deterministic demo seed. Every mutation rolls back.

begin;

-- The private revision helper is intentionally not executable by service_role;
-- compute the server input before assuming the wrapper role.
select pg_catalog.set_config(
  'inordo.prompt13_project_revision',
  private.compute_project_revision(
    '10000000-0000-4000-8000-000000000001'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid
  ),
  true
);

set local role service_role;
select pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000102',
  true
);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"role":"service_role","sub":"00000000-0000-4000-8000-000000000102"}',
  true
);

-- The provenance bridge is member-readable, server-written, append-only, and
-- its invalidation trigger functions are not callable RPC surfaces.
do $$
begin
  if not has_table_privilege(
       'authenticated', 'public.analysis_request_sources', 'SELECT'
     )
     or has_table_privilege(
       'authenticated', 'public.analysis_request_sources', 'INSERT'
     )
     or has_table_privilege(
       'authenticated', 'public.analysis_request_sources', 'UPDATE'
     )
     or has_table_privilege(
       'authenticated', 'public.analysis_request_sources', 'DELETE'
     )
     or has_table_privilege(
       'anon', 'public.analysis_request_sources', 'SELECT'
     )
     or not has_table_privilege(
       'service_role', 'public.analysis_request_sources', 'SELECT'
     )
     or not has_table_privilege(
       'service_role', 'public.analysis_request_sources', 'INSERT'
     )
     or has_table_privilege(
       'service_role', 'public.analysis_request_sources', 'UPDATE'
     )
     or has_table_privilege(
       'service_role', 'public.analysis_request_sources', 'DELETE'
     ) then
    raise exception 'analysis provenance bridge privileges are not least-privilege';
  end if;
  if not exists (
       select 1
       from pg_catalog.pg_class as relation
       join pg_catalog.pg_namespace as namespace
         on namespace.oid = relation.relnamespace
       where namespace.nspname = 'public'
         and relation.relname = 'analysis_request_sources'
         and relation.relrowsecurity
     )
     or not exists (
       select 1
       from pg_catalog.pg_trigger as trigger
       where trigger.tgrelid = 'public.analysis_request_sources'::regclass
         and trigger.tgname = 'analysis_request_sources_immutable'
         and not trigger.tgisinternal
     ) then
    raise exception 'analysis provenance bridge is not RLS and append-only';
  end if;
  if has_function_privilege(
       'anon',
       'private.supersede_project_proposals_on_item_change()',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'private.supersede_project_proposals_on_item_change()',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'private.supersede_project_proposals_on_item_change()',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'private.supersede_project_proposals_on_dependency_change()',
       'EXECUTE'
     ) then
    raise exception 'proposal invalidation trigger functions are directly executable';
  end if;
end;
$$;

-- Identical normalized evidence must keep one provider-spend claim while each
-- distinct full provenance capture remains independently addressable.
do $$
declare
  expected_project_revision text;
  normalized_hash text;
  first_result jsonb;
  second_result jsonb;
  exact_replay jsonb;
begin
  expected_project_revision := pg_catalog.current_setting(
    'inordo.prompt13_project_revision'
  );
  normalized_hash := pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        'Prompt 13 provenance verifier: summit update.', 'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  first_result := public.begin_project_analysis_with_policy(
    '00000000-0000-4000-8000-000000000102'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    expected_project_revision,
    'Programme desk capture', 'manual_note', 'Programme desk',
    'Prompt 13 provenance verifier: summit update.', normalized_hash,
    '2026-07-19 09:00:00+00'::timestamptz, null,
    'auto', false, true, 'gpt-5.6-luna', 'openai/gpt-oss-20b'
  );
  second_result := public.begin_project_analysis_with_policy(
    '00000000-0000-4000-8000-000000000102'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    expected_project_revision,
    'Operations handoff capture', 'manual_note', 'Operations lead',
    'Prompt 13 provenance verifier: summit update.', normalized_hash,
    '2026-07-19 10:00:00+00'::timestamptz, null,
    'auto', false, true, 'gpt-5.6-luna', 'openai/gpt-oss-20b'
  );
  exact_replay := public.begin_project_analysis_with_policy(
    '00000000-0000-4000-8000-000000000102'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    expected_project_revision,
    'Operations handoff capture', 'manual_note', 'Operations lead',
    'Prompt 13 provenance verifier: summit update.', normalized_hash,
    '2026-07-19 10:00:00+00'::timestamptz, null,
    'auto', false, true, 'gpt-5.6-luna', 'openai/gpt-oss-20b'
  );

  if first_result ->> 'status' <> 'claimed'
     or second_result ->> 'status' <> 'duplicate'
     or first_result ->> 'analysis_request_id'
       <> second_result ->> 'analysis_request_id' then
    raise exception 'same normalized evidence did not retain one canonical claim: %, %',
      first_result, second_result;
  end if;
  if first_result ->> 'source_document_id' = second_result ->> 'source_document_id'
     or not exists (
       select 1
       from public.source_documents as source
       where source.id = (second_result ->> 'source_document_id')::uuid
         and source.title = 'Operations handoff capture'
         and source.source_author = 'Operations lead'
         and source.occurred_at = '2026-07-19 10:00:00+00'::timestamptz
     ) then
    raise exception 'distinct source provenance was collapsed into the canonical capture: %, %',
      first_result, second_result;
  end if;
  if exact_replay ->> 'status' <> 'duplicate'
     or exact_replay ->> 'analysis_request_id'
       <> second_result ->> 'analysis_request_id'
     or exact_replay ->> 'source_document_id'
       <> second_result ->> 'source_document_id' then
    raise exception 'exact provenance replay was not idempotent: %, %',
      second_result, exact_replay;
  end if;
  if to_regclass('public.analysis_request_sources') is null
     or not exists (
       select 1
       from public.analysis_request_sources as capture
       where capture.analysis_request_id =
               (first_result ->> 'analysis_request_id')::uuid
         and capture.source_document_id =
               (first_result ->> 'source_document_id')::uuid
     )
     or not exists (
       select 1
       from public.analysis_request_sources as capture
       where capture.analysis_request_id =
               (second_result ->> 'analysis_request_id')::uuid
         and capture.source_document_id =
               (second_result ->> 'source_document_id')::uuid
     ) then
    raise exception 'canonical analysis claim is missing one or more provenance captures';
  end if;
  if (select pg_catalog.count(*)
      from public.analysis_requests as request
      where request.project_id = '20000000-0000-4000-8000-000000000001'::uuid
        and request.project_revision = expected_project_revision
        and request.normalized_content_sha256 = normalized_hash) <> 1
     or (select pg_catalog.count(*)
         from public.source_documents as source
         where source.project_id = '20000000-0000-4000-8000-000000000001'::uuid
           and source.normalized_content_sha256 = normalized_hash) <> 2
     or (select pg_catalog.count(*)
         from public.analysis_request_sources as capture
         where capture.analysis_request_id =
           (first_result ->> 'analysis_request_id')::uuid) <> 2 then
    raise exception 'provenance replay changed canonical claim or capture cardinality';
  end if;
end;
$$;

-- A ready proposal must not remain executable after any active project item
-- changes because every active item version participates in the canonical
-- project revision. The action targets a different item, so target-version
-- checks alone cannot catch this context drift.
do $$
declare
  target_version bigint;
  result jsonb;
begin
  select version into target_version
  from public.project_items
  where id = '30000000-0000-4000-8000-000000000002'::uuid;

  insert into public.source_documents (
    id, workspace_id, project_id, title, source_kind, raw_text, captured_by,
    source_author, normalized_content_sha256
  ) values (
    '9d130000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'Prompt 13 context fixture', 'manual_note', 'Context freshness fixture.',
    '00000000-0000-4000-8000-000000000102', 'Verifier',
    pg_catalog.encode(
      extensions.digest(
        pg_catalog.convert_to('Context freshness fixture.', 'UTF8'),
        'sha256'
      ),
      'hex'
    )
  );
  insert into public.change_events (
    id, workspace_id, project_id, source_document_id, subject_item_id,
    field_name, proposed_value, state, created_by
  ) values (
    '9d130000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '9d130000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    'title', to_jsonb('Reviewed subject title'::text), 'needs_confirmation',
    '00000000-0000-4000-8000-000000000102'
  );
  insert into public.impact_runs (
    id, workspace_id, project_id, change_event_id, state, max_depth,
    started_by, completed_at
  ) values (
    '9d130000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '9d130000-0000-4000-8000-000000000002', 'completed', 5,
    '00000000-0000-4000-8000-000000000102', now()
  );
  insert into public.action_proposals (
    id, workspace_id, project_id, change_event_id, impact_run_id, state,
    title, rationale, created_by
  ) values (
    '9d130000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '9d130000-0000-4000-8000-000000000002',
    '9d130000-0000-4000-8000-000000000003', 'ready',
    'Context freshness fixture', 'Reject stale analysis context.',
    '00000000-0000-4000-8000-000000000102'
  );
  insert into public.proposal_actions (
    id, workspace_id, project_id, proposal_id, ordinal, action_type,
    target_item_id, expected_item_version, payload, rationale
  ) values (
    '9d130000-0000-4000-8000-000000000005',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '9d130000-0000-4000-8000-000000000004', 1, 'update_item',
    '30000000-0000-4000-8000-000000000002', target_version,
    jsonb_build_object(
      'prompt_action_type', 'update_item_field', 'field_name', 'title',
      'proposed_value', 'Project-context target update',
      'linked_impact_item_id', '30000000-0000-4000-8000-000000000002',
      'confidence', 0.9, 'requires_human_input', false
    ), 'The target remains version-current while another active item changes.'
  );

  update public.project_items
  set title = 'Externally changed project context'
  where id = '30000000-0000-4000-8000-000000000003'::uuid;

  if (select state from public.action_proposals
      where id = '9d130000-0000-4000-8000-000000000004'::uuid)
      <> 'superseded'::public.proposal_state then
    raise exception 'project context drift did not supersede the live proposal';
  end if;
  if (select version from public.project_items
      where id = '30000000-0000-4000-8000-000000000002'::uuid)
      <> target_version then
    raise exception 'context verifier unexpectedly changed the selected target';
  end if;

  result := public.apply_project_proposal(
    '00000000-0000-4000-8000-000000000102'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    '9d130000-0000-4000-8000-000000000004'::uuid,
    array['9d130000-0000-4000-8000-000000000005'::uuid], '[]'::jsonb,
    'verify-p13-stale-context-001'
  );
  if result ->> 'status' <> 'failed' then
    raise exception 'context-drifted ready proposal remained executable: %', result;
  end if;
end;
$$;

-- The same immutable capture can support a fresh claim after the project
-- revision changes. Provenance linkage is many-to-many across revisions even
-- though each revision/hash pair still has only one canonical claim.
reset role;
select pg_catalog.set_config(
  'inordo.prompt13_revision_after_context_change',
  private.compute_project_revision(
    '10000000-0000-4000-8000-000000000001'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid
  ),
  true
);
set local role service_role;
select pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000102',
  true
);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"role":"service_role","sub":"00000000-0000-4000-8000-000000000102"}',
  true
);

do $$
declare
  normalized_hash text;
  original_request_id uuid;
  original_source_id uuid;
  next_revision_result jsonb;
begin
  normalized_hash := pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        'Prompt 13 provenance verifier: summit update.', 'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
  select source.id
  into strict original_source_id
  from public.source_documents as source
  where source.project_id = '20000000-0000-4000-8000-000000000001'::uuid
    and source.title = 'Programme desk capture'
    and source.normalized_content_sha256 = normalized_hash;
  select request.id
  into strict original_request_id
  from public.analysis_requests as request
  where request.project_id = '20000000-0000-4000-8000-000000000001'::uuid
    and request.source_document_id = original_source_id;

  next_revision_result := public.begin_project_analysis_with_policy(
    '00000000-0000-4000-8000-000000000102'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    pg_catalog.current_setting(
      'inordo.prompt13_revision_after_context_change'
    ),
    'Programme desk capture', 'manual_note', 'Programme desk',
    'Prompt 13 provenance verifier: summit update.', normalized_hash,
    '2026-07-19 09:00:00+00'::timestamptz, null,
    'auto', false, true, 'gpt-5.6-luna', 'openai/gpt-oss-20b'
  );

  if next_revision_result ->> 'status' <> 'claimed'
     or (next_revision_result ->> 'analysis_request_id')::uuid =
       original_request_id
     or (next_revision_result ->> 'source_document_id')::uuid <>
       original_source_id
     or not exists (
       select 1
       from public.analysis_request_sources as capture
       where capture.analysis_request_id =
         (next_revision_result ->> 'analysis_request_id')::uuid
         and capture.source_document_id = original_source_id
     ) then
    raise exception 'new revision did not create a fresh claim over retained provenance: %',
      next_revision_result;
  end if;
end;
$$;

-- A partially approved proposal must also fail closed after a dependency edit;
-- selective approval is not permission to execute a stale graph proposal.
do $$
declare
  target_version bigint;
  result jsonb;
begin
  select version into target_version
  from public.project_items
  where id = '30000000-0000-4000-8000-000000000002'::uuid;

  insert into public.source_documents (
    id, workspace_id, project_id, title, source_kind, raw_text, captured_by,
    source_author, normalized_content_sha256
  ) values (
    '9d130000-0000-4000-8000-000000000007',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'Prompt 13 graph fixture', 'manual_note', 'Graph freshness fixture.',
    '00000000-0000-4000-8000-000000000102', 'Verifier',
    pg_catalog.encode(
      extensions.digest(
        pg_catalog.convert_to('Graph freshness fixture.', 'UTF8'),
        'sha256'
      ),
      'hex'
    )
  );
  insert into public.change_events (
    id, workspace_id, project_id, source_document_id, subject_item_id,
    field_name, proposed_value, state, created_by
  ) values (
    '9d130000-0000-4000-8000-000000000008',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '9d130000-0000-4000-8000-000000000007',
    '30000000-0000-4000-8000-000000000001',
    'title', to_jsonb('Graph review subject'::text), 'needs_confirmation',
    '00000000-0000-4000-8000-000000000102'
  );
  insert into public.impact_runs (
    id, workspace_id, project_id, change_event_id, state, max_depth,
    started_by, completed_at
  ) values (
    '9d130000-0000-4000-8000-000000000009',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '9d130000-0000-4000-8000-000000000008', 'completed', 5,
    '00000000-0000-4000-8000-000000000102', now()
  );
  insert into public.action_proposals (
    id, workspace_id, project_id, change_event_id, impact_run_id, state,
    title, rationale, created_by
  ) values (
    '9d130000-0000-4000-8000-000000000010',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '9d130000-0000-4000-8000-000000000008',
    '9d130000-0000-4000-8000-000000000009', 'partially_approved',
    'Graph freshness fixture', 'Reject stale dependency context.',
    '00000000-0000-4000-8000-000000000102'
  );
  insert into public.proposal_actions (
    id, workspace_id, project_id, proposal_id, ordinal, action_type,
    target_item_id, expected_item_version, payload, rationale
  ) values (
    '9d130000-0000-4000-8000-000000000011',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '9d130000-0000-4000-8000-000000000010', 1, 'update_item',
    '30000000-0000-4000-8000-000000000002', target_version,
    jsonb_build_object(
      'prompt_action_type', 'update_item_field', 'field_name', 'title',
      'proposed_value', 'Graph-context target update',
      'linked_impact_item_id', '30000000-0000-4000-8000-000000000002',
      'confidence', 0.9, 'requires_human_input', false
    ), 'The target remains version-current while its project graph changes.'
  );

  insert into public.item_dependencies (
    id, workspace_id, project_id, from_item_id, to_item_id, relationship,
    rationale, created_by
  ) values (
    '9d130000-0000-4000-8000-000000000006',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000003',
    '30000000-0000-4000-8000-000000000002', 'informs',
    'Prompt 13 graph-drift verifier edge.',
    '00000000-0000-4000-8000-000000000102'
  );

  if (select state from public.action_proposals
      where id = '9d130000-0000-4000-8000-000000000010'::uuid)
      <> 'superseded'::public.proposal_state then
    raise exception 'dependency drift did not supersede the live proposal';
  end if;

  result := public.apply_project_proposal(
    '00000000-0000-4000-8000-000000000102'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    '9d130000-0000-4000-8000-000000000010'::uuid,
    array['9d130000-0000-4000-8000-000000000011'::uuid], '[]'::jsonb,
    'verify-p13-stale-graph-001'
  );
  if result ->> 'status' <> 'failed' then
    raise exception 'dependency-drifted partially-approved proposal remained executable: %', result;
  end if;
end;
$$;

reset role;
rollback;
