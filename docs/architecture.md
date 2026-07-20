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

### CI-only browser seam

`/__e2e__/core-demo` is a guarded server-rendered fixture for Playwright. Next treats underscore-prefixed source folders as private, so a minimal encoded route segment delegates to the canonical fixture page. Access is allowed only when the runtime is `development` or `test` and the exact test opt-in is `1`; production returns not found even if an operator sets the flag. The flag is intentionally absent from `.env.example` and is not a deployment variable.

The page renders the real `ImpactWorkflow`, approval, audit, undo, and reset components with conspicuously labeled, deterministic synthetic records. An HTTP-only stage cookie changes fixture presentation after Playwright intercepts the four existing API seams. Tests parse every intercepted body with the production Zod schemas and abort unexpected project API requests. No production auth, proxy, API route, Supabase, OpenAI, RLS, or operation implementation contains a fixture switch, and a static boundary test enforces that separation. This seam proves browser contract integration only; the live production smoke remains separate.

### Project-view presentation boundary

The authenticated project-management shell exposes one consistent route set:

- `/app` is the project overview and guided entry point;
- `/app/items` is the filterable project-item table/card view;
- `/app/items/[itemId]` is the item detail and edit view;
- `/app/decisions` and `/app/risks` are focused projections of the same project records; and
- `/app/dependencies` is the text-first dependency inspector and relationship editor. An optional `item` query selects the record opened from an item detail view.

Server Components load the current authorized project through the existing bounded, RLS-scoped repositories and validated project-record operations. They pass only serializable view data to interactive Client Components. Search, filters, selected tabs/items, and dialog visibility are local presentation state; the browser does not keep a second canonical project fixture. Create, edit, add-relationship, and remove-relationship controls submit to the existing validated server actions, and refreshed server state remains authoritative. Loading, empty, validation-error, permission, success, and optimistic-version conflict states are presented explicitly.

Dependency language follows the database contract exactly: `from_item_id` is the dependent item and `to_item_id` is its upstream prerequisite or context. A selected item's **Depends on** section contains edges whose `from_item_id` is that item; its **Affects** section contains downstream items from edges whose `to_item_id` is that item. The relationship editor asks for the dependent item first, previews the sentence “dependent item depends on upstream prerequisite,” and preserves the existing relationship enum. This presentation does not redefine graph reachability or traversal semantics.

The dependency experience is deliberately text-first: labeled item controls, complete relationship sentences, item keys, relationship names, rationales, and separate upstream/downstream lists carry the meaning. Arrows, color, and status marks are supplementary, not the only signal. Tables yield to labeled cards on small screens, controls retain visible focus, modal interactions return focus, and the shell must not create horizontal page overflow at 375 pixels.

The guided callout labels the workspace and records as synthetic and derives its destinations from the server-loaded seed. The current canonical seed contains no sponsor record or sponsor relationship, so the interface states that limitation and does not fabricate either. This branch adds presentation and route wiring only: it does not change SQL, RLS, authorization, OpenAI integration, project-record contracts, operation logic, dependency edge meaning, or deterministic traversal.

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

The model is a constrained interpreter and drafting assistant. It does not authorize users, traverse dependencies, call tools, persist records directly, approve actions, or mutate project data. Both logical calls use the OpenAI Responses API from a server-only adapter with `OPENAI_MODEL` (default `gpt-5.6-luna`), strict Zod-backed structured output, `store: false`, low reasoning effort, an empty tools list, bounded prompts and output tokens, a 30-second timeout per call, and SDK/request retries disabled. There is no application retry loop.

The canonical context loader still fails closed above 200 active items or 1,000 edges. Before either prompt is built, a pure deterministic projection limits each item description to 500 characters and all item descriptions to 15,000 characters, marks every truncated description, and rejects an encoded item projection above 160,000 bytes. Extraction does not receive dependency rows because the model does not traverse the graph. The second call receives only bounded affected-item values plus application-computed paths. Canonical database rows are never truncated or rewritten by this projection.

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

Fresh success returns `201`. Duplicate in-progress requests return `202` with the remaining database lease as `Retry-After`; the browser tells the user to resubmit the exact update after that delay so the POST boundary can reconcile it. An already completed key returns `200` with its existing record IDs; a failed duplicate returns a safe `409` conflict. Provider usage can be `null` when the provider does not return usage data, and duplicate-success responses omit model-call metadata because no call occurred. Error responses expose stable user-safe codes, not database/provider internals or source text.

