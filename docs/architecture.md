# InOrdo architecture

## System shape

```text
Browser
  │ public Supabase client only
  ▼
Next.js App Router
  ├─ Server Components: reads and presentation
  ├─ Server actions/routes: validation, authorization, orchestration
  ├─ OpenAI adapter: candidate extraction and recovery drafts
  └─ Domain services: dependency traversal, approvals, operations, undo
  │
  ▼
Supabase Postgres + Auth + RLS
```

## Boundaries

### Web

Use React Server Components by default. Client Components may hold browser interaction state but must not import server secrets, call OpenAI, or make authorization decisions.

### Authentication and request refresh

The installed Next.js 16 line uses `src/proxy.ts` for request interception. The proxy refreshes the Supabase session with a request-scoped server client and carries every cookie update to both the current request and outgoing response. It does not make domain authorization decisions and it does not use a service-role client.

Server Components, route handlers, and server actions create a fresh Supabase server client per request. Protected entry points establish identity with `auth.getClaims()` and then apply explicit workspace and project authorization; they do not treat an unverified `getSession()` payload as authorization. Redirect destinations are accepted only when they are local application paths.

The request-scoped and privileged clients have distinct nominal TypeScript capabilities, so a privileged client cannot accidentally satisfy an API that requires a user-scoped client. The session proxy copies refreshed cookies and cache-safety headers to normal and redirect responses. Route handlers can pass a response `Headers` sink to the server-client factory and must apply that same object to the returned response.

The browser client can read only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Server environment validation is isolated from the public schema. The privileged client imports a server-only marker, reads `SUPABASE_SERVICE_ROLE_KEY` only on the server, disables session persistence, and is reserved for narrowly reviewed analysis persistence and approved operations. Normal authenticated reads and writes always use the user's session so RLS remains in force.

### Authorization and data access

Reusable server-only guards establish the user, workspace membership, allowed roles, and the project's workspace before a repository query proceeds. Typed authorization failures distinguish unauthenticated, forbidden, and not-found outcomes for route mapping, while tenant-sensitive lookups return a non-disclosing not-found result when revealing existence would cross a workspace boundary.

Repositories are server-only, typed from the generated database schema, and bounded. They select explicit columns and cap collection sizes for the demo workspace/project lookup, project overview, items, item dependencies, source updates, impact runs and proposals, and operations. UI modules receive repository results rather than a privileged client, unrestricted query builder, or `select('*')` response.

Project-record operations derive the current user from verified claims inside the authorizer; no user ID comes from form or model input. Mutations require owner, admin, or member membership, while viewers retain read access. Every query carries explicit workspace and project filters. Item updates also filter by the submitted positive version, and a zero-row update is a conflict rather than an overwrite. The database owns the next version. Dependency creation first resolves both endpoints inside the authorized project, then relies on composite foreign keys and self/duplicate constraints as defense in depth.

### Evidence and model output

`POST /api/projects/[projectId]/analyze` is the only Prompt 7 model boundary. It accepts a strict, bounded source object (`title`, allowlisted `type`, `author`, optional timestamp, and text) plus an optional maximum graph depth. The route requires a verified contributor role and returns private, non-cacheable JSON. Oversized bodies, unsupported media types, unknown fields, malformed JSON, and invalid project IDs fail before orchestration.

Analysis is intentionally two stage:

1. GPT-5.6 Luna extracts at most one candidate change from the untrusted source and a bounded canonical snapshot of one project.
2. Application code postvalidates that change, runs the pure deterministic graph traversal, and gives the second model call only the validated change, deterministic paths, and bounded current values needed to draft inert recovery actions.

The model is a constrained interpreter and drafting assistant. It does not authorize users, traverse dependencies, call tools, persist records directly, approve actions, or mutate project data. Both logical calls use the OpenAI Responses API from a server-only adapter with `OPENAI_MODEL` (default `gpt-5.6-luna`), strict Zod-backed structured output, `store: false`, low reasoning effort, an empty tools list, bounded prompts and output tokens, a 30-second timeout per call, and at most one SDK retry per call for transient provider failures. There is no application retry loop.

