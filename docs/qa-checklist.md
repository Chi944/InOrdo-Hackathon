# InOrdo QA checklist

Use this checklist against the exact commit and deployment submitted to judges. An unchecked item is not evidence that a feature works. Record failures and limitations instead of changing the public claim.

## Test record

- Commit SHA: `[COMMIT_SHA]`
- Deployment URL: `[DEPLOYMENT_URL]`
- Tester and date: `[TESTER] — [DATE]`
- Browser and operating system: `[BROWSER_AND_OS]`
- Synthetic workspace: `demo-iuec-summit-2026`
- Reset snapshot: `summit-baseline-v1`

Use only the synthetic demo workspace. Do not enter real private information, print environment values, or include secrets in screenshots or bug reports.

## Automated release gate

- [ ] `npm run lint` passes in the current worktree.
- [ ] `npm run typecheck` passes in the current worktree.
- [ ] `npm run test:run` passes in the current worktree.
- [ ] `npm run build` passes in the current worktree.
- [ ] `git diff --check` passes in the current worktree.
- [ ] `npm run test:e2e` passes for implemented browser workflows when a Playwright browser is available, or the submission records why it was not run.

## Authentication and tenancy

- [ ] A signed-out visitor cannot open authenticated project pages by navigating directly to their URLs.
- [ ] A valid demo user can sign in, refresh, and retain the expected session without seeing another user's data.
- [ ] Sign-out clears the session and returns the user to a public or sign-in page.
- [ ] An expired or invalid session fails closed with a useful recovery path.
- [ ] A user who is not a workspace member is denied by the server when requesting the workspace by URL or identifier.
- [ ] A member of one workspace cannot read or mutate records, evidence, proposals, operations, or reset controls in another workspace.
- [ ] Hiding a control in the interface is not the only authorization check; direct requests receive the same denial.
- [ ] Reset authorization is restricted to the configured synthetic workspace and cannot accept an arbitrary project target.

## Project views and records

- [ ] The workspace name and synthetic-data label are clear.
- [ ] Task, milestone, decision, event, risk, and artifact records render with distinct text labels, not color alone.
- [ ] `EVT-01` shows 12 September 2026 at the reset baseline.
- [ ] Record detail views show ID, type, owner, state, relevant date, and dependencies without truncating essential information.
- [ ] Project lists, filters, and links preserve the selected workspace.
- [ ] Loading, empty, error, and permission-denied states are distinguishable and offer an appropriate next step.
- [ ] Refreshing or opening a deep link does not replace real seed data with an unlabeled fixture or stale client-only state.
- [ ] User-supplied text is rendered as content rather than executable HTML or script.

## Dependency graph and deterministic impact

- [ ] The interface explains that `A → B` means B depends on A.
- [ ] The graph contains the dependency registry in `docs/demo-scenario.md` with no missing, reversed, or duplicate edge.
- [ ] Confirming the `EVT-01` candidate returns exactly the expected depth-1 records for the fixture.
- [ ] Every downstream result displays at least one ordered path from `EVT-01`.
- [ ] Direct and indirect impacts are visibly distinguished with text or depth, not color alone.
- [ ] The path `EVT-01 → TSK-02 → MS-02 → TSK-03 → MS-03 → ART-02` is available and ordered correctly.
- [ ] Repeating traversal from the same snapshot returns the same affected records, depths, and paths.
- [ ] A graph with converging paths does not duplicate the affected record and can explain an accepted path.
- [ ] A cycle fixture or unit test terminates safely and does not produce an infinite traversal.
- [ ] Traversal remains within the current workspace.
- [ ] No model output is used to decide which graph nodes are reachable.

## GPT-5.6 structured extraction

- [ ] The exact venue update from `docs/demo-scenario.md` can be pasted without alteration.
- [ ] The raw source is stored before model interpretation begins.
- [ ] The model call runs only on the server and the browser never receives an OpenAI credential.
- [ ] The displayed candidate identifies `EVT-01.event_date`, `2026-09-12`, `2026-09-26`, and the venue-unavailable reason.
- [ ] The candidate states that all other venue terms remain unchanged.
- [ ] Model output is visibly labeled as a candidate requiring human confirmation.
- [ ] Zod-valid output enters review; malformed, incomplete, overlong, or schema-invalid output produces a safe error and no mutation.
- [ ] A reviewer can reject the candidate, and rejection leaves `EVT-01` unchanged.
- [ ] If correction is implemented, a reviewer can correct a candidate before confirmation and the correction is attributable.
- [ ] Prompt-like instructions inside pasted evidence are treated as untrusted source text and do not bypass schema, authorization, or approval checks.
- [ ] Model timeout, rate-limit, and unavailable-service states do not create partial proposals or project mutations.

