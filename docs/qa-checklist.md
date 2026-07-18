# QA checklist

## Project views branch gate (`andres/03-project-views`)

These checks are pending until the complete branch diff is settled. Earlier checked gates below are historical evidence for their named implementation slices, not evidence for this branch.

- [x] `npm run lint` under Node 22
- [x] `npm run typecheck` under Node 22
- [x] `npm run test:run` under Node 22 (236 tests across 40 files)
- [x] `npm run build` under Node 22
- [x] `git diff --check`
- [x] Public landing-shell browser review at 375, 768, and 1440 pixel viewport widths with no horizontal overflow
- [ ] Authenticated project-view browser review at 375, 768, and 1440 pixel viewport widths; this clean worktree has no public Supabase configuration or operator-created login
- [ ] `npm run test:e2e`; Playwright starts successfully, but the repository currently contains no end-to-end test files

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

## Project items and dependencies manual procedure

Use an operator-created Auth account in the isolated synthetic **Regional Climate Action Summit 2026** project. Keep credentials in untracked configuration. Perform mutation checks as an owner, admin, or member; repeat the read-only portions as a viewer. Do not use or capture private customer data.

### 1. Navigation, provenance, and loading states

- [ ] Open `/app` and confirm the project navigation exposes Overview, Items, Decisions, Risks, and Dependencies with a visible current-page state and a working skip link.
- [ ] Confirm the overview and guided callout label the workspace as synthetic, use titles and links from current server-loaded records, and do not show fake customer claims.
- [ ] Confirm the seed note says the canonical seed has no sponsor record or sponsor relationship; search Items and Dependencies for `sponsor` and verify the UI does not fabricate one.
- [ ] Throttle or pause a page request, then navigate between project routes and confirm a useful loading state appears without exposing a stale editable copy as canonical state.

### 2. Project-item list, filters, and cards

- [ ] Open `/app/items`. Confirm every visible row at 1440 pixels includes key/title, type, status, priority, assignee, due date, and a detail link; compare at least `EVT-01`, `DEC-01`, `TSK-01`, `TSK-06`, `TSK-07`, `TSK-09`, and `ART-05` with their server-loaded detail pages.
- [ ] Enter `summit` in Search items, then independently filter by type `Event`, status `Not started`, priority `Critical`, and a real assignee. Confirm the live result count and records update for each filter and for a combined filter.
- [ ] Choose a combination with no matches. Confirm the empty result names the filter problem, offers Reset filters, and returns to the full server result after reset.
- [ ] At 375 and 768 pixels, confirm the table becomes labeled cards containing the same type/status/priority/assignee/due-date meaning, long titles wrap or truncate safely, and the page has no horizontal overflow.
- [ ] Verify status and priority remain understandable in grayscale or with color disabled because visible text and symbols carry the meaning.

### 3. Item detail and edit

- [ ] Open `EVT-01 — Regional Climate Action Summit 2026`. Confirm breadcrumbs return to Overview and Items; detail fields reflect the current server state; and the page separates **Depends on** upstream records from downstream records under **Affects**.
- [ ] Follow one item link in each relationship section, then use Manage relationships. Confirm the selected item is preserved in `/app/dependencies?item=<item-id>`.
- [ ] As a contributor, open Edit item using only the keyboard. Confirm focus enters the dialog, every field has a label, Escape and Close dismiss it, and focus returns to Edit item.
- [ ] Change a reversible, non-demo-critical field on a temporary QA item and save. Confirm pending text prevents repeat submission, a success result is announced, refreshed detail shows the new value/version, and the list reflects the saved server state.
- [ ] Open the same item in two tabs at the same version. Save a change in tab A, then submit a different edit from stale tab B. Confirm tab B announces an explicit conflict, does not overwrite tab A, and a refresh shows the current server value.
- [ ] Submit an invalid edit, such as a blank title. Confirm the dialog retains useful context, the validation error is announced, and no item/version change is visible after refresh.