The extraction prompt labels source text as untrusted evidence and instructs the model to ignore embedded instructions, use only supplied item IDs, quote exact evidence, and surface ambiguities rather than guess. The proposal prompt treats all values as data, makes deterministic impacts authoritative, and allowlists only `update_item_field`, `create_task`, `create_risk`, and `request_confirmation`. Metadata contains stage/version and internal record IDs only; raw source text, credentials, and source secrets are excluded.

Strict output parsing is only the first gate. Application postvalidation rejects unknown target or impact IDs, unsupported fields, invalid enums/dates/owners, no-op values, impossible date ranges, evidence that is not an exact source substring/span, and mismatched impact annotations. Canonical current state replaces a model-supplied previous value; a mismatch is retained as an explicit review reason. Low confidence, warnings, unresolved references, ambiguities, and all otherwise valid changes still require human confirmation. Validation is all-or-nothing, so malformed or partially valid model output creates no derived records.

### Analysis request and response shape

The following redacted examples describe the wire shape only; bracketed IDs/text and zero token counts are placeholders, not credentials or reusable production data.

```json
{
  "source": {
    "title": "<redacted update title>",
    "type": "pasted_update",
    "author": "<redacted author>",
    "timestamp": "2026-07-18T09:00:00+08:00",
    "text": "<redacted untrusted source text>"
  },
  "maxDepth": 5
}
```

```json
{
  "status": "completed",
  "duplicate": false,
  "analysisRequestId": "<uuid>",
  "sourceDocumentId": "<uuid>",
  "changeEventId": "<uuid>",
  "impactRunId": "<uuid>",
  "proposalId": "<uuid>",
  "model": "gpt-5.6-luna",
  "modelCalls": {
    "extraction": {
      "requestId": null,
      "responseId": "<provider-response-id>",
      "model": "gpt-5.6-luna",
      "usage": {
        "inputTokens": 0,
        "cachedInputTokens": 0,
        "cacheWriteInputTokens": 0,
        "outputTokens": 0,
        "reasoningOutputTokens": 0,
        "totalTokens": 0
      }
    },
    "proposal": {
      "requestId": null,
      "responseId": "<provider-response-id>",
      "model": "gpt-5.6-luna",
      "usage": {
        "inputTokens": 0,
        "cachedInputTokens": 0,
        "cacheWriteInputTokens": 0,
        "outputTokens": 0,
        "reasoningOutputTokens": 0,
        "totalTokens": 0
      }
    }
  },
  "validationOutcome": "needs_review"
}
```

Fresh success returns `201`. Duplicate in-progress requests return `202` with a short retry hint; an already completed key returns `200` with its existing record IDs; a failed duplicate returns a safe `409` conflict. Provider usage can be `null` when the provider does not return usage data, and duplicate-success responses omit model-call metadata because no call occurred. Error responses expose stable user-safe codes, not database/provider internals or source text.

The accepted route input is a strict object: `source.title` is 1–240 characters, `source.type` is `pasted_update` or `manual_note`, `source.author` is 1–120 characters, optional `source.timestamp` is a timezone-qualified ISO timestamp or `null` and defaults to `null`, `source.text` is 1–12,000 characters, and `maxDepth` is an integer from 1 through 20 with a default of 5. The encoded JSON body is capped at 24,000 bytes. Unknown keys are rejected.

The first strict model result contains either one candidate `change` or `null`, plus bounded `ambiguities`, `unresolvedReferences`, and `warnings` arrays. A candidate change must contain a supplied target UUID; one allowlisted field; previous and proposed JSON scalar values; an exact evidence excerpt with either two valid offsets or two null offsets; and confidence from 0 through 1. The schema permits `null` so the model is never forced to fabricate a change; the current service stops before proposal drafting and returns a safe model-validation failure for that result.

The second strict model result contains a bounded title/rationale, exactly one annotation for every deterministic affected item, and one through eight inert actions. Actions are limited to `update_item_field`, `create_task`, `create_risk`, and `request_confirmation`; every action links to the changed item or a deterministic impact. The application validates this shape again against canonical state before serialization, and the finalization RPC independently validates the serialized database contract.

### Deterministic impact

Store explicit directed dependency edges. Domain code traverses those edges from the reviewed changed record, records direct versus downstream depth, prevents cycles, and returns one deterministic full path for every affected item. The model does not choose graph reach.

