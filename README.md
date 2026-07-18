# InOrdo

InOrdo is a Work and Productivity application for small teams. It turns an unstructured project update into reviewable evidence, deterministically traces affected work, drafts recovery actions with GPT-5.6, and requires explicit human approval before applying reversible internal changes.

## Current status

This repository contains the P0 application foundation, workspace-scoped Supabase schema and synthetic Regional Climate Action Summit fixture, Supabase email/password authentication, bounded typed repositories, protected project records, deterministic dependency traversal, and the Prompt 7 server-only analysis API. The Prompt 9 branch adds the reviewed operation boundary for selectively applying allowlisted proposal actions, reading ordered audit history, creating compensating undo operations, and resetting only the named synthetic demo project.

This is backend foundation, not an end-to-end product claim. Every generated change and action still requires human review, and the Prompt 9 operation routes are not yet wired into a complete browser journey. The linked Prompt 9 migrations, generated types, schema/security checks, and rollback-wrapped apply/history/undo/reset RPC verification are complete and recorded in the QA checklist. Authenticated HTTP and browser verification remain pending.

## Local setup

Requirements: Node.js 22 and npm.

```bash
npm ci
copy .env.example .env.local
npm run dev
```

Fill local values in `.env.local`; never commit that file. The application runs at `http://localhost:3000` by default.

The authentication and data-access boundary expects these variable names. Obtain project values from the Supabase Dashboard and keep every value in `.env.local` or the deployment environment:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (defaults to `gpt-5.6-luna` for analysis)
- `DEMO_PROJECT_SLUG`
- `DEMO_RESET_SECRET`

Normal login, authorization, project reads, and project-record writes use the public Supabase configuration plus the user's session. The Prompt 7 route lazily uses the service-role key only after request-scoped contributor authorization and bounded context loading, through three server-only persistence RPCs that independently recheck the verified actor. The key must never enter a browser bundle.

`DEMO_PROJECT_SLUG` and `DEMO_RESET_SECRET` are server-only reset controls. The reset route accepts neither value from the browser. After owner/admin authorization, the runtime verifies that both are configured and then passes only the verified actor, project ID, configured project slug, and idempotency key to the constrained reset RPC. The reset secret never enters a URL, header, JSON body, RPC argument, audit row, or log.

Create the email/password demo account manually and map its generated Auth UUID to the seeded workspace by following [docs/demo-user-setup.md](docs/demo-user-setup.md). No demo password belongs in source control.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js development server. |
| `npm run build` | Create a production build. |
| `npm run start` | Serve the production build. |
| `npm run lint` | Run ESLint across the repository. |
| `npm run typecheck` | Run TypeScript without emitting files. |
| `npm test` | Run Vitest in watch mode. |
| `npm run test:run` | Run unit and component tests once. |
| `npm run test:e2e` | Run Playwright browser tests. |

## Architecture intention

- Next.js App Router and React Server Components provide the web boundary.
- Supabase provides Postgres persistence, authentication, RLS, and durable operation history.
- GPT-5.6 Luna runs server-side only to structure one evidence-backed candidate change and draft inert recovery actions; it never traverses the graph or applies an action.
- Application code—not the model—traverses explicit dependency edges.
- Validated model output remains a proposal until a person approves a specific action; only authorized server code can mutate data and record an undoable operation.

See [docs/architecture.md](docs/architecture.md) and [AGENTS.md](AGENTS.md) before implementing P0 contracts.

Security evidence and recovery procedures are recorded in [docs/security-review.md](docs/security-review.md) and [docs/rollback-plan.md](docs/rollback-plan.md). Prompt 7's resolved integration decisions and remaining verification gates are recorded in [docs/prompt-7-readiness.md](docs/prompt-7-readiness.md).

## Analysis backend

`POST /api/projects/[projectId]/analyze` accepts one bounded JSON source record. Contributor authorization, strict allowlists, a normalized source hash, a deterministic project revision, duplicate claiming, and a five-new-requests-per-actor/per-project/10-minute limit run before either model call.

The OpenAI Responses adapter uses `OPENAI_MODEL` with a `gpt-5.6-luna` default, strict structured output, `store: false`, low reasoning effort, no tools, a 30-second timeout per logical call, at most one SDK retry per call for transient failures, and bounded input/output. Source text is explicitly marked untrusted. Returned IDs, fields, values, dates, enums, evidence excerpts/offsets, confidence, and canonical previous values are checked again by application code.

The first database phase stores immutable evidence and an idempotency claim. After both model results pass validation, a server-only service-role wrapper passes the already verified actor to a private implementation that rechecks contributor membership, project revision, claim ownership, and current item state. It then atomically writes only a pending change, deterministic impact paths, and pending proposal actions. Authenticated browser roles cannot execute these RPCs, and no item mutation occurs. Model actions map narrowly as follows: `update_item_field` to `update_item`; `create_task` and `create_risk` to `create_item` with an explicit item type; and `request_confirmation` to its dedicated inert action type.

