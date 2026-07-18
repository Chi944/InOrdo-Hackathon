# InOrdo rollback plan

## Principles

- Roll back application artifacts; do not rewrite shared Git history.
- Keep the database migration ledger forward-only.
- Never delete evidence, audit history, or shared project data to reverse a release.
- Reverse user-visible record changes through authorized compensating operations with current versions.
- Stop on a conflict; never force an overwrite or decrement an item version.

## Before release

Record the deployed application commit, remote migration ledger, affected project/workspace IDs, and the current backup/PITR status. Do not record credentials or raw private evidence. The known-good application commit before Prompt 5 is `1aa95f2` (`feat: add Supabase authentication and data access`). The known-good application commit before Prompt 7 is `2c9c11b` (`feat: add project records and dependency engine`). The known-good application commit before Prompt 9 is `7e7405a` (`feat: add secure evidence-backed project analysis`).

## Application rollback

Redeploy the last known-good artifact or commit. Do not use `git reset --hard`, force-push, or delete the Prompt 5 branch. The Prompt 5 migration is backward-compatible with Prompt 3: it narrows anonymous authorization and rejects invalid cross-workspace owners, so an application rollback does not require a matching database reversal.

## Database rollback

Do not remove an applied migration file or run a destructive down migration. If the new authorization function, policy, constraint, or index has a defect, first close or disable the affected write path at the application layer. Ship a separately reviewed, numbered forward migration that restores safe compatibility while retaining data. Re-run anonymous, role, cross-workspace, and constraint checks before reopening writes.

The owner-membership constraint may expose pre-existing invalid data during deployment. If that occurs, stop the migration, inventory the invalid rows, and reconcile each owner to a valid workspace member or `null` with product-owner approval. Do not silently delete profiles, memberships, items, or evidence.

## Item-edit compensation

1. Capture the prior allowed field values and the item ID from the approved change record or operator notes.
2. Reload the item through the authenticated project operation and obtain its current version.
3. If another edit occurred, stop for human reconciliation.
4. Submit only the prior allowed values with the current version as `expectedVersion`.
5. Let the database increment the version again; never write or decrement `version` directly.
6. Verify the returned values and new version.

## Dependency compensation

- To reverse a dependency creation, remove the exact dependency ID through the authorized scoped operation.
- To reverse a dependency removal, recreate the captured `from_item_id`, `to_item_id`, relationship, and rationale only after confirming both endpoints still exist in the same project, the edge is not self-referential, and the typed edge is not already present. If either endpoint's status changed after removal, stop for human reconciliation before compensating; completed or cancelled endpoints can still hold valid dependency records even though traversal excludes them.
- A recreated dependency receives a new ID and actor attribution. Do not rewrite history to reuse the deleted row identity.

## Authentication and sessions

An ordinary application rollback keeps Auth users and valid sessions. Preserve the request proxy and RLS policies. Revoke sessions only for an authentication incident or an incompatible auth change, then require a fresh login and verify that logout removes protected access. Do not delete Auth users as a substitute for session invalidation.

## Verification before reopening writes

Run the Node 22 lint, typecheck, unit, build, and diff gates. Verify owner/admin/member/viewer behavior, anonymous denial, cross-workspace denial, stale-version conflict, dependency direction, deterministic traversal, and unchanged evidence/audit rows. Confirm the migration ledger and security advisors. For a UI release, also run one real item edit and dependency add/remove with an operator-created Auth account.

## Incident ownership

Deston owns database, RLS, server-operation, and graph-engine rollback decisions. Andres owns any presentation-only rollback. Security-sensitive or cross-boundary compensation requires both owners to review the user-visible effect and the verification evidence before writes resume.

## Prompt 7 analysis rollback

Prompt 7 adds an application route and a forward database schema for immutable evidence, analysis claims, model-derived review records, and the inert `request_confirmation` action type. Its rollback objective is to stop new model spend and unsafe finalization while preserving evidence and review history. It is not a destructive data reversal.

### Contain first

