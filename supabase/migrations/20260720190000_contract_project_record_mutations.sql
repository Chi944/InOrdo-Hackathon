begin;

-- The exact RPC-capable production artifact has exercised all four native
-- mutations and exact replay. Contract the temporary expand-phase browser DML
-- path so authenticated writes can proceed only through the generation-fenced
-- RPCs installed by 20260719140000_guard_project_record_mutations.sql.
drop policy if exists project_items_insert_contributor
  on public.project_items;
drop policy if exists project_items_update_contributor
  on public.project_items;
drop policy if exists project_items_delete_contributor
  on public.project_items;

drop policy if exists item_dependencies_insert_contributor
  on public.item_dependencies;
drop policy if exists item_dependencies_update_contributor
  on public.item_dependencies;
drop policy if exists item_dependencies_delete_contributor
  on public.item_dependencies;

revoke insert, update, delete
  on table public.project_items
  from authenticated;

-- Project items use explicit column grants in the expand schema. Table-level
-- revocation does not remove those grants, so revoke both allowlists exactly.
revoke insert (
  id,
  workspace_id,
  project_id,
  item_key,
  item_type,
  title,
  description,
  status,
  priority,
  owner_id,
  start_date,
  due_date,
  event_date,
  metadata,
  created_by
) on table public.project_items
  from authenticated;

revoke update (
  item_key,
  item_type,
  title,
  description,
  status,
  priority,
  owner_id,
  start_date,
  due_date,
  event_date,
  metadata
) on table public.project_items
  from authenticated;

revoke insert, update, delete
  on table public.item_dependencies
  from authenticated;

commit;