The general project graph loader selects only one authorized project's active item IDs (`not_started`, `in_progress`, `blocked`, or `at_risk`) and dependency fields, then normalizes them into types that do not expose Supabase response objects. It pages deterministically and fails closed above the P0 bounds of 500 active items or 2,000 edges rather than traversing truncated state. Prompt 7's analysis-context loader uses the stricter 200-item/1,000-edge bounds documented below. No network or model call occurs inside traversal.

Traversal builds adjacency from each upstream `to_item_id` to dependent `from_item_id`. It ignores self-loops, inactive endpoints, and duplicate endpoint pairs. A breadth-first work queue and best-depth map retain the shortest path, terminate cycles, and deduplicate affected items. Adjacency lists and final results use stable item-ID ordering, making equal-depth path selection reproducible. The configurable maximum depth defaults to 5 and is bounded at 20 by validation.

### Analysis idempotency and persistence

Analysis uses two related hashes without changing the original evidence. The normalized source hash is SHA-256 over NFC-normalized text with normalized line endings, trimmed line edges, collapsed horizontal whitespace, and trimmed outer whitespace. Raw text is stored unchanged. The project revision is SHA-256 over the current workflow generation, a stable representation of active item IDs and versions, and normalized dependency endpoint pairs. Relationship labels do not affect reachability revision because traversal deduplicates the same endpoint pair. Including the generation prevents a restored post-reset fixture from reusing an archived analysis claim with otherwise identical graph state. The application and database must compute the same revision contract.

`(workspace_id, project_id, project_revision, normalized_content_sha256)` is the unique analysis key. The request-scoped client first verifies a non-anonymous contributor and loads one bounded project context. Only then is the privileged persistence capability initialized. A service-role-only `begin_project_analysis` wrapper passes that verified actor to a private implementation, which independently rechecks contributor membership, project scope, hashes, bounds, and the current revision before storing immutable evidence and a `processing` claim. Transaction-scoped advisory locks serialize the shared source key and actor rate check. At most five new claims per actor and project are accepted in a rolling ten-minute window; duplicate keys return the existing state and IDs without another model call.

Evidence/claim creation is deliberately committed before model work so the original source and attempt remain auditable even when the provider refuses, times out, or returns invalid output. A failure transition records only an allowlisted stage/code and optional bounded provider request ID, never raw provider output or source text.

After both model calls and all application checks succeed, `complete_project_analysis` passes the same verified actor into a private implementation, locks the claim and graph tables against concurrent record writes, reauthorizes claim ownership/membership, recomputes the project revision, rechecks the changed item/version/current value, independently recomputes deterministic impact paths, and validates the entire derived payload. It then creates the pending change event, impact run/items, proposal/actions, and succeeds the claim in one transaction. Any invalid element aborts the entire finalization; there are no partially written derived records. Public wrappers are `SECURITY INVOKER`, require a service-role JWT, and grant execution only to `service_role`; the validation implementations are private `SECURITY DEFINER` functions with empty `search_path`, fully qualified relations, and exact grants. Authenticated and anonymous browser roles cannot execute the persistence RPCs.

### Cost and abuse controls

- The route caps the encoded request body at 24,000 bytes and source text at 12,000 characters.
- Analysis context is limited to 200 active items and 1,000 dependencies for one authorized project; graph loading fails closed above the bound.
- Extraction and proposal responses are capped separately at 2,048 and 4,096 output tokens.
- Low reasoning effort, no tools, no web/file search, no embeddings, no RAG, no background jobs, and no model-driven loops keep calls predictable.
- Duplicate claims and the per-actor rolling rate limit run before either provider call.
- Exactly two logical model calls are required for a successful new analysis. A validation/provider failure stops the pipeline. Because each logical call permits one transient SDK retry, a successful analysis can make two to four provider attempts; no model-driven or application retry loop can exceed that bound.

### Prompt 7 threat model

