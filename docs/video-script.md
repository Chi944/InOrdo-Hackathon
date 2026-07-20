# InOrdo production video script

**Authoritative runtime:** 2:47 (under the three-minute submission limit)

**Track:** Work and Productivity

**Production rule:** Record only the public Production application with the synthetic workspace label visible. Do not show fixtures, test routes, generated interfaces, private tools, or expected results as live product behavior. Raw media and credentials remain outside Git.

The separate speaker masters are [Andres's voiceover](video-production/andres-voiceover.md) and [Deston's voiceover](video-production/deston-voiceover.md). The capture and edit procedure is the [production runbook](video-production/production-runbook.md).

## Recording gates

- Use a successful GPT-5.6 result only if the exact authenticated Production run was verified and captured. Otherwise show the real fail-closed or unavailable state and keep public submission copy on the no-verified-result branch.
- The paid recording authorization is one bounded, server-only GPT-5.6 analysis. Verify the raw capture is playable, then revoke the purpose-specific recording key immediately.
- After the single attempt is classified and every paid credential is revoked, select exactly one mutually exclusive editorial branch: **verified success** or **no retry**. Never combine their shots, D1 narration, or thumbnail badge.
- GPT-5.6 performs only structured candidate extraction and recovery-action drafting. Deterministic TypeScript, not GPT, determines dependency reach.
- Recovery drafts remain inert. The model output never directly mutates project records; a human chooses an action and the server rechecks authority and state before any supported internal mutation.
- The workspace and every person, organization, project, and record shown are synthetic.

## Verified-success 2:47 timeline

Use this branch only after the single attempt is verified successful, its raw capture is playable, and the recording key is revoked. The successful-branch voiceover below is authoritative and verbatim.

| Time | Speaker | Production picture | Verbatim voiceover |
| --- | --- | --- | --- |
| **0:00–0:16** | Andres (A1) | Open on the genuine Production landing page, then the labeled synthetic project workflow. | One changed fact can invalidate work several steps away. A venue date moves, and suddenly speaker confirmation, catering, programme deadlines, travel, and briefing materials may all be stale. Small teams usually reconstruct that chain by hand. |
| **0:16–0:33** | Andres (A2) | Hold on the evidence → impact → proposal → approval → history and undo workflow. | InOrdo makes the response reviewable. It preserves the evidence, separates source fact from inference, explains downstream impact, and keeps every proposed change inert until a person approves it. |
| **0:33–0:54** | Andres (A3) | In the protected synthetic workspace, enter the canonical venue update and hold on the source/privacy notice. | This workspace and every name in it are synthetic. I insert one venue update: the hall is unavailable on September twelfth and offers September twenty-sixth instead. InOrdo preserves the exact source and warns us never to paste secrets or customer data. |
| **0:54–1:18** | Deston (D1) | Show only the verified Production analysis state and its immutable evidence/candidate boundary. | On the server, GPT-5.6 has two bounded jobs: extract one structured candidate change, then draft recovery actions. Strict schemas and canonical-state checks validate identifiers, values, dates, and the exact evidence span. The model has no tools and cannot write a project record. |
| **1:18–1:41** | Deston (D2) | Expand the real direct and indirect impact path and hold on its depths and full dependency path. | GPT never decides reach. Deterministic TypeScript follows explicit dependency edges, terminates cycles, keeps a stable shortest path, and labels depth one as direct and later steps as indirect. Every affected record is therefore explainable, not merely plausible. |
| **1:41–2:04** | Andres (A4) | Review real recovery proposals, leave human-required work pending, select only the safe internal deadline update, and show the exact confirmation. | Recovery actions are proposals, not permission. I can review them individually, leave anything requiring human confirmation pending, and approve only the safe internal deadline change. The confirmation names exactly what will be applied. |
| **2:04–2:28** | Deston (D3) | Apply the selected verified action, open ordered history, and show its linked compensating undo if the current state remains eligible. | Before applying anything, the server rechecks role, proposal state, selected action IDs, required human input, item versions, and idempotency. History records the actor and ordered before-and-after state. Undo never erases history; it creates a linked compensating operation only when current state still matches. |
| **2:28–2:38** | Deston (D4) | Show sanitized public Codex evidence: public commits, CI/test evidence, or a purpose-built non-secret slide. | Codex accelerated our schema and RLS review, graph and model contracts, operation and undo tests, and release hardening—while preserving the rule that model output never mutates data directly. |
| **2:38–2:47** | Andres (A5) | Briefly show the ordinary-project preview, then return to the InOrdo mark and workflow promise. | InOrdo's promise is simple: when evidence changes a project, every consequence stays visible, attributable, and safely under human control. |

