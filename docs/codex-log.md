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
