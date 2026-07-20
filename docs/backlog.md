# InOrdo backlog

## P0 — Build Week

- [x] Establish the Node 22, npm, TypeScript, Next.js, Tailwind, Vitest, and Supabase CLI foundation.
- [x] Publish an honest, accessible landing shell.
- [x] Define, apply, and verify the Supabase schema, constraints, seed fixture, RLS policies, and generated TypeScript types.
- [x] Complete and automatically verify typed Supabase browser/server clients, request refresh, email/password login, and the authentication boundary.
- [x] Complete and automatically verify role-aware authorization helpers, bounded typed repositories, and protected real-data pages.
- [x] Implement validated native project-item and dependency operations with optimistic concurrency and reliable server refresh.
- [x] Implement bounded evidence intake, immutable provenance, source hashing, and duplicate/rate claims.
- [x] Implement server-only two-stage GPT-5.6 Luna analysis with strict structured output and application postvalidation.
- [x] Implement deterministic dependency traversal with cycle protection, stable shortest paths, and path explanations.
- [x] Implement recovery proposal drafting and atomic persistence of pending per-action review state.
- [x] Wire the analysis route and pending-review records into the project UI without weakening the server contract.
- [x] Implement and linked-verify authorized, idempotent, reversible internal operation contracts.
- [x] Implement and linked-verify operation history, undo, and isolated demo reset contracts.
- [x] Build the integrated end-to-end demo workspace and CI-safe core browser journey.
- [ ] Complete the native-mutation contract release: expand `20260719140000`, exact RPC deployment, four-mutation/replay smoke, and reset are complete; merge PR #17, approve/apply only `20260720190000`, then rerun hosted denial/parity verification.
- [ ] Complete the operator-held live production smoke path for authentication, Supabase/RLS, one funded GPT-5.6 analysis, selective apply, audit, undo, and reset.

## P1

- [ ] Collaborative assignments, comments, and notifications.
- [ ] Proposal editing, richer conflicts, and approval roles.
- [ ] Search, filtering, saved views, and reusable project templates.
- [ ] Observability, retention policy, and hardened failure recovery.
- [ ] Paginate project/dependency presentation beyond the bounded P0 fixture and split the large impact workflow client boundary.

## P2 scaling follow-ups

- [ ] Replace `complete_project_analysis` whole-table `SHARE` locks with measured project-scoped coordination that preserves revision consistency, atomic completion, and late-worker fencing. Until then, monitor lock waits and completion latency and keep the workflow to the low-volume synthetic demo.
- [ ] Paginate the dependency-management repository beyond 500 rows and surface an explicit completeness/truncation state. Until then, keep supported demo projects below the cap and do not present that screen as a complete large-project inventory.

## Explicitly deferred

External connectors, embeddings/vector search, autonomous mutation, enterprise administration, and native mobile applications.