1. Disable access to `POST /api/projects/[projectId]/analyze` at the deployment layer or redeploy the known-good Prompt 5 artifact `2c9c11b`.
2. Preserve current application/provider logs under the project's normal retention controls, but do not copy raw source text, prompts, model output, credentials, or private project data into tickets or this repository.
3. Record only safe incident coordinates: deployed commit, migration version, affected workspace/project/analysis-request IDs, claim state, model name, provider request ID when already stored, timestamps, and error code/stage.
4. If credential exposure is suspected, rotate or revoke the affected key in its provider console and deployment secret store. Never place the replacement value in Git, chat, command output, or a tracked file.

Redeploying Prompt 5 removes the analysis HTTP route while retaining project-item/dependency behavior. The Prompt 7 schema is additive for those paths: extra nullable source/change columns, the new analysis table, and an additional proposal enum value do not require a matching destructive down migration. The Prompt 7 migration also revokes direct authenticated source-document insertion; Prompt 5 has no supported source-write workflow that depends on that grant.

### Preserve claims and evidence

- Never delete `source_documents`, `analysis_requests`, `change_events`, `impact_runs`, `impact_items`, `action_proposals`, or `proposal_actions` to make a retry possible.
- Succeeded analyses remain inert pending review. Reject them through the future authorized review workflow if they are unsuitable; do not mutate their evidence, paths, or model metadata.
- Failed claims are terminal for the same project revision and normalized source hash. Do not alter the hash, revision, state, or source text to bypass duplicate protection.
- A `processing` claim has an immutable three-minute lease. An exact POST replay during the lease returns the bounded remaining delay; the first exact replay after expiry locks and terminalizes that same row as failed without starting a model call or deleting evidence. A success transition at or after expiry is rejected and rolls back its derived writes. This reconciliation is demand-driven: a page refresh alone does not invoke it, so follow the UI instruction to resubmit the exact source after the delay. Do not issue an ad hoc direct table update.
- Because evidence/claim creation commits before model work, a provider failure can legitimately leave a source document plus failed claim without derived rows. That is the intended auditable state, not partial derived corruption.

### Database correction

Do not drop the Prompt 7 enum value, table, columns, functions, constraints, triggers, policies, or stored analysis rows. PostgreSQL enum rollback and evidence deletion are especially unsuitable release-reversal mechanisms. If an RPC, policy, constraint, or validation rule is defective:

1. contain the route;
2. identify the exact migration and affected claim states;
3. create a new numbered forward migration that narrows or replaces the faulty contract while retaining evidence;
4. review function ownership, empty `search_path`, fully qualified objects, direct table grants, RPC execution grants, RLS, and anonymous/cross-tenant denial;
5. run the migration in a transaction-capable test path and then against the confirmed linked project; and
6. regenerate database types and rerun linked schema/security verification before reopening analysis.

If finalization is suspected of producing invalid derived rows, do not edit or delete them in place. Keep the analysis route disabled, prevent those proposals from being approved, inventory affected IDs without copying private payloads, and use a product/security-reviewed forward quarantine or status transition. Prompt 7 itself has no operation that applies those rows to project items.

### Reopen criteria

Before restoring analysis traffic, require all of the following:

- Node 22 lint, typecheck, unit tests, production build, and `git diff --check` pass on the exact artifact;
- linked migration ledger, generated types, schema lint, RLS/grant/constraint SQL checks, and security advisors are clean for the exact forward migration;
- duplicate active/expired/success/failure behavior, lease retry guidance, expired-success rollback, rate limiting, stale project revision, refusal, malformed output, timeout, and terminal failure recording are verified;
- a synthetic test proves the analysis path creates no project-item mutation and all proposal actions remain pending;
- when funded credentials and safe synthetic input are available, exactly one controlled live request confirms both bounded logical model calls and records only safe metadata; and
- browser/UI verification is completed if the analysis form or pending-review surface is part of the deployment.

If live credentials are unavailable, keep the live and browser criteria explicitly pending; do not substitute mocked tests for a live-provider claim.

## Prompt 9 operation rollback

Prompt 9 introduces privileged apply, undo, history, and reset routes plus forward schema for canonical request fingerprints, ordered audit items, workflow generations, generation-scoped evidence, active-key retirement, and a private deterministic demo baseline. Its rollback objective is to stop new mutations, use audited compensation only when safe, and preserve every evidence/audit generation. It is never a request to erase an operation, decrement a version/generation, or rewrite shared Git/database history.

