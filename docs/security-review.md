# Reviewer security checklist

Review date: 2026-07-18
Scope: Prompt 5 on `deston/04-graph-engine`

## Result

The code and linked-database controls required for Prompt 5 pass the reviewer checklist. The only outstanding operational check is a real browser login/action flow, which requires an operator-created Auth account and local public Supabase configuration. No credential was read or created to bypass that prerequisite.

## Checklist and evidence

- [x] **Normal reads and writes are user-scoped and RLS-protected.** Request code accepts only the nominal `ServerSupabaseClient`. Project-record operations derive identity from verified claims, authorize project membership/role, and send explicit workspace/project filters. Database RLS remains enabled on every public table.
- [x] **The service-role client is server-only and absent from Prompt 5 request paths.** It has a separate nominal capability. Prompt 7 later adds one reviewed, lazy persistence boundary described below; static import-graph tests continue to reject the privileged client from browser-reachable and unrelated feature modules.
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

## Prompt 7 analysis security review

Review date: 2026-07-18

Scope: Prompt 7 implementation on `deston/05-openai-analysis`

Result: implementation controls reviewed. Linked migrations, rollback-wrapped SQL integration, schema lint, generated types, and Supabase security advisors are complete; the final Node 22 command gate is recorded separately after it runs. Live-provider and browser gates remain pending.

### Threats and implementation evidence

- [x] **A caller cannot select an arbitrary tenant or bypass contributor authorization in application code.** The route accepts a project UUID only. The service derives the current user from verified claims, requires owner/admin/member access, and loads a bounded context through explicit workspace/project filters before initializing the OpenAI client.
- [x] **The database contract does not trust application authorization alone.** Request-scoped authorization and context loading happen before privileged initialization. The public `begin_project_analysis`, `complete_project_analysis`, and `fail_project_analysis` wrappers are `SECURITY INVOKER`, require a service-role JWT, and grant execution only to `service_role`. They pass the verified actor to private `SECURITY DEFINER` implementations with empty `search_path`, fully qualified relations, contributor-role, claim-ownership, revision, and scope checks. Authenticated/anonymous execution is denied. The linked SQL suite exercised these grants and actor checks, and the Supabase security advisor returned no findings.
- [x] **Pasted updates and project text are treated as prompt-injection input.** Both prompts label supplied values as untrusted data, expose no tools, and forbid embedded instructions from expanding IDs, fields, paths, action types, or behavior. Source text cannot alter request metadata or model configuration.
- [x] **Structured output cannot become authority.** Strict Zod schemas are followed by canonical-state checks for item/impact IDs, allowlisted fields/actions, evidence substring/offset agreement, enums, dates, owner IDs supplied in context, current values, item versions, confidence, and exact deterministic impact coverage. The finalization RPC performs an independent database validation pass.
- [x] **GPT does not traverse or mutate.** Pure TypeScript computes paths. The second call receives those paths as authoritative input, all stored actions begin `pending`, and the narrowly privileged persistence adapter exposes only three analysis RPCs. Static tests reject project-item mutation calls and privileged imports outside the reviewed runtime/persistence boundary.
- [x] **Replay and duplicate spend are bounded in the database contract.** A unique project-revision/source-hash key and transaction advisory locks serialize duplicate claims. Duplicate processing/success/failure states do not start another model call. Five new claims per actor/project in a rolling ten-minute window are allowed before rate limiting; the linked rollback-wrapped SQL suite exercised the sixth-request rejection.
- [x] **Stale project state and partial derived writes fail closed by design.** Finalization locks the claim, reauthorizes the actor, recomputes the revision and graph paths, checks the target version/current value, and writes the pending change, impacts, proposal, actions, and success transition in one database transaction.
- [x] **Provider failures and refusals are bounded and user-safe in application code.** Each logical call has a 30-second timeout and at most one SDK transient retry. Refusal, incomplete output, malformed output, timeout, transient failure, stale state, and persistence errors map to bounded public codes rather than raw provider or database detail.
- [x] **Secrets and raw provider output have no client or persistence path.** OpenAI and service-role initialization are server-only and lazy. The caller's session performs identity, role, and context checks first; only the verified actor ID crosses into the service-role-only persistence RPCs. `store: false`, an empty tools list, bounded safe metadata, and allowlisted failure metadata are set explicitly. InOrdo does not persist raw model output.

### Residual risks and required controls

- [x] Applied the additive Prompt 7 migrations to the confirmed linked InOrdo project, regenerated database types, passed linked schema lint, ran rollback-wrapped claim/completion/failure/duplicate/rate/authorization/no-mutation SQL assertions, and obtained a clean Supabase security-advisor result. Performance advisors reported only expected unused-index informational notices on the new/small dataset.
- [x] Node 22 `npm run lint`, `npm run typecheck`, `npm run test:run` (177 tests across 32 files), and `npm run build` passed on the settled implementation. The final staged diff check is recorded in the QA checklist before commit.
- [ ] With a funded OpenAI project and required environment variable names present, run exactly one synthetic live analysis and record only the model, safe request/response IDs, usage counts, state transitions, and derived record IDs. Do not record a key, source body, prompt, or raw output.
- [ ] Verify browser login, submission, duplicate feedback, pending review display, refusal/failure copy, and confirmation behavior after Andres's UI contract is wired. Prompt 7 does not currently provide that UI.
- [ ] Configure an upstream/deployment request-size limit. The route rejects a declared oversized body before reading and checks actual encoded bytes after reading, but `Request.text()` itself is not a streaming memory bound when `Content-Length` is absent or dishonest.
- [ ] Define operator handling for a `processing` claim left behind if the terminal failure RPC itself fails. Preserve the evidence/claim, disable or contain the route if necessary, and use a separately reviewed forward repair; the current duplicate path cannot resume that claim. Do not delete or rewrite it to bypass idempotency.
- [ ] Treat the actor/project rate limit as a P0 spend guard, not full abuse prevention. Deployment traffic controls, account controls, monitoring, and budget alerts remain operational responsibilities.

These unchecked items are release gates, not claims of completed verification. The required environment variable names were absent from the process environment during this review, so no live OpenAI or browser request was made and no environment or secret file was read.
