-- Bound analysis claims with a database-owned, nonrenewable lease. Exact
-- replays reconcile an expired processing row to a terminal failure instead
-- of starting a second model attempt or returning processing indefinitely.

alter table public.analysis_requests
  add column lease_expires_at timestamptz
    default (pg_catalog.now() + interval '3 minutes');

-- The existing transition guard deliberately rejects same-state updates.
-- The first ALTER TABLE holds an ACCESS EXCLUSIVE lock until commit, so only
-- this migration-owned backfill runs while the exact named guard is disabled.
alter table public.analysis_requests
  disable trigger analysis_requests_guard_transition;

update public.analysis_requests
set lease_expires_at = created_at + interval '3 minutes';

alter table public.analysis_requests
  alter column lease_expires_at set not null,
  add constraint analysis_requests_fixed_lease check (
    lease_expires_at = created_at + interval '3 minutes'
  );

create function private.assign_analysis_request_lease()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.lease_expires_at := new.created_at + interval '3 minutes';
  return new;
end;
$$;

create trigger analysis_requests_assign_lease
before insert on public.analysis_requests
for each row execute function private.assign_analysis_request_lease();

create or replace function private.guard_analysis_request_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.workspace_id is distinct from old.workspace_id
     or new.project_id is distinct from old.project_id
     or new.source_document_id is distinct from old.source_document_id
     or new.project_revision is distinct from old.project_revision
     or new.normalized_content_sha256 is distinct from old.normalized_content_sha256
     or new.model_name is distinct from old.model_name
     or new.requested_by is distinct from old.requested_by
     or new.created_at is distinct from old.created_at
     or new.lease_expires_at is distinct from old.lease_expires_at then
    raise exception 'analysis request identity is immutable'
      using errcode = '23514';
  end if;

  if old.state <> 'processing'::public.analysis_request_state
     or new.state not in (
       'succeeded'::public.analysis_request_state,
       'failed'::public.analysis_request_state
     ) then
    raise exception 'invalid analysis request transition'
      using errcode = '23514';
  end if;

  if new.state = 'succeeded'::public.analysis_request_state
     and old.lease_expires_at <= pg_catalog.clock_timestamp() then
    raise exception 'analysis claim lease expired'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

alter table public.analysis_requests
  enable trigger analysis_requests_guard_transition;

create function private.reconcile_expired_analysis_claim(
  p_project_id uuid,
  p_analysis_request_id uuid,
  p_expected_project_revision text,
  p_normalized_content_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  actor_id uuid := (select auth.uid());
  observed_at timestamptz;
  retry_after_seconds integer;
  request_row public.analysis_requests%rowtype;
begin
  if actor_id is null
     or coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select request.*
  into request_row
  from public.analysis_requests as request
  inner join public.projects as project
    on project.workspace_id = request.workspace_id
   and project.id = request.project_id
   and project.workflow_generation = request.workflow_generation
  where request.id = p_analysis_request_id
    and request.project_id = p_project_id
    and request.project_revision = p_expected_project_revision
    and request.normalized_content_sha256 = p_normalized_content_sha256
  for update of request;

  if not found
     or not exists (
       select 1
       from public.workspace_members as member
       where member.workspace_id = request_row.workspace_id
         and member.user_id = actor_id
         and member.role in (
           'owner'::public.workspace_role,
           'admin'::public.workspace_role,
           'member'::public.workspace_role
         )
     ) then
    raise exception 'analysis request not found or access denied'
      using errcode = '42501';
  end if;

  observed_at := pg_catalog.clock_timestamp();
  if request_row.state = 'processing'::public.analysis_request_state
     and request_row.lease_expires_at <= observed_at then
    update public.analysis_requests as request
    set state = 'failed'::public.analysis_request_state,
        failure_stage = 'persistence',
        failure_code = 'analysis_cancelled',
        failure_provider_request_id = null,
        finished_at = observed_at
    where request.id = request_row.id
    returning request.* into request_row;
  end if;

  if request_row.state = 'processing'::public.analysis_request_state then
    retry_after_seconds := greatest(
      1,
      least(
        180,
        pg_catalog.ceil(
          extract(epoch from (request_row.lease_expires_at - observed_at))
        )::integer
      )
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'status', 'duplicate',
    'analysis_request_id', request_row.id,
    'source_document_id', request_row.source_document_id,
    'state', request_row.state::text,
    'change_event_id', request_row.change_event_id,
    'impact_run_id', request_row.impact_run_id,
    'proposal_id', request_row.proposal_id,
    'retry_after_seconds', retry_after_seconds
  );
end;
$$;

create or replace function public.begin_project_analysis(
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
declare
  begin_result jsonb;
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

  begin_result := private.begin_project_analysis_internal(
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

  if begin_result ->> 'status' = 'duplicate'
     and begin_result ->> 'state' = 'processing' then
    return private.reconcile_expired_analysis_claim(
      p_project_id,
      (begin_result ->> 'analysis_request_id')::uuid,
      p_expected_project_revision,
      p_normalized_content_sha256
    );
  end if;

  return begin_result;
end;
$$;

revoke all on function private.assign_analysis_request_lease()
  from public, anon, authenticated, service_role;
revoke all on function private.reconcile_expired_analysis_claim(
  uuid, uuid, text, text
) from public, anon, authenticated, service_role;
grant execute on function private.reconcile_expired_analysis_claim(
  uuid, uuid, text, text
) to service_role;

revoke all on function public.begin_project_analysis(
  uuid, uuid, text, text, text, text, text, text, timestamptz, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.begin_project_analysis(
  uuid, uuid, text, text, text, text, text, text, timestamptz, text, text
) to service_role;

comment on column public.analysis_requests.lease_expires_at is
  'Fixed three-minute claim lease. Exact replays lazily reconcile expired processing claims to failed; the lease is never renewed.';
comment on function private.reconcile_expired_analysis_claim(
  uuid, uuid, text, text
) is
  'Locks an exact current-generation claim and atomically terminalizes an expired processing request without starting another model attempt.';
