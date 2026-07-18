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
- `src/app/app/project-record-actions.test.ts`
- `src/app/app/items/project-items-view.test.tsx`
- `src/app/app/dependencies/dependency-view.test.tsx`

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
- [x] **Replay and duplicate spend are bounded in the database contract.** A unique project-revision/source-hash key and transaction advisory locks serialize duplicate claims. Every claim has a fixed, nonrenewable three-minute lease. Active duplicates return the remaining delay; the first exact replay after expiry locks and terminalizes the same row without another model call. Five new claims per actor/project in a rolling ten-minute window are allowed before rate limiting; the linked rollback-wrapped SQL suite exercises the sixth-request rejection.
- [x] **Stale project state and partial derived writes fail closed by design.** Finalization locks the claim, reauthorizes the actor, recomputes the revision and graph paths, checks the target version/current value, and writes the pending change, impacts, proposal, actions, and success transition in one database transaction. The transition guard rejects success at or after lease expiry, rolling every derived insert back before a late worker can overwrite reconciliation.
- [x] **Provider failures and refusals are bounded and user-safe in application code.** Each logical call has a 30-second timeout and at most one SDK transient retry. Refusal, incomplete output, malformed output, timeout, transient failure, stale state, and persistence errors map to bounded public codes rather than raw provider or database detail.
- [x] **Secrets and raw provider output have no client or persistence path.** OpenAI and service-role initialization are server-only and lazy. The caller's session performs identity, role, and context checks first; only the verified actor ID crosses into the service-role-only persistence RPCs. `store: false`, an empty tools list, bounded safe metadata, and allowlisted failure metadata are set explicitly. InOrdo does not persist raw model output.

### Residual risks and required controls

- [x] Applied the additive Prompt 7 migrations to the confirmed linked InOrdo project, regenerated database types, passed linked schema lint, ran rollback-wrapped claim/completion/failure/duplicate/rate/authorization/no-mutation SQL assertions, and obtained a clean Supabase security-advisor result. Performance advisors reported only expected unused-index informational notices on the new/small dataset.
- [x] Node 22 `npm run lint`, `npm run typecheck`, `npm run test:run` (177 tests across 32 files), and `npm run build` passed on the settled implementation. The final staged diff check is recorded in the QA checklist before commit.
- [ ] With a funded OpenAI project and required environment variable names present, run exactly one synthetic live analysis and record only the model, safe request/response IDs, usage counts, state transitions, and derived record IDs. Do not record a key, source body, prompt, or raw output.
- [ ] Verify browser login, submission, duplicate feedback, pending review display, refusal/failure copy, and confirmation behavior after Andres's UI contract is wired. Prompt 7 does not currently provide that UI.
- [ ] Configure an upstream/deployment request-size limit. The route rejects a declared oversized body before reading and checks actual encoded bytes after reading, but `Request.text()` itself is not a streaming memory bound when `Content-Length` is absent or dishonest.
- [x] Interrupted `processing` claims now have a reviewed, evidence-preserving path: exact POST replay after the immutable lease terminalizes the existing request as failed. Reconciliation is demand-driven; operators must not replace it with deletion, direct state edits, or a second model attempt.
- [ ] Treat the actor/project rate limit as a P0 spend guard, not full abuse prevention. Deployment traffic controls, account controls, monitoring, and budget alerts remain operational responsibilities.

These unchecked items are release gates, not claims of completed verification. The required environment variable names were absent from the process environment during this review, so no live OpenAI or browser request was made and no environment or secret file was read.

## Prompt 9 operation security review

Review date: 2026-07-18

Scope: Prompt 9 implementation and reviewer hardening on `deston/06-operations`

Result: the implementation has explicit approval, authorization, transaction, audit, undo, and named-demo reset boundaries. Independent reviews identified canonical-fingerprint, same-item undo, current-generation source lookup/reuse and rate-limit scoping, active-key allocation/formatting, bounded-conflict, immutable-backfill, request-normalization, and baseline-integrity gaps; the Prompt 9 migrations and server response contract address those findings. Both migrations are applied to the confirmed linked project, rollback-wrapped SQL/RPC verification passes without retained test rows, linked types match, database lint reports no errors, and the Supabase security advisor reports no findings. The final Node 22 gate and authenticated browser flow are recorded separately below.

