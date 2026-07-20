-- Contract-phase native project-record mutation assertions. Requires the
-- deterministic demo seed. Every fixture and receipt rolls back.

begin;

do $$
declare
  signature text;
begin
  if exists (
       select 1
       from pg_catalog.pg_policies as policy
       where policy.schemaname = 'public'
         and policy.policyname in (
           'project_items_insert_contributor',
           'project_items_update_contributor',
           'project_items_delete_contributor',
           'item_dependencies_insert_contributor',
           'item_dependencies_update_contributor',
           'item_dependencies_delete_contributor'
         )
     ) then
    raise exception 'legacy project-record write policies remain';
  end if;

  if exists (
       select 1
       from pg_catalog.pg_policies as policy
       where policy.schemaname = 'public'
         and policy.tablename in ('project_items', 'item_dependencies')
         and policy.cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
     ) then
    raise exception 'unexpected project-record write policy remains';
  end if;

  if not pg_catalog.has_table_privilege(
       'authenticated', 'public.project_items', 'SELECT'
     )
     or not pg_catalog.has_table_privilege(
       'authenticated', 'public.item_dependencies', 'SELECT'
     ) then
    raise exception 'authenticated project-record reads were removed';
  end if;

  if pg_catalog.has_table_privilege(
       'authenticated', 'public.project_items', 'INSERT'
     )
     or pg_catalog.has_table_privilege(
       'authenticated', 'public.project_items', 'UPDATE'
     )
     or pg_catalog.has_table_privilege(
       'authenticated', 'public.project_items', 'DELETE'
     )
     or pg_catalog.has_table_privilege(
       'authenticated', 'public.item_dependencies', 'INSERT'
     )
     or pg_catalog.has_table_privilege(
       'authenticated', 'public.item_dependencies', 'UPDATE'
     )
     or pg_catalog.has_table_privilege(
       'authenticated', 'public.item_dependencies', 'DELETE'
     ) then
    raise exception 'authenticated project-record table DML remains';
  end if;

  if exists (
       select 1
       from pg_catalog.pg_attribute as attribute
       where attribute.attrelid in (
           'public.project_items'::regclass,
           'public.item_dependencies'::regclass
         )
         and attribute.attnum > 0
         and not attribute.attisdropped
         and (
           pg_catalog.has_column_privilege(
             'authenticated', attribute.attrelid, attribute.attnum, 'INSERT'
           )
           or pg_catalog.has_column_privilege(
             'authenticated', attribute.attrelid, attribute.attnum, 'UPDATE'
           )
         )
     ) then
    raise exception 'authenticated project-record column DML remains';
  end if;

  foreach signature in array array[
    'public.mutate_project_item_create(uuid,bigint,text,jsonb)',
    'public.mutate_project_item_update(uuid,uuid,bigint,bigint,text,jsonb)',
    'public.mutate_project_dependency_create(uuid,bigint,text,jsonb)',
    'public.mutate_project_dependency_remove(uuid,uuid,bigint,text)'
  ] loop
    if not pg_catalog.has_function_privilege(
         'authenticated', signature, 'EXECUTE'
       )
       or pg_catalog.has_function_privilege('anon', signature, 'EXECUTE')
       or pg_catalog.has_function_privilege(
         'service_role', signature, 'EXECUTE'
       ) then
      raise exception 'project mutation RPC privileges changed: %', signature;
    end if;
  end loop;
end;
$$;

set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated","is_anonymous":false}',
  true
);

-- A real contributor still sees seeded records through the retained read
-- policies, while every direct table mutation is denied. These behavioral
-- checks supplement the ACL and policy inventory above.
do $$
begin
  if (
       select pg_catalog.count(*)
       from public.project_items as item
       where item.id = '30000000-0000-4000-8000-000000000001'::uuid
     ) <> 1 then
    raise exception 'member project-item read policy is unavailable';
  end if;

  if (
       select pg_catalog.count(*)
       from public.item_dependencies as dependency
       where dependency.id = '40000000-0000-4000-8000-000000000001'::uuid
     ) <> 1 then
    raise exception 'member dependency read policy is unavailable';
  end if;
end;
$$;