The accepted route input is a strict object: `source.title` is 1–240 characters, `source.type` is `pasted_update` or `manual_note`, `source.author` is 1–120 characters, optional `source.timestamp` is a timezone-qualified ISO timestamp or `null` and defaults to `null`, `source.text` is 1–12,000 characters, and `maxDepth` is an integer from 1 through 20 with a default of 5. The encoded JSON body is capped at 24,000 bytes. Unknown keys are rejected.

The first strict model result contains either one candidate `change` or `null`, plus bounded `ambiguities`, `unresolvedReferences`, and `warnings` arrays. A candidate change must contain a supplied target UUID; one allowlisted field; previous and proposed JSON scalar values; an exact evidence excerpt with either two valid offsets or two null offsets; and confidence from 0 through 1. The schema permits `null` so the model is never forced to fabricate a change; the current service stops before proposal drafting and returns a safe model-validation failure for that result.

The second strict model result contains a bounded title/rationale, exactly one annotation for every deterministic affected item, and one through eight inert actions. Actions are limited to `update_item_field`, `create_task`, `create_risk`, and `request_confirmation`; every action links to the changed item or a deterministic impact. The application validates this shape again against canonical state before serialization, and the finalization RPC independently validates the serialized database contract.

### Deterministic impact

Store explicit directed dependency edges. Domain code traverses those edges from the reviewed changed record, records direct versus downstream depth, prevents cycles, and returns one deterministic full path for every affected item. The model does not choose graph reach.

The general project graph loader selects only one authorized project's active item IDs (`not_started`, `in_progress`, `blocked`, or `at_risk`) and dependency fields, then normalizes them into types that do not expose Supabase response objects. It pages deterministically and fails closed above the P0 bounds of 500 active items or 2,000 edges rather than traversing truncated state. Prompt 7's analysis-context loader uses the stricter 200-item/1,000-edge bounds documented below. No network or model call occurs inside traversal.

The dependency-management page uses a separate bounded repository query that currently returns at most 500 rows without a truncation indicator. This does not truncate the analysis or impact graph loaders, but a larger project's management UI could omit later dependencies silently. The P0 fixture has 26 edges; until pagination and an explicit completeness signal are added, the UI is supported only within that bound and must not be presented as a complete large-project dependency inventory.

Traversal builds adjacency from each upstream `to_item_id` to dependent `from_item_id`. It ignores self-loops, inactive endpoints, and duplicate endpoint pairs. A breadth-first work queue and best-depth map retain the shortest path, terminate cycles, and deduplicate affected items. Adjacency lists and final results use stable item-ID ordering, making equal-depth path selection reproducible. The configurable maximum depth defaults to 5 and is bounded at 20 by validation.

### Analysis idempotency and persistence

Migration `20260719120000_preserve_analysis_provenance_and_supersede_stale_proposals` separates the canonical revision/hash claim from evidence provenance. `analysis_requests` remains the single provider-spend/idempotency claim for one current-generation project revision and normalized input, while immutable `analysis_request_sources` links every distinct attributable source capture to that claim. An exact replay returns the same claim and adds at most one link for the same capture; a materially distinct capture with the same normalized input is preserved as additional provenance rather than creating another provider claim. The same immutable capture can link to a fresh claim after the project revision changes. Rate-limited calls have no claim and create no orphan capture/link.

Every active item version and normalized dependency endpoint pair participates in the project revision. Ready and partially approved proposals are therefore closed when any project item or dependency changes in the current generation. An apply transaction may mutate an item itself; its final locked state reconciliation preserves only that explicitly approved proposal's progress, while other live proposals remain superseded. Historic live proposals are closed conservatively because they lack a trustworthy context snapshot. Applied operations and append-only evidence/history are not rewritten; fresh analysis creates a current proposal.

When a proposal's final transaction state is `superseded`, an initially deferred constraint trigger changes only still-live `pending` or `approved` child actions to `stale`. Pending actions remain unattributed; approved actions retain their real reviewer and timestamp. Rejected, applied, and already-stale history is unchanged. The trigger re-reads the parent at commit time because an apply transaction temporarily supersedes its own proposal while changing a project item, then reconciles that parent to its intended non-superseded terminal state.