### Authorization and privileged boundary

- [x] **Mutation routes require a verified owner or admin before privileged initialization.** Apply, undo, and reset derive the actor from request-scoped verified claims and authorize the project with `workspaceAdministratorRoles`; neither a body nor a model supplies an actor, workspace, or role. Operation history uses the bounded read-role guard and remains project/workspace scoped.
- [x] **The database reauthorizes instead of trusting the application check.** Each internal operation resolves `auth.uid()`, rejects anonymous identities, joins the target project to the actor's owner/admin membership, and checks proposal/operation ownership and the current workflow generation where applicable.
- [x] **The service-role capability is narrow and lazy.** The application initializes it only after request validation and request-scoped authorization. The adapter exposes only `apply_project_proposal`, `undo_project_operation`, and `reset_demo_project`, with fixed typed arguments; it accepts no relation name, SQL fragment, arbitrary patch, credential, URL, or external destination.
- [x] **RPC grants are explicit.** Public wrappers are `SECURITY INVOKER`, have an empty `search_path`, reject any caller whose database role is not `service_role`, and are executable only by `service_role`. Their private implementations are `SECURITY DEFINER`, use an empty `search_path` and fully qualified objects, and have execution revoked from `public`, `anon`, and `authenticated`. The wrappers pass the already verified actor into a transaction-local authenticated claim, restore the original claim state on both success and exception, and the private functions independently enforce that actor's role.

### Request, action, and state validation

- [x] **HTTP inputs are strict and bounded.** Path IDs must be UUIDs; POST requires JSON; encoded bodies are capped at 32,000 bytes; unknown keys fail; selection and human-response arrays are capped at 50; response text is capped at 2,000 characters; and idempotency keys are 8–200 allowlisted characters. A path project/proposal/operation ID cannot be overridden in a body.
- [x] **Only pending actions in the named current-generation proposal can execute.** The database locks the project, proposal, selected actions, and target items in stable order. It accepts proposal state `ready` or `partially_approved`, requires each selected action to be `pending`, and never revives an `applied`, `rejected`, or `stale` action.
- [x] **The executable allowlist is closed.** It permits one validated field update (`title`, `description`, `status`, `priority`, `owner_id`, `start_date`, `due_date`, or event-compatible `event_date`), constrained task creation, constrained risk creation, or an explicit confirmation activity. It rejects delete, membership, dependency, arbitrary-patch/SQL, unknown action/payload fields, external calls, cross-project IDs, retired targets, invalid owners, bad dates, and unsupported item types.
- [x] **Human input remains explicit and action-bound.** Every supplied response must be unique, confirmed, selected, and matched to the exact action. A `requires_human_input` action cannot execute without it, while an action that does not require input rejects an unexpected response. The response is audit data only and cannot expand the action vocabulary.
- [x] **Model output still has no direct mutation authority.** Prompt 9 applies only an immutable stored proposal action after a human selects it. Application and database validation recheck the action independently; no OpenAI or graph call occurs inside an operation transaction.

### Idempotency, locking, atomicity, and audit