do $$
begin
  begin
    insert into public.project_items (
      id, workspace_id, project_id, item_key, item_type, title, description,
      status, priority, owner_id, start_date, due_date, event_date, metadata,
      created_by
    ) values (
      '3c200000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      'TST-98', 'task', 'Denied direct item insert', null,
      'not_started', 'medium', null, null, null, null, '{}'::jsonb,
      '00000000-0000-4000-8000-000000000103'
    );
    raise exception 'direct project item insert unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.project_items
    set title = title
    where id = '30000000-0000-4000-8000-000000000001'::uuid;
    raise exception 'direct project item update unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;

  begin
    delete from public.project_items
    where id = '30000000-0000-4000-8000-000000000001'::uuid;
    raise exception 'direct project item delete unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.item_dependencies (
      id, workspace_id, project_id, from_item_id, to_item_id, relationship,
      rationale, created_by
    ) values (
      '4c200000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000024',
      '30000000-0000-4000-8000-000000000007',
      'depends_on', 'Denied direct dependency insert.',
      '00000000-0000-4000-8000-000000000103'
    );
    raise exception 'direct dependency insert unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.item_dependencies
    set rationale = rationale
    where id = '40000000-0000-4000-8000-000000000001'::uuid;
    raise exception 'direct dependency update unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;

  begin
    delete from public.item_dependencies
    where id = '40000000-0000-4000-8000-000000000001'::uuid;
    raise exception 'direct dependency delete unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- The contracted application path remains functional and exactly idempotent
-- for create item, update item, create dependency, and remove dependency.
do $$
declare
  project_id constant uuid := '20000000-0000-4000-8000-000000000001';
  upstream_item_id constant uuid := '30000000-0000-4000-8000-000000000007';
  current_generation bigint;
  created jsonb;
  created_replay jsonb;
  updated jsonb;
  updated_replay jsonb;
  dependency_created jsonb;
  dependency_replay jsonb;
  dependency_removed jsonb;
  removal_replay jsonb;
  created_item_id uuid;
  created_item_version bigint;
  created_dependency_id uuid;
begin
  select project.workflow_generation
  into current_generation
  from public.projects as project
  where project.id = project_id;

  created := public.mutate_project_item_create(
    project_id,
    current_generation,
    'verify-contract-item-create-001',
    pg_catalog.jsonb_build_object(
      'item_key', 'TST-98',
      'item_type', 'task',
      'title', 'Contract RPC item',
      'description', 'Rollback-only project-record contract fixture.',
      'status', 'not_started',
      'priority', 'medium',
      'owner_id', null,
      'start_date', null,
      'due_date', null,
      'event_date', null
    )
  );
  created_replay := public.mutate_project_item_create(
    project_id,
    current_generation,
    'verify-contract-item-create-001',
    pg_catalog.jsonb_build_object(
      'item_key', 'TST-98',
      'item_type', 'task',
      'title', 'Contract RPC item',
      'description', 'Rollback-only project-record contract fixture.',
      'status', 'not_started',
      'priority', 'medium',
      'owner_id', null,
      'start_date', null,
      'due_date', null,
      'event_date', null
    )
  );
  created_item_id := (created -> 'item' ->> 'id')::uuid;
  created_item_version := (created -> 'item' ->> 'version')::bigint;
  if created ->> 'status' <> 'succeeded'
     or created_replay ->> 'status' <> 'duplicate'
     or created_replay -> 'item' ->> 'id' <> created_item_id::text then
    raise exception 'contract item create/replay failed: %, %',
      created, created_replay;
  end if;

  updated := public.mutate_project_item_update(
    project_id,
    created_item_id,
    created_item_version,
    current_generation,
    'verify-contract-item-update-001',
    pg_catalog.jsonb_build_object('title', 'Contract RPC item updated')
  );
  updated_replay := public.mutate_project_item_update(
    project_id,
    created_item_id,
    created_item_version,
    current_generation,
    'verify-contract-item-update-001',
    pg_catalog.jsonb_build_object('title', 'Contract RPC item updated')
  );
  if updated ->> 'status' <> 'succeeded'
     or updated_replay ->> 'status' <> 'duplicate'
     or updated_replay -> 'item' ->> 'id' <> created_item_id::text
     or (updated -> 'item' ->> 'version')::bigint <> created_item_version + 1 then
    raise exception 'contract item update/replay failed: %, %',
      updated, updated_replay;
  end if;

  dependency_created := public.mutate_project_dependency_create(
    project_id,
    current_generation,
    'verify-contract-dependency-create-001',
    pg_catalog.jsonb_build_object(
      'from_item_id', created_item_id,
      'to_item_id', upstream_item_id,
      'relationship', 'requires',
      'rationale', 'Rollback-only contracted RPC relationship.'
    )
  );
  dependency_replay := public.mutate_project_dependency_create(
    project_id,
    current_generation,
    'verify-contract-dependency-create-001',
    pg_catalog.jsonb_build_object(
      'from_item_id', created_item_id,
      'to_item_id', upstream_item_id,
      'relationship', 'requires',
      'rationale', 'Rollback-only contracted RPC relationship.'
    )
  );
  created_dependency_id := (
    dependency_created -> 'dependency' ->> 'id'
  )::uuid;
  if dependency_created ->> 'status' <> 'succeeded'
     or dependency_replay ->> 'status' <> 'duplicate'
     or dependency_replay -> 'dependency' ->> 'id' <>
       created_dependency_id::text then
    raise exception 'contract dependency create/replay failed: %, %',
      dependency_created, dependency_replay;
  end if;

  dependency_removed := public.mutate_project_dependency_remove(
    project_id,
    created_dependency_id,
    current_generation,
    'verify-contract-dependency-remove-001'
  );
  removal_replay := public.mutate_project_dependency_remove(
    project_id,
    created_dependency_id,
    current_generation,
    'verify-contract-dependency-remove-001'
  );
  if dependency_removed ->> 'status' <> 'succeeded'
     or removal_replay ->> 'status' <> 'duplicate'
     or removal_replay ->> 'dependency_id' <> created_dependency_id::text then
    raise exception 'contract dependency remove/replay failed: %, %',
      dependency_removed, removal_replay;
  end if;

  perform pg_catalog.set_config(
    'inordo.contract_item_id', created_item_id::text, true
  );