### Contain first

1. Block `POST /api/projects/[projectId]/proposals/[proposalId]/apply`, `POST /api/projects/[projectId]/operations/[operationId]/undo`, and `POST /api/projects/[projectId]/demo/reset` at the deployment layer. Keep the bounded history GET available for investigation unless the incident is a history-disclosure defect; in that case block `GET /api/projects/[projectId]/operations` too.
2. Prefer route containment or a current generation-aware artifact with operation POSTs disabled. Commit `7e7405a` is the pre-Prompt 9 application reference and removes the operation routes, but it predates workflow-generation revision v2 and current-generation repository filters. If it is redeployed after the Prompt 9 migrations, also contain the analysis route and do not treat its workflow reads as archive-aware until a reviewed compatibility artifact or forward migration is deployed.
3. Record only safe incident coordinates: deployed commit, local/remote migration versions, workspace/project/proposal/action/operation IDs, operation type/state/error code, workflow generation, item versions, and timestamps. Do not copy source text, human responses, before/after values, reverse payloads, credentials, or private audit data into Git or a public ticket.
4. Preserve database and deployment logs under normal retention. If the service-role key may be exposed, rotate it in the provider/deployment secret stores and keep every privileged route closed until the replacement and grant inventory are verified. Never print or commit the key.
5. If application containment is insufficient, ship a new numbered forward migration that revokes `service_role` execution from the three public operation wrappers and their private implementations. Do not edit or remove an already applied migration. Regrant only after a reviewed replacement is verified.

### Apply-operation recovery

1. Stop new apply requests and read the operation header plus its ordered operation items through the authorized history boundary. Verify project, proposal, actor, idempotency fingerprint, state, reversibility, item IDs, expected/resulting versions, and current workflow generation.
2. A terminal failed apply is expected to have no project mutation and no partial operation items. Keep the failed row and its consumed idempotency key. Do not change its state/hash or retry a different request under that key.
3. An unexpected route/RPC error may roll back before a failed operation header persists. Keep apply closed, look up the idempotency key through the authorized history boundary, and verify that proposal/action/item state is unchanged. If no terminal operation exists, preserve safe request coordinates for reconciliation; never fabricate or backfill runtime audit rows to make the attempt appear terminal.
4. For a successful operation marked entirely reversible, request the normal compensating undo only if every target still has the recorded final version and latest after-state for each affected field. Let the undo preflight handle multiple updates to one item and reverse the complete plan in descending ordinal order. Stop on any bounded conflict; never force a field value or version.
5. Do not use undo for an operation containing task/risk creation or confirmation activity. Those operations are intentionally nonreversible. A product owner must approve a new forward action: for example, cancel a created task/risk using its current version or add a corrective confirmation/activity. Preserve the created record and original audit; never delete either to simulate rollback.
6. If the apply audit itself is suspected to be incomplete or incorrect, do not trust its reverse payload. Keep the route closed, compare the current state with trusted backup/PITR and product-owner evidence, and ship a separately reviewed compensating operation or forward repair. Never hand-edit `operation_logs`, `operation_items`, proposal states, or item versions.

### Undo-operation recovery

- A failed undo with `undo_conflict` changes no target. Retain its safe conflict details, reload the named item versions/current state, and require human reconciliation. A new reviewed action may compensate the original intent; do not bypass the conflict with direct SQL.
- A successful undo is final append-only history and cannot itself be undone. If it was requested by mistake, create a new reviewed proposal/action against current versions and apply it as a separate operation. The original apply and undo remain visible.
- Same-key/same-request replay must return the same terminal undo. Same-key/different-request conflict is containment evidence, not permission to edit the key or request hash. Use a new key only for a genuinely new, human-reviewed operation.
- Do not remove or relax the unique successful-reversal index. If a concurrency defect is suspected, close undo, inventory every reversal ID, and repair through a forward migration without deleting either operation.

### Demo-reset recovery