## Evidence and provenance

- [ ] The original pasted text remains visible and byte-for-byte unchanged after extraction, approval, undo, and page refresh.
- [ ] Evidence displays source type, created time, actor, workspace, and a stable reference.
- [ ] The candidate, impact review, and recovery proposal link back to the same evidence reference.
- [ ] The interface separates raw evidence from model interpretation and confirmed project state.
- [ ] A superseding correction creates a new attributable record or version; it does not silently overwrite the original evidence.
- [ ] Evidence from another workspace cannot be linked to or displayed in this impact review.
- [ ] Long text, special characters, and safe line breaks render without page overflow or script execution.

## Recovery proposal

- [ ] A proposal is generated only from a human-confirmed candidate and the current deterministic impact result.
- [ ] Each action identifies its target record, intended change, reason, and approval state.
- [ ] Proposed actions are clearly inert; opening, generating, or viewing them does not change any project record.
- [ ] The proposal distinguishes native record updates from external work that InOrdo does not perform.
- [ ] `RA-08` explains its cost and participant-consent consequence.
- [ ] A stale record version, missing target, invalid action, or changed dependency snapshot blocks application and asks for review.
- [ ] Invalid model-drafted recovery output fails validation and creates no mutation.
- [ ] Regenerating or revisiting a proposal does not silently approve or duplicate actions.

## Selective approval and application

- [ ] An authorized reviewer can select individual actions rather than accepting the entire proposal.
- [ ] Approval controls name the action and consequence clearly before confirmation.
- [ ] Cancelling the confirmation leaves every record and approval state unchanged.
- [ ] Applying approved actions rechecks identity, membership, permission, current record version, action validation, and idempotency on the server.
- [ ] Approved actions apply only to their named records and create attributable operation entries.
- [ ] A mixed selection can succeed for valid approved actions while `RA-08` remains pending and `TSK-07` remains unchanged.
- [ ] No operation entry is presented for an action that did not succeed.
- [ ] Double-clicking, refreshing, or retrying the same apply request does not apply an action twice.
- [ ] Partial or transactional failure is reported accurately and never presents unapplied work as complete.
- [ ] No approval sends a message, contacts a supplier, changes an external site, or books travel in P0.

## Operation history and undo

- [ ] History shows actor, time, proposal action, evidence reference, affected record, before-state, after-state, and outcome for each applied operation.
- [ ] History order is stable and understandable after refresh.
- [ ] The interface labels which operations support undo and explains when undo is unavailable.
- [ ] Undo of the `RA-03` operation restores `TSK-01` from 19 September 2026 to 5 September 2026.
- [ ] Undo appends a compensating operation and preserves the original operation.
- [ ] Undo rechecks authorization and current state on the server.
- [ ] A repeated undo request is idempotent or fails safely without changing the record twice.
- [ ] A conflicting later edit blocks stale undo and explains that current state was preserved.
- [ ] Undo affects only the selected operation and does not approve, undo, or erase unrelated actions.

## Demo reset

- [ ] Reset presents a clear confirmation naming the synthetic workspace and destructive fixture effect.
- [ ] Cancelling reset changes nothing.
- [ ] Successful reset restores all 29 records and all 34 edges from `summit-baseline-v1`.
- [ ] Reset restores `EVT-01` to 12 September 2026 and `TSK-01` to 5 September 2026.
- [ ] The active demo run contains no source, candidate, impact, proposal, approval, applied-operation, or undo state after reset.
- [ ] Stable record IDs are the same before and after reset.
- [ ] Repeating reset produces the same baseline without duplicates.
- [ ] Reset cannot target a non-demo workspace, even through a direct request with a modified identifier.
- [ ] Reset failure is visible and does not leave a state presented as successfully reset.

## Responsive layout

- [ ] At approximately 375 px wide, public pages and the complete demo workflow have no horizontal page overflow.
- [ ] At approximately 768 px wide, navigation, tables or lists, dialogs, and graph controls remain usable without hidden actions.
- [ ] At approximately 1440 px wide, content remains readable and related evidence, impact, and proposal details use space clearly.
- [ ] Navigation can open and close at each breakpoint without trapping focus or covering the active control.
- [ ] Long record names, dependency paths, evidence text, and error messages wrap or scroll within a labeled region without widening the page.
- [ ] Browser zoom at 200% preserves content and controls without loss of function.
- [ ] Touch targets are usable on a mobile viewport and do not depend on hover.

