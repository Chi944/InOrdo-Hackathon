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