- [x] **Idempotency uses a canonical logical-request fingerprint.** The SHA-256 request hash covers the operation type and scoped IDs plus sorted selected action IDs and human responses normalized and ordered by action ID. Equivalent selection/response ordering produces the same fingerprint. The idempotency key itself is not treated as a secret and is not part of the logical payload hash. Same-key/same-fingerprint replay returns the original terminal operation; same-key/different-fingerprint reuse returns a conflict and cannot apply another effect.
- [x] **Concurrency is serialized at the correct boundaries.** A project row lock serializes proposal application and deterministic item-key allocation. A transaction advisory lock serializes each workspace/idempotency key, action and target locks use stable ordering, expected item versions reject stale changes, and a unique successful-reversal index prevents two successful undo operations for one original.
- [x] **Validation and mutation are all-or-nothing.** The implementation validates every selected action and required human response before inserting a successful operation or mutating project data. Action/proposal transitions, project changes, ordered operation items, activity, and the terminal operation header share one database transaction. A rejected request records only a safe terminal failure and no partial operation item or project mutation.
- [x] **Audit history is append-only and ordered.** Successful apply records the initiator, proposal, canonical request hash, selected action IDs, reversibility, and one operation item per selected action in proposal ordinal order. Field updates record expected/resulting versions, before/after values, and a constrained reverse payload. Task/risk creation and confirmation record their bounded result but make the whole operation nonreversible. Errors use allowlisted codes rather than SQL/provider internals.
- [x] **The legacy audit backfill preserves the immutable trigger boundary.** The Prompt 9 migration disables `operation_logs_immutable` only around its migration-owned legacy hash/metadata backfill, re-enables it before any new RPC is created, and relies on PostgreSQL transactional DDL so a migration failure cannot leave a committed half-enabled write path. No runtime code can disable that trigger.

### Undo safety and conflict disclosure

- [x] **Undo is compensating, current-generation, and never recursive.** Only a successful current-generation `apply_proposal` operation whose every operation item is reversible can be undone. Create-task, create-risk, confirmation, failed, reset, and undo operations are not undo targets. Undo writes a new append-only operation linked by `reverses_operation_id`; it never changes or deletes the original, and the database permits only one successful reversal.
- [x] **Undo preflights the whole reverse plan before writing.** It validates the recorded version chain for each item, compares the current item version with that item's final recorded resulting version, and compares each current field with the last recorded after-state for that field. This grouped final-state policy correctly handles multiple updates to the same item in one operation; it does not falsely require an intermediate version to be current before reverse execution. Only after every target passes does it apply reverse payloads in descending original ordinal order.
- [x] **Conflicts are safe but useful.** Missing items, version mismatches, and state mismatches abort the entire undo before reversal. The API can return at most 50 strict conflict entries containing only item UUID, expected version, nullable actual version, and an allowlisted reason (`item_missing`, `version_mismatch`, or `state_mismatch`). It does not disclose field values, tenant-external existence, SQL detail, table names, or raw payloads.

### Reset, workflow generations, and deterministic baseline

- [x] **Reset is a named owner/admin operation, not a caller-secret protocol.** The application and RPC both require owner/admin authorization. The runtime additionally requires server-held `DEMO_PROJECT_SLUG` and `DEMO_RESET_SECRET` configuration before privileged initialization; configuration presence acts as an operator-controlled enablement gate. No caller secret is accepted from a browser, URL, header, body, RPC argument, fixture, audit row, or log. The RPC receives only actor, project, configured slug, and idempotency key, then rechecks `projects.is_demo`, the exact slug, actor role, baseline, and rate limit.
- [x] **The private baseline is integrity pinned.** Reset requires exactly 24 canonical items and 26 dependencies and recomputes the versioned canonical serialization of ordered item/dependency fields, excluding `created_at`. It must equal `f5fdef78150fe8eb6a87962e50e635e60927909fbf70019a2f53cee970624f8a`; a count-preserving baseline edit therefore fails closed rather than becoming a new reset truth.
- [x] **Reset preserves audit/evidence through workflow generations.** The reset operation and activity are written in the closing generation, canonical item values and 26 edges are restored, nonbaseline items are cancelled and retired rather than deleted, and `projects.workflow_generation` advances once. Current planning/history reads select the active generation, while explicit bounded archived history remains available. Reset, undo, and evidence rows are never erased by the reset operation.
- [x] **A restored source can be analyzed in the new generation without colliding with archived evidence.** Project revision v2 includes workflow generation, and source-document lookup/reuse plus analysis duplicate and rate queries are scoped to the current generation. The same normalized synthetic update can therefore create or reuse a current-generation source and create a new analysis claim after reset while the prior source and derived history remain immutable and archived.
- [x] **Active item keys are deterministic and overflow-safe across resets.** Retired nonbaseline items do not reserve the active project key namespace. Active-key uniqueness is enforced with a partial unique index, the database enforces the same 64-character boundary as the public Zod schema, and constrained task/risk allocation uses arbitrary-precision numeric suffixes plus nontruncating formatting under the project lock. Linked regression verification inserted `TSK-999999999999` and successfully allocated `TSK-1000000000000`; a 65-character otherwise-valid key failed on the named length constraint. Repeating the same baseline scenario therefore yields the same active key sequence without deleting the retired historical item.
- [x] **Reset replay and frequency are bounded.** Same-key/same-fingerprint replay returns the original reset operation and does not advance generation again. A different successful reset within 60 seconds records a safe rate-limited failure. Wrong-slug, non-demo, cross-project, and cross-workspace attempts fail closed.

