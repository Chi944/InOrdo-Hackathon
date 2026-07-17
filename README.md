# InOrdo

InOrdo is a Work and Productivity application for small teams. It turns an unstructured project update into reviewable evidence, deterministically traces affected work, drafts recovery actions with GPT-5.6, and requires explicit human approval before applying reversible internal changes.

## Current status

This repository contains the P0 application foundation and an accessible landing shell. The page clearly reports **“Demo workspace coming online.”** Authentication, persistence, model extraction, dependency traversal, approvals, mutation history, undo, and demo reset are planned but are not represented as working features yet.

## Local setup

Requirements: Node.js 22 and npm.

```bash
npm ci
copy .env.example .env.local
npm run dev
```

Fill local values in `.env.local`; never commit that file. The application runs at `http://localhost:3000` by default.

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

Local Supabase configuration is initialized under `supabase/`. When the CLI and its container runtime are available:

```bash
npx supabase start
```

No production credentials or database are included in this repository.

> TODO before submission: verify the MIT License copyright holder and legal attribution with every InOrdo team member.
