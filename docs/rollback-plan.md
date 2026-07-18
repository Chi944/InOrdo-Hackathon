# Prompt 5 rollback plan

## Principles

- Roll back application artifacts; do not rewrite shared Git history.
- Keep the database migration ledger forward-only.
- Never delete evidence, audit history, or shared project data to reverse a release.
- Reverse user-visible record changes through authorized compensating operations with current versions.
- Stop on a conflict; never force an overwrite or decrement an item version.

## Before release

Record the deployed application commit, remote migration ledger, affected project/workspace IDs, and the current backup/PITR status. Do not record credentials or raw private evidence. The known-good application commit before Prompt 5 is `1aa95f2` (`feat: add Supabase authentication and data access`).

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