1. Disable the reset POST immediately. Keep `DEMO_PROJECT_SLUG` and `DEMO_RESET_SECRET` only in the server secret store; removing/invalidating reset configuration is an additional operator kill switch, not a replacement for route containment.
2. Record the reset operation ID, actor, configured project slug, closing/current generation, and the active baseline counts. Confirm whether the private baseline matches canonical checksum `f5fdef78150fe8eb6a87962e50e635e60927909fbf70019a2f53cee970624f8a`, computed from the versioned canonical serialization of ordered item/dependency fields excluding `created_at`. Do not log the serialized private rows.
3. If checksum or 24-item/26-dependency validation fails, reset must remain closed and no project state should have changed. Rebuild the private snapshot only through a reviewed forward migration from the version-controlled synthetic seed, then recompute the existing pinned digest. Never change the expected digest merely to bless unexplained snapshot drift.
4. A successful reset has no built-in undo. Do not decrement `projects.workflow_generation`, relabel old rows as current, delete the reset operation, or erase archived evidence. The reset's canonical baseline is the safe current state while recovery is assessed.
5. Nonbaseline items survive as cancelled, retired records; do not hard-delete them. If a product-approved recovery needs one, restore its material fields through a reviewed forward operation in the current generation and resolve any active item-key collision explicitly. Nonbaseline dependency edges are not retained by baseline reset, so reconstruct them only from a trusted pre-reset backup/PITR or independently verified product record—never by inference from stale graph output.
6. To return intentionally to the canonical demo baseline after a corrected reset implementation, wait for the rate window and use a new idempotency key. Replaying the original key must remain a no-op duplicate. Do not edit operation timestamps or failed rows to bypass the 60-second rate limit.
7. Wrong-slug, non-demo, cross-project, or cross-workspace behavior is a security incident. Keep all operation routes contained, preserve safe IDs, audit owner/admin sessions and RPC grants, and use backup/PITR comparison plus a separately reviewed forward repair. Do not run reset against another project as a diagnostic.

### Workflow-generation and archive policy

- Workflow generation is monotonic. Never decrement it, reuse a prior number, or bulk-update archived evidence, analysis, proposal, operation, or activity rows into the current generation.
- A reset operation belongs to the closing generation. Current planning/history defaults to the active generation; `includeArchived=true` is a bounded read for investigation, not a mutation mechanism.
- The same normalized source may legitimately appear again in a later generation. Keep source-document lookup/reuse and analysis duplicate/rate queries scoped to the current generation, and preserve both generations' source documents and claims. Do not alter hashes/revisions or broaden reuse across reset boundaries to deduplicate archived evidence.
- Retired items remain historical identities but do not reserve the active key namespace. Keep active-key uniqueness partial and deterministic. Before unretiring an item, check for an active key collision and resolve it through an explicit reviewed rename or leave the old item retired; never disable the index to force two active keys.
- If pre-reset business state must be reintroduced, create reviewed current-generation records or operations from trusted evidence. Preserve the archived originals and link the recovery in operator notes/activity rather than retagging history.

### Forward-only database correction

Never delete `20260718190000_add_approval_undo_demo_reset.sql`, its hardening migration, an applied ledger row, workflow-generation columns, audit hashes, baseline tables, or stored operations. Do not run a destructive down migration. For a defect:

1. contain the affected routes and identify the exact migration/function/index/trigger plus affected IDs and generations;
2. create a new numbered forward migration that revokes or replaces the smallest unsafe capability while leaving history readable;
3. preserve the service-role-only `SECURITY INVOKER` wrapper, private empty-`search_path` implementation, fully qualified object references, actor/role recheck, and explicit execution grants;
4. preserve `operation_logs_immutable` and `operation_items_immutable`; if a migration-owned backfill is unavoidable, disable a trigger only inside one reviewed transaction, update only the necessary legacy rows, and re-enable it before exposing any function;
5. preserve canonical fingerprint semantics, one-successful-undo uniqueness, current-generation source lookup/reuse and rate-limit scoping, deterministic active-key uniqueness, and the pinned baseline checksum unless the forward migration includes a reviewed compatibility/data plan;
6. regenerate database types and run rollback-wrapped SQL against the confirmed target before regranting RPC execution; and
7. document the repair and exact non-secret verification without rewriting earlier audit evidence.

### Reopen criteria

Keep operation writes closed until all applicable criteria are recorded:

