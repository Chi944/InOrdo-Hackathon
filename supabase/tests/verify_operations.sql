-- Prompt 9 approval, audit, undo, and demo-reset integration assertions.
-- Requires the migrations and deterministic demo seed. All mutations roll back.

begin;

do $$
begin
  if to_regprocedure(
    'public.apply_project_proposal(uuid,uuid,uuid,uuid[],jsonb,text)'
  ) is null then
    raise exception 'apply_project_proposal RPC is missing';
  end if;
  if to_regprocedure(
    'public.undo_project_operation(uuid,uuid,uuid,text)'
  ) is null then
    raise exception 'undo_project_operation RPC is missing';
  end if;
  if to_regprocedure(
    'public.reset_demo_project(uuid,uuid,text,text)'
  ) is null then
    raise exception 'reset_demo_project RPC is missing';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.apply_project_proposal(uuid,uuid,uuid,uuid[],jsonb,text)',
    'EXECUTE'
  ) then
    raise exception 'authenticated can invoke the privileged apply RPC';
  end if;
  if not has_function_privilege(
    'service_role',
    'public.apply_project_proposal(uuid,uuid,uuid,uuid[],jsonb,text)',
    'EXECUTE'
  ) then
    raise exception 'service_role cannot invoke the apply RPC';
  end if;
  if has_table_privilege(
    'authenticated', 'public.operation_logs', 'INSERT'
  ) then
    raise exception 'authenticated can forge operation history';
  end if;
  if has_column_privilege(
    'authenticated', 'public.projects', 'workflow_generation', 'UPDATE'
  ) then
    raise exception 'authenticated can change workflow generations';
  end if;
  if has_column_privilege(
    'authenticated', 'public.project_items', 'is_demo_retired', 'UPDATE'
  ) then
    raise exception 'authenticated can unretire demo records';
  end if;
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.project_items'::regclass
      and conname = 'project_items_item_key_length'
      and contype = 'c'
      and convalidated
  ) then
    raise exception 'the item-key length boundary is missing or unvalidated';
  end if;
  if private.demo_baseline_fingerprint_v1(
       '10000000-0000-4000-8000-000000000001'::uuid,
       '20000000-0000-4000-8000-000000000001'::uuid
     ) <> 'f5fdef78150fe8eb6a87962e50e635e60927909fbf70019a2f53cee970624f8a' then
    raise exception 'canonical demo baseline fingerprint changed';
  end if;
  if has_function_privilege(
    'service_role',
    'private.demo_baseline_fingerprint_v1(uuid,uuid)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'private.guard_demo_baseline_fingerprint()',
    'EXECUTE'
  ) or has_function_privilege(
    'service_role',
    'private.record_undo_conflict(uuid,uuid,text,text,uuid,uuid,uuid,jsonb)',
    'EXECUTE'
  ) then
    raise exception 'private Prompt 9 hardening helpers are executable';
  end if;
  if has_function_privilege(
    'service_role',
    'private.begin_project_analysis_internal(uuid,text,text,text,text,text,text,timestamptz,text,text)',
    'EXECUTE'
  ) or not has_function_privilege(
    'service_role',
    'private.undo_project_operation_internal(uuid,uuid,text)',
    'EXECUTE'
  ) then
    raise exception 'private hardened implementation privileges are unsafe';
  end if;
  if not exists (
    select 1
    from pg_catalog.pg_proc as procedure
    where procedure.oid in (
      'private.demo_baseline_fingerprint_v1(uuid,uuid)'::regprocedure,
      'private.guard_demo_baseline_fingerprint()'::regprocedure,
      'private.begin_project_analysis_internal(uuid,text,text,text,text,text,text,timestamptz,text,text)'::regprocedure,
      'private.apply_project_proposal_internal(uuid,uuid,uuid[],jsonb,text)'::regprocedure,
      'private.undo_project_operation_internal(uuid,uuid,text)'::regprocedure
    )
    having pg_catalog.bool_and(
      procedure.proconfig @> array['search_path=""']::text[]
    )
      and pg_catalog.count(*) = 5
  ) then
    raise exception 'Prompt 9 hardening function search_path is unsafe';
  end if;
end;
$$;

-- The database boundary must match the public Zod contract. A syntactically
-- valid item key longer than 64 characters must fail on the named constraint.
do $$
declare
  rejected_constraint text;
begin
  begin
    insert into public.project_items (
      id, workspace_id, project_id, item_key, item_type, title, status,
      priority, created_by
    ) values (
      '97000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      'TSK-' || pg_catalog.repeat('9', 61),
      'task', 'Oversized key verifier', 'not_started', 'low',
      '00000000-0000-4000-8000-000000000102'
    );
    raise exception 'a 65-character item key unexpectedly succeeded';
  exception when check_violation then
    get stacked diagnostics rejected_constraint = CONSTRAINT_NAME;
    if rejected_constraint <> 'project_items_item_key_length' then
      raise exception 'the wrong constraint rejected the oversized key: %',
        rejected_constraint;
    end if;
  end;
end;
$$;

-- A count-preserving private-baseline edit must block generation advance and
-- roll its own test mutation back inside the exception subtransaction.
do $$
declare
  generation_before bigint;
