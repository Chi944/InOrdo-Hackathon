# InOrdo QA checklist

This checklist is the submission truth source. A checked box means the named check was run on the stated scope and evidence is recorded in this repository. A historical check does not imply that the current documentation-only branch has passed its final gate. Unchecked items are release or submission gates, not implied functionality.

## Current submission branch gate

Run these commands on the final `andres/05-qa-submission` worktree immediately before commit. Do not check them from an earlier branch result.

- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm run test:run`
- [x] `npm run build`
- [x] `git diff --check`
- [x] Confirm the final diff changes documentation/submission assets only.

Final gate on 2026-07-18 used Node 22.23.1 and npm 10.9.8. ESLint and TypeScript completed without errors; Vitest passed 231 tests across 39 files; the Next.js 16.2.10 production build completed and listed the implemented page/API routes; and the final documentation/asset patch passed `git diff --check`. No application, package, migration, CI, or environment file changed.

`npm run test:e2e` is not required by this documentation-only diff, but the authenticated browser journey below remains a release gate because it has never been completed in the recorded environment.

### Current local browser evidence

- [x] The public `/` route rendered locally at 1280 × 720 with one `h1`, a skip link, semantic workflow headings, and `document.documentElement.scrollWidth === window.innerWidth`.
- [x] The public `/login` route rendered locally at 1280 pixels wide with one `h1`, visible Email and Password labels, a skip link, and no horizontal document overflow.
- [x] Current-build landing and workflow-principle screenshots were captured from the optimized production build's real public route and saved under `docs/assets/`; neither is labeled as an authenticated or live-model result.
- [ ] The protected `/app` route could not be exercised in this worktree because `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` were absent. No environment file or value was read.

## Preserved implementation evidence

These results are historical, scoped evidence from the implementation branches. They remain useful, but they are not substitutes for the current gate or an authenticated production test.

### Authentication, tenancy, records, and graph

- [x] Request-scoped identity, role, project membership, bounded repository, and safe error-mapping tests passed on the authentication/data branch.
- [x] Linked RLS verification denied anonymous, viewer-write, cross-workspace owner, and cross-project dependency cases without retaining verification rows.
- [x] Native item/dependency contract tests covered strict input allowlists, stale item versions, contributor/read roles, and same-project dependency validation.
- [x] Pure TypeScript graph tests covered upstream-to-dependent direction, direct and downstream paths, cycles, duplicates, stable ordering, inactive items, bounds, and maximum depth.
- [ ] Complete a real browser login, project load, item edit, dependency add/remove, session refresh, logout, and viewer-read-only pass.

### Evidence, GPT-5.6 extraction, and impact review

- [x] Analysis tests covered successful orchestration, provider refusal, malformed structured output, unknown IDs, evidence mismatch, timeout, duplicate handling, transient failure, stale state, prompt injection, and no-mutation boundaries.
- [x] Linked rollback-wrapped analysis SQL verification covered authorization, immutable evidence, duplicate/rate claims, validated completion, deterministic impacts, pending actions, and no project-item mutation.
- [x] Static contract review confirmed that the protected impact interface posts only to the existing analyze, apply, and undo routes; persisted review and operation history are read through scoped server repositories.
- [x] Component tests covered source validation, duplicate-submit prevention, safe default action selection, human-input exclusion, approval request shape, and draft-state gating.
- [ ] Run one funded synthetic live GPT-5.6 analysis and record only safe metadata: model name, provider/request identifiers already intended for storage, usage counts when returned, state transitions, and derived record IDs. Do not record a key, prompt, raw model output, or source body.
- [ ] In an authenticated browser, confirm preserved evidence remains distinct from model inference and every impact shows its deterministic dependency path separately from the GPT-generated explanation.
- [ ] Confirm live direct impacts have depth 1 and live indirect impacts have depth greater than 1 for the seeded venue-date scenario.

### Proposal, approval, history, undo, and reset

- [x] Linked rollback-wrapped RPC verification observed selective apply, ordered before/after history, a linked compensating undo, named-demo reset, workflow-generation advance, and no retained verification rows.
- [x] Operation contract tests covered owner/admin authorization, viewer/cross-tenant denial, allowlisted actions, required human input, partial selection, atomic rollback, idempotency, stale undo conflicts, archived history, and reset safeguards.
- [ ] Resolve the proposal-state blocker described below, then complete a fresh authenticated analysis → selective approval → current history → undo → reset journey.
- [ ] Verify that the travel rebooking action remains unapproved while the chosen safe actions proceed.
- [ ] Verify that the UI never claims a partial apply, successful undo, or reset when the server returns an error or conflict.
- [ ] Verify reset restores 24 active canonical items, 26 dependency edges, and the original `2026-09-12` event date while preserving archived history.

## Manual release procedure

Use only the synthetic Regional Climate Action Summit 2026 workspace and an operator-created owner/admin account. Keep credentials in untracked local or deployment configuration. Never capture cookies, authorization headers, secret values, raw provider output, or private data.

### 1. Authentication and tenancy

- [ ] In a private/incognito window, anonymous access to `/app` redirects to login or otherwise fails closed.
- [ ] A valid owner/admin can sign in and sees only the configured synthetic workspace and project.
- [ ] Invalid credentials produce a useful, non-sensitive error.
- [ ] A viewer can read permitted records but cannot create/edit records, dependencies, approvals, undo, or reset.
- [ ] Logout ends the browser session and a protected-route refresh remains denied.

### 2. Project views and deterministic graph

- [ ] The project header visibly identifies the workspace as synthetic.
- [ ] Project counts, seeded records, statuses, owners, dates, risks, and dependency sections agree with the database seed.
- [ ] The event-date, speaker, catering, programme-lock, and briefing-pack relationships are discoverable without relying on color.
- [ ] “Depends on” and “affects” wording agrees with the documented prerequisite-to-dependent edge direction.
- [ ] The required event → speaker confirmation → programme lock → briefing pack path is shown in order.
- [ ] Loading, empty, not-found, authorization, validation, conflict, and general error states remain clear and non-disclosing.

### 3. Evidence and analysis

- [ ] Insert the canonical venue update and confirm no expected analysis result is prefilled or presented as a live response.
- [ ] Submit blank and oversized source input and confirm inline validation, focus on the first invalid control, and no analysis request.
- [ ] Submit the valid update once, immediately attempt a second submission, and confirm only one analyze request begins.
- [ ] If live analysis is slow, keep the loading state honest; do not substitute a fixture while labeling it as GPT output.
- [ ] On success, confirm the exact immutable source, inferred `event_date` change from `2026-09-12` to `2026-09-26`, confidence, ambiguity/review signals, and confirmation requirement.
- [ ] Confirm model refusal, timeout, duplicate, and safe failure messages expose no prompt, provider detail, SQL detail, or secret.

### 4. Proposal and approval

- [ ] Pending actions that do not require human input are selected by default; human-input and non-pending actions are not.
- [ ] Keyboard users can toggle each action and use “Select all safe actions” and “Leave all pending.”
- [ ] A human-input action cannot be confirmed with a blank response.
- [ ] The approval dialog summarizes only selected actions; Cancel and Escape return focus to the trigger.
- [ ] The browser sends only selected action IDs, matching human responses, and an idempotency key through the existing contract.
- [ ] Unselected actions remain pending and no unsupported reject request is sent.

### 5. History, undo, and reset

- [ ] Applied results show operation type/state, actor, time, changed records, and before/after values from server history.
- [ ] Undo appears only for a successful, reversible apply with no successful reversal.
- [ ] Successful undo creates a linked compensating operation and preserves the original history.
- [ ] A stale-state undo conflict produces no partial-success claim.
- [ ] Reset requires explicit confirmation, applies only to the configured demo project, and leaves archived generations available through bounded history.

## Responsive and accessibility evidence

### Verified fixture-only review

The checks below were completed on 2026-07-18 against a temporary, clearly labeled synthetic local preview. That preview stated that no AI or backend call was made and was removed before the final diff. This verifies component layout and selected interactions only; it does **not** verify an authenticated application, real seed reads, production behavior, or a live model response.

- [x] 375 × 812: no horizontal document overflow or out-of-viewport controls.
- [x] 768 × 1024: no horizontal document overflow or out-of-viewport controls.
- [x] 1440 × 900: no horizontal document overflow or out-of-viewport controls.
- [x] Native checkbox operation, seeded-source insertion, blank human-input prevention, approval-dialog contents, initial Cancel focus, and trigger-focus return.
- [x] Confidence, severity, proposal, and operation states include text and do not rely on color alone.
- [x] Reduced-motion styles remove spinner animation and smooth scrolling.

### Pending authenticated and production review

- [ ] At 375 × 812, 768 × 1024, and 1440 × 900, verify the real authenticated route has no horizontal overflow, clipped dialog, clipped control, or unreadable dependency path.
- [ ] Navigate the complete journey with keyboard only, beginning at the skip link; confirm visible focus, logical order, accessible names, and no keyboard trap.
- [ ] Confirm one `h1`, logical heading order, landmarks, labels/instructions, meaningful status text, and explained disabled actions on each route.
- [ ] Confirm analysis completion moves focus to Change review and apply/undo refresh moves focus to the result.
- [ ] Confirm errors and completed operations are announced without character-count or selection-change chatter.
- [ ] Run a production incognito test for landing, login, protected routing, source submission, review, approval gating, history, logout, and safe refresh behavior.

## Deployment and submission checks

- [ ] A human supplies and verifies the final production URL in a private/incognito browser.
- [ ] Deployment environment contains every required variable name, with secret values server-only and absent from the client bundle, logs, screenshots, and repository.
- [ ] The deployment platform enforces an upstream request-body limit in addition to application checks.
- [ ] The public repository is accessible without team credentials and contains the intended MIT license.
- [ ] README setup, migration, seed, demo/test path, screenshots, architecture, claims, and commands match the final artifact.
- [ ] Devpost copy and the video describe only the verified artifact and use “Work and Productivity” as the track.
- [ ] The public video has voiceover, runs no longer than three minutes, and never presents a fixture as a live model response.
- [ ] The primary `/feedback` Session ID and all URLs, account-path instructions, team members, and deadline placeholders are replaced.
- [ ] Final repository, deployment, video, Devpost, and Session ID links are tested without a team-authenticated browser session.
- [ ] Record the final submitted commit and stop repository, deployment, Devpost, and video edits at the stated deadline.

## Unresolved issues

| Severity | Issue | Owner | Required resolution or honest workaround |
| --- | --- | --- | --- |
| Critical | Fresh successful analysis persists the recovery proposal as `draft`, while apply accepts only `ready` or `partially_approved`; no application route promotes the draft. | Deston | Add and verify a reviewed server-owned transition before claiming the complete live flow. Until then, demonstrate evidence and impact review only, keep approval disabled, and state that apply/undo is separately database-verified but not connected to a fresh browser analysis. Do not alter SQL or client state as a demo shortcut. |
| High | No funded live GPT-5.6 request has been recorded in the available environment. | Deston / Shared | Run exactly one safe synthetic analysis with deployment configuration, record only safe metadata, and retain the raw evidence/model separation. Tests and fixtures may explain the contract but must not be labeled as a live response. |
| High | No authenticated end-to-end browser or production incognito pass has been recorded; no production URL or test-account path was supplied for this session. | Shared | Supply the production URL and operator-managed account path, then complete the manual release procedure. There is no documentation-only substitute for this gate. |
| High | The candidate GitHub repository URL was reachable anonymously and labeled public, but its signed-out default page reported “This repository is empty”; public access to the intended commit is therefore not verified. | Shared | After this branch is pushed and reviewed, ensure the final commit is reachable from the public default branch or submission URL, then retest from a signed-out browser. Do not infer judge access from local remote-tracking refs. |
| High | Final repository/video/Devpost URLs, team-member names, deadline, and primary `/feedback` Session ID are not supplied. | Shared | Replace every placeholder in `docs/submission-checklist.md`, README, and submission copy; test public access before submitting. |
| Medium | Public status copy is inconsistent with runtime configuration: the landing page says the protected workspace is “connected” even when Supabase variables are absent, while the login page says evidence extraction, recovery actions, mutations, and undo are “still being built” although those contracts and the review UI are implemented with separate verification gaps. | Andres | Update both messages on a UX branch before recording, or avoid those status sentences in submission media. Do not overcorrect them into an end-to-end claim until live QA passes. |
| Medium | A missing or dishonest `Content-Length` is bounded only after `Request.text()` reads the body. | Deston | Configure and verify a deployment-level request-body limit; retain the application validation as a second boundary. |
| Medium | A failure while recording terminal analysis failure can leave a `processing` claim that the current duplicate path cannot resume. | Deston | Define operator reconciliation and route-containment handling; preserve the immutable evidence and do not rewrite state ad hoc. |
| Medium | Authenticated Playwright coverage has not been run for the implemented browser workflow. | Andres / Shared | Complete the manual matrix first, then configure a non-secret synthetic E2E environment and run `npm run test:e2e` when available. |

## Claim rule

Submission language may claim implemented and scoped automated/database verification where recorded above. It must describe live GPT-5.6 analysis, fresh-analysis approval, authenticated browser operation, production responsiveness/accessibility, and production readiness as unverified until their boxes are checked with non-secret evidence.
