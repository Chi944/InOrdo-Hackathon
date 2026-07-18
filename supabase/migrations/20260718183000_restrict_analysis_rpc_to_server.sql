-- Keep Prompt 7 orchestration behind the Next.js server boundary. The first
-- migration's validated implementations move out of the exposed API schema;
-- thin invoker wrappers are executable only by service_role and establish the
-- already-verified request actor for the internal membership/ownership checks.

alter function public.begin_project_analysis(
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
) set schema private;
alter function private.begin_project_analysis(
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
) rename to begin_project_analysis_internal;

alter function public.complete_project_analysis(uuid, text, jsonb)
  set schema private;
alter function private.complete_project_analysis(uuid, text, jsonb)
  rename to complete_project_analysis_internal;

alter function public.fail_project_analysis(uuid, text, text, text)
  set schema private;
alter function private.fail_project_analysis(uuid, text, text, text)
  rename to fail_project_analysis_internal;

create function public.begin_project_analysis(
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
  p_model_name text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_actor_id is null or coalesce((select auth.role()), '') <> 'service_role' then
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

  return private.begin_project_analysis_internal(
    p_project_id,
    p_expected_project_revision,
    p_title,
    p_source_kind,
    p_source_author,
    p_raw_text,
    p_normalized_content_sha256,
    p_occurred_at,
    p_source_url,
    p_model_name
  );
end;
$$;

create function public.complete_project_analysis(
  p_actor_id uuid,
  p_analysis_request_id uuid,
  p_expected_project_revision text,
  p_result jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_actor_id is null or coalesce((select auth.role()), '') <> 'service_role' then
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

  return private.complete_project_analysis_internal(
    p_analysis_request_id,
    p_expected_project_revision,
    p_result
  );
end;
$$;

create function public.fail_project_analysis(
  p_actor_id uuid,
  p_analysis_request_id uuid,
  p_failure_stage text,
  p_failure_code text,
  p_failure_provider_request_id text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_actor_id is null or coalesce((select auth.role()), '') <> 'service_role' then
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

  return private.fail_project_analysis_internal(
    p_analysis_request_id,
    p_failure_stage,
    p_failure_code,
    p_failure_provider_request_id
  );
end;
$$;

revoke all on function private.begin_project_analysis_internal(
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
revoke all on function private.complete_project_analysis_internal(
  uuid,
  text,
  jsonb
) from public, anon, authenticated, service_role;
revoke all on function private.fail_project_analysis_internal(
  uuid,
  text,
  text,
  text
) from public, anon, authenticated, service_role;

grant usage on schema private to service_role;
grant execute on function private.begin_project_analysis_internal(
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
) to service_role;
grant execute on function private.complete_project_analysis_internal(
  uuid,
  text,
  jsonb
) to service_role;
grant execute on function private.fail_project_analysis_internal(
  uuid,
  text,
  text,
  text
) to service_role;

revoke all on function public.begin_project_analysis(
  uuid,
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
revoke all on function public.complete_project_analysis(
  uuid,
  uuid,
  text,
  jsonb
) from public, anon, authenticated, service_role;
revoke all on function public.fail_project_analysis(
  uuid,
  uuid,
  text,
  text,
  text
) from public, anon, authenticated, service_role;

grant execute on function public.begin_project_analysis(
  uuid,
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
) to service_role;
grant execute on function public.complete_project_analysis(
  uuid,
  uuid,
  text,
  jsonb
) to service_role;
grant execute on function public.fail_project_analysis(
  uuid,
  uuid,
  text,
  text,
  text
) to service_role;

comment on function public.begin_project_analysis(
  uuid,
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
) is 'Server-only Prompt 7 intake wrapper. The actor was authenticated by the request-scoped Next.js client and is rechecked by the private implementation.';
comment on function public.complete_project_analysis(uuid, uuid, text, jsonb)
  is 'Server-only Prompt 7 atomic completion wrapper. It never applies proposal actions.';
comment on function public.fail_project_analysis(uuid, uuid, text, text, text)
  is 'Server-only Prompt 7 terminal failure wrapper.';
