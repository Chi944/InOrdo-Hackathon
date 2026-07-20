# InOrdo Production capture and edit runbook

This runbook creates one truthful 2:47 submission video from the public Production application. It does not authorize a provider request, deployment change, account operation, or publication. Raw media, edit projects, browser profiles, and credentials stay outside Git.

## Fixed media workspace

Use `C:\Users\User\Videos\InOrdo-Build-Week` as the external media root. Capture these seven Production-only files:

1. `01-screen-captures\01-landing-and-workflow.mp4`
2. `01-screen-captures\02-source-evidence.mp4`
3. `01-screen-captures\03-gpt56-analysis.mp4`
4. `01-screen-captures\04-deterministic-impact.mp4`
5. `01-screen-captures\05-approval-history-undo.mp4`
6. `01-screen-captures\06-project-preview.mp4`
7. `01-screen-captures\07-codex-evidence.mp4`

Voice recordings are provided separately as:

- `02-voiceover\andres\Andres.wav`
- `02-voiceover\andres\Andres-room-tone.wav`
- `02-voiceover\deston\Deston.wav`
- `02-voiceover\deston\Deston-room-tone.wav`

All voice masters are mono PCM WAV, 48 kHz, 24-bit, without clipping. Leave approximately two seconds between sections and record approximately five seconds of room tone per speaker.

## Before the first take

1. Confirm the browser is on `https://inordo.vercel.app`, not a Preview, localhost, or test route.
2. Use a clean recording browser profile containing only the Production session required for the shot. Never record sign-in credentials or account details.
3. Set capture to 1920×1080, browser zoom to 100%, and the browser to full screen.
4. Disable desktop and browser notifications, password-manager prompts, autofill overlays, bookmarks, and unrelated tabs.
5. Confirm the visible project and names are synthetic and the `Synthetic demo` label is legible.
6. Perform a privacy frame check: no email, password, personal data, key, source secret, customer content, browser profile, terminal, local file explorer, private notes, or private transcript is visible.
7. Never capture the `__e2e__` route. Every interface shown must be genuine Production UI.

## Recording key lifecycle

The purpose-specific OpenAI key permits one bounded server-only GPT-5.6 analysis for the recording. GPT-5.6 may extract one structured candidate change and draft recovery actions; it has no tools and no mutation authority. Deterministic TypeScript calculates dependency reach, and model output never directly mutates project records.

1. Complete the non-provider rehearsal and all camera framing before enabling the recording key.
2. Record the single authorized Production analysis and its resulting workflow once.
3. Play the raw capture from beginning to end and verify that it is readable, audible where applicable, uncorrupted, and safe to edit.
4. Immediately after that playable raw capture is verified, revoke the purpose-specific OpenAI key at the provider.
5. Remove the key from Vercel Production and redeploy in the approved safe mode before any public handoff.

If the one provider attempt fails, do not retry without explicit authorization. Use the truthful no-verified-result submission branch and never fabricate, regenerate, or substitute an interface result.

## Exact capture map

| Timeline | Voice | Capture | Required picture |
| --- | --- | --- | --- |
| 0:00–0:16 | A1 | `01-landing-and-workflow.mp4` | Production landing and labeled synthetic project hook. |
| 0:16–0:33 | A2 | `01-landing-and-workflow.mp4` | Evidence → impact → proposal → approval → history and undo workflow. |
| 0:33–0:54 | A3 | `02-source-evidence.mp4` | Canonical venue update, exact evidence, and privacy warning. |
| 0:54–1:18 | D1 | `03-gpt56-analysis.mp4` | The one verified bounded Production analysis, immutable source, candidate, and review signals. |
| 1:18–1:41 | D2 | `04-deterministic-impact.mp4` | Direct/indirect groups, depth labels, and stable full path. |
| 1:41–2:04 | A4 | `05-approval-history-undo.mp4` | Individual proposals, human-required work pending, safe internal update selected, exact confirmation. |
| 2:04–2:28 | D3 | `05-approval-history-undo.mp4` | Applied action, ordered history, and eligible linked compensating undo. |
| 2:28–2:38 | D4 | `07-codex-evidence.mp4` | Sanitized public development evidence only. |
| 2:38–2:43 | A5 | `06-project-preview.mp4` | Ordinary-project preview and its truthful currently unavailable message. |
| 2:43–2:47 | A5 | `01-landing-and-workflow.mp4` | InOrdo mark and final workflow promise. |

`07-codex-evidence.mp4` may show sanitized public GitHub commits, public CI results, public test evidence, or a purpose-built non-secret slide. It must never show the Codex task transcript, terminal history, shell prompt, local file explorer, browser profile, environment output, account details, or private review notes.

## Direction and editing

- Use restrained cursor movement. Move once with intent, then hold before clicking.
- Hold briefly on the immutable evidence span, deterministic full path, selected approval summary, applied state, and linked undo so each remains readable.
- Prefer straight cuts and short dissolves; avoid decorative transitions, excessive zooms, simulated typing, or invented product motion.
- Keep the genuine Production interface visually dominant. Do not redraw, composite, or generate an interface.
- Use the speaker room tone only for clean edits. Do not alter meaning or compress pauses until words become rushed.
- Create accurate burned-in or selectable captions from the verbatim speaker masters. Check names, `GPT-5.6`, `TypeScript`, `idempotency`, and punctuation manually.
- Keep captions within title-safe margins and away from evidence, path, approval, history, and synthetic-status text.
- Perform the privacy frame check before every take and again on the assembled timeline.
- Do not use a Higgsfield asset; genuine footage, typography, and standard editing are sufficient.

## Export and review

- Timeline duration: exactly 2:47.
- Canvas: 1920×1080, progressive, square pixels.
- Export a high-quality H.264 MP4 with AAC audio suitable for YouTube; retain a high-bitrate review master outside Git.
- Listen on headphones and speakers. Confirm speech is clear, neither voice clips, and transitions contain no abrupt room-tone changes.
- Watch the entire export at 100% and at a small player size. Confirm captions, synthetic label, evidence, paths, and confirmation remain legible.
- Scrub every frame around cuts for leaked notifications, credentials, personal data, browser chrome overlays, or private material.
- Confirm every public claim matches the exact Production behavior and the chosen verified-result/no-verified-result release evidence.
