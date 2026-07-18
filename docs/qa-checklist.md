# QA checklist

## Last completed automated gate (Prompt 5)

- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm run test:run`
- [x] `npm run build`
- [x] `git diff --check`
- [ ] `npm run test:e2e` for implemented browser workflows when a Playwright browser is available

The checked command results above are the preserved Prompt 5 handoff evidence. They do not imply that the Prompt 7 diff has passed.

## Prompt 7 verification gate

- [x] `npm run lint` for the complete Prompt 7 diff under Node 22
- [x] `npm run typecheck` for the complete Prompt 7 diff under Node 22
- [x] `npm run test:run` for the complete Prompt 7 diff under Node 22 (177 tests across 32 files)
- [x] `npm run build` for the complete Prompt 7 diff under Node 22
- [x] `git diff --check` for the complete Prompt 7 diff
- [x] Linked migration ledger, schema lint/security advisors, generated types, and Prompt 7 rollback-wrapped SQL verification
- [ ] Exactly one controlled live OpenAI analysis with safe metadata only
- [ ] Browser login, analysis submission, pending review display, and confirmation behavior

The linked database gate is complete: all three additive Prompt 7 migrations were applied to the confirmed project, generated types were refreshed, public/private schema lint returned no errors, security advisors returned no findings, and transaction-wrapped SQL assertions passed without retaining test rows. Performance advisors reported only unused-index informational notices expected on this new/small dataset. Node 22 lint, typecheck, 177 unit/integration tests across 32 files, and the production build passed. Live analysis and browser checks were not run because the required environment variable names were absent from the process environment.

## Prompt 9 verification gate

Prompt 9 automated and linked database verification is complete on the applied schema. Authenticated HTTP/browser verification remains a separate release gate.

- [x] `npm run lint` under Node 22
- [x] `npm run typecheck` under Node 22
- [x] `npm run test:run` under Node 22 (223 tests across 37 files)
- [x] `npm run build` under Node 22
- [x] `git diff --check`
- [x] Reviewed linked `npx supabase db push --dry-run`, followed by the operations migrations
- [x] Regenerated linked `src/types/database.ts` and confirmed no unexplained schema drift
- [x] Public/private schema lint and Supabase security advisors with no new actionable finding
- [x] Rollback-wrapped `supabase/tests/verify_operations.sql` against the linked project with no retained verification rows
- [x] One authorized linked apply → history → undo → reset RPC/audit sequence using only synthetic data, explicitly rolled back

Linked evidence on 2026-07-18: the migration ledger is aligned through `20260718191000_harden_prompt9_operations`; generated types match the linked schema after line-ending normalization; schema lint returned no errors; the security advisor returned no findings; and performance advisors reported only unused-index informational notices on the new/small dataset. `verify_p0.sql`, `verify_analysis_pipeline.sql`, and `verify_operations.sql` all completed inside rollback-wrapped linked transactions. A separate evidence query observed `apply_state=succeeded`, ordered before/after history present, `undo_state=succeeded`, `reset_state=succeeded`, workflow generation `2`, and overflow-safe item creation, then a follow-up confirmed no verification operation keys were retained. This is database RPC/audit evidence, not authenticated HTTP, cookie, route, or browser evidence.

### Prompt 9 operation and security cases

- [x] Owner/admin apply succeeds; viewer, nonmember, cross-workspace, and cross-project requests fail closed.
- [x] Only pending actions belonging to the named proposal/project can be selected.
- [x] The executable allowlist is limited to an allowlisted item-field update, constrained task creation, constrained risk creation, and confirmation activity.
- [x] Delete, membership, dependency, arbitrary-patch/SQL, external-call, unknown-field, and malformed-payload attempts are rejected.
- [x] A required human response must explicitly match one selected action; missing, duplicate, extra, or unselected responses are rejected.
- [x] Partial selection applies only selected actions in proposal ordinal order and leaves unselected actions pending.
- [x] Mutation, action/proposal transitions, the operation header, and every ordered before/after audit item commit together or all roll back.
- [x] Same-key/same-request replay returns the original operation without repeating effects; same-key/different-request reuse conflicts.
- [x] Undo restores only an entirely reversible update operation, processes reverse records in reverse order, and writes a new operation linked to the original.
- [x] Undo rejects a stale version or after-state mismatch without partial reversal; repeat undo is stable and undo-of-undo is rejected.
- [x] Current history is generation-scoped, bounded, ordered, and actor-attributed; `includeArchived=true` exposes preserved prior generations.
- [x] Reset accepts only explicit confirmation and an idempotency key; no reset secret is accepted through a browser, URL, header, body, RPC argument, fixture, audit row, or log.
- [x] Reset rechecks owner/admin access, configured slug, the demo marker, a deterministic baseline, idempotency, and rate limiting inside the reviewed database boundary.
- [x] Reset restores 24 active canonical items and 26 edges, retires nonbaseline items without deleting history, records its operation in the closing generation, and advances the generation once.

### Pending authenticated HTTP/browser procedure

The linked SQL/RPC procedure above is complete. The following end-to-end procedure still requires an operator-created owner/admin Auth account and the configured synthetic project. Keep all credentials in untracked environment configuration; do not paste or print them.

1. Create or identify a pending proposal with one reversible field update and note its proposal/action UUIDs, target value, and expected item version.
2. `POST /api/projects/[projectId]/proposals/[proposalId]/apply` with that action UUID and a new idempotency key. Confirm a `201`, the expected value/version change, `succeeded` operation, actor attribution, action state, and ordered before/after/reverse audit item.
3. Repeat the identical request and confirm `200`, `duplicate: true`, the same operation ID, and no second version increment. Reuse the key with a changed selection and confirm a safe conflict.
4. `GET /api/projects/[projectId]/operations?limit=25&includeArchived=false` and confirm the apply header plus its item-level ordinal, before-state, after-state, expected/resulting versions, reversibility, and initiator.
5. `POST /api/projects/[projectId]/operations/[operationId]/undo` with a new idempotency key. Confirm the before-state is restored at a newer version and a new `undo` operation references the original. Repeat it to confirm a stable duplicate; separately verify a post-apply target change produces an undo conflict without partial reversal.
6. With `DEMO_PROJECT_SLUG` and `DEMO_RESET_SECRET` configured only on the server, `POST /api/projects/[projectId]/demo/reset` using `{ "confirmed": true, "idempotencyKey": "<unique-key>" }`. Confirm the 24-item/26-edge baseline, retirement of extras, a one-step generation advance, and preservation of the reset operation in the closing generation.
7. Confirm current history is clean for the new generation, `includeArchived=true` retains the apply/undo/reset trail, an identical reset replay is stable, an immediate distinct reset is rate-limited, and a non-demo/wrong-project request is denied.
8. Record exact non-secret HTTP/browser results here and in `docs/codex-log.md`; until then this browser procedure remains pending.

## Product behavior

- [ ] Original evidence remains visible and unchanged.
- [ ] Candidate extraction is labeled as model output and can be corrected or rejected.
- [ ] Direct and downstream impacts are produced by deterministic traversal.
- [ ] Every impact shows an evidence reference and dependency path.
- [ ] Proposals remain inert before explicit human approval.
- [ ] Sensitive actions can remain unapproved while other actions proceed.
- [ ] Applied operations identify the approver and reversible before-state.
- [ ] Undo creates a traceable compensating operation.
- [ ] Demo reset affects only the configured synthetic project.

## Security

- [ ] No secret appears in source, logs, screenshots, client bundles, fixtures, or Git history.
- [ ] Service-role and OpenAI keys are referenced only by server-only code.
- [ ] RLS and server authorization tests cover cross-project access.
- [ ] Model output is schema-validated and never directly mutates data.
- [ ] Stale versions, repeated requests, and partial failures fail safely.

### Prompt 5 reviewer evidence

- [x] Anonymous Auth identities fail closed in both application guards and linked RLS verification.
- [x] Cross-workspace item owners and cross-project dependency endpoints are rejected by database constraints.
- [x] Request and feature modules cannot import the privileged client; user/privileged clients are nominally distinct.
- [x] Refreshed session cookies and cache-safety headers are preserved by tested response paths.
- [x] A rollback-wrapped linked item edit, stale retry, dependency create/remove, and post-rollback read completed without retained test data.
- [ ] Real browser login and UI mutation flow with an operator-created Auth user.

### Prompt 7 implementation evidence (code review, not command results)

- [x] The request and source schemas are strict and bounded; unsupported keys, source types, depths, and oversized request bodies fail closed.
- [x] Contributor authorization and one-project context loading happen before the model boundary.
- [x] The server-only Responses adapter sets `store: false`, low reasoning, no tools, bounded output, a 30-second timeout per logical call, and at most one SDK retry per call.
- [x] Prompts treat source/input as untrusted data and cannot grant tools, IDs, fields, or action types.
- [x] Strict parsing is followed by ID, field, enum, date, owner, evidence-span, current-value, version, confidence, and impact-coverage validation.
- [x] Pure deterministic traversal, not GPT, produces the downstream paths supplied to proposal drafting.
- [x] The first persistence phase stores evidence and a duplicate/rate/revision claim; final derived writes are an all-or-nothing inert transaction.
- [x] Proposal actions are persisted pending and the analysis path contains no project-item mutation.
- [x] Prompt-injection, tenant-isolation, replay/spend, stale-state, partial-write, secret-boundary, and model-mutation threats have implementation controls documented in `docs/security-review.md`.
- [x] Prompt 7 has a forward-only containment/rollback procedure that preserves evidence and treats stuck processing claims as an operator-reconciliation state.
- [x] Complete Prompt 7 repository tests and linked SQL checks pass.

## Accessibility and responsive review

- [ ] Keyboard navigation and visible focus work throughout.
- [ ] The document has one clear `h1`, logical headings, landmarks, and a skip link.
- [ ] Status is conveyed with text, not color alone.
- [ ] Disabled and unavailable actions explain why.
- [ ] Layouts work at approximately 375, 768, and 1440 pixels without page overflow.
- [ ] Reduced-motion preferences are respected.

## Demo claims

- [ ] Synthetic data is visibly labeled.
- [ ] No unverified feature is described as working.
- [ ] Submission copy and video match the verified build.
