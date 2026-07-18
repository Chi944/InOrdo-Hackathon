# Codex implementation log

## 2026-07-18 — Repository bootstrap

- Replaced the prior repository application history with a clean root `main` foundation at the user’s direction.
- Scaffolded the current stable Next.js App Router application with TypeScript, ESLint, Tailwind CSS, `src/`, and the `@/*` alias.
- Added the approved P0 runtime and testing dependencies, Node 22/npm scripts, Vitest setup, and an honest landing-shell smoke test.
- Added environment documentation, ownership and security rules, product/architecture/demo/QA documentation, CI and contribution templates, MIT licensing, and Supabase CLI configuration.
- Kept the landing state explicit that the demo workspace and product workflows are not yet operational.
- No private transcript, credential, or environment value is included in this log.

## 2026-07-18 — P0 database, RLS, and synthetic seed

- Added versioned migrations for the complete workspace/project domain, composite tenant integrity, constrained states, optimistic item versions, direction-safe dependencies, indexes, timestamps, and append-only evidence/operation history.
- Added least-privilege RLS for every user-facing table, private membership predicates with hardened `SECURITY DEFINER` settings, exact authenticated grants, viewer read-only behavior, protected membership administration, and no anonymous access.
- Added a deterministic, credential-free Regional Climate Action Summit 2026 seed with eight fictional profiles, 24 canonical items, 26 dependency edges, the 2026-09-12 baseline, and the demonstration’s multi-hop path.
- Added transaction-wrapped SQL verification for cross-workspace denial, viewer mutation denial, self-dependency rejection, operation idempotency uniqueness, seed counts, the baseline date, and the expected graph path.
- Linked the confirmed InOrdo Supabase project, pushed four migrations and the deterministic seed, and generated `src/types/database.ts` from the hosted schema. No secret value was read or logged.
- Added immutable scope/attribution guards, database-owned reviewer attribution, serialized final-owner protection, explicit server-role grants, and server-only write boundaries for model-derived and audit records.
- Re-ran the transaction-locked seed through the linked SQL runner to verify idempotency, then executed the rollback-wrapped SQL verification against the hosted database. It passed with 15/15 public tables protected by RLS, 24 items, 26 dependency edges, no anonymous table grants, no unvalidated constraints, and no retained verification rows.
- Ran Supabase security advisors after revoking direct API execution from internal trigger functions; no security advisories remained. Unused-index notices are expected for a newly seeded project.
- Local `npx supabase db reset` and CLI pgTAP remain unavailable because Docker Desktop’s Linux engine is stopped; hosted migration, RLS, constraint, seed, and advisor checks provide the runtime verification for this task.

## 2026-07-18 — Authentication and typed data access

- Added separate public and server-only environment validation plus typed browser, request-scoped server, and narrowly scoped privileged Supabase clients.
- Added the Next.js 16 proxy session-refresh boundary with request/response cookie propagation and cache-safety headers, then protected identity with `auth.getClaims()` and an authenticated, non-anonymous account requirement.
- Added email/password login, logout, local-application-only redirects, useful non-sensitive errors, workspace membership and role guards, project/workspace verification, and typed 401/403/404 authorization errors.
- Added bounded, explicit-column, server-only repositories for the demo project overview, items and dependencies, source updates, impact/proposal records, and operation history.
- Connected the protected `/app` shell to real RLS-scoped seed data with loading, not-found, authorization, empty-workflow, and general error states. Unfinished AI and mutation paths remain labeled as unavailable.
- Added redirect, error mapping, membership, identity, environment, server-action, query-boundary, and client-secret-boundary tests.
- Ran the required Node 22 checks: lint, typecheck, 24 tests across 9 files, production build, and `git diff --check` all completed successfully.
- Documented the manual demo-account flow without committing a password. Live login and project-load verification were not run because no `.env` or `.env.local` configuration and no operator-created Auth credential were available; no environment value or secret was read.

## 2026-07-18 — Native project records and dependency engine

- Added strict Zod allowlists for item/dependency mutations, list filters, and graph input/output, with bounded user-safe validation messages.
- Added claim-bound project authorization, contributor/read role separation, scoped Supabase persistence, conditional item-version updates, safe conflict/error results, and same-project dependency validation.
- Added pure deterministic upstream-to-dependent traversal with active-item filtering, complete paths, cycle/self-loop/duplicate defense, stable ordering, shortest-path policy, and a default maximum depth of 5.
- Added a project-scoped graph loader with deterministic pagination and fail-closed 500-item/2,000-edge bounds, plus minimal server-refreshed project record/dependency controls without changing the established visual language or using optimistic UI.
- Completed the reviewer checklist with nominal user/privileged client separation, proxy/Route Handler response-state tests, request-path privileged-import checks, and a claim-bound authorization helper.
- Applied a forward migration that rejects Supabase anonymous Auth identities at RLS and requires an item owner to belong to the item's workspace. Linked schema lint reported no errors.
- Performed a rollback-wrapped member-role verification: an item edit advanced version 1 to 2, the stale retry changed zero rows, and a dependency was created then removed. A post-rollback read confirmed item version 1 and no retained verification edge.
- Confirmed against the linked database that anonymous identity/membership/project visibility all fail closed and that cross-workspace owner assignment and cross-project dependency creation are rejected.
- Added a non-destructive rollback runbook, a refreshed-version UI regression test, and a Prompt 7 readiness checklist covering action vocabulary, project revision, and atomic persistence decisions.
- Ran the required Node 22 checks: lint, typecheck, 84 tests across 21 files, production build, and `git diff --check` all completed successfully. The linked migration ledger matched and remote schema lint reported no errors.
- Live browser action verification remains gated on an operator-created Auth account and untracked public Supabase environment configuration; no credential or environment file was read.