## Accessibility

- [ ] Each page has one descriptive `h1`, logical heading order, landmarks, and a working skip link.
- [ ] All workflows can be completed with a keyboard; focus order follows the visual and reading order.
- [ ] Focus is always visible, including navigation, graph controls, tabs, dialogs, approval controls, and undo.
- [ ] Dialogs have an accessible name, initial focus, contained focus, Escape behavior, and focus return.
- [ ] Every form control has a persistent label, instructions where needed, and an associated error message.
- [ ] Icon-only buttons have accessible names; status and impact depth never rely on color or icons alone.
- [ ] Loading and result changes are announced without repeatedly interrupting screen-reader users.
- [ ] Text and controls meet appropriate WCAG contrast; disabled controls remain understandable.
- [ ] The graph has a usable text/list alternative exposing the same records, direction, depth, and paths.
- [ ] Reduced-motion preferences are respected and no essential information depends on animation.

## Production deployment review

- [ ] The tested deployment points to the submitted commit SHA.
- [ ] Public landing, sign-in, workspace, evidence, impact, proposal, history, and reset routes used in the demo load over HTTPS without uncaught errors.
- [ ] A production build completes before deployment.
- [ ] Only documented public Supabase values appear in the browser bundle; service-role, OpenAI, database, and private tokens do not.
- [ ] Required server environment values are configured in the deployment provider without being printed, exposed, or committed.
- [ ] RLS and server authorization remain enabled in the deployed environment.
- [ ] Logs avoid raw secrets and private data while retaining enough synthetic identifiers to diagnose failures.
- [ ] Error states do not expose stack traces, SQL, model prompts, credentials, or another workspace's data.
- [ ] The synthetic demo can be reset before judging and cannot mutate any non-demo project.
- [ ] Browser console and network review show no unexpected errors, secret-bearing requests, or mixed content during the walkthrough.

## README, submission, and video

- [ ] README setup commands work from a clean checkout with Node 22 and npm.
- [ ] README lists required environment variable names with blank or synthetic example values only.
- [ ] README explains the evidence → impact → proposal → approval → history and undo sequence.
- [ ] README and submission label the workspace and all names as synthetic.
- [ ] Final repository, deployment, video, and Codex Session ID placeholders are replaced with correct URLs or IDs.
- [ ] The 50-word summary is exactly 50 words after placeholders are replaced.
- [ ] The video is no longer than 2 minutes 50 seconds.
- [ ] The video and Devpost copy distinguish GPT-5.6 extraction/drafting from deterministic graph traversal and authorized application code.
- [ ] Codex contributions describe work performed in the recorded session and do not imply Codex independently shipped the product.
- [ ] No public material claims autonomous mutation, connectors, RAG, embeddings, native mobile, enterprise administration, or production readiness.
- [ ] Every feature shown or described as working passes this checklist on the submitted commit; unavailable steps are labeled planned or limited.

## Claim evidence sign-off

Complete this table before submission. A claim may be used publicly only when its evidence is recorded.

| Public claim | Required evidence | Result and reference |
| --- | --- | --- |
| Raw evidence is preserved | Create, refresh, approve, and undo without raw-text change | `[PASS/FAIL — REFERENCE]` |
| GPT-5.6 extracts a structured candidate | Server log or screen recording plus validated displayed fields; no secret content | `[PASS/FAIL — REFERENCE]` |
| Impact traversal is deterministic | Repeat run with identical records, depths, and paths | `[PASS/FAIL — REFERENCE]` |
| Approval is selective | Apply a mixed selection while `RA-08` and `TSK-07` remain unchanged | `[PASS/FAIL — REFERENCE]` |
| Applied changes are attributable | Operation history contains the expected actor and before/after state | `[PASS/FAIL — REFERENCE]` |
| Supported changes can be undone | `RA-03` apply and compensating undo operation | `[PASS/FAIL — REFERENCE]` |
| Demo reset is isolated and deterministic | Two resets match `summit-baseline-v1`; non-demo target is denied | `[PASS/FAIL — REFERENCE]` |

## Release decision

- [ ] All claims in the submission have passing evidence above.
- [ ] Known failures and unfinished behavior are listed in the submission's honest limitations.
- [ ] A reviewer has completed the judge-facing walkthrough from a clean reset without relying on unstated manual database edits.
- Release reviewer: `[NAME]`
- Decision: `[GO / NO-GO]`
- Notes: `[NOTES]`
