# QA checklist

## Automated gate

- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm run test:run`
- [x] `npm run build`
- [x] `git diff --check`
- [ ] `npm run test:e2e` for implemented browser workflows when a Playwright browser is available

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