- **Cross-tenant or forged identifiers:** request-scoped application authorization runs before privileged persistence or model work, every context query carries workspace/project scope, model IDs must come from the supplied context, and the private persistence implementations recheck the passed actor's contributor membership, claim ownership, and tenant scope. Public RPC execution is service-role-only.
- **Prompt injection through pasted evidence or project text:** prompts mark all supplied values as data, the Responses requests expose no tools, strict schemas allow no executable payload, deterministic traversal ignores model graph claims, and postvalidation rejects IDs, fields, values, and evidence not grounded in canonical input.
- **Replay, duplicate spend, and request floods:** the database owns the unique project-revision/source-hash claim, transaction advisory locks serialize duplicate and actor-rate decisions, and a five-new-claims/10-minute actor/project limit runs before provider work. This is a P0 abuse control, not a substitute for deployment-level traffic and account controls.
- **Stale state and partial persistence:** finalization locks the claim, recomputes project revision and deterministic paths, rechecks item version/current value, and atomically writes all derived records or none. Evidence and the claim intentionally survive provider or finalization failure for auditability.
- **Secret or sensitive-data leakage:** OpenAI and service-role credentials are server-only and excluded from prompts and metadata. The model receives only one bounded project snapshot needed for the analysis. Safe failure records contain an allowlisted stage/code and optional provider request ID, never raw provider output.
- **Model-caused mutation:** the model adapter has no tools, proposal actions persist only as `pending`, the analysis route has no project-item write operation, and the Prompt 9 operation service reauthorizes and revalidates each selected action before any mutation.

Residual operational risks are tracked rather than hidden: a request without a trustworthy `Content-Length` is size-checked after `Request.text()` has read it, so the deployment must also enforce an upstream request-body limit; a failure while recording a terminal failure can leave a visible `processing` claim for operator reconciliation; and per-actor limits do not replace workspace-wide abuse monitoring. Linked migrations and RLS/grant behavior are verified. One funded live request and the authenticated browser flow remain explicit release gates in the QA checklist.

### Approval and mutation

A recovery action is immutable proposal data until a person selects it. Prompt 7 stores model `update_item_field` as database `update_item`; `create_task` and `create_risk` as `create_item` with an explicit `item_type`; and `request_confirmation` as its dedicated inert action. Unsupported action types are rejected, never coerced. All new proposal actions are `pending` and have no mutation privilege.

The Prompt 9 operation routes are:

- `POST /api/projects/[projectId]/proposals/[proposalId]/apply`
- `GET /api/projects/[projectId]/operations?limit=25&includeArchived=false`
- `POST /api/projects/[projectId]/operations/[operationId]/undo`
- `POST /api/projects/[projectId]/demo/reset`

All return private, no-store JSON. POST bodies are strict and bounded. Apply accepts only selected action UUIDs, zero or more matching explicit human responses, and an idempotency key. Undo accepts only an idempotency key. Reset accepts only an explicit `confirmed: true` and an idempotency key. Path identifiers cannot be overridden in a body, and unknown keys are rejected.

Owner/admin authorization runs with the request-scoped client before the privileged executor is initialized. A public `SECURITY INVOKER` wrapper is executable only by `service_role` and delegates to a private, empty-`search_path`, fully qualified implementation. The implementation independently rechecks the verified actor, workspace/project/proposal ownership, action state, payload allowlist, required human input, current item version, and idempotency fingerprint. The service-role boundary is therefore a constrained transaction capability, not an authorization substitute.

Exactly four proposal action forms can execute:

1. update one allowlisted project-item field with its expected version;
2. create one constrained task;
3. create one constrained risk;
4. append a confirmation activity with explicit human input when required.

No operation action can delete data, edit membership, add or remove dependency edges, run arbitrary patches or SQL, or call an external system. Selected actions execute in immutable proposal ordinal order. Their approval and application transitions, project mutations, operation header, and ordered item-level audit records commit in one database transaction or none do. The apply route accepts only `pending` actions and moves each selected action `pending -> approved -> applied`; an unselected action remains `pending`, and a `rejected`, `applied`, or `stale` action can never be revived through apply. The proposal becomes `partially_approved` while pending actions remain and `applied` when none remain. Expected validation/business failures produce append-only terminal safe `failed` records with allowlisted codes. An unexpected database exception rolls back atomically and returns a generic error, but may leave no failed audit row; there is still no externally visible half-applied state.

Idempotency is scoped to the project operation and stores a deterministic request fingerprint. Repeating the same key and request returns the original operation ID without reapplying effects. Reusing that key for a different payload conflicts. Per-target locks, expected versions, and current-value checks prevent a stale reviewer action from overwriting newer work.

### Undo and reset

