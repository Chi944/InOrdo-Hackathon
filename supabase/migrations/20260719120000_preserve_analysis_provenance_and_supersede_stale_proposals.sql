-- Prompt 13 integrity hardening: retain every immutable evidence capture while
-- preserving one provider-spend claim per normalized input, and close live
-- proposals when their project-record context or dependency graph changes.

create table public.analysis_request_sources (
  workspace_id uuid not null,
  project_id uuid not null,
  analysis_request_id uuid not null,
  source_document_id uuid not null,
  created_at timestamptz not null default now(),
  constraint analysis_request_sources_request_fk foreign key (
    workspace_id,
    project_id,
    analysis_request_id
  ) references public.analysis_requests (workspace_id, project_id, id)
    on delete restrict,
  constraint analysis_request_sources_source_fk foreign key (
    workspace_id,
    project_id,
    source_document_id
  ) references public.source_documents (workspace_id, project_id, id)
    on delete restrict,
  constraint analysis_request_sources_pkey primary key (
    workspace_id,
    project_id,
    analysis_request_id,
    source_document_id
  )
);

comment on table public.analysis_request_sources is
  'Append-only provenance links. A normalized analysis request remains the provider-spend claim while every distinct source capture remains attributable.';

insert into public.analysis_request_sources (
  workspace_id,
  project_id,
  analysis_request_id,
  source_document_id,
  created_at
)
select
  request.workspace_id,
  request.project_id,
  request.id,
  request.source_document_id,
  request.created_at
from public.analysis_requests as request
on conflict do nothing;

create trigger analysis_request_sources_immutable
before update or delete on public.analysis_request_sources
for each row execute function public.reject_immutable_change();

alter table public.analysis_request_sources enable row level security;

create policy analysis_request_sources_select_member
on public.analysis_request_sources
for select to authenticated
using ((select private.is_workspace_member(workspace_id)));

revoke all on table public.analysis_request_sources from anon, authenticated;
grant select on table public.analysis_request_sources to authenticated;
grant select, insert on table public.analysis_request_sources to service_role;

-- The internal claim function deliberately returns early for a normalized
-- duplicate. The server wrapper therefore performs the provenance capture
-- after the claim result is known, while the internal advisory lock remains
-- held for the transaction. Rate-limited calls have no claim and create no
-- orphan evidence.
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
#variable_conflict use_variable
declare
  begin_result jsonb;
  linked_request_id uuid;
  target_workspace_id uuid;
  request_generation bigint;
  capture_source_document_id uuid;
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
    begin_result := private.reconcile_expired_analysis_claim(
      p_project_id,
      (begin_result ->> 'analysis_request_id')::uuid,
      p_expected_project_revision,
      p_normalized_content_sha256
    );
  end if;

  linked_request_id := (begin_result ->> 'analysis_request_id')::uuid;
  if linked_request_id is null then
    return begin_result;
  end if;

  select request.workspace_id, request.workflow_generation
  into target_workspace_id, request_generation
  from public.analysis_requests as request
  where request.id = linked_request_id
    and request.project_id = p_project_id
    and request.project_revision = p_expected_project_revision
    and request.normalized_content_sha256 = p_normalized_content_sha256;

  if not found then
    raise exception 'analysis provenance claim mismatch' using errcode = '55000';
  end if;

  select source.id
  into capture_source_document_id
  from public.source_documents as source
  where source.workspace_id = target_workspace_id
    and source.project_id = p_project_id
    and source.workflow_generation = request_generation
    and source.normalized_content_sha256 = p_normalized_content_sha256
    and source.raw_text = p_raw_text
    and source.title = pg_catalog.btrim(p_title, E' \t\r\n')
    and source.source_kind = p_source_kind
    and source.source_url is not distinct from p_source_url
    and source.occurred_at is not distinct from p_occurred_at
    and source.source_author = pg_catalog.btrim(
      p_source_author,
      E' \t\r\n'
    )
    and source.captured_by = p_actor_id
  order by source.created_at, source.id
  limit 1;

  if capture_source_document_id is null then
    insert into public.source_documents (
      workspace_id,
      project_id,
      title,
      source_kind,
      source_url,
      raw_text,
      occurred_at,
      captured_by,
      source_author,
      normalized_content_sha256
    ) values (
      target_workspace_id,
      p_project_id,
      pg_catalog.btrim(p_title, E' \t\r\n'),
      p_source_kind,
      p_source_url,
      p_raw_text,
      p_occurred_at,
      p_actor_id,
      pg_catalog.btrim(p_source_author, E' \t\r\n'),
      p_normalized_content_sha256
    )
    returning id into capture_source_document_id;
  end if;

  insert into public.analysis_request_sources (
    workspace_id,
    project_id,
    analysis_request_id,
    source_document_id
  ) values (
    target_workspace_id,
    p_project_id,
    linked_request_id,
    capture_source_document_id
  )
  on conflict do nothing;

  return pg_catalog.jsonb_set(
    begin_result,
    '{source_document_id}',
    pg_catalog.to_jsonb(capture_source_document_id),
    true
  );