The application native project-record write path uses `mutate_project_item_create`, `mutate_project_item_update`, `mutate_project_dependency_create`, and `mutate_project_dependency_remove`. Every RPC independently rejects anonymous/viewer/nonmember callers, locks the same project row used by apply and reset, validates an explicit allowlist and project-owned references, and checks the server-rendered expected workflow generation. A private append-only ledger binds one workspace/idempotency key to the actor and canonical request hash. Exact successful replay is returned before mutable owner validation and generation comparison, including after reset; a stale first attempt fails without consuming the key, and a same-key different request conflicts. Mutation and receipt commit atomically.

The database permission change uses expand/deploy/contract. Migration `20260719140000` installs the RPC/ledger path but deliberately retains the prior contributor DML policies and grants while the pre-RPC production artifact is still schema-compatible. That artifact is not generation-safe because its direct writes do not check `workflow_generation`; reset must be blocked for the entire interval in which it is served, or every native mutation surface must be contained. After the exact RPC application is deployed and all four mutations plus replay are verified, a separate forward contract migration removes those policies and every table- and column-level write grant. The two migrations must never be pending in the same `db push`. This rollout completed with separately approved migration `20260720190000`; hosted verification proves direct DML is denied while the four RPCs, replay, and member reads remain available. Only RPC-capable deployments are now valid rollback targets.

Analysis uses two related hashes without changing the original evidence. The normalized source hash is SHA-256 over NFC-normalized text with normalized line endings, trimmed line edges, collapsed horizontal whitespace, and trimmed outer whitespace. Raw text is stored unchanged. The project revision is SHA-256 over the current workflow generation, a stable representation of active item IDs and versions, and normalized dependency endpoint pairs. Relationship labels do not affect reachability revision because traversal deduplicates the same endpoint pair. Including the generation prevents a restored post-reset fixture from reusing an archived analysis claim with otherwise identical graph state. The application and database must compute the same revision contract.

`(workspace_id, project_id, project_revision, normalized_content_sha256)` is the unique analysis key. The request-scoped client first verifies a non-anonymous contributor and loads one bounded project context. Only then is the privileged persistence capability initialized. A service-role-only `begin_project_analysis` wrapper passes that verified actor to a private implementation, which independently rechecks contributor membership, project scope, hashes, bounds, and the current revision before storing immutable evidence and a `processing` claim. Each claim receives one immutable, nonrenewable three-minute database lease—twice the route's 90-second maximum. Transaction-scoped advisory locks serialize the shared source key and actor rate check. At most five new claims per actor and project are accepted in a rolling ten-minute window; duplicate keys return the existing state and IDs without another model call. An exact POST replay while the lease is active returns its bounded remaining delay. The first exact replay after expiry locks the row and atomically changes the existing request to failed with safe `persistence`/`analysis_cancelled` metadata; it never creates a new attempt, renews the lease, deletes evidence, or calls the model.

Evidence/claim creation is deliberately committed before model work so the original source and attempt remain auditable even when the provider refuses, times out, or returns invalid output. A failure transition records only an allowlisted stage/code and optional bounded provider request ID, never raw provider output or source text.

After both model calls and all application checks succeed, `complete_project_analysis` passes the same verified actor into a private implementation, locks the claim and graph tables against concurrent record writes, reauthorizes claim ownership/membership, recomputes the project revision, rechecks the changed item/version/current value, independently recomputes deterministic impact paths, and validates the entire derived payload. It then creates the pending change event, impact run/items, proposal/actions, and succeeds the claim in one transaction. The final state-transition guard rejects success at or after lease expiry; PostgreSQL rolls back every derived insert in that statement, so a late worker cannot beat reconciliation or leave partial records. A narrow completion trigger promotes only the exactly linked, current-generation proposal from `draft` to `ready` after confirming the change still needs confirmation, the impact run completed, and every one-to-eight action is pending and unattributed. Anomalous historical drafts stay quarantined. Readiness means eligible for human review, not approved: no action, item, or operation row changes during promotion. Any invalid element aborts the entire finalization; there are no partially written derived records. Public wrappers are `SECURITY INVOKER`, require a service-role JWT, and grant execution only to `service_role`; the validation implementations are private `SECURITY DEFINER` functions with empty `search_path`, fully qualified relations, and exact grants. Authenticated and anonymous browser roles cannot execute the persistence RPCs or directly update change/action review state.

