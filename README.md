# InOrdo

InOrdo is a Work and Productivity application for small teams. It turns an unstructured project update into reviewable evidence, deterministically traces affected work, drafts recovery actions with GPT-5.6, and requires explicit human approval before applying reversible internal changes.

## Current status

This repository contains the P0 application foundation, the workspace-scoped Supabase schema and synthetic Regional Climate Action Summit fixture, Supabase email/password authentication, bounded typed repositories, and a protected read-only project overview. The Prompt 3 automated checks pass on `deston/03-auth-data`; a live login still requires an operator-created Auth account and local environment configuration. Model extraction, dependency traversal services, approvals, mutations, undo, and demo reset are not represented as working features yet.

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
- `DEMO_PROJECT_SLUG`

Normal signed-in requests use the public Supabase configuration plus the user's session. The service-role key is reserved for narrowly reviewed, server-only administration such as a future controlled demo reset; it is not required for ordinary login or project reads and must never enter a browser bundle.

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
- GPT-5.6 will run server-side only to structure evidence and draft recovery actions.
- Application code—not the model—will traverse explicit dependency edges.
- Validated model output remains a proposal until a person approves a specific action; only authorized server code can mutate data and record an undoable operation.

See [docs/architecture.md](docs/architecture.md) and [AGENTS.md](AGENTS.md) before implementing P0 contracts.

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
