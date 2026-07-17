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

The browser client can read only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Server environment validation is isolated from the public schema. The privileged client imports a server-only marker, reads `SUPABASE_SERVICE_ROLE_KEY` only on the server, disables session persistence, and is reserved for narrowly reviewed operations such as a future controlled demo reset. Normal authenticated reads and writes always use the user's session so RLS remains in force.

### Authorization and data access

Reusable server-only guards establish the user, workspace membership, allowed roles, and the project's workspace before a repository query proceeds. Typed authorization failures distinguish unauthenticated, forbidden, and not-found outcomes for route mapping, while tenant-sensitive lookups return a non-disclosing not-found result when revealing existence would cross a workspace boundary.

Repositories are server-only, typed from the generated database schema, and bounded. They select explicit columns and cap collection sizes for the demo workspace/project lookup, project overview, items, item dependencies, source updates, impact runs and proposals, and operations. UI modules receive repository results rather than a privileged client, unrestricted query builder, or `select('*')` response.

### Evidence and model output

Persist raw source text and provenance before interpretation. A server-only OpenAI adapter requests structured output from `OPENAI_MODEL`; Zod validates the response into a candidate change or recovery draft. Validation failure produces a reviewable error and no mutation.

### Deterministic impact

Store explicit directed dependency edges. Domain code traverses those edges from the reviewed changed record, records direct versus downstream depth, prevents cycles, and returns at least one ordered path for every affected item. The model does not choose graph reach.

### Approval and mutation

A recovery action is immutable proposal data until a person selects it. Before application, server code rechecks identity, project membership, permission, current record version, action validation, and idempotency. A successful mutation and its reversible before-state are recorded in one transaction.

### Undo and reset

Undo creates a compensating operation; it does not erase history. Demo reset is a server-only, secret-protected operation limited to the configured synthetic project slug. It must be deterministic and unable to target a non-demo project.

## Security invariants

- Service-role and OpenAI keys remain server-only.
- RLS applies to all user-scoped tables.
- Model output never directly mutates data.
- Public demo data is synthetic.
- Authorization and approval checks fail closed.

## Planned modules

- `src/lib/supabase/`: typed browser and server clients.
- `src/lib/auth/`: identity, redirect validation, authorization guards, and typed errors.
- `src/lib/repositories/`: bounded, explicit-column server-side reads.
- `src/features/evidence/`: intake, validation, and provenance.
- `src/features/impact/`: dependency graph traversal and path explanations.
- `src/features/proposals/`: recovery drafts and per-action approval state.
- `src/features/operations/`: authorized application, history, undo, and reset.
- `supabase/migrations/`: schema, constraints, functions, and RLS policies.

The Supabase, authentication, and repository paths are implemented for the read-only Prompt 3 foundation. The feature paths remain planned boundaries for later prompts. Lint, type checking, unit/static tests, and the production build pass on the branch; live login and project-load verification still require an operator-created Auth account and local environment values.

## P0 database model

The database is workspace-scoped and uses UUID primary keys throughout. `profiles` are durable attribution identities; a profile ID normally matches an Auth user ID, but there is intentionally no destructive foreign key from `profiles` to `auth.users`. The Auth trigger provisions a profile for a new real user, while the synthetic fixture can exist without creating login credentials.

The core hierarchy is `workspaces` → `projects` → canonical `project_items`. `workspace_members` assigns owner, admin, member, or viewer access. One `project_items` table represents tasks, milestones, decisions, events, risks, and artifacts. Each item has a database-maintained positive `version`; every update increments it, so mutation services must compare their expected version before writing.

Evidence and planning use `source_documents`, `change_events`, `impact_runs`, `impact_items`, `action_proposals`, and `proposal_actions`. Raw source documents are append-only. Impact records store deterministic paths and depth; proposals and actions remain inert until reviewed.

Operations use append-only `operation_logs` and `operation_items`. An operation header is inserted only in a final succeeded or failed state inside the same transaction as its effects. Each item can record expected/resulting versions, before/after snapshots, and an explicit reverse payload. Undo is a new compensating operation referencing the original; it never updates or deletes history. `activity_events` is append-only supplemental dashboard context.

Composite foreign keys carry `workspace_id` and `project_id` through every project-owned domain relationship. This prevents project records and dependency edges from crossing tenant or project boundaries. Profile references such as creator, owner, reviewer, and actor remain durable global attribution identities; they do not grant membership. RLS and guarded review transitions establish authorization, while identity triggers prevent rewriting tenant scope or historical attribution. Core and audit parents use restrictive deletion rather than cascades that erase evidence or operation history.

### Dependency direction

`item_dependencies.from_item_id` is always the dependent item. `to_item_id` is always its upstream prerequisite or context item. Downstream traversal therefore starts at a changed item and follows rows whose `to_item_id` is the current node to each `from_item_id`. Relationship labels (`depends_on`, `requires`, `informs`, and `scheduled_by`) are phrased consistently with that direction. Self-edges and duplicate typed edges are database constraints.

### RLS strategy

RLS is enabled on every public user-facing table and no anonymous table privileges are granted. Authenticated privileges are explicitly revoked and then granted per table because current Supabase projects do not auto-expose new public tables. Policies deny by default:

- members of any role can read their workspace;
- viewers cannot mutate records;
- members can manage ordinary project records, while project deletion is owner/admin only;
- owner/admin access is required for reviewed changes, impacts, proposals, operations, activity, and membership administration;
- admins can manage only member/viewer membership rows; owners manage privileged roles, and a trigger prevents removing or demoting the final owner;
- derived change, impact, proposal, operation, and activity rows are inserted only by server-side orchestration; authenticated reviewers can only confirm/reject pending changes and approve/reject pending proposal actions;
- no policy encodes an anonymous or service-role client bypass.

The private membership predicates are stable `SECURITY DEFINER` functions used to avoid recursive membership-policy evaluation. They have an empty `search_path`, fully qualified relations, explicit `auth.uid()` checks, revoked anonymous execution, and only the minimum authenticated execution grants. Trigger functions have no API-role execution grants. Explicit `service_role` object grants support the server-only client, but the service-role key remains forbidden from browser code and server orchestration must still recheck user authorization.

### Demo seed and verification

`supabase/seed.sql` contains deterministic UUIDs for the fictional eight-person Civic Futures Lab and the Regional Climate Action Summit 2026. It creates no Auth users or credentials. The project has 24 items, 26 directed relationships, the 2026-09-12 baseline event date, and the required event → speaker confirmation → programme lock → briefing pack path. `npx supabase db reset` reconstructs the fixture; a production-safe reset RPC is intentionally deferred to the operation-service task.

The transaction-wrapped `supabase/tests/verify_p0.sql` checks seed counts and the expected path, cross-workspace invisibility, viewer mutation denial, reviewer attribution, immutable record identity, server-only audit writes, the self-dependency constraint, and operation idempotency uniqueness, then rolls back its test rows. It is plain assertion SQL, not pgTAP, and was executed successfully against the linked hosted project with:

```bash
npx supabase db query --linked --file supabase/tests/verify_p0.sql
```

Local `db reset` and CLI pgTAP execution still require Docker Desktop.

Database types are generated from the linked hosted schema with:

```bash
npx supabase gen types typescript --linked --schema public > src/types/database.ts
```
