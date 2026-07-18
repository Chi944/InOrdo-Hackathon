# InOrdo rollback plan

## Principles

- Roll back application artifacts; do not rewrite shared Git history.
- Keep the database migration ledger forward-only.
- Never delete evidence, audit history, or shared project data to reverse a release.
- Reverse user-visible record changes through authorized compensating operations with current versions.
- Stop on a conflict; never force an overwrite or decrement an item version.

## Before release

Record the deployed application commit, remote migration ledger, affected project/workspace IDs, and the current backup/PITR status. Do not record credentials or raw private evidence. The known-good application commit before Prompt 5 is `1aa95f2` (`feat: add Supabase authentication and data access`). The known-good application commit before Prompt 7 is `2c9c11b` (`feat: add project records and dependency engine`).

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
- A `processing` claim can remain if the provider path or terminal failure transition was interrupted. Keep the route contained, inspect only safe state/metadata, and ship a separately reviewed forward repair. The current duplicate path returns the existing processing state and does not resume or terminalize it. Do not issue an ad hoc direct table update.
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
- duplicate processing/success/failure behavior, rate limiting, stale project revision, refusal, malformed output, timeout, transient retry, and terminal failure recording are verified;
- a synthetic test proves the analysis path creates no project-item mutation and all proposal actions remain pending;
- when funded credentials and safe synthetic input are available, exactly one controlled live request confirms both bounded logical model calls and records only safe metadata; and
- browser/UI verification is completed if the analysis form or pending-review surface is part of the deployment.

If live credentials are unavailable, keep the live and browser criteria explicitly pending; do not substitute mocked tests for a live-provider claim.