end;
$$;

revoke all on function public.begin_project_analysis(
  uuid, uuid, text, text, text, text, text, text, timestamptz, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.begin_project_analysis(
  uuid, uuid, text, text, text, text, text, text, timestamptz, text, text
) to service_role;

-- Every active item version participates in the canonical analysis revision.
-- A project-record mutation therefore closes every still-live proposal in the
-- current generation. An apply transaction may mutate an item itself; its
-- final state reconciliation occurs later in the same locked transaction and
-- preserves explicitly approved progress for that proposal only.
create or replace function private.supersede_project_proposals_on_item_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid;
  target_project_id uuid;
begin
  target_workspace_id := case
    when tg_op = 'DELETE' then old.workspace_id
    else new.workspace_id
  end;
  target_project_id := case
    when tg_op = 'DELETE' then old.project_id
    else new.project_id
  end;

  update public.action_proposals as proposal
  set state = 'superseded'::public.proposal_state
  from public.projects as project
  where proposal.workspace_id = target_workspace_id
    and proposal.project_id = target_project_id
    and proposal.state in (
      'ready'::public.proposal_state,
      'partially_approved'::public.proposal_state
    )
    and project.workspace_id = proposal.workspace_id
    and project.id = proposal.project_id
    and project.workflow_generation = proposal.workflow_generation;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function private.supersede_project_proposals_on_dependency_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid;
  target_project_id uuid;
begin
  if tg_op = 'UPDATE' and new is not distinct from old then
    return new;
  end if;

  target_workspace_id := case
    when tg_op = 'DELETE' then old.workspace_id
    else new.workspace_id
  end;
  target_project_id := case
    when tg_op = 'DELETE' then old.project_id
    else new.project_id
  end;

  update public.action_proposals as proposal
  set state = 'superseded'::public.proposal_state
  from public.projects as project
  where proposal.workspace_id = target_workspace_id
    and proposal.project_id = target_project_id
    and proposal.state in (
      'ready'::public.proposal_state,
      'partially_approved'::public.proposal_state
    )
    and project.workspace_id = proposal.workspace_id
    and project.id = proposal.project_id
    and project.workflow_generation = proposal.workflow_generation;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger project_items_supersede_project_proposals
after insert or update or delete on public.project_items
for each row execute function private.supersede_project_proposals_on_item_change();

create trigger item_dependencies_supersede_project_proposals
after insert or update or delete on public.item_dependencies
for each row execute function private.supersede_project_proposals_on_dependency_change();

-- Historic live proposals have no trustworthy context snapshot. Close them
-- forward-only; users can preserve their audit trail and run fresh analysis.
update public.action_proposals as proposal
set state = 'superseded'::public.proposal_state
from public.projects as project
where project.workspace_id = proposal.workspace_id
  and project.id = proposal.project_id
  and project.workflow_generation = proposal.workflow_generation
  and proposal.state in (
    'ready'::public.proposal_state,
    'partially_approved'::public.proposal_state
  );

revoke all on function private.supersede_project_proposals_on_item_change()
  from public, anon, authenticated, service_role;
revoke all on function private.supersede_project_proposals_on_dependency_change()
  from public, anon, authenticated, service_role;

comment on function private.supersede_project_proposals_on_item_change() is
  'Closes current-generation ready proposals after a project item mutation; approved apply transactions reconcile their own proposal afterward.';
comment on function private.supersede_project_proposals_on_dependency_change() is
  'Closes current-generation ready proposals after a dependency graph mutation.';