### 4. Create-item states

- [ ] From `/app/items`, open Create item by keyboard. Confirm the initial field receives focus, all required/optional fields are labeled, Escape and Cancel close the dialog, and focus returns to Create item.
- [ ] Submit an empty form and confirm accessible browser/server validation prevents creation and communicates the missing required value.
- [ ] Create a clearly synthetic task titled `QA — temporary relationship check`, using a valid QA item key, an existing seeded assignee, and an unambiguous future due date. Confirm the pending state, announced success, and refreshed list/detail use the submitted key plus the server-owned version rather than a client-only placeholder.
- [ ] As a viewer, confirm create/edit controls are absent or explicitly read-only while item and relationship information remains available.

### 5. Decisions and risks

- [ ] Open `/app/decisions`. Confirm only decision records are presented, including `DEC-01 — Approve venue contract`, with decision status and recorded rationale or an honest “not recorded” message; follow its item link and return to the project.
- [ ] Open `/app/risks`. Confirm only open risk/blocker records are emphasized, each shows status and available risk context, and completed/cancelled records are not presented as open.
- [ ] Compare at least one focused card with its item detail. Confirm both are projections of the same current record and do not diverge after an edit and refresh.

### 6. Dependency direction, add, and remove

- [ ] Open `/app/dependencies`, select `EVT-01`, and read the direction help aloud: the dependent item (`from_item_id`) depends on the upstream prerequisite/context (`to_item_id`). Confirm every relationship card is a complete text sentence and exposes its type and rationale without requiring arrow or color interpretation.
- [ ] Select `TSK-01 — Confirm keynote speakers`. Confirm **Depends on** lists its upstream event and **Affects** lists the downstream programme lock; follow those links and confirm their item-detail relationship sections reverse the perspective correctly.
- [ ] Open Add relationship by keyboard. Confirm focus enters the dialog, Tab/Shift+Tab remain inside, Escape closes it, and focus returns to Add relationship.
- [ ] Add an edge in which `QA — temporary relationship check` is the dependent item and `DEC-01 — Approve venue contract` is the upstream prerequisite. Confirm the direction preview says the QA item depends on the venue decision, success is announced, and the edge appears under the QA item's **Depends on** and the decision's **Affects** sections after refresh.
- [ ] Attempt a duplicate or otherwise invalid relationship and confirm an error is announced with no duplicate edge. Confirm the upstream selector cannot choose the same item as the dependent.
- [ ] Remove the QA relationship. Confirm a labeled confirmation dialog appears, then confirm the pending/success states, persistent result announcement, refreshed absence from both directions, and no unrelated edge changes. Leave canonical seeded relationships intact.

### 7. Guided demo and responsive accessibility

- [ ] On `/app` and `/app/items`, follow callout links for the summit event, venue decision, speaker confirmation, media advisory/campaign work, print signage, volunteers, approval/readiness, and runbook where present in server state.
- [ ] Dismiss the guided-demo callout. Confirm it disappears without blocking navigation, moving the page unexpectedly, or hiding the synthetic-data label elsewhere.
- [ ] At 375, 768, and 1440 pixels, inspect `/app`, `/app/items`, one item detail, `/app/decisions`, `/app/risks`, and `/app/dependencies`. Confirm headings remain logical, controls and text fit, dialogs stay within the viewport, touch targets remain usable, and `document.documentElement.scrollWidth` does not exceed `clientWidth`.
- [ ] Traverse every route and interactive control using Tab, Shift+Tab, Enter/Space, and Escape. Confirm focus is always visible, control names are announced, filter/result changes use status announcements, errors use alerts, and no keyboard trap occurs outside an open modal.
- [ ] After mutation review, use the approved synthetic demo reset procedure if configured and confirm the 24-item/26-edge baseline is restored. If reset is unavailable, record the temporary QA item as deliberate synthetic test state for the owner to reconcile.

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
