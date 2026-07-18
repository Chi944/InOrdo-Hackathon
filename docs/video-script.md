# InOrdo demo video script

**Target runtime:** 2:45 (acceptable range: 2:40–2:50)

**Track:** Work and Productivity

**Recording rule:** Show only the current synthetic workspace and behavior verified in the recorded build. Keep the synthetic label visible. Never present a test fixture, mock, or expected result as a live GPT-5.6 response.

## Recording gates

- `[VERIFY LIVE]` requires a successful authenticated production run recorded in the QA checklist before filming.
- Fresh analysis currently persists a `draft` proposal while apply accepts only `ready` or `partially_approved`. Until that contract is resolved and verified, show the honest disabled approval state; do not stage an apply or undo as live.
- A live GPT-5.6 request, authenticated browser flow, and incognito production run are currently unverified. If they remain unverified at recording time, use the safe fallback shots and narration below.
- If live analysis is slow after it has been verified, cut to a rehearsal capture of the **same verified production request**. If no verified capture exists, stay on the real loading state, cut to the architecture diagram, and state that live verification remains open.

## Timed storyboard and voiceover

| Time | On-screen action | Narration | Fallback / verification point |
| --- | --- | --- | --- |
| **0:00–0:17** | Title card, then the synthetic Regional Climate Action Summit 2026 overview. Keep “synthetic” visible. | “One changed fact can invalidate work several steps away. A venue date moves, and suddenly speaker confirmation, catering, programme deadlines, travel, and briefing materials may all be stale. Small teams usually find that chain manually.” | Safe now: public landing page and its labeled illustrative venue trace. Do not imply a signed-in session unless verified. |
| **0:17–0:34** | Show the InOrdo workflow label: evidence → impact → proposal → approval → history and undo. | “InOrdo makes that response reviewable. It preserves the evidence, separates source fact from inference, explains downstream impact, and keeps every proposed change inert until a person approves it.” | Safe now: use the implemented landing-page workflow. |
| **0:34–0:55** | In the protected source form, insert the canonical update: the venue is unavailable on 12 September and offers 26 September 2026. Show the privacy/synthetic warning. | “This workspace and every name in it are fictional. I paste the venue update once. InOrdo preserves the exact source before analysis and warns me not to enter secrets, personal data, or customer content.” | `[VERIFY LIVE: authenticated production source form]`. Otherwise show the public workflow plus the source sentence from `docs/demo-scenario.md`; say “Here is the synthetic source we use,” not “I submitted it.” |
| **0:55–1:19** | Click **Analyze change**. When complete, place immutable source evidence beside the candidate change and confidence/review signals. | “Server-side GPT-5.6 has two bounded jobs: extract one structured candidate change, then draft recovery actions. Strict schemas and application checks validate identifiers, values, dates, and the exact evidence span. The model has no tools and cannot write a project record.” | `[VERIFY LIVE: funded GPT-5.6 request]`. If slow after verification, use the same request’s verified rehearsal capture. If still unverified, show the architecture diagram and replace the first sentence with: “The implemented server boundary assigns GPT-5.6 two bounded jobs; a live request is still a release gate.” Never use a test fixture here. |
| **1:19–1:42** | Open direct and indirect impact groups. Expand the path from event date → speaker confirmation → programme lock → briefing pack. | “GPT does not decide reach. Deterministic TypeScript follows explicit dependency edges, prevents cycles, keeps a stable shortest path, and labels depth one as direct and later steps as indirect. That makes each impact inspectable instead of merely plausible.” | `[VERIFY LIVE: result loaded from the authenticated project]`. Without live output, animate/highlight the architecture diagram and describe the expected demo path as “the seeded dependency path,” not a model result. |
| **1:42–2:05** | Review action cards. If the verified proposal contains a travel-rebooking action, leave it pending; otherwise show only the seeded travel impact and do not stage an action. Open the approval summary only if enabled. | “Recovery actions are proposals, not permission. A reviewer chooses them individually. If travel rebooking appears, it stays pending because it affects cost and participants. The server must recheck role, proposal state, required human input, item versions, and idempotency before one atomic operation.” | `[VERIFY LIVE: proposal is ready or partially approved]`. With the current `draft` state, show the disabled control and say: “This build correctly blocks approval because the analysis and apply contracts do not yet share a review-ready transition.” Do not invent a travel action if the model did not draft one. |
| **2:05–2:24** | If verified, confirm selected actions, open operation history, then undo one eligible field update and show the linked compensating operation. | “For supported field updates, history records the actor and ordered before-and-after state. Undo never erases that record. It creates a linked compensating operation only after current version and state still match.” | `[VERIFY LIVE: authenticated apply/history/undo]`. Until verified, show the backend test/architecture evidence and say: “Linked database checks verify apply, history, and undo contracts; the browser journey remains open.” Do not click a seeded or mocked success. |
| **2:24–2:37** | Show a concise Codex evidence slide with the primary Session ID placeholder and named work packages. | “Codex accelerated schema and RLS review, deterministic graph and GPT contracts, operation and undo tests, and the accessible interface. It also caught the draft-to-ready gap, so InOrdo fails closed.” | Replace `<PRIMARY_FEEDBACK_SESSION_ID>` only after `/feedback`; never show a private transcript or credential. |
| **2:37–2:45** | Return to the product mark and final workflow. | “Our vision: when evidence changes a project, every consequence stays visible, attributable, and safely under human control.” | Safe now. End at approximately **2:45**. |

## Director checklist before export

- [ ] Runtime is between 2:40 and 2:50, with voiceover throughout.
- [ ] The synthetic workspace label is legible, and no real private data or credential appears.
- [ ] Every `[VERIFY LIVE]` shot has current QA evidence; otherwise its safe fallback and alternate narration are used.
- [ ] A slow analysis cut uses the same previously verified production request, not a fixture or rehearsed fake result.
- [ ] The narration distinguishes GPT-5.6 extraction/drafting from deterministic traversal and server-owned approval/mutation.
- [ ] Any travel-rebooking action shown remains unapproved; no action is invented if the verified proposal does not contain one.
- [ ] The current proposal-state gate is either visibly resolved and verified or disclosed with approval disabled.
- [ ] Apply, history, undo, reset, accessibility, and production claims match the final QA checklist.
- [ ] The Codex slide names concrete contributions and shows `<PRIMARY_FEEDBACK_SESSION_ID>` only after replacement.
- [ ] The final public video is no longer than three minutes.