### Verification results and residual risks

- [x] Reviewed a linked dry run, then applied `20260718190000_add_approval_undo_demo_reset.sql` and `20260718191000_harden_prompt9_operations.sql` to the confirmed project. The local/remote migration ledger is aligned, generated `src/types/database.ts` matches the linked schema after line-ending normalization, public/private schema lint reports no errors, and the Supabase security advisor reports no findings. Performance advisors report only unused-index informational notices expected for the new/small dataset.
- [x] Ran `verify_p0.sql`, `verify_analysis_pipeline.sql`, and the complete rollback-wrapped `verify_operations.sql` against the linked project. The operation suite covers authorization, the four-action allowlist, partial selection, full rollback, canonical request permutations/collisions, same-item multi-update undo, bounded persisted conflict detail, no undo-of-undo, baseline checksum, current-generation source lookup/reuse and rate-limit scoping, deterministic active-key reuse, large numeric suffix allocation, reset rate limiting, and non-demo reset denial. A post-run query confirmed no verifier rows were retained.
- [x] Ran a separate synthetic linked evidence transaction that observed successful apply, ordered before/after history, successful undo, successful reset, workflow generation advance, and overflow-safe creation, then explicitly rolled back. A follow-up query confirmed the verification operation keys were not retained. This verifies the database RPC/audit contract, not cookies, HTTP routing, or UI behavior.
- [x] On the settled Prompt 9 diff, Node 22 lint, typecheck, 223 tests across 37 files, the production build, and `git diff --check` passed.
- [ ] Complete an owner/admin browser flow for apply → current history → undo → reset, plus viewer denial, duplicate feedback, conflict rendering, archived-history labeling, session refresh, keyboard focus, and explicit reset confirmation. No live browser operation is claimed here.
- [ ] Keep a deployment-level request-size limit. The route checks declared and actual encoded size, but `Request.text()` is not itself a streaming memory bound when a length header is absent or dishonest.
- [ ] Treat the 60-second reset limit and server configuration gate as P0 controls, not reauthentication or general abuse prevention. When reset is enabled, a compromised owner/admin session can request it; deployment session security, monitoring, alerts, and rapid route containment remain required.
- [ ] Treat the service-role key as high impact despite narrow adapters. Rotate it and contain all privileged routes if exposure is suspected; never place a replacement value or private audit payload in Git, tickets, chat, screenshots, or command output.
- [ ] An unexpected database exception rolls back the entire operation atomically and returns a generic error, but may roll back before a failed operation header can persist. Treat a route error with no terminal operation as an incident/reconciliation state; verify project state is unchanged and never fabricate audit history.
- [ ] Confirm product copy clearly marks create-task, create-risk, and confirmation operations as nonreversible. Recovery for them requires a new reviewed forward action, not an implied undo.

The unchecked items remain release/demo gates. This review contains no secret value. It claims the exact Node, linked migration/type/lint/advisor, and rollback-wrapped SQL/RPC evidence recorded above; the authenticated HTTP/browser workflow remains unclaimed.

## Prompt 10 integrated security review

Scope: the complete P0 diff from current `main` through `deston/07-integration-deploy`, including the integrated Andres UI, proposal-readiness transition, model-context budget, operation retry behavior, reset control, and guarded browser test seam.

### Reviewed controls