- Node 22 lint, typecheck, complete unit suite, production build, and `git diff --check` on the exact artifact;
- linked migration ledger, generated types, public/private schema lint, security advisor, RLS/grant inventory, immutable triggers, and no unvalidated constraints;
- rollback-wrapped tests for role/tenant denial, the four-action allowlist, required human input, partial selection, transaction rollback, canonical request permutations/collisions, ordered audit, same-item multi-update undo, bounded undo conflicts, and no undo-of-undo;
- deterministic reset tests for the pinned baseline checksum, 24 active items, 26 dependencies, retired-history preservation, current-generation source reuse, active-key reuse, one-step generation advance, duplicate replay, rate limit, and wrong/non-demo denial;
- one synthetic owner/admin apply → history → undo → reset flow on the confirmed linked project, with archived history checked and no private values recorded; and
- viewer denial and complete browser feedback/accessibility checks if those controls are exposed in the deployed UI.

This runbook defines recovery procedure; it is not execution evidence. Exact Prompt 9 migration, linked SQL/RPC, Node, and remaining authenticated browser results belong in `docs/qa-checklist.md` and `docs/codex-log.md`. If any applicable gate is unavailable, leave it visibly pending and keep the affected write route contained.

## Prompt 10 integration and readiness rollback

The Prompt 10 proposal-readiness migration is forward-only. Never delete or edit the applied migration, decrement proposal/workflow state, restore broad authenticated review grants, or rewrite proposal/action/operation history.

### Contain first

1. If analysis completion promotes an ineligible proposal, block the analyze and apply POST routes at the deployment layer. Keep authorized read/history access available unless the defect is a disclosure issue.
2. Record only safe coordinates: deployed commit, migration version, project/analysis/change/impact/proposal/action IDs, workflow generation, states, counts, and timestamps. Do not copy source text, prompts, model output, human responses, before/after payloads, credentials, cookies, or headers.
3. Confirm whether an operation exists. A readiness transition alone must leave the change `needs_confirmation`, every action pending/unattributed, project items unchanged, and operation history unchanged. If any mutation exists, switch to the Prompt 9 apply-operation recovery procedure.
4. If browser retry behavior is suspect, contain the affected apply, undo, or reset route and reconcile the idempotency key through authorized history before retrying. Never guess whether a network/5xx request committed and never reuse a key after a definitive failed 4xx correction.

### Forward repair

- Ship a new numbered migration that narrows or disables the readiness trigger/function. Prefer a guard that leaves affected proposals `draft` or moves them through a separately reviewed forward quarantine state; do not bulk-promote or delete historical drafts.
- Preserve the removal of direct authenticated `change_events` and `proposal_actions` review updates. If product requirements later need a reject/edit workflow, add a separately authorized, transactional server/RPC contract rather than restoring browser table writes.
- Preserve pending action state and append-only operation history. A ready proposal has no applied effect to compensate; correcting eligibility should not fabricate an operation row.
- If the model-context budget rejects legitimate canonical data, adjust only the deterministic projection in reviewed application code. Do not relax database bounds blindly or send the full database graph to GPT.
- A defect in the CI-only browser fixture is fixed or disabled in test configuration; it is never a reason to change production auth, proxy, project routes, or API authorization.

### Reopen criteria

- A linked transaction proves eligible completion yields exactly one ready proposal with all actions pending/unattributed and no item/operation mutation; failed, incomplete, wrong-generation, or structurally anomalous analyses stay unpromoted.
- The read-only `supabase/tests/verify_proposal_readiness_reconciliation.sql` query records the ready inventory and returns zero eligible succeeded drafts plus zero ready invariant violations.
- Authenticated direct review-table updates remain denied, while the authorized service-role completion and owner/admin apply contracts still work.
- Apply/undo/reset regression tests prove new keys after definitive 4xx outcomes and stable key replay after network/5xx ambiguity.
- The complete Node 22 lint, typecheck, unit, Playwright, production build, dependency audit, and diff gates pass on the repair artifact.
- The linked migration ledger, generated types, schema lint, security advisor, and rollback-wrapped P0/analysis/operation suites pass before routes reopen.
- One operator-held live production smoke follows `docs/qa-checklist.md`; unavailable steps remain visibly pending and the corresponding capability stays unclaimed.