Undo creates a compensating operation; it does not erase history. P0 marks an apply operation reversible only when every selected mutating action is a reversible field update. Task/risk creation and confirmation activity are deliberately nonreversible, so any operation containing them cannot be undone. A reversible undo groups records by item, locks every target, checks the item's final resulting version plus the latest recorded after-state for each affected field, and only then applies reverse payloads in descending original ordinal order. This sequence-safe policy supports multiple updates to one item. A mismatch returns a bounded undo conflict without partial reversal. The new operation points to the original through `reverses_operation_id`; repeat requests are idempotent, only one successful reversal can exist, and `undo` or `demo_reset` operations can never be undo targets.

Demo reset is restricted to an owner/admin, the configured `DEMO_PROJECT_SLUG`, and a project explicitly marked as the demo. `DEMO_RESET_SECRET` is validated only as server-held configuration after authorization and before privileged initialization. No caller supplies it through a browser, URL, header, JSON body, RPC argument, audit record, or log. The RPC independently rechecks the actor, named slug, demo marker, baseline availability, and reset rate limit.

Reset preserves history with a monotonically increasing `projects.workflow_generation`. Workflow records and operations are tagged with the generation in which they were created. Reset writes its own operation in the closing generation, restores the exact seeded items and 26 dependency edges, retires rather than deletes nonbaseline demo items, and then advances the project generation. Normal history and planning reads select the current generation; an explicit bounded `includeArchived=true` history read can include earlier generations. Replaying the same idempotency key is stable, while a distinct immediate reset is rate-limited. No evidence or operation row is erased.

## Security invariants

- Service-role and OpenAI keys remain server-only.
- RLS applies to all user-scoped tables.
- Model output never directly mutates data.
- Public demo data is synthetic.
- Authorization and approval checks fail closed.

## Implemented backend modules

- `src/lib/supabase/`: typed browser and server clients.
- `src/lib/auth/`: identity, redirect validation, authorization guards, and typed errors.
- `src/lib/repositories/`: bounded, explicit-column server-side reads.
- `src/features/analysis/`: bounded intake, context revision, model adapters/prompts, postvalidation, orchestration, persistence mapping, and route response handling.
- `src/features/project-records/`: strict schemas, authorized operations, scoped persistence, and safe database-error mapping.
- `src/features/impact/`: pure dependency graph traversal, schemas, and the project-scoped loader.
- `src/features/proposals/`: recovery drafts and per-action approval state.
- `src/features/operations/`: authorized application, history, undo, and reset.
- `supabase/migrations/`: schema, constraints, functions, and RLS policies.

The Supabase, authentication, repository, project-record, and deterministic-impact paths were implemented through Prompt 5. Prompt 7 adds the server-only evidence/analysis pipeline and pending proposal persistence. Prompt 9 adds the approval/application, ordered operation history, compensating undo, and history-preserving demo-reset backend contracts. Linked migrations, schema/security checks, and rollback-wrapped RPC/audit verification are complete. Complete browser wiring and authenticated HTTP verification remain integration tasks.

## P0 database model

The database is workspace-scoped and uses UUID primary keys throughout. `profiles` are durable attribution identities; a profile ID normally matches an Auth user ID, but there is intentionally no destructive foreign key from `profiles` to `auth.users`. The Auth trigger provisions a profile for a new real user, while the synthetic fixture can exist without creating login credentials.

The core hierarchy is `workspaces` → `projects` → canonical `project_items`. `workspace_members` assigns owner, admin, member, or viewer access. One `project_items` table represents tasks, milestones, decisions, events, risks, and artifacts. Each item has a database-maintained positive `version`; every update increments it, so mutation services must compare their expected version before writing.

Evidence and planning use `source_documents`, `analysis_requests`, `change_events`, `impact_runs`, `impact_items`, `action_proposals`, and `proposal_actions`. Raw source documents are append-only. `analysis_requests` stores the project-revision/source-hash claim and its one-way processing-to-succeeded/failed lifecycle without storing raw model output. Impact records store deterministic paths and depth; proposals and actions remain inert until reviewed.

