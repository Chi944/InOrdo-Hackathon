# InOrdo demo video script

**Maximum scripted runtime:** 2 minutes 45 seconds
**Recording rule:** Show only behavior verified in the final deployed build. Keep the synthetic workspace label visible and never imply that an unfinished step works.

## Before recording

- [ ] Replace `[FINAL_LIVE_DEMO_URL]` and `[FINAL_CODEX_SESSION_ID]`.
- [ ] Complete each segment’s verification point against the deployed commit.
- [ ] Record only synthetic project data.
- [ ] If a workflow step is unavailable, use the supplied fallback line and do not simulate a successful result.
- [ ] Confirm the final edit, including pauses and transitions, remains at or below 2:50.

## 0:00–0:18 — The chain reaction

**Picture**

Open the InOrdo landing page, then the synthetic “Inter-University Environmental Coalition — Regional Climate Action Summit 2026” workspace if available. Show the original summit date: 12 September 2026.

**Voiceover**

“A project rarely changes in one place. When a venue, deadline, or decision moves, dependent tasks and artifacts can stay stale. Small teams then coordinate from memory, discover blockers late, and lose the reason behind each change. InOrdo is designed for that chain reaction.”

**Verification point**

- Confirm every screen shown exists in the final build. If the workspace is unavailable, show only the verified landing page and say: “The project workflow is still being implemented.”

## 0:18–0:36 — The working product and evidence

**Picture**

Paste the exact venue notice and keep the raw text visible:

> Venue update — 20 July 2026: The campus convention hall is unavailable on 12 September 2026. The venue team has offered 26 September 2026 instead. All other venue terms remain unchanged.

**Voiceover**

“In the working flow, a reviewer pastes this venue notice. InOrdo preserves the raw evidence and provenance before interpreting it. That source remains visible throughout review, so every later proposal can be traced back to the new fact.”

**Verification point**

- Verify that evidence persists and is visible after submission. If not, do not paste or claim persistence; say: “Preserved evidence is the next P0 checkpoint.”

## 0:36–0:59 — GPT-5.6 interprets, but does not act

**Picture**

Show the candidate change beside the source: event date from 12 September 2026 to 26 September 2026, with its review state. Briefly show the server-side structured response or validation result if safe and understandable.

**Voiceover**

“GPT-5.6 runs server-side to draft a structured candidate change: the summit date moves from 12 September to 26 September. Its output is validated before entering product logic and remains a review item. The model does not approve the interpretation, mutate a record, or decide what else is affected.”

**Verification point**

- Confirm the request uses GPT-5.6 server-side, the structured output passes Zod validation, and no secret appears on screen. If any check fails, replace the segment with: “GPT-5.6 extraction remains under verification and is not demonstrated here.”

## 0:59–1:21 — Deterministic impact paths

**Picture**

Confirm the candidate change, open the impact review, and expand one direct impact plus the canonical multi-hop path `EVT-01 → TSK-02 → MS-02 → TSK-03 → MS-03 → ART-02`, ending at the master programme.

**Voiceover**

“After human confirmation, deterministic application code follows explicit dependency edges. It separates direct from downstream impact and shows the path for each affected item. GPT-5.6 does not choose graph reach. The same reviewed change and the same graph produce the same explainable traversal.”

**Verification point**

- Verify the expected affected IDs, direct-versus-indirect labels, path order, and cycle handling against the seeded graph. If traversal is unavailable, label it unfinished and show no fabricated result.

## 1:21–1:48 — Proposal and selective approval

**Picture**

Open the recovery proposal. Compare each action with its evidence and impact path. Approve safe internal date updates individually. Leave the cost-sensitive `RA-08` internal travel-options task update unapproved; do not show any booking.

**Voiceover**

“GPT-5.6 can draft bounded recovery actions, but a proposal is not permission. A person reviews the evidence and dependency path, then approves each action separately. We apply only the selected internal updates. RA-08, the internal travel-options task update, stays unapproved because any real rebooking carries cost and participant consequences.”

**Verification point**

- Confirm that unapproved actions cannot mutate data and that the server rechecks authorization and current state. If selective application is not verified, do not click Apply; state that approval is still a P0 milestone.

## 1:48–2:11 — History, undo, and reset

**Picture**

Open operation history and identify actor, time, action, and before/after state. Undo one supported internal change, show the compensating operation, then run the isolated demo reset.

**Voiceover**

“Every applied internal operation is attributable. For supported changes, undo creates a compensating operation instead of erasing history. The demo reset is limited to this synthetic workspace and restores the original date, seeded records, dependencies, and an empty operation history.”

**Verification point**

- Verify attribution, compensating undo, final record state, reset isolation, and exact baseline restoration. Omit any unverified action and say: “History, undo, or reset remains in progress.”

## 2:11–2:31 — Specific Codex contribution

**Picture**

Show the repository documentation diff, selected QA checklist items, and the Codex session reference: `[FINAL_CODEX_SESSION_ID]`. Do not expose credentials, private prompts, or unrelated data.

**Voiceover**

“Codex helped us inspect the repository constraints and turn confirmed requirements into the product brief, synthetic fixture, backlog, QA checklist, submission copy, and this timed storyboard. It also prepared the repository verification steps. The team reviewed the scope, implementation decisions, and every public claim.”

**Verification point**

- Confirm each named artifact is present in the submitted commit and replace the Session ID placeholder. Mention code or debugging work only if it is visible in that session.

## 2:31–2:45 — Future vision

**Picture**

Return to the impact path and end card: **evidence → impact → proposal → approval → history and undo**. Display `[FINAL_LIVE_DEMO_URL]`.

**Voiceover**

“InOrdo starts as a standalone workspace for small teams. The future is broader project coverage and optional integrations, without surrendering control: evidence stays visible, impact stays explainable, and people decide what changes.”

**Verification point**

- Label future capabilities as roadmap items and replace the live demo URL before export.

## Final edit check

- Scripted end time: **2:45**.
- Hard maximum requested: **2:50**.
- Allow no more than five seconds of added pauses, title cards, or transitions.
- Keep unfinished steps explicitly labeled; cutting a segment is preferable to staging unsupported functionality.
