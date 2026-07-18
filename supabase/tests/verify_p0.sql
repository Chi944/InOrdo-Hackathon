-- Execute this assertion script with a plain SQL runner after seeding either a
-- local reset or the confirmed linked project. It is intentionally not pgTAP.
-- Every mutation is wrapped in this transaction and rolled back.

begin;

do $$
declare
  item_count integer;
  edge_count integer;
  baseline_date date;
  path_found boolean;
begin
  select count(*) into item_count
  from public.project_items
  where project_id = '20000000-0000-4000-8000-000000000001';
  if item_count < 20 then
    raise exception 'seed requires at least 20 items, found %', item_count;
  end if;

  select count(*) into edge_count
  from public.item_dependencies
  where project_id = '20000000-0000-4000-8000-000000000001';
  if edge_count < 1 then
    raise exception 'seed requires dependency edges';
  end if;

  select event_date into baseline_date
  from public.project_items
  where id = '30000000-0000-4000-8000-000000000001';
  if baseline_date is distinct from date '2026-09-12' then
    raise exception 'unexpected baseline event date: %', baseline_date;
  end if;

  with recursive downstream(item_id, path) as (
    select '30000000-0000-4000-8000-000000000001'::uuid,
           array['30000000-0000-4000-8000-000000000001'::uuid]
    union all
    select d.from_item_id, downstream.path || d.from_item_id
    from downstream
    join public.item_dependencies d on d.to_item_id = downstream.item_id
    where not d.from_item_id = any(downstream.path)
  )
  select exists (
    select 1 from downstream
    where path = array[
      '30000000-0000-4000-8000-000000000001'::uuid,
      '30000000-0000-4000-8000-000000000002'::uuid,
      '30000000-0000-4000-8000-000000000004'::uuid,
      '30000000-0000-4000-8000-000000000005'::uuid
    ]
  ) into path_found;
  if not path_found then
    raise exception 'expected event -> speakers -> programme -> briefing path missing';
  end if;

  if not has_table_privilege('service_role', 'public.operation_logs', 'INSERT') then
    raise exception 'service_role lacks required server-only operation INSERT privilege';
  end if;
  if has_table_privilege('authenticated', 'public.operation_logs', 'INSERT') then
    raise exception 'authenticated must not insert operation audit rows directly';
  end if;
end;
$$;

-- Constraint: an item cannot depend on itself.
do $$
begin
  begin
    insert into public.item_dependencies (
      workspace_id, project_id, from_item_id, to_item_id, relationship, created_by
    ) values (
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000001',
      'depends_on',
      '00000000-0000-4000-8000-000000000101'
    );
    raise exception 'self-dependency unexpectedly succeeded';
  exception
    when check_violation or insufficient_privilege then null;
  end;
end;
$$;

-- Concurrency: one conditional item update succeeds and the stale token cannot
-- update the same row again.
do $$
declare
  expected_version bigint;
  changed_count integer;
begin
  select version into expected_version
  from public.project_items
  where id = '30000000-0000-4000-8000-000000000002';

  update public.project_items
  set priority = case
    when priority = 'low' then 'medium'::public.item_priority
    else 'low'::public.item_priority
  end
  where id = '30000000-0000-4000-8000-000000000002'
    and version = expected_version;
  get diagnostics changed_count = row_count;
  if changed_count <> 1 then
    raise exception 'current item version update changed % rows', changed_count;
  end if;

  update public.project_items
  set priority = priority
  where id = '30000000-0000-4000-8000-000000000002'
    and version = expected_version;
  get diagnostics changed_count = row_count;
  if changed_count <> 0 then
    raise exception 'stale item version unexpectedly changed % rows', changed_count;
  end if;
end;
$$;