## No-retry 2:47 timeline

Use this branch only after the single attempt is classified as absent, failed, invalid, or unverified; the owner chooses no retry; and every paid credential is revoked. A1–A3, D2, A4, D3, D4, and A5 remain exactly as written in the verified-success timeline. Replace only D1 with the exact text below. The 0:54–2:28 picture plan uses genuine Production fail-closed or preserved synthetic state and must display the listed editorial labels. It never represents a seeded, preserved, failed, or previously stored result as a new paid run.

| Time | Speaker | Genuine Production picture | Required editorial label | Voiceover |
| --- | --- | --- | --- | --- |
| **0:54–1:18** | Deston (D1 no-retry replacement) | Show the real Production disabled/fail-closed analysis state and its safe user-facing explanation. Do not show a result card or success transition. | `No new paid result was verified • Live paid analysis disabled` | InOrdo's GPT-5.6 integration is designed for two bounded server-side jobs: structured change extraction and recovery-action drafting. In this public release, live paid analysis is disabled; the model has no tools and cannot write a project record. |
| **1:18–1:41** | Deston (D2 unchanged) | Show a genuine preserved synthetic dependency view with explicit edges, direct/indirect depths, and a stable full path. Do not associate it with the failed attempt. | `Preserved synthetic dependency state • Not a new paid result` | Use D2 verbatim from the verified-success timeline. |
| **1:41–2:04** | Andres (A4 unchanged) | Show genuine preserved synthetic proposal-review and confirmation UI. Keep human-required work pending; do not claim these proposals came from the failed attempt and do not apply anything for this recording. | `Preserved synthetic proposal state • Not a new paid result` | Use A4 verbatim from the verified-success timeline. |
| **2:04–2:28** | Deston (D3 unchanged) | Show genuine preserved synthetic ordered operation history and the visible undo eligibility/compensating-operation relationship. Do not create a new operation or imply that this history came from the failed attempt. | `Preserved synthetic history • No action applied for this recording` | Use D3 verbatim from the verified-success timeline. |

## Verified-success capture allocation

All capture files live outside Git under `C:\Users\User\Videos\InOrdo-Build-Week\01-screen-captures`:

| Capture | Timeline use |
| --- | --- |
| `01-landing-and-workflow.mp4` | 0:00–0:33 and final 2:43–2:47 mark |
| `02-source-evidence.mp4` | 0:33–0:54 |
| `03-gpt56-analysis.mp4` | 0:54–1:18 |
| `04-deterministic-impact.mp4` | 1:18–1:41 |
| `05-approval-history-undo.mp4` | 1:41–2:28 |
| `06-project-preview.mp4` | 2:38–2:43 |
| `07-codex-evidence.mp4` | 2:28–2:38 |

For the no-retry branch, captures `03-gpt56-analysis.mp4`, `04-deterministic-impact.mp4`, and `05-approval-history-undo.mp4` are replaced in full by the no-retry shots and labels above. Captures 01, 02, 06, and 07 retain their listed timing. Do not place a verified-success frame or badge anywhere in the no-retry edit.

## Final truth and privacy check

- [ ] Runtime is exactly 2:47 and the voiceover text matches the separate speaker masters verbatim.
- [ ] Exactly one post-classification/post-revocation branch is selected; its D1, captures 03–05, and thumbnail badge all agree.
- [ ] Deston's exact D4 pickup was timed before the Production session and is intelligible within 10 seconds without rushing. If it does not fit, recording is blocked pending specification-owner resolution; no wording or timing is changed silently.
- [ ] Every interface frame is genuine Production behavior at 1920×1080 and 100% browser zoom.
- [ ] The synthetic label is legible; no customer data, credential, account detail, browser profile, terminal, or private transcript appears.
- [ ] Captions match the spoken words and do not cover evidence, dependency paths, approval state, or history.
- [ ] The GPT-5.6 shot reflects the one verified Production result; if no result was verified, it is not represented as successful.
- [ ] The recording key was revoked immediately after the playable raw capture was verified.
- [ ] No `__e2e__` route, fabricated interface, or Higgsfield asset appears.