begin
  select workflow_generation into generation_before
  from public.projects
  where id = '20000000-0000-4000-8000-000000000001'::uuid;

  begin
    update private.demo_baseline_project_items
    set title = title || ' tampered'
    where project_id = '20000000-0000-4000-8000-000000000001'::uuid
      and item_id = '30000000-0000-4000-8000-000000000001'::uuid;
    update public.projects
    set workflow_generation = workflow_generation + 1
    where id = '20000000-0000-4000-8000-000000000001'::uuid;
    raise exception 'tampered baseline unexpectedly advanced generation';
  exception when insufficient_privilege then null;
  end;

  if (select workflow_generation from public.projects
      where id = '20000000-0000-4000-8000-000000000001'::uuid)
      <> generation_before
     or private.demo_baseline_fingerprint_v1(
       '10000000-0000-4000-8000-000000000001'::uuid,
       '20000000-0000-4000-8000-000000000001'::uuid
     ) <> 'f5fdef78150fe8eb6a87962e50e635e60927909fbf70019a2f53cee970624f8a' then
    raise exception 'baseline fingerprint guard did not fail atomically';
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
  '{"role":"service_role","sub":"00000000-0000-4000-8000-000000000102"}',
  true
);

-- Create inert, human-reviewable proposal fixtures without invoking a model.
do $$
declare
  current_version bigint;