-- Invariant: the final owner cannot be removed or demoted, even by privileged SQL.
do $$
begin
  begin
    update public.workspace_members
    set role = 'admin'
    where workspace_id = '10000000-0000-4000-8000-000000000001'
      and user_id = '00000000-0000-4000-8000-000000000101';
    raise exception 'final owner demotion unexpectedly succeeded';
  exception
    when check_violation then null;
  end;
end;
$$;

-- Constraint: operation idempotency is unique within a workspace.
insert into public.operation_logs (
  id, workspace_id, project_id, operation_type, state, idempotency_key,
  request_hash, result_metadata, initiated_by
) values (
  '50000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'demo_reset', 'succeeded', 'verification-idempotency-key',
  repeat('a', 64), '{}'::jsonb,
  '00000000-0000-4000-8000-000000000101'
);
do $$
begin
  begin
    insert into public.operation_logs (
      workspace_id, project_id, operation_type, state, idempotency_key,
      request_hash, result_metadata, initiated_by
    ) values (
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      'demo_reset', 'succeeded', 'verification-idempotency-key',
      repeat('b', 64), '{}'::jsonb,
      '00000000-0000-4000-8000-000000000101'
    );
    raise exception 'duplicate idempotency key unexpectedly succeeded';
  exception
    when unique_violation then null;
  end;
end;
$$;

-- A workspace that the fixture viewer does not belong to.
insert into public.workspaces (id, name, slug, created_by)
values (
  '10000000-0000-4000-8000-000000000099', 'RLS Verification Workspace',
  'rls-verification-workspace', '00000000-0000-4000-8000-000000000101'
);
insert into public.projects (id, workspace_id, name, slug, created_by)
values (
  '20000000-0000-4000-8000-000000000099',
  '10000000-0000-4000-8000-000000000099',
  'Hidden verification project', 'hidden-verification-project',
  '00000000-0000-4000-8000-000000000101'
);

insert into public.profiles (id, display_name)
values ('00000000-0000-4000-8000-000000000109', 'Outside Workspace User');
insert into public.workspace_members (workspace_id, user_id, role)
values (
  '10000000-0000-4000-8000-000000000099',
  '00000000-0000-4000-8000-000000000109',
  'owner'
);

insert into public.projects (id, workspace_id, name, slug, created_by)
values (
  '20000000-0000-4000-8000-000000000098',
  '10000000-0000-4000-8000-000000000001',
  'Second Project Verification',
  'second-project-verification',
  '00000000-0000-4000-8000-000000000101'
);
insert into public.project_items (
  id, workspace_id, project_id, item_key, item_type, title, created_by
) values (
  '30000000-0000-4000-8000-000000000099',
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000098',
  'VERIFY-99',
  'task',
  'Cross-project verification item',
  '00000000-0000-4000-8000-000000000101'
);

-- Tenant integrity: an item owner must belong to the item's workspace even
-- when a direct database client bypasses the application service.
do $$
begin
  begin
    update public.project_items
    set owner_id = '00000000-0000-4000-8000-000000000109'
    where id = '30000000-0000-4000-8000-000000000001';
    raise exception 'cross-workspace item owner unexpectedly succeeded';
  exception
    when foreign_key_violation then null;
  end;
end;
$$;

-- Tenant integrity: dependency endpoints cannot cross projects even inside one
-- workspace.
do $$
begin
  begin
    insert into public.item_dependencies (
      workspace_id, project_id, from_item_id, to_item_id,
      relationship, created_by
    ) values (
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000002',
      '30000000-0000-4000-8000-000000000099',
      'requires',
      '00000000-0000-4000-8000-000000000101'
    );
    raise exception 'cross-project dependency unexpectedly succeeded';
  exception
    when foreign_key_violation then null;
  end;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000108', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000108","role":"authenticated","is_anonymous":false}',
  true
);

-- RLS: cross-workspace SELECT returns no rows.
do $$
declare
  visible_count integer;
begin
  select count(*) into visible_count
  from public.projects
  where id = '20000000-0000-4000-8000-000000000099';
  if visible_count <> 0 then
    raise exception 'cross-workspace project was visible to viewer';
  end if;