The current completion implementation obtains whole-table `SHARE` locks on `project_items` and `item_dependencies` while it rechecks revision and persists the bounded result. That gives the P0 finalization a simple consistency fence, but it briefly serializes writes to those tables across projects and is not the intended multi-tenant scaling boundary. The small synthetic demo and bounded completion transaction limit present exposure. Before broader or higher-concurrency use, replace the table locks with measured project-scoped coordination while preserving the same revision and atomicity invariants; monitor lock waits and completion latency until that work lands.

### Cost and abuse controls

- The route streams and counts the encoded request body, cancels immediately above 24,000 bytes without trusting `Content-Length`, and caps source text at 12,000 characters. Operation routes use the same reader with a 32,000-byte cap.
- Analysis context is limited to 200 active items and 1,000 dependencies for one authorized project; graph loading fails closed above the bound.
- Model-item descriptions are capped at 500 characters each and 15,000 characters in aggregate, with a 160,000-byte encoded item-context ceiling.
- Extraction and proposal responses are capped separately at 2,048 and 4,096 output tokens.
- Low reasoning effort, no tools, no web/file search, no embeddings, no RAG, no background jobs, and no model-driven loops keep calls predictable.
- Duplicate claims and the per-actor rolling rate limit run before either provider call.
- Exactly two logical model calls and two provider attempts are required for a successful new analysis. A validation/provider failure stops the pipeline. SDK/request retries and model-driven/application retry loops are disabled.

### Deployment and readiness boundary

The Build Week deployment target is one manually operated Vercel Hobby project with Fluid Compute explicitly enabled. There is no Git-connected automatic deployment. Deston deploys a clean reviewed `main` through the CLI and records the exact source SHA without rewriting another contributor's author or committer metadata. Preview deployments do not receive production Supabase, service-role, reset, or OpenAI values by default.

`GET /api/health` is a no-store, no-spend configuration-readiness endpoint. It checks only whether the required environment names parse; it does not call OpenAI, query Supabase, validate a credential by using it, reveal a value, or claim the authenticated workflow passed. Readiness and runtime share the same schemas: a remote Supabase URL must be unpadded HTTPS, plaintext HTTP is accepted only for exact loopback development hosts, embedded URL credentials are rejected, keys/secrets/slugs must be nonblank and unpadded, and an omitted model uses the documented trimmed default while a whitespace-only model fails. Complete configuration returns `200 ready`; a missing or invalid name returns a generic `503 not_ready` status. The server log includes only the allowlisted missing/invalid names needed by the operator, never their values, the source body, provider output, credentials, authorization headers, or cookies.

The analysis route uses the Node.js runtime and an application `maxDuration` of 90 seconds. Vercel's currently supported Hobby Fluid maximum is 300 seconds, so 90 seconds is a conservative application budget rather than the plan ceiling. The two sequential OpenAI calls each have a 30-second internal timeout with SDK/request retries disabled, leaving about 30 seconds for authorization, deterministic graph work, persistence, and safe failure recording. Other mutation/history routes use a 30-second duration. No route introduces background work, and the OpenAI client remains lazy so `next build` and Vercel's build phase cannot contact the provider.

The configured model defaults to `gpt-5.6-luna`. After authorization and bounded-context validation but before the database creates an idempotency claim, the service validates and resolves the lazy model environment and fails with a safe unavailable result if required model configuration is absent; configuration failure therefore consumes no claim. Safe response and persisted model-call metadata retain the actual model identifier returned by the provider so release evidence does not silently substitute the requested name. The private metadata validator accepts the current exact envelope and the prior artifact's exact envelope during the rollback compatibility window, without fabricating a historical model name; unknown fields and malformed present model names remain rejected. This metadata never grants mutation authority and excludes prompts, source text, provider output, and keys.