end;
$$;

reset role;
set local role service_role;

-- This profile has no membership in any workspace, making the subsequent JWT
-- a true nonmember rather than a viewer or a member of another workspace.
insert into public.profiles (id, display_name)
values (
  '0c200000-0000-4000-8000-000000000001',
  'Rollback-only contract nonmember'
);

reset role;

do $$
begin
  if exists (
       select 1
       from public.workspace_members as membership
       where membership.user_id =
         '0c200000-0000-4000-8000-000000000001'::uuid
     ) then
    raise exception 'contract nonmember fixture unexpectedly has membership';
  end if;
end;
$$;

set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"0c200000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',
  true
);

do $$
declare
  project_id constant uuid := '20000000-0000-4000-8000-000000000001';
  generation constant bigint := 1;
begin
  begin
    perform public.mutate_project_item_create(
      project_id,
      generation,
      'verify-contract-nonmember-create',
      pg_catalog.jsonb_build_object(
        'item_key', 'TST-99', 'item_type', 'task', 'title', 'Denied',
        'description', null, 'status', 'not_started', 'priority', 'medium',
        'owner_id', null, 'start_date', null, 'due_date', null,
        'event_date', null
      )
    );
    raise exception 'true nonmember item create unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.mutate_project_item_update(
      project_id,
      '30000000-0000-4000-8000-000000000001'::uuid,
      1,
      generation,
      'verify-contract-nonmember-update',
      pg_catalog.jsonb_build_object('title', 'Denied')
    );
    raise exception 'true nonmember item update unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.mutate_project_dependency_create(
      project_id,
      generation,
      'verify-contract-nonmember-dependency-create',
      pg_catalog.jsonb_build_object(
        'from_item_id', '30000000-0000-4000-8000-000000000024',
        'to_item_id', '30000000-0000-4000-8000-000000000007',
        'relationship', 'depends_on',
        'rationale', null
      )
    );
    raise exception 'true nonmember dependency create unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.mutate_project_dependency_remove(
      project_id,
      '40000000-0000-4000-8000-000000000001'::uuid,
      generation,
      'verify-contract-nonmember-dependency-remove'
    );
    raise exception 'true nonmember dependency remove unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;

do $$
begin
  if (
       select pg_catalog.count(*)
       from private.project_mutation_ledger as ledger
       where ledger.actor_id =
         '00000000-0000-4000-8000-000000000103'::uuid
         and ledger.idempotency_key like 'verify-contract-%'
     ) <> 4 then
    raise exception 'contract RPC replay created an unexpected receipt count';
  end if;

  if exists (
       select 1
       from private.project_mutation_ledger as ledger
       where ledger.actor_id =
         '0c200000-0000-4000-8000-000000000001'::uuid
     ) then
    raise exception 'true nonmember mutation created a receipt';
  end if;

  if (
       select pg_catalog.count(*)
       from public.project_items as item
       where item.id = pg_catalog.current_setting(
         'inordo.contract_item_id'
       )::uuid
         and item.title = 'Contract RPC item updated'
         and item.version = 2
     ) <> 1 then
    raise exception 'contract RPC item state is incorrect';
  end if;
end;
$$;

rollback;