The analysis modules include injected-adapter test cases for successful orchestration, refusal, malformed output, unknown IDs, evidence mismatch, timeout, duplicate handling, and transient provider errors. On the settled Prompt 7 diff, Node 22 lint, typecheck, 177 tests across 32 files, and the production build passed. Linked migration, schema-lint, rollback-wrapped SQL, generated-type, and security-advisor evidence is recorded in [docs/qa-checklist.md](docs/qa-checklist.md). Live OpenAI and browser verification remain explicitly pending.

## Approval, audit, undo, and reset backend

Prompt 9 exposes four private, no-store JSON boundaries:

- `POST /api/projects/[projectId]/proposals/[proposalId]/apply` selects one or more pending proposal actions and supplies any explicitly required human responses.
- `GET /api/projects/[projectId]/operations?limit=25&includeArchived=false` reads ordered operation headers and item-level audit records. `includeArchived=true` includes prior workflow generations.
- `POST /api/projects/[projectId]/operations/[operationId]/undo` requests one idempotent compensating operation.
- `POST /api/projects/[projectId]/demo/reset` requires `{ "confirmed": true, "idempotencyKey": "..." }` and uses only server-held reset configuration.

The application reauthorizes the current owner/admin before initializing the privileged RPC executor. The database then rechecks actor membership, project/proposal ownership, action state, allowlisted payloads, required human input, current item versions, and the idempotency fingerprint. The only executable proposal actions are a constrained allowlisted item-field update, a constrained task creation, a constrained risk creation, and a confirmation activity. Deletes, membership changes, dependency changes, arbitrary patches/SQL, and external calls are not operation actions.

Application happens in proposal ordinal order in one transaction. A successful operation and every selected action's before/after audit item commit with the mutations; expected validation/business failures record a safe terminal failure without a partial project mutation. An unexpected database exception rolls the transaction back atomically but may leave no failed audit row. Only operations composed entirely of reversible field updates can be undone. Undo groups same-item updates, checks each item's final resulting version and the latest recorded after-state for every affected field, then applies reverse payloads in descending ordinal order. It creates a new operation linked through `reverses_operation_id`; it never edits history, and an undo cannot itself be undone.

Demo reset restores the deterministic named fixture without deleting audit evidence. It advances the project's workflow generation, retires nonbaseline demo items, restores canonical item values and dependency edges, and makes current-generation reads start clean while archived history remains available. Replays with the same request are stable, and a different immediate reset is rate-limited. On the settled Prompt 9 diff, Node 22 lint, typecheck, 223 tests across 37 files, and the production build passed. Linked rollback-wrapped RPC/audit verification is complete; the authenticated HTTP/browser procedure remains pending in [docs/qa-checklist.md](docs/qa-checklist.md).

## Project records and graph tests

The unit suite covers strict request allowlists, stale item versions, authorization fail-closed behavior, cross-project dependency rejection, and safe database-error mapping. The impact suite covers chains, fan-out, fan-in, cycles, self-loops, duplicate edges, disconnected nodes, inactive items, maximum depth, stable ordering, and deterministic shortest paths.

The general project graph loader treats `not_started`, `in_progress`, `blocked`, and `at_risk` items as active. It loads only the authorized project, then passes normalized TypeScript records into a pure traversal with no network or model call. It rejects projects beyond the documented 500-active-item or 2,000-edge demo bounds instead of returning a truncated graph. The model-analysis context uses stricter 200-active-item and 1,000-edge limits before either model call.

## P0 scope

The Build Week demo targets native project records, explicit dependencies, pasted source evidence, structured extraction, deterministic impact paths, selective recovery approval, operation history, undo, and a reliable reset for one synthetic workspace. External connectors, embeddings, autonomous mutations, and production-readiness claims are out of scope.

## Supabase

Supabase CLI configuration is initialized under `supabase/`. To point a fresh checkout at the existing hosted project, authenticate locally and link with a project reference obtained from the Supabase Dashboard:

```bash
npx supabase login
npx supabase link --project-ref <PROJECT_REF>
```

Do not commit the CLI login token, database password, project keys, or generated `.env.local`. Apply pending migrations only after reviewing the linked target:

```bash
npx supabase db push --dry-run
npx supabase db push
```

For a local Supabase stack, when the CLI and its container runtime are available:

```bash
npx supabase start
```

No production credential or demo-account password is included in this repository.

> TODO before submission: verify the MIT License copyright holder and legal attribution with every InOrdo team member.