Operations use append-only `operation_logs` and `operation_items`. Successful and expected-rejection operation headers are inserted only in a terminal state inside the same transaction as their effects or rejection decision. Unexpected database exceptions may roll back before a failed header can persist. A request hash binds an idempotency key to one normalized request. Each selected action receives a stable ordinal and can record expected/resulting versions, before/after snapshots, an explicit reverse payload, reversibility, and a safe error code. Undo is a new compensating operation referencing the original; it never updates or deletes history. `activity_events` is append-only supplemental dashboard context.

Composite foreign keys carry `workspace_id` and `project_id` through every project-owned domain relationship. This prevents project records and dependency edges from crossing tenant or project boundaries. An item's optional owner additionally has a composite foreign key to `workspace_members`, so direct database clients cannot assign a profile from another workspace. Other profile references remain durable attribution identities and do not grant membership. RLS and guarded review transitions establish authorization, while identity triggers prevent rewriting tenant scope or historical attribution. Core and audit parents use restrictive deletion rather than cascades that erase evidence or operation history.

### Dependency direction

`item_dependencies.from_item_id` is always the dependent item. `to_item_id` is always its upstream prerequisite or context item. Downstream traversal therefore starts at a changed item and follows rows whose `to_item_id` is the current node to each `from_item_id`. Relationship labels (`depends_on`, `requires`, `informs`, and `scheduled_by`) are phrased consistently with that direction. Self-edges and duplicate typed edges are database constraints.

The returned path begins with the changed item and ends with the affected item. `depth` is `path.length - 1`; depth 1 is direct and greater depths are indirect. Results are ordered first by depth and then by item ID. If two shortest paths reach the same item, sorted traversal retains the lexically earliest path.

### RLS strategy

RLS is enabled on every public user-facing table and no anonymous table privileges are granted. Authenticated privileges are explicitly revoked and then granted per table because current Supabase projects do not auto-expose new public tables. Policies deny by default:

- members of any role can read their workspace;
- viewers cannot mutate records;
- members can manage ordinary project records, while project deletion is owner/admin only;
- owner/admin access is required for reviewed changes, impacts, proposals, operations, activity, and membership administration;
- admins can manage only member/viewer membership rows; owners manage privileged roles, and a trigger prevents removing or demoting the final owner;
- derived change, impact, proposal, operation, and activity rows are inserted only by server-side orchestration; authenticated reviewers can only confirm/reject pending changes and approve/reject pending proposal actions;
- analysis evidence/claims and derived records are created only through the exact authenticated analysis RPC signatures; direct authenticated inserts are revoked, the functions recheck caller/project role, and finalization accepts only comprehensively validated inert JSON;
- no policy encodes an anonymous or service-role client bypass.

The private membership predicates are stable `SECURITY DEFINER` functions used to avoid recursive membership-policy evaluation. They have an empty `search_path`, fully qualified relations, explicit `auth.uid()` checks, and an `is_anonymous` JWT rejection because Supabase anonymous Auth users otherwise assume the `authenticated` Postgres role. Anonymous/public execution is revoked and only minimum authenticated execution is granted. Trigger functions have no API-role execution grants. Explicit `service_role` object grants support the server-only client, but the service-role key remains forbidden from browser code and server orchestration must still recheck user authorization.

### Demo seed and verification

`supabase/seed.sql` contains deterministic UUIDs for the fictional eight-person Civic Futures Lab and the Regional Climate Action Summit 2026. It creates no Auth users or credentials. The project has 24 items, 26 directed relationships, the 2026-09-12 baseline event date, and the required event → speaker confirmation → programme lock → briefing pack path. `npx supabase db reset` reconstructs the fixture for local development. The Prompt 9 production-safe reset uses a reviewed named-project RPC, baseline snapshots, workflow generations, non-destructive retirement, idempotency, and rate limiting instead of deleting history.

The transaction-wrapped `supabase/tests/verify_p0.sql` checks seed counts and the expected path, anonymous and cross-workspace invisibility, viewer mutation denial, cross-workspace owner rejection, reviewer attribution, immutable record identity, server-only audit writes, the self-dependency constraint, and operation idempotency uniqueness, then rolls back its test rows. It is plain assertion SQL, not pgTAP.

Local `db reset` and CLI pgTAP execution still require Docker Desktop.

Database types are generated from the linked hosted schema with:

```bash
npx supabase gen types typescript --linked --schema public > src/types/database.ts
```
