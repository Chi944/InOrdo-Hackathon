-- Supabase's function grant hook assigns direct API-role EXECUTE privileges.
-- Trigger functions are internal implementation details and must not be RPCs.
revoke all on function public.set_updated_at() from public, anon, authenticated, service_role;
revoke all on function public.bump_project_item_version() from public, anon, authenticated, service_role;
revoke all on function public.reject_immutable_change() from public, anon, authenticated, service_role;
revoke all on function public.protect_final_workspace_owner() from public, anon, authenticated, service_role;
