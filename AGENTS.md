# InOrdo engineering guide

## Product purpose

InOrdo helps small teams respond safely when new evidence changes a project. It preserves the source update, uses GPT-5.6 to draft a structured interpretation, deterministically traverses explicit dependencies, and presents recovery actions for selective human approval. Applied internal operations must be attributable and reversible where supported.

The product sequence is: **evidence → impact → proposal → approval → history and undo**.

## P0 scope

- Native project records for tasks, milestones, decisions, events, risks, and artifacts.
- Explicit directed dependencies between records.
- Pasted source updates with immutable raw evidence.
- Server-side GPT-5.6 structured extraction and recovery drafting with Zod validation.
- Deterministic direct and downstream impact traversal with explainable paths.
- Per-action human approval before any mutation.
- Reversible internal operations, operation history, undo, and a deterministic demo reset.
- One isolated, synthetic demo workspace and an accessible responsive web interface.

## Explicit non-goals

- Autonomous model-driven mutations.
- External connectors or sync engines.
- Embeddings, vector search, RAG, or semantic search infrastructure.
- Django, FastAPI, n8n, Firebase, Neon, Railway, Neo4j, or Redis.
- Enterprise administration, native mobile apps, or production-readiness claims during Build Week.

## Architecture boundaries

- Use npm, Node 22, TypeScript, Next.js App Router under `src/`, React Server Components by default, Tailwind CSS, Supabase, and the OpenAI SDK.
- Browser code may use only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. It must never import or reference service-role or OpenAI secrets.
- OpenAI calls run only in server-only modules or server routes/actions. Validate all model output with Zod before it enters domain logic.
- The model may extract a candidate change and draft recovery actions. Deterministic application code owns graph traversal, authorization, approval checks, mutations, operation records, and undo.
- **Model output never directly mutates data.** A validated proposal remains inert until a human explicitly approves a specific action and the server rechecks authorization and current state.
- Supabase migrations, RLS, and server-side authorization are the source of truth for data access. Never rely on UI visibility as authorization.
- Keep the core product standalone. Do not add connector packages or external workflow services.

## Ownership

- **Deston:** Supabase schema and migrations, RLS and authorization, server contracts, OpenAI integration, deterministic impact logic, mutation/undo services, and demo reset safety.
- **Andres:** information architecture, interface copy, visual system, accessibility, responsive behavior, frontend components, and demo presentation.
- Shared ownership: typed boundaries between frontend and server, end-to-end workflow behavior, security review, QA, release readiness, and public claims.
- Coordinate before changing another owner’s contract. Document cross-boundary decisions in `docs/architecture.md` and `docs/codex-log.md`.

## Security and secrets

- Never read, print, log, commit, or expose `.env`, `.env.local`, API keys, database passwords, service-role keys, tokens, or private user data.
- Commit only `.env.example` with blank documented values. Use synthetic data in public demos.
- Treat pasted updates as untrusted input. Validate length and shape, minimize data sent to models, and preserve provenance.
- Never use a service-role key in a Client Component, browser bundle, public log, test fixture, or screenshot.
- Fail closed when authorization, validation, approval, idempotency, or operation logging is uncertain.

## Required commands before commits

Run all of the following and fix failures caused by the change:

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
git diff --check
```

Run `npm run test:e2e` when a change affects an implemented browser workflow and the Playwright browser is available. Never claim a check passed unless it was run in the current worktree.

## Branch and commit conventions

- `main` is the shared integration branch. After this one approved empty-repository bootstrap, use short-lived branches prefixed `deston/`, `andres/`, or `codex/` as appropriate.
- Rebase or merge the latest `main` before handoff; never force-push shared branches.
- Use Conventional Commits such as `feat:`, `fix:`, `test:`, `docs:`, `chore:`, and `refactor:`.
- Keep commits focused, explain security-sensitive decisions, and do not mix generated artifacts with unrelated code changes.
