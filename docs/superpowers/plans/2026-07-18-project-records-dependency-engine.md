# Project records and dependency engine plan

## Goal

Deliver Prompt 5 on `deston/04-graph-engine`: validated, workspace-authorized project record operations; optimistic concurrency; deterministic dependency impact traversal; a project-scoped graph loader; minimal reliable UI wiring; security/rollback evidence; and complete verification.

## Design

- Server Actions parse untrusted form input with strict Zod schemas and create a cookie-backed, user-scoped Supabase client.
- Every read or mutation resolves the authenticated user, project, workspace membership, and allowed role before using explicit workspace/project filters. Existing RLS and composite foreign keys remain the database backstop.
- Item edits compare the submitted version in the update filter. A zero-row result is a user-safe stale-write conflict; the database trigger owns the next version.
- Dependency records retain the documented direction: `from_item_id` is the dependent and `to_item_id` is its upstream prerequisite/context.
- Traversal is pure TypeScript. It follows upstream-to-dependent adjacency, ignores inactive nodes, selects the shortest path and a deterministic lexical tie-break, terminates cycles, and enforces a bounded depth.
- The UI uses ordinary Server Action forms followed by server revalidation. It does not use optimistic state, so failed mutations never need client-side rollback.

## Work sequence

1. Add failing tests for schema boundaries, graph invariants, authorization, stale updates, cross-project dependencies, and security client boundaries.
2. Implement the smallest domain, service, loader, and action layers needed to pass them.
3. Wire the existing project view without changing its visual language.
4. Document edge semantics, rollback, security review evidence, and Prompt 7 prerequisites.
5. Run linked-project checks plus lint, typecheck, unit tests, build, and `git diff --check`; then commit and push without force.

## Rollback principle

Application rollback is a deployment/git rollback. Database history is forward-only: no destructive down migration and no deletion of shared evidence. User record changes are reversed through authorized, version-checked compensating edits; dependency changes use explicit authorized remove/recreate operations.