- [x] **Secrets stay outside the browser graph.** Static boundary tests reject server-only environment, privileged Supabase, and OpenAI imports from browser-reachable modules. The service-role client remains nominally distinct, `server-only`, and initialized only after request-scoped authorization.
- [x] **Every production project route reauthorizes scope.** Analyze requires contributor membership; apply, undo, and reset require owner/admin membership; history is user-scoped. Path project/proposal/operation identifiers remain authoritative and tenant-sensitive failures disclose no other workspace.
- [x] **Redirect and session boundaries remain local.** Protected routes use verified claims and the allowlisted `/app` redirect contract; proxy/session tests cover refreshed cookies without treating an unverified browser session as authorization.
- [x] **Source and model data remain untrusted.** Source bodies, project context, Responses output, evidence spans, IDs, fields, values, owners, dates, impacts, and proposal actions are strictly bounded and postvalidated. GPT receives no tools, does no traversal, and has no mutation capability.
- [x] **Model context is aggregate-bounded.** Descriptions are deterministically limited per item and in aggregate, the encoded item projection has a hard ceiling, and extraction no longer receives dependency rows that only deterministic traversal needs.
- [x] **Readiness does not equal approval.** The completion transition promotes only a fully eligible proposal to `ready`; the change remains `needs_confirmation`, all actions remain pending/unattributed, and no item or operation is created. Anomalous drafts remain quarantined.
- [x] **Browser roles cannot race review state.** Legacy authenticated direct-review policies and column grants are removed. Only the authorized apply transaction can move selected action review state together with allowlisted mutation and audit evidence.
- [x] **Operation requests are consistently bounded.** The UI/model/apply action count is one shared maximum of eight, encoded bodies above 32,000 bytes return safe `413` responses, and database validation remains defense in depth.
- [x] **Retries distinguish definitive, successful, and ambiguous outcomes.** A received 4xx clears the current browser idempotency key so a corrected request can create a new attempt; a structurally valid success retires the completed key before another logical operation; network errors, 5xx responses, and malformed success bodies retain it so an ambiguous committed result can be replayed safely. Apply, undo, and reset have regression coverage.
- [x] **Reset remains explicitly protected.** Only an owner/admin can open the confirmation control. The browser sends `confirmed` plus an idempotency key and never receives or supplies the reset secret.
- [x] **The browser fixture cannot become a production backdoor.** The test-only page requires a non-production runtime plus an exact test opt-in, is conspicuously labeled synthetic, and never changes production auth, proxy, or API route behavior. Boundary tests reject test-seam references from those production modules.
- [x] **Logs and UI errors are safe.** Client errors prefer stable server messages without database/provider details; documentation and tests contain no credentials, session values, private headers, or fake production keys.
- [x] **RLS and constrained grants remain documented.** User-scoped tables retain RLS, privileged wrappers retain exact grants, and linked SQL verification includes anonymous/cross-tenant denial plus authenticated direct-review denial.
- [ ] **Live deployment verification remains pending.** CI-safe Playwright cannot prove hosted cookies, RLS, service-role/OpenAI configuration, one funded provider response, or deployment monitoring. Follow the production smoke path in `docs/qa-checklist.md` before presenting those as verified.

### Residual operational risks

- Deployment-level body limits are still required because `Request.text()` is not a streaming memory bound when a length header is absent or false.
- Stale-claim reconciliation is demand-driven. A refresh-only workflow does not expire a row; the exact update must be resubmitted after the bounded lease delay, and evidence must never be deleted to bypass it.
- The service-role credential remains high impact despite narrow adapters. Rotation, alerting, deployment access control, and rapid route containment remain operator responsibilities.
- P0 reset rate limiting is not reauthentication. A compromised owner/admin session can still request the named synthetic reset.
- The guarded browser fixture proves UI contract integration only. The open manual-QA issue tracks live authorization, responsive, provider, mutation, and reset evidence.

Final command, dependency-audit, linked-database, and formal-review evidence is recorded in the current Prompt 10 section of `docs/qa-checklist.md`. This section contains no secret value.
