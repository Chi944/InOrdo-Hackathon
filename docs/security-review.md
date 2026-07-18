# Reviewer security checklist

Review date: 2026-07-18
Scope: Prompt 5 on `deston/04-graph-engine`

## Result

The code and linked-database controls required for Prompt 5 pass the reviewer checklist. The only outstanding operational check is a real browser login/action flow, which requires an operator-created Auth account and local public Supabase configuration. No credential was read or created to bypass that prerequisite.

## Checklist and evidence

- [x] **Normal reads and writes are user-scoped and RLS-protected.** Request code accepts only the nominal `ServerSupabaseClient`. Project-record operations derive identity from verified claims, authorize project membership/role, and send explicit workspace/project filters. Database RLS remains enabled on every public table.
- [x] **The service-role client is server-only and absent from request paths.** It has a separate nominal capability and no production caller. Static import-graph tests reject privileged-client imports from `src/app/**`, client-reachable modules, and `src/features/**`.
- [x] **Session refresh state is preserved.** Proxy tests prove refreshed cookies and cache-safety headers survive normal and redirect responses. The request-scoped client can capture Supabase response headers into a Route Handler-owned `Headers` object; callers must apply that object to the response.
- [x] **Redirects are local and safe.** Redirect validation accepts only `/app` paths and rejects external, scheme-relative, backslash, control-character, and unrelated local paths.
- [x] **Anonymous and cross-workspace access fail closed.** The application rejects anonymous claims. Migration `20260718160500_reject_anonymous_identities.sql` adds the same check to every private membership predicate and direct self/workspace-insert policy. A linked transaction using an anonymous JWT for an existing fixture member returned `accepted_identity=false`, `workspace_member_allowed=false`, and `visible_project_count=0`.
- [x] **Cross-tenant owner and dependency references fail closed.** `project_items` now has a composite owner-to-workspace-membership foreign key. The existing composite project/item foreign keys reject cross-project edges. Linked rollback-wrapped checks confirmed both rejections.
- [x] **Stale writes do not overwrite newer state.** Item updates include workspace, project, item ID, and expected version filters. The linked verification changed fixture item version 1 to version 2, then confirmed an update using stale version 1 affected zero rows.
- [x] **Database errors are user-safe.** Known constraint/permission codes map to bounded public messages, and unknown errors use a generic message without database detail, hint, policy, table, or query text.
- [x] **No secret or credential is in the implementation.** Only documented environment variable names appear. `.env` and `.env.local` were not read. No password, service-role key, OpenAI key, token, or private fixture was added.
- [x] **Model output has no mutation path.** Prompt 5 makes no model call. The graph engine is pure TypeScript, and current request/feature modules do not import OpenAI or the privileged Supabase client. Model-derived database tables remain inaccessible to ordinary authenticated inserts.

## Automated evidence

Relevant tests include:

- `src/lib/supabase/client-scope.test.ts`
- `src/lib/supabase/proxy.test.ts`
- `src/lib/supabase/server.test.ts`
- `src/lib/security-boundaries.test.ts`
- `src/lib/auth/guards.test.ts`
- `src/features/project-records/operations.test.ts`
- `src/features/project-records/supabase-store.test.ts`
- `src/features/impact/graph.test.ts`
- `src/features/impact/loader.test.ts`
- `src/features/impact/loader-boundary.test.ts`
- `src/app/app/project-record-controls.test.tsx`

`supabase/tests/verify_p0.sql` is transaction-wrapped and now covers anonymous denial and cross-workspace owner rejection in addition to the earlier RLS/integrity assertions.

## Linked verification

The forward migration appears in both local and remote migration ledgers. Remote schema lint returned no errors. The graph loader also rejects projects above its explicit capacity instead of silently truncating traversal input. A member-role transaction performed and then rolled back:

1. an item priority edit with the current version;
2. a stale retry that affected zero rows;
3. dependency creation; and
4. removal of that exact dependency.

The post-rollback read confirmed the item returned to version 1 and the verification dependency count was zero.

## Remaining operational check

Before a demo or deployment, create the real Auth user using `docs/demo-user-setup.md`, provide the public Supabase URL/key through the deployment environment or untracked `.env.local`, then verify login, one UI item edit, one UI dependency add/remove, session refresh, logout, viewer read-only behavior, and keyboard/focus behavior. This is not a code blocker for Prompt 5, but it is a release/demo gate.