The required hosted Supabase Auth state uses `https://inordo.vercel.app` as Site URL. Its redirect allowlist contains `https://inordo.vercel.app/**`, the `http://localhost:3000/**` and `http://127.0.0.1:3000/**` local paths, and the account-scoped Vercel Preview wildcard documented in `docs/deployment-runbook.md`; saving and re-verifying that renamed production configuration remains an operator gate. The local CLI config uses `http://localhost:3000` and both local HTTP wildcards; it never uses `https://127.0.0.1`. Full release, smoke, rollback, and environment-scope procedures live in the runbook. The Git-revert fallback first proves that the exact target belongs to synchronized `main`, then inventories migrations against the same explicit mainline parent passed to `git revert -m`; ordinary commits reject a mainline value, while roots, octopus merges, and disconnected commits stop for a separate reviewed plan. Explicit ordinary/merge command branches remain compatible with macOS system Bash 3.2.

### Prompt 7 threat model

- **Cross-tenant or forged identifiers:** request-scoped application authorization runs before privileged persistence or model work, every context query carries workspace/project scope, model IDs must come from the supplied context, and the private persistence implementations recheck the passed actor's contributor membership, claim ownership, and tenant scope. Public RPC execution is service-role-only.
- **Prompt injection through pasted evidence or project text:** prompts mark all supplied values as data, the Responses requests expose no tools, strict schemas allow no executable payload, deterministic traversal ignores model graph claims, and postvalidation rejects IDs, fields, values, and evidence not grounded in canonical input.
- **Replay, duplicate spend, and request floods:** the database owns the unique project-revision/source-hash claim, transaction advisory locks serialize duplicate and actor-rate decisions, the fixed lease prevents a late worker from succeeding after its deadline, and a five-new-claims/10-minute actor/project limit runs before provider work. Reconciliation terminalizes the existing claim instead of creating another model opportunity. This is a P0 abuse control, not a substitute for deployment-level traffic and account controls.
- **Stale state and partial persistence:** finalization locks the claim, recomputes project revision and deterministic paths, rechecks item version/current value, and atomically writes all derived records or none. Evidence and the claim intentionally survive provider or finalization failure for auditability.
- **Secret or sensitive-data leakage:** OpenAI and service-role credentials are server-only and excluded from prompts and metadata. The model receives only one bounded project snapshot needed for the analysis. Safe failure records contain an allowlisted stage/code and optional provider request ID, never raw provider output.
- **Model-caused mutation:** the model adapter has no tools, proposal actions persist only as `pending`, the analysis route has no project-item write operation, and the Prompt 9 operation service reauthorizes and revalidates each selected action before any mutation.

Residual operational risks are tracked rather than hidden: Vercel's outer body limit remains defense in depth while the application streams and cancels at its tighter caps; stale-claim reconciliation is demand-driven and therefore requires an exact POST replay after the displayed lease delay; and per-actor limits do not replace workspace-wide abuse monitoring. A project revision change makes the old logical claim irrelevant to new intake, but it does not rewrite that historical row. Linked migrations and RLS/grant behavior are verified. One funded live request and the authenticated browser flow remain explicit release gates in the QA checklist.

### Approval and mutation

A recovery action is immutable proposal data until a person selects it. Prompt 7 stores model `update_item_field` as database `update_item`; `create_task` and `create_risk` as `create_item` with an explicit `item_type`; and `request_confirmation` as its dedicated inert action. Unsupported action types are rejected, never coerced. All new proposal actions are `pending` and have no mutation privilege.

Successful analysis completion makes an eligible proposal `ready` so the integrated review UI can offer selective approval. The browser cannot directly approve/reject a change or proposal action: legacy authenticated review-update policies and column grants are removed. The operation transaction remains the only supported review-plus-mutation path, keeping selected action state, item mutations, and audit evidence atomic.

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

Proposal action sets are validated as a set as well as one action at a time. A proposal cannot contain two updates to the same target field, and every non-null proposed start date for one target must be on or before every non-null proposed due date for that target. The application rejects invalid model output before persistence. A private database trigger takes the proposal row lock and enforces the same invariant for every persisted action, including concurrent inserts; active legacy proposals that violate it are superseded rather than repaired or reopened. Because every persisted pair is compatible, any selectively approved subset remains date-safe without making graph traversal or a model call part of apply.