## Prompt 12 Vercel production rollback

Prompt 12 adds deployment/readiness configuration and may include a forward-only metadata validator migration. Its release target is one Deston-operated Vercel Hobby project with manual CLI deployment and no Git-connected automatic deploy. Rollback must preserve Git authorship, database evidence, operation history, and the migration ledger.

### Contain and restore the last known-good artifact

1. Stop the affected write route first. For an analysis/provider defect, contain the analyze POST; for an apply/undo/reset defect, use the Prompt 9 route-specific containment above. A failing configuration-readiness check is not permission to keep a privileged route open.
2. Record only the deployed full Git SHA, Vercel deployment URL/ID, safe route/status/error code, model name/provider request ID if already stored, and applicable database migration version. Do not copy environment values, request bodies, evidence, model output, human responses, authorization headers, cookies, or private audit payloads.
3. List and inspect the known-good deployment, then repoint production with `npx vercel rollback <LAST_KNOWN_GOOD_DEPLOYMENT_URL_OR_ID>`. Verify the served deployment metadata and rerun `/api/health`, `/`, `/login`, signed-out `/app`, Auth, and the affected path. Do not disable Vercel deployment protection or delete the failed deployment to hide evidence.
4. A Vercel rollback changes only the served application artifact. It does not revert a database migration, rotate a credential, undo an operation, or erase an analysis claim. Keep migrations forward-only and use the matching Prompt 7/9/10 recovery section for persisted state.

If bad environment configuration caused the incident, correct only the affected name in Vercel's secret store, never on the command line or in Git. Redeploy before testing because environment updates do not change an existing artifact. If exposure is suspected, rotate the credential in the provider/Supabase console and Vercel, keep privileged routes contained, and never print or record either old or replacement value.

### Git revert and redeploy fallback

If no safe Vercel artifact exists or source must change, start from current `main` and use the migration-aware revert procedure in `docs/deployment-runbook.md`. A whole-commit `git revert` is permitted only when the inspected target contains no migration already applied to the linked project. Otherwise use a no-commit revert, restore `supabase/migrations` from current `HEAD`, verify application/schema compatibility, and commit only the truthful repair; if database behavior must change, add a new numbered forward migration. Never reset, force-push, rewrite another contributor's authorship, edit/remove an applied migration, or manufacture a new author to bypass a Hobby-plan restriction.

Run clean `npm ci`, lint, typecheck, the complete Vitest and Playwright suites, production build, production dependency audit, and diff/status checks on the revert. Open and review a PR, merge normally, pull the new `main` with `--ff-only`, record the new full SHA, rerun the complete gate, and deploy with `npx vercel --prod`. The exact commands are in `docs/deployment-runbook.md`.

If the Prompt 12 database validator is defective, keep analysis/finalization contained and ship a new numbered forward migration that narrows or replaces it. The current forward validator accepts both the prior artifact's exact legacy envelope and the current exact envelope during the rollback window; malformed present model names and unknown fields are still denied, and the function remains non-executable to public API roles. Preserve existing model metadata and derived records; never delete metadata or substitute a configured/requested model name for the actual provider-returned identifier. Re-run the linked ledger, generated-type comparison, schema lint, advisors, and rollback-wrapped SQL verifiers before reopening.

### Reopen criteria

- The exact artifact's SHA matches inspected Vercel deployment metadata and both working-tree status checks are empty.
- `/api/health` returns `200 ready` only with complete configuration, performs no database/provider call, and exposes/logs no values; deliberate missing-name verification returns safe `503 not_ready`.
- Fluid Compute is enabled; analysis retains its 90-second application budget, two sequential 30-second provider limits, disabled SDK/request retries, and application headroom. Other mutation/history routes retain their 30-second budget.
- Hosted Supabase Site URL/redirects match the exact production host, both local HTTP wildcards, and the account-scoped Preview wildcard; Auth login/logout and tenant denial pass in a fresh browser profile.
- The applicable authenticated synthetic analysis/operation/reset and responsive/accessibility smoke steps in `docs/qa-checklist.md` pass. If `OPENAI_API_KEY` or an operator Auth account is unavailable, keep those steps pending and the capability unclaimed.