end;
$$;

-- RLS: a viewer mutation affects zero rows and leaves the record unchanged.
do $$
declare
  changed_count integer;
  current_title text;
begin
  update public.project_items
  set title = 'viewer mutation must not persist'
  where id = '30000000-0000-4000-8000-000000000001';
  get diagnostics changed_count = row_count;
  if changed_count <> 0 then
    raise exception 'viewer mutation unexpectedly changed % rows', changed_count;
  end if;
  select title into current_title
  from public.project_items
  where id = '30000000-0000-4000-8000-000000000001';
  if current_title <> 'Regional Climate Action Summit 2026' then
    raise exception 'viewer mutation altered the seeded event';
  end if;
end;
$$;

reset role;

-- RLS: an anonymous Auth identity still uses the authenticated Postgres role,
-- but must fail closed even if its subject appears in workspace_members.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000108","role":"authenticated","is_anonymous":true}',
  true
);

do $$
declare
  visible_count integer;
  changed_count integer;
begin
  if private.is_workspace_member(
    '10000000-0000-4000-8000-000000000001'::uuid
  ) then
    raise exception 'anonymous workspace member predicate unexpectedly allowed access';
  end if;

  select count(*) into visible_count
  from public.projects
  where id = '20000000-0000-4000-8000-000000000001';
  if visible_count <> 0 then
    raise exception 'anonymous identity unexpectedly read a project';
  end if;

  update public.project_items
  set status = 'in_progress'
  where id = '30000000-0000-4000-8000-000000000001';
  get diagnostics changed_count = row_count;
  if changed_count <> 0 then
    raise exception 'anonymous identity unexpectedly changed a project item';
  end if;
end;
$$;

reset role;

-- Seed a review candidate as the trusted orchestration path, then prove that an
-- authenticated admin cannot forge reviewer attribution or record identity.
insert into public.source_documents (
  id, workspace_id, project_id, title, source_kind, raw_text, captured_by
) values (
  '50000000-0000-4000-8000-000000000010',
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'Verification evidence', 'manual_note', 'Verification-only evidence.',
  '00000000-0000-4000-8000-000000000101'
);
insert into public.change_events (
  id, workspace_id, project_id, source_document_id, subject_item_id,
  field_name, proposed_value, created_by
) values (
  '50000000-0000-4000-8000-000000000011',
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000010',
  '30000000-0000-4000-8000-000000000001',
  'event_date', '"2026-09-19"'::jsonb,
  '00000000-0000-4000-8000-000000000101'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000102', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000102","role":"authenticated","is_anonymous":false}',
  true
);

update public.change_events
set state = 'confirmed',
    reviewed_by = '00000000-0000-4000-8000-000000000108',
    reviewed_at = '2000-01-01 00:00:00+00'
where id = '50000000-0000-4000-8000-000000000011';

do $$
declare
  actual_reviewer uuid;
begin
  select reviewed_by into actual_reviewer
  from public.change_events
  where id = '50000000-0000-4000-8000-000000000011';
  if actual_reviewer is distinct from '00000000-0000-4000-8000-000000000102'::uuid then
    raise exception 'review attribution was not forced to auth.uid()';
  end if;

  begin
    update public.projects
    set created_by = '00000000-0000-4000-8000-000000000102'
    where id = '20000000-0000-4000-8000-000000000001';
    raise exception 'project attribution mutation unexpectedly succeeded';
  exception
    when check_violation or insufficient_privilege then null;
  end;

  begin
    insert into public.operation_logs (
      workspace_id, project_id, operation_type, state, idempotency_key, initiated_by
    ) values (
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      'demo_reset', 'succeeded', 'forged-authenticated-audit-row',
      '00000000-0000-4000-8000-000000000102'
    );
    raise exception 'authenticated operation audit insertion unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;
rollback;