Create-task and create-risk approvals disclose the complete bounded commit contract in both the action card and final confirmation: item type, title, description, fixed initial status, priority, owner ID, start date, and due date. A successful create operation stores receipt version 2 from the committed `project_items` row, not from the model payload or caller-supplied JSON. The same canonical fields appear in the applied result and audit history. Historical receipts without the versioned payload retain their existing summary; the application does not invent missing detail or rewrite append-only history.

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

The Supabase, authentication, repository, project-record, and deterministic-impact paths were implemented through Prompt 5. Prompt 7 adds the server-only evidence/analysis pipeline and pending proposal persistence. Prompt 9 adds the approval/application, ordered operation history, compensating undo, and history-preserving demo-reset backend contracts. The protected browser workflow is integrated, and linked migrations, schema/security checks, and rollback-wrapped RPC/audit verification are complete. Authenticated live HTTP/production-browser verification remains a release task.

## P0 database model

The database is workspace-scoped and uses UUID primary keys throughout. `profiles` are durable attribution identities; a profile ID normally matches an Auth user ID, but there is intentionally no destructive foreign key from `profiles` to `auth.users`. The Auth trigger provisions a profile for a new real user, while the synthetic fixture can exist without creating login credentials.

The core hierarchy is `workspaces` → `projects` → canonical `project_items`. `workspace_members` assigns owner, admin, member, or viewer access. One `project_items` table represents tasks, milestones, decisions, events, risks, and artifacts. Each item has a database-maintained positive `version`; every update increments it, so mutation services must compare their expected version before writing.

Evidence and planning use `source_documents`, `analysis_requests`, `change_events`, `impact_runs`, `impact_items`, `action_proposals`, and `proposal_actions`. Raw source documents are append-only. `analysis_requests` stores the project-revision/source-hash claim, immutable lease deadline, and one-way processing-to-succeeded/failed lifecycle without storing raw model output. Impact records store deterministic paths and depth; proposals and actions remain inert until reviewed.

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
- derived change, impact, proposal, operation, and activity rows are inserted only by server-side orchestration; authenticated users cannot directly update change or proposal-action review state, and owner/admin review plus mutation occurs only through the constrained operation transaction;
- analysis evidence/claims and derived records are created only through the exact authenticated analysis RPC signatures; direct authenticated inserts are revoked, the functions recheck caller/project role, and finalization accepts only comprehensively validated inert JSON;
- no policy encodes an anonymous or service-role client bypass.

The private membership predicates are stable `SECURITY DEFINER` functions used to avoid recursive membership-policy evaluation. They have an empty `search_path`, fully qualified relations, explicit `auth.uid()` checks, and an `is_anonymous` JWT rejection because Supabase anonymous Auth users otherwise assume the `authenticated` Postgres role. Anonymous/public execution is revoked and only minimum authenticated execution is granted. Trigger functions have no API-role execution grants. Explicit `service_role` object grants support the server-only client, but the service-role key remains forbidden from browser code and server orchestration must still recheck user authorization.

### Demo seed and verification

`supabase/seed.sql` contains deterministic UUIDs for the fictional eight-person Civic Futures Lab and the Regional Climate Action Summit 2026. It creates no Auth users or credentials. The project has 24 items, 26 directed relationships, the 2026-09-12 baseline event date, and the required event → speaker confirmation → programme lock → briefing pack path. `npx --no-install supabase db reset` uses the repository-pinned CLI to reconstruct the fixture for local development. The Prompt 9 production-safe reset uses a reviewed named-project RPC, baseline snapshots, workflow generations, non-destructive retirement, idempotency, and rate limiting instead of deleting history.

The transaction-wrapped `supabase/tests/verify_p0.sql` checks seed counts and the expected path, anonymous and cross-workspace invisibility, viewer mutation denial, cross-workspace owner rejection, reviewer attribution, immutable record identity, server-only audit writes, the self-dependency constraint, and operation idempotency uniqueness, then rolls back its test rows. It is plain assertion SQL, not pgTAP.

Local `db reset` and CLI pgTAP execution still require Docker Desktop.

Database types are generated from the linked hosted schema with:

```bash
npx --no-install supabase gen types typescript --linked --schema public > src/types/database.ts
```