begin
  if not exists (
    select 1 from public.projects
    where id = '20000000-0000-4000-8000-000000000001'::uuid
      and is_demo
  ) then
    raise exception 'Prompt 9 verification requires the demo seed';
  end if;

  select version into current_version
  from public.project_items
  where id = '30000000-0000-4000-8000-000000000001'::uuid;

  insert into public.source_documents (
    id, workspace_id, project_id, title, source_kind, raw_text, captured_by,
    source_author, normalized_content_sha256
  ) values (
    '91000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'Prompt 9 verifier source', 'manual_note',
    'A human reviewer approved a constrained project update.',
    '00000000-0000-4000-8000-000000000102',
    'Prompt 9 verifier',
    pg_catalog.encode(
      extensions.digest(
        pg_catalog.convert_to(
          'A human reviewer approved a constrained project update.',
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    )
  );
  insert into public.change_events (
    id, workspace_id, project_id, source_document_id, subject_item_id,
    field_name, previous_value, proposed_value, state, confidence, created_by
  ) values (
    '91000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    'title', to_jsonb('Regional Climate Action Summit 2026'::text),
    to_jsonb('Regional Climate Action Summit 2026 — reviewed'::text),
    'needs_confirmation', 0.95,
    '00000000-0000-4000-8000-000000000102'
  );
  insert into public.impact_runs (
    id, workspace_id, project_id, change_event_id, state, max_depth,
    started_by, completed_at
  ) values (
    '91000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000002',
    'completed', 5, '00000000-0000-4000-8000-000000000102', now()
  );
  insert into public.action_proposals (
    id, workspace_id, project_id, change_event_id, impact_run_id, state,
    title, rationale, created_by
  ) values (
    '91000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000002',
    '91000000-0000-4000-8000-000000000003',
    'ready', 'Prompt 9 verifier proposal',
    'Exercise partial approval and constrained action execution.',
    '00000000-0000-4000-8000-000000000102'
  );
  insert into public.proposal_actions (
    id, workspace_id, project_id, proposal_id, ordinal, action_type,
    target_item_id, expected_item_version, payload, rationale
  ) values
  (
    '91000000-0000-4000-8000-000000000005',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000004', 1, 'update_item',
    '30000000-0000-4000-8000-000000000001', current_version,
    jsonb_build_object(
      'prompt_action_type', 'update_item_field',
      'field_name', 'title',
      'proposed_value', 'Regional Climate Action Summit 2026 — reviewed',
      'linked_impact_item_id', '30000000-0000-4000-8000-000000000001',
      'confidence', 0.95,
      'requires_human_input', false
    ),
    'Apply an allowlisted title update.'
  ),
  (
    '91000000-0000-4000-8000-000000000006',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000004', 2, 'request_confirmation',
    '30000000-0000-4000-8000-000000000001', null,
    jsonb_build_object(
      'prompt_action_type', 'request_confirmation',
      'question', 'Has the revised summit title been confirmed?',
      'linked_impact_item_id', '30000000-0000-4000-8000-000000000001',
      'confidence', 0.9,
      'requires_human_input', true
    ),
    'Record explicit reviewer confirmation.'
  ),
  (
    '91000000-0000-4000-8000-000000000007',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000004', 3, 'request_confirmation',
    '30000000-0000-4000-8000-000000000002', null,
    jsonb_build_object(
      'prompt_action_type', 'request_confirmation',
      'question', 'Has the keynote owner confirmed the revised brief?',
      'linked_impact_item_id', '30000000-0000-4000-8000-000000000002',
      'confidence', 0.85,
      'requires_human_input', true
    ),
    'Verify canonical ordering of multiple human responses.'
  );
end;
$$;

-- Direct callers without an administrator membership must fail before history.
do $$
begin
  perform public.apply_project_proposal(
    '00000000-0000-4000-8000-000000000108'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    '91000000-0000-4000-8000-000000000004'::uuid,
    array['91000000-0000-4000-8000-000000000005'::uuid],
    '[]'::jsonb,
    'verify-forbidden-001'
  );
  raise exception 'viewer approval unexpectedly succeeded';
exception
  when insufficient_privilege then null;
end;
$$;

-- Partial approval applies only the selected action and records reversible audit.
do $$
declare
  result jsonb;
  replay jsonb;
  title_after text;
  applied_operation_id uuid;
begin
  result := public.apply_project_proposal(
    '00000000-0000-4000-8000-000000000102'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    '91000000-0000-4000-8000-000000000004'::uuid,
    array['91000000-0000-4000-8000-000000000005'::uuid],
    '[]'::jsonb,
    'verify-apply-001'
  );
  if result ->> 'status' <> 'succeeded' then
    raise exception 'apply failed: %', result;
  end if;
  applied_operation_id := (result ->> 'operation_id')::uuid;
  perform set_config(
    'inordo.verify_apply_operation', applied_operation_id::text, true
  );

  select title into title_after from public.project_items
  where id = '30000000-0000-4000-8000-000000000001'::uuid;
  if title_after <> 'Regional Climate Action Summit 2026 — reviewed' then
    raise exception 'approved update was not applied';
  end if;
  if (select state from public.proposal_actions
      where id = '91000000-0000-4000-8000-000000000006'::uuid) <> 'pending' then
    raise exception 'unselected action was changed';
  end if;
  if (select state from public.action_proposals
      where id = '91000000-0000-4000-8000-000000000004'::uuid)
      <> 'partially_approved' then
    raise exception 'proposal partial state was not recorded';
  end if;
  if not exists (
    select 1 from public.operation_logs as operation
    join public.operation_items as item
      on item.operation_id = operation.id
     and item.workspace_id = operation.workspace_id
     and item.project_id = operation.project_id
    where operation.id = applied_operation_id
      and operation.initiated_by = '00000000-0000-4000-8000-000000000102'
      and operation.reversible
      and operation.request_hash ~ '^[0-9a-f]{64}$'
      and item.ordinal = 1
      and item.before_state is not null
      and item.after_state is not null
      and item.reverse_payload is not null
  ) then
    raise exception 'apply audit trail is incomplete';
  end if;

  replay := public.apply_project_proposal(
    '00000000-0000-4000-8000-000000000102'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    '91000000-0000-4000-8000-000000000004'::uuid,
    array['91000000-0000-4000-8000-000000000005'::uuid],
    '[]'::jsonb,
    'verify-apply-001'
  );
  if replay ->> 'status' <> 'duplicate'
     or replay ->> 'operation_id' <> applied_operation_id::text then
    raise exception 'apply idempotency replay was not stable: %', replay;
  end if;
end;
$$;

-- Human-input actions remain inert until the matching response is explicit.
do $$
declare
  rejected jsonb;
  accepted jsonb;
  replay jsonb;
begin
  rejected := public.apply_project_proposal(
    '00000000-0000-4000-8000-000000000102'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    '91000000-0000-4000-8000-000000000004'::uuid,
    array[
      '91000000-0000-4000-8000-000000000006'::uuid,
      '91000000-0000-4000-8000-000000000007'::uuid
    ],
    '[]'::jsonb,
    'verify-human-001'
  );
  if rejected ->> 'status' <> 'failed'
     or rejected ->> 'error_code' <> 'human_input_required' then
    raise exception 'unresolved human input was not rejected: %', rejected;
  end if;

  accepted := public.apply_project_proposal(
    '00000000-0000-4000-8000-000000000102'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    '91000000-0000-4000-8000-000000000004'::uuid,
    array[
      '91000000-0000-4000-8000-000000000006'::uuid,
      '91000000-0000-4000-8000-000000000007'::uuid
    ],
    jsonb_build_array(
      jsonb_build_object(
        'action_id', '91000000-0000-4000-8000-000000000006',
        'confirmed', true,
        'response', 'Confirmed by the delivery lead.'
      ),
      jsonb_build_object(
        'action_id', '91000000-0000-4000-8000-000000000007',
        'confirmed', true,
        'response', 'Confirmed by the keynote owner.'
      )
    ),
    'verify-human-002'
  );
  if accepted ->> 'status' <> 'succeeded' then
    raise exception 'resolved confirmation failed: %', accepted;
  end if;
  if not exists (
    select 1 from public.activity_events
    where entity_id = '91000000-0000-4000-8000-000000000006'::uuid
      and event_type = 'proposal.confirmation_recorded'
  ) then
    raise exception 'confirmation activity was not recorded';
  end if;

  replay := public.apply_project_proposal(
    '00000000-0000-4000-8000-000000000102'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    '91000000-0000-4000-8000-000000000004'::uuid,
    array[
      '91000000-0000-4000-8000-000000000007'::uuid,
      '91000000-0000-4000-8000-000000000006'::uuid
    ],
    jsonb_build_array(
      jsonb_build_object(
        'action_id', '91000000-0000-4000-8000-000000000007',
        'confirmed', true,
        'response', 'Confirmed by the keynote owner.'
      ),
      jsonb_build_object(
        'action_id', '91000000-0000-4000-8000-000000000006',
        'confirmed', true,
        'response', 'Confirmed by the delivery lead.'
      )
    ),
    'verify-human-002'
  );
  if replay ->> 'status' <> 'duplicate'
     or (replay ->> 'operation_id') <> (accepted ->> 'operation_id') then
    raise exception 'logical human-input ordering changed idempotency: %', replay;
  end if;
end;
$$;

-- Undo restores before-state, preserves the original, and cannot be undone.
do $$
declare
  result jsonb;
  replay jsonb;
  undo_id uuid;
begin
  result := public.undo_project_operation(
    '00000000-0000-4000-8000-000000000102'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    current_setting('inordo.verify_apply_operation')::uuid,
    'verify-undo-001'
  );
  if result ->> 'status' <> 'succeeded' then
    raise exception 'undo failed: %', result;
  end if;
  undo_id := (result ->> 'operation_id')::uuid;
  if (select title from public.project_items
      where id = '30000000-0000-4000-8000-000000000001'::uuid)
      <> 'Regional Climate Action Summit 2026' then
    raise exception 'undo did not restore before-state';
  end if;
  if not exists (
    select 1 from public.operation_logs
    where id = undo_id
      and operation_type = 'undo'
      and reverses_operation_id =
        current_setting('inordo.verify_apply_operation')::uuid
  ) then
    raise exception 'undo audit relationship is missing';
  end if;
  replay := public.undo_project_operation(
    '00000000-0000-4000-8000-000000000102'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    current_setting('inordo.verify_apply_operation')::uuid,
    'verify-undo-001'
  );
  if replay ->> 'status' <> 'duplicate'
     or replay ->> 'operation_id' <> undo_id::text then
    raise exception 'undo replay was not idempotent: %', replay;
  end if;
  result := public.undo_project_operation(
    '00000000-0000-4000-8000-000000000102'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    undo_id,
    'verify-undo-of-undo-001'
  );
  if result ->> 'status' <> 'failed'
     or result ->> 'error_code' <> 'not_reversible' then
    raise exception 'undo of undo was not rejected: %', result;
  end if;
end;
$$;

-- A different request cannot reuse an existing idempotency key.
do $$
begin
  perform public.apply_project_proposal(
    '00000000-0000-4000-8000-000000000102'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    '91000000-0000-4000-8000-000000000004'::uuid,
    array['91000000-0000-4000-8000-000000000006'::uuid],
    jsonb_build_array(jsonb_build_object(
      'action_id', '91000000-0000-4000-8000-000000000006',
      'confirmed', true,
      'response', 'A different request.'
    )),
    'verify-apply-001'
  );
  raise exception 'idempotency mismatch unexpectedly succeeded';
exception when serialization_failure then null;
end;
$$;

-- Build a second proposal to verify rollback, constrained creation, and undo
-- conflict behavior without relying on model calls.
do $$
declare
  item_two_version bigint;
  item_three_version bigint;
begin
  select version into item_two_version from public.project_items
  where id = '30000000-0000-4000-8000-000000000002'::uuid;
  select version into item_three_version from public.project_items
  where id = '30000000-0000-4000-8000-000000000003'::uuid;

  insert into public.action_proposals (
    id, workspace_id, project_id, change_event_id, impact_run_id, state,
    title, rationale, created_by
  ) values (
    '92000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000002',
    '91000000-0000-4000-8000-000000000003',
    'ready', 'Rollback and creation verifier',
    'Verify the complete constrained operation allowlist.',
    '00000000-0000-4000-8000-000000000102'
  );
  insert into public.proposal_actions (
    id, workspace_id, project_id, proposal_id, ordinal, action_type,
    target_item_id, expected_item_version, payload, rationale
  ) values
  (
    '92000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000001', 1, 'update_item',
    '30000000-0000-4000-8000-000000000002', item_two_version,
    jsonb_build_object(
      'prompt_action_type', 'update_item_field',
      'field_name', 'title',
      'proposed_value', 'Confirm keynote speakers — reviewed',
      'linked_impact_item_id', '30000000-0000-4000-8000-000000000002',
      'confidence', 0.9,
      'requires_human_input', false
    ),
    'Valid first action for atomic rollback verification.'
  ),
  (
    '92000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000001', 2, 'update_item',
    '30000000-0000-4000-8000-000000000003', item_three_version + 10,
    jsonb_build_object(
      'prompt_action_type', 'update_item_field',
      'field_name', 'title',
      'proposed_value', 'Finalize catering order — stale',
      'linked_impact_item_id', '30000000-0000-4000-8000-000000000003',
      'confidence', 0.9,
      'requires_human_input', false
    ),
    'Intentionally stale second action.'
  ),
  (
    '92000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000001', 3, 'create_item',
    null, null,
    jsonb_build_object(
      'prompt_action_type', 'create_task',
      'item_type', 'task',
      'title', 'Confirm revised speaker brief',
      'description', 'Synthetic verifier follow-up.',
      'priority', 'high',
      'owner_id', null,
      'start_date', '2026-08-01',
      'due_date', '2026-08-05',
      'linked_impact_item_id', '30000000-0000-4000-8000-000000000002',
      'confidence', 0.9,
      'requires_human_input', false
    ),
    'Create one constrained follow-up task.'
  ),
  (
    '92000000-0000-4000-8000-000000000005',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000001', 4, 'create_item',
    null, null,
    jsonb_build_object(
      'prompt_action_type', 'create_risk',
      'item_type', 'risk',
      'title', 'Revised speaker brief may slip',
      'description', 'Synthetic verifier risk.',
      'priority', 'medium',
      'owner_id', null,
      'start_date', null,
      'due_date', '2026-08-05',
      'linked_impact_item_id', '30000000-0000-4000-8000-000000000002',
      'confidence', 0.8,
      'requires_human_input', false
    ),
    'Create one constrained risk.'
  );
end;
$$;

do $$
declare
  failed_result jsonb;
  create_result jsonb;
  update_result jsonb;
  conflict_result jsonb;
  update_operation uuid;
begin
  failed_result := public.apply_project_proposal(
    '00000000-0000-4000-8000-000000000102'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    '92000000-0000-4000-8000-000000000001'::uuid,
    array[
      '92000000-0000-4000-8000-000000000002'::uuid,
      '92000000-0000-4000-8000-000000000003'::uuid
    ],
    '[]'::jsonb,
    'verify-rollback-001'
  );
  if failed_result ->> 'status' <> 'failed'
     or failed_result ->> 'error_code' <> 'stale_target' then
    raise exception 'stale transaction was not rejected: %', failed_result;
  end if;
  if (select title from public.project_items
      where id = '30000000-0000-4000-8000-000000000002'::uuid)
      <> 'Confirm keynote speakers' then
    raise exception 'failed transaction partially mutated its first item';
  end if;
  if exists (
    select 1 from public.operation_items
    where operation_id = (failed_result ->> 'operation_id')::uuid
  ) then
    raise exception 'failed transaction persisted partial operation items';
  end if;

  create_result := public.apply_project_proposal(
    '00000000-0000-4000-8000-000000000102'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    '92000000-0000-4000-8000-000000000001'::uuid,
    array[
      '92000000-0000-4000-8000-000000000004'::uuid,
      '92000000-0000-4000-8000-000000000005'::uuid
    ],
    '[]'::jsonb,
    'verify-create-001'
  );
  if create_result ->> 'status' <> 'succeeded'
     or (select count(*) from public.operation_items
         where operation_id = (create_result ->> 'operation_id')::uuid
           and not reversible) <> 2
     or (
       select pg_catalog.count(*)
       from public.operation_items as operation_item
       join public.project_items as item
         on item.workspace_id = operation_item.workspace_id
        and item.project_id = operation_item.project_id
        and item.id = operation_item.item_id
       where operation_item.operation_id
         = (create_result ->> 'operation_id')::uuid
         and operation_item.proposal_action_id in (
           '92000000-0000-4000-8000-000000000004'::uuid,
           '92000000-0000-4000-8000-000000000005'::uuid
         )
         and operation_item.after_state = pg_catalog.jsonb_build_object(
           'receipt_version', 2,
           'item_id', item.id,
           'item_key', item.item_key,
           'version', item.version,
           'create_payload', pg_catalog.jsonb_build_object(
             'item_type', item.item_type,
             'title', item.title,
             'description', item.description,
             'status', item.status,
             'priority', item.priority,
             'owner_id', item.owner_id,
             'start_date', item.start_date,
             'due_date', item.due_date
           )
         )
     ) <> 2
     or not exists (
       select 1 from public.project_items
       where project_id = '20000000-0000-4000-8000-000000000001'::uuid
         and title = 'Confirm revised speaker brief'
         and item_type = 'task'
     )
     or not exists (
       select 1 from public.project_items
       where project_id = '20000000-0000-4000-8000-000000000001'::uuid
         and title = 'Revised speaker brief may slip'
         and item_type = 'risk'
     ) then
    raise exception 'constrained item creation failed: %', create_result;
  end if;

  update_result := public.apply_project_proposal(
    '00000000-0000-4000-8000-000000000102'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    '92000000-0000-4000-8000-000000000001'::uuid,
    array['92000000-0000-4000-8000-000000000002'::uuid],
    '[]'::jsonb,
    'verify-conflict-apply-001'
  );
  if update_result ->> 'status' <> 'succeeded' then
    raise exception 'undo-conflict setup failed: %', update_result;
  end if;
  update_operation := (update_result ->> 'operation_id')::uuid;
  update public.project_items
  set title = 'Manual concurrent edit'
  where id = '30000000-0000-4000-8000-000000000002'::uuid;
  conflict_result := public.undo_project_operation(
    '00000000-0000-4000-8000-000000000102'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    update_operation,
    'verify-undo-conflict-001'
  );
  if conflict_result ->> 'status' <> 'failed'
     or conflict_result ->> 'error_code' <> 'undo_conflict'
     or pg_catalog.jsonb_array_length(conflict_result -> 'conflicts') <> 1
     or conflict_result #>> '{conflicts,0,item_id}'
       <> '30000000-0000-4000-8000-000000000002'
     or conflict_result #>> '{conflicts,0,reason}' <> 'version_mismatch'
     or pg_catalog.jsonb_typeof(
       conflict_result #> '{conflicts,0,expected_version}'
     ) <> 'number'
     or pg_catalog.jsonb_typeof(
       conflict_result #> '{conflicts,0,actual_version}'
     ) <> 'number'
     or (select title from public.project_items
         where id = '30000000-0000-4000-8000-000000000002'::uuid)
       <> 'Manual concurrent edit' then
    raise exception 'undo conflict rule failed: %', conflict_result;
  end if;
  if not exists (
    select 1
    from public.operation_logs as operation
    where operation.id = (conflict_result ->> 'operation_id')::uuid
      and operation.result_metadata -> 'conflicts'
        = conflict_result -> 'conflicts'
  ) then
    raise exception 'safe undo conflict metadata was not persisted';
  end if;
end;
$$;

-- Multiple actions may update one item. Undo validates its final state once,
-- then applies the recorded reverse payloads in descending ordinal order.
do $$
declare
  item_version bigint;
  apply_result jsonb;
  undo_result jsonb;
begin
  select version into item_version
  from public.project_items
  where id = '30000000-0000-4000-8000-000000000004'::uuid;

  insert into public.action_proposals (
    id, workspace_id, project_id, change_event_id, impact_run_id, state,
    title, rationale, created_by
  ) values (
    '95000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000002',
    '91000000-0000-4000-8000-000000000003',
    'ready', 'Sequence-aware undo verifier',
    'Apply two reversible fields to one target.',
    '00000000-0000-4000-8000-000000000102'
  );
  insert into public.proposal_actions (
    id, workspace_id, project_id, proposal_id, ordinal, action_type,
    target_item_id, expected_item_version, payload, rationale
  ) values (
    '95000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '95000000-0000-4000-8000-000000000001', 1, 'update_item',
    '30000000-0000-4000-8000-000000000004', item_version,
    pg_catalog.jsonb_build_object(
      'prompt_action_type', 'update_item_field', 'field_name', 'title',
      'proposed_value', 'Programme lock - reviewed',
      'linked_impact_item_id', '30000000-0000-4000-8000-000000000004',
      'confidence', 0.9, 'requires_human_input', false
    ), 'First same-item update.'
  ), (
    '95000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '95000000-0000-4000-8000-000000000001', 2, 'update_item',
    '30000000-0000-4000-8000-000000000004', item_version,
    pg_catalog.jsonb_build_object(
      'prompt_action_type', 'update_item_field', 'field_name', 'priority',
      'proposed_value', 'high',
      'linked_impact_item_id', '30000000-0000-4000-8000-000000000004',
      'confidence', 0.9, 'requires_human_input', false
    ), 'Second same-item update.'
  );

  apply_result := public.apply_project_proposal(
    '00000000-0000-4000-8000-000000000102'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    '95000000-0000-4000-8000-000000000001'::uuid,
    array[
      '95000000-0000-4000-8000-000000000002'::uuid,
      '95000000-0000-4000-8000-000000000003'::uuid
    ],
    '[]'::jsonb,
    'verify-same-item-apply-001'
  );
  if apply_result ->> 'status' <> 'succeeded'
     or (select title from public.project_items
         where id = '30000000-0000-4000-8000-000000000004'::uuid)
       <> 'Programme lock - reviewed'
     or (select priority::text from public.project_items
         where id = '30000000-0000-4000-8000-000000000004'::uuid)
       <> 'high' then
    raise exception 'same-item multi-action apply failed: %', apply_result;
  end if;

  undo_result := public.undo_project_operation(
    '00000000-0000-4000-8000-000000000102'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    (apply_result ->> 'operation_id')::uuid,
    'verify-same-item-undo-001'
  );
  if undo_result ->> 'status' <> 'succeeded'
     or (select title from public.project_items
         where id = '30000000-0000-4000-8000-000000000004'::uuid)
       <> 'Programme lock'
     or (select priority::text from public.project_items
         where id = '30000000-0000-4000-8000-000000000004'::uuid)
       <> 'critical' then
    raise exception 'same-item sequence-aware undo failed: %', undo_result;
  end if;
end;
$$;

-- Project authorization is checked again inside every privileged function,
-- and reset refuses both cross-workspace and non-demo targets.
do $$
begin
  insert into public.workspaces (id, name, slug, created_by)
  values (
    '94000000-0000-4000-8000-000000000001',
    'Other synthetic workspace', 'other-synthetic-workspace',
    '00000000-0000-4000-8000-000000000101'
  );
  insert into public.projects (
    id, workspace_id, name, slug, status, is_demo, created_by
  ) values (
    '94000000-0000-4000-8000-000000000002',
    '94000000-0000-4000-8000-000000000001',
    'Cross-workspace project', 'cross-workspace-project', 'active', false,
    '00000000-0000-4000-8000-000000000101'
  ), (
    '94000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    'Non-demo project', 'non-demo-project', 'active', false,
    '00000000-0000-4000-8000-000000000101'
  );

  begin
    perform public.apply_project_proposal(
      '00000000-0000-4000-8000-000000000102'::uuid,
      '94000000-0000-4000-8000-000000000002'::uuid,
      '92000000-0000-4000-8000-000000000001'::uuid,
      array['92000000-0000-4000-8000-000000000002'::uuid],
      '[]'::jsonb,
      'verify-cross-workspace-001'
    );
    raise exception 'cross-workspace apply unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.reset_demo_project(
      '00000000-0000-4000-8000-000000000102'::uuid,
      '94000000-0000-4000-8000-000000000003'::uuid,
      'non-demo-project',
      'verify-non-demo-reset-001'
    );
    raise exception 'non-demo reset unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- Demo reset is named, deterministic, history-preserving, and rate-limited.
do $$
declare
  generation_before bigint;
  reset_result jsonb;
  replay jsonb;
  limited jsonb;
  reset_operation uuid;
begin
  select workflow_generation into generation_before
  from public.projects
  where id = '20000000-0000-4000-8000-000000000001'::uuid;

  insert into public.project_items (
    id, workspace_id, project_id, item_key, item_type, title, status,
    priority, created_by
  ) values (
    '93000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'TSK-99', 'task', 'Temporary demo item', 'not_started', 'low',
    '00000000-0000-4000-8000-000000000102'
  );
  update public.project_items
  set due_date = '2026-10-01'
  where id = '30000000-0000-4000-8000-000000000002'::uuid;

  reset_result := public.reset_demo_project(
    '00000000-0000-4000-8000-000000000102'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    'regional-climate-action-summit-2026',
    'verify-reset-001'
  );
  if reset_result ->> 'status' <> 'succeeded' then
    raise exception 'demo reset failed: %', reset_result;
  end if;
  reset_operation := (reset_result ->> 'operation_id')::uuid;
  if (select workflow_generation from public.projects
      where id = '20000000-0000-4000-8000-000000000001'::uuid)
      <> generation_before + 1 then
    raise exception 'reset did not advance the workflow generation';
  end if;
  if (select count(*) from public.project_items
      where project_id = '20000000-0000-4000-8000-000000000001'::uuid
        and not is_demo_retired) <> 24 then
    raise exception 'reset did not restore 24 active baseline items';
  end if;
  if (select count(*) from public.item_dependencies
      where project_id = '20000000-0000-4000-8000-000000000001'::uuid)
      <> 26 then
    raise exception 'reset did not restore 26 baseline dependencies';
  end if;
  if not (select is_demo_retired from public.project_items
          where id = '93000000-0000-4000-8000-000000000001'::uuid) then
    raise exception 'reset deleted or retained a nonbaseline demo item';
  end if;
  if not exists (
    select 1 from public.operation_logs
    where id = reset_operation
      and workflow_generation = generation_before
  ) then
    raise exception 'reset history was not preserved in its source generation';
  end if;

  replay := public.reset_demo_project(
    '00000000-0000-4000-8000-000000000102'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    'regional-climate-action-summit-2026',
    'verify-reset-001'
  );
  if replay ->> 'status' <> 'duplicate'
     or replay ->> 'operation_id' <> reset_operation::text then
    raise exception 'reset replay was not stable: %', replay;
  end if;

  limited := public.reset_demo_project(
    '00000000-0000-4000-8000-000000000102'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    'regional-climate-action-summit-2026',
    'verify-reset-002'
  );
  if limited ->> 'status' <> 'failed'
     or limited ->> 'error_code' <> 'rate_limited' then
    raise exception 'reset rate limit was not enforced: %', limited;
  end if;

  begin
    perform public.reset_demo_project(
      '00000000-0000-4000-8000-000000000102'::uuid,
      '20000000-0000-4000-8000-000000000001'::uuid,
      'wrong-project-slug',
      'verify-reset-wrong-slug'
    );
    raise exception 'wrong named demo reset unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
select pg_catalog.set_config(
  'inordo.verify_revision_after_reset',
  private.compute_project_revision(
    '10000000-0000-4000-8000-000000000001'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid
  ),
  true
);
select pg_catalog.set_config(
  'inordo.verify_source_hash',
  private.source_normalized_sha256(
    'A human reviewer approved a constrained project update.'
  ),
  true
);
set local role service_role;

-- The same evidence after reset must create current-generation evidence rather
-- than reusing the archived source. Active task keys must restart from the
-- canonical live baseline even while retired TSK-10 and TSK-99 rows survive.
do $$
declare
  analysis_result jsonb;
  apply_result jsonb;
  overflow_apply_result jsonb;
  current_generation bigint;
  current_source_id uuid;
begin
  select workflow_generation into current_generation
  from public.projects
  where id = '20000000-0000-4000-8000-000000000001'::uuid;

  analysis_result := public.begin_project_analysis_with_policy(
    '00000000-0000-4000-8000-000000000102'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    current_setting('inordo.verify_revision_after_reset'),
    'Prompt 9 verifier source',
    'manual_note',
    'Prompt 9 verifier',
    'A human reviewer approved a constrained project update.',
    current_setting('inordo.verify_source_hash'),
    null,
    null,
    'auto', false, true, 'gpt-5.6-luna', 'openai/gpt-oss-20b'
  );
  current_source_id := (analysis_result ->> 'source_document_id')::uuid;
  if analysis_result ->> 'status' <> 'claimed'
     or current_source_id =
       '91000000-0000-4000-8000-000000000001'::uuid
     or (select workflow_generation from public.source_documents
         where id = current_source_id) <> current_generation
     or (select workflow_generation from public.analysis_requests
         where id = (analysis_result ->> 'analysis_request_id')::uuid)
       <> current_generation then
    raise exception 'post-reset source intake reused archived evidence: %',
      analysis_result;
  end if;

  insert into public.change_events (
    id, workspace_id, project_id, source_document_id, subject_item_id,
    field_name, previous_value, proposed_value, state, confidence, created_by
  ) values (
    '96000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    current_source_id,
    '30000000-0000-4000-8000-000000000002',
    'due_date', to_jsonb('2026-07-31'::text),
    to_jsonb('2026-08-02'::text), 'needs_confirmation', 0.9,
    '00000000-0000-4000-8000-000000000102'
  );
  insert into public.impact_runs (
    id, workspace_id, project_id, change_event_id, state, max_depth,
    started_by, completed_at
  ) values (
    '96000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '96000000-0000-4000-8000-000000000001',
    'completed', 5, '00000000-0000-4000-8000-000000000102', now()
  );
  insert into public.action_proposals (
    id, workspace_id, project_id, change_event_id, impact_run_id, state,
    title, rationale, created_by
  ) values (
    '96000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '96000000-0000-4000-8000-000000000001',
    '96000000-0000-4000-8000-000000000002',
    'ready', 'Post-reset key verifier',
    'Create the next deterministic active task key.',
    '00000000-0000-4000-8000-000000000102'
  );
  insert into public.proposal_actions (
    id, workspace_id, project_id, proposal_id, ordinal, action_type,
    target_item_id, expected_item_version, payload, rationale
  ) values (
    '96000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '96000000-0000-4000-8000-000000000003', 1, 'create_item', null, null,
    pg_catalog.jsonb_build_object(
      'prompt_action_type', 'create_task',
      'item_type', 'task',
      'title', 'Post-reset deterministic task',
      'description', 'Synthetic active-key verifier.',
      'priority', 'medium',
      'owner_id', null,
      'start_date', null,
      'due_date', '2026-08-03',
      'linked_impact_item_id', '30000000-0000-4000-8000-000000000002',
      'confidence', 0.9,
      'requires_human_input', false
    ),
    'Retired task keys must not influence active allocation.'
  );

  -- The analysis wrapper intentionally impersonates the verified actor for its
  -- one RPC transaction. This verifier keeps multiple RPCs in one transaction,
  -- so restore the synthetic service-role claims before the next wrapper call.
  perform pg_catalog.set_config(
    'request.jwt.claim.sub',
    '00000000-0000-4000-8000-000000000102',
    true
  );
  perform pg_catalog.set_config(
    'request.jwt.claims',
    '{"role":"service_role","sub":"00000000-0000-4000-8000-000000000102"}',
    true
  );

  apply_result := public.apply_project_proposal(
    '00000000-0000-4000-8000-000000000102'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    '96000000-0000-4000-8000-000000000003'::uuid,
    array['96000000-0000-4000-8000-000000000004'::uuid],
    '[]'::jsonb,
    'verify-post-reset-key-001'
  );
  if apply_result ->> 'status' <> 'succeeded'
     or (select count(*) from public.project_items
         where project_id = '20000000-0000-4000-8000-000000000001'::uuid
           and item_key = 'TSK-10'
           and not is_demo_retired) <> 1
     or not exists (
       select 1 from public.project_items
       where project_id = '20000000-0000-4000-8000-000000000001'::uuid
         and item_key = 'TSK-10'
         and is_demo_retired
     ) then
    raise exception 'post-reset active key allocation was not deterministic: %',
      apply_result;
  end if;

  -- A manually entered numeric suffix may exceed a 32-bit integer. The
  -- deterministic allocator must remain safe for every key admitted by the
  -- public 64-character item-key contract.
  insert into public.project_items (
    id, workspace_id, project_id, item_key, item_type, title, status,
    priority, created_by
  ) values (
    '96000000-0000-4000-8000-000000000005',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'TSK-999999999999', 'task', 'Large suffix verifier', 'not_started',
    'low', '00000000-0000-4000-8000-000000000102'
  );
  insert into public.action_proposals (
    id, workspace_id, project_id, change_event_id, impact_run_id, state,
    title, rationale, created_by
  ) values (
    '96000000-0000-4000-8000-000000000006',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '96000000-0000-4000-8000-000000000001',
    '96000000-0000-4000-8000-000000000002',
    'ready', 'Large key suffix verifier',
    'Verify numeric allocation without integer overflow.',
    '00000000-0000-4000-8000-000000000102'
  );
  insert into public.proposal_actions (
    id, workspace_id, project_id, proposal_id, ordinal, action_type,
    target_item_id, expected_item_version, payload, rationale
  ) values (
    '96000000-0000-4000-8000-000000000007',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '96000000-0000-4000-8000-000000000006', 1, 'create_item', null, null,
    pg_catalog.jsonb_build_object(
      'prompt_action_type', 'create_task',
      'item_type', 'task',
      'title', 'Large suffix allocation result',
      'description', 'Synthetic numeric-overflow verifier.',
      'priority', 'medium',
      'owner_id', null,
      'start_date', null,
      'due_date', '2026-08-04',
      'linked_impact_item_id', '30000000-0000-4000-8000-000000000002',
      'confidence', 0.9,
      'requires_human_input', false
    ),
    'The allocator must use a numeric type wide enough for valid item keys.'
  );

  perform pg_catalog.set_config(
    'request.jwt.claim.sub',
    '00000000-0000-4000-8000-000000000102',
    true
  );
  perform pg_catalog.set_config(
    'request.jwt.claims',
    '{"role":"service_role","sub":"00000000-0000-4000-8000-000000000102"}',
    true
  );
  overflow_apply_result := public.apply_project_proposal(
    '00000000-0000-4000-8000-000000000102'::uuid,
    '20000000-0000-4000-8000-000000000001'::uuid,
    '96000000-0000-4000-8000-000000000006'::uuid,
    array['96000000-0000-4000-8000-000000000007'::uuid],
    '[]'::jsonb,
    'verify-large-key-suffix-001'
  );
  if overflow_apply_result ->> 'status' <> 'succeeded'
     or not exists (
       select 1
       from public.project_items
       where project_id = '20000000-0000-4000-8000-000000000001'::uuid
         and item_key = 'TSK-1000000000000'
         and not is_demo_retired
     ) then
    raise exception 'large key suffix allocation failed: %',
      overflow_apply_result;
  end if;
end;
$$;

reset role;
rollback;
