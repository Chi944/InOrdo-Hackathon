# InOrdo

InOrdo is a Work and Productivity application for small teams. It turns an unstructured project update into reviewable evidence, deterministically traces affected work, drafts recovery actions with GPT-5.6, and requires explicit human approval before applying reversible internal changes.

## Current status

This repository contains the P0 application foundation, workspace-scoped Supabase schema and synthetic Regional Climate Action Summit fixture, Supabase email/password authentication, bounded typed repositories, protected project records, and deterministic dependency traversal. The Prompt 7 branch adds a server-only analysis API that stores pasted evidence, extracts one candidate change with GPT-5.6 Luna, postvalidates it against canonical project state, computes impacts in TypeScript, drafts inert recovery actions in a second bounded model call, and persists the derived review records without changing a project item.

This is backend foundation, not an end-to-end product claim. The analysis route is not wired into the project UI, every generated change and action still requires human review, and applying approved actions, operation history, undo, and demo reset remain unfinished. No live OpenAI analysis or browser workflow has been verified on this branch because the required environment variable names were absent from the process environment.

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

Normal login, authorization, project reads, and project-record writes use the public Supabase configuration plus the user's session. The Prompt 7 route lazily uses the service-role key only after request-scoped contributor authorization and bounded context loading, through three server-only persistence RPCs that independently recheck the verified actor. The key must never enter a browser bundle.

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
- Supabase will provide Postgres persistence, authentication, RLS, and durable operation history.
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
