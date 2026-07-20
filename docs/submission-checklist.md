# Build Week submission checklist

Use this as the final human handoff. Check an item only after testing the exact public artifact that judges will receive. Never place a password, API key, session cookie, service-role key, private transcript, or real customer data in the repository or submission.

## Confirmed submission facts

- [x] Product: InOrdo.
- [x] Track: **Work and Productivity**.
- [x] Demo records represent the synthetic “Regional Climate Action Summit 2026” workspace; no customer account is used.
- [x] The repository contains an MIT `LICENSE` file.
- [x] The repository contains architecture, demo, security, QA, and Codex implementation evidence.
- [x] The implementation log contains summaries only and no private Codex transcript or fabricated Session ID.
- [x] The public canonical alias `https://inordo.vercel.app` is assigned to production deployment `dpl_EwTWxyQ4j8F7P4Dk3wrh5whTP9RA` at reviewed `main` SHA `dad6b33e8fe99ae134f6949a4c46e8311352691d`; Preview deployments remain protected.

## Required public assets and access

- [x] An unauthenticated GitHub API/raw-file check confirmed `https://github.com/Chi944/InOrdo-Hackathon` is public and defaults to `main`; the current deployed application SHA is recorded separately below.
- [x] The public MIT license and README return `200`; the full-repository release review plus a current/all-history credential-format scan found no secret, unexpected tracked environment file, private data, or private transcript.
- [x] Production is public while Preview remains protected. Signed-out checks returned `200` for `/` and `/login`, `ready` for `/api/health`, and `307` from `/app` to `/login?next=%2Fapp`; the immutable Production URL is public and a real Preview URL still returns Vercel SSO.
- [ ] Confirm the README renders correctly on the public repository, including Mermaid, screenshots/GIFs, setup instructions, known limitations, and links.
- [x] Confirm the checked-in landing and workflow-principle screenshots come from the real public route, include descriptive alt text, and make no authenticated or live-model claim.
- [ ] Capture a final protected-workspace screenshot or short GIF after the funded analysis-to-undo QA; label synthetic data and do not present the failed provider attempt or a fixture as live GPT-5.6 output.
- [ ] Confirm the synthetic sample path and operator-managed demo/test-account instructions at `<DEMO_ACCESS_INSTRUCTIONS_OR_TEST_PATH>` work without committing a password.
- [ ] Confirm `<PUBLIC_YOUTUBE_VIDEO_URL>` is publicly viewable, has voiceover, matches the submitted build, and runs no longer than 3:00.
- [ ] Confirm `<DEVPOST_URL>` is public after submission and every linked asset opens without team credentials.

## Product and claim review

- [ ] README and Devpost use the one-line pitch consistently and identify the Work and Productivity track.
- [ ] The demo follows evidence → impact → proposal → approval → history and undo, or clearly stops at the last independently verified step.
- [ ] The GPT-5.6 explanation is specific: server-side structured extraction and recovery drafting, strict validation, no tools, and no direct mutation authority.
- [ ] The deterministic explanation is specific: explicit dependency traversal, authorization, approval checks, mutations, operation history, and undo remain application/database logic.
- [ ] The Codex explanation names concrete work packages and decisions instead of making a generic “AI helped us code” claim.
- [ ] The video never presents a fixture, test double, prerecorded mock, or expected result as a live model response.
- [x] The proposal-readiness mismatch is resolved by the invariant-checked server-owned transition and its linked reconciliation; non-ready states still fail closed.
- [ ] Known limitations include the unverified live model/browser/deployment gates that remain open at submission time.

## Production video package

- [x] The authoritative storyboard is exactly 2:47 and assigns Andres sections A1–A5 and Deston sections D1–D4.
- [x] Separate recording masters specify mono PCM WAV at 48 kHz/24-bit, no clipping, approximately two seconds between sections, approximately five seconds of room tone, and external-only media paths.
- [x] The capture runbook requires genuine public Production behavior at 1920×1080, 100% browser zoom, full-screen browser, disabled notifications, a visible synthetic label, and a privacy frame check before every take.
- [x] The video package states that GPT-5.6 performs bounded server-only extraction/drafting, deterministic TypeScript owns dependency reach, and model output never directly mutates project records.
- [ ] Record the seven named Production captures in `C:\Users\User\Videos\InOrdo-Build-Week\01-screen-captures`; never commit raw captures, voice files, browser profiles, edit projects, credentials, or private notes.
- [ ] Verify the single authorized GPT-5.6 raw capture is playable, then immediately revoke the purpose-specific OpenAI key, remove it from Vercel Production, and redeploy in the approved safe mode.
- [ ] If the one provider attempt does not yield a verified result, do not retry without explicit authorization; select the truthful no-verified-result copy and do not imply a live success in the video or thumbnail.
- [ ] Receive `Andres.wav`, `Andres-room-tone.wav`, `Deston.wav`, and `Deston-room-tone.wav` at the documented external paths and verify format, clipping, intelligibility, and section order.
- [ ] Assemble accurate captions, restrained cursor movement, readable holds on evidence/path/approval/history, and a final frame-by-frame privacy review.
- [ ] Export and inspect the exactly 2:47 1920×1080 final video; verify it contains no test route, generated interface, private transcript, environment output, account detail, credential, or customer data.
- [ ] Export `C:\Users\User\Videos\InOrdo-Build-Week\05-exports\final\inordo-thumbnail-1280x720.png` at exactly 1280×720 from a genuine Production frame with the approved title, subtitle, badge, synthetic label, and privacy constraints.
- [ ] Confirm the recording key is revoked and the safe post-recording Production deployment is live before uploading or sharing any video.

## README and local reproduction

- [ ] Prerequisites match `package.json` and the repository toolchain, including Node 22 and npm.
- [ ] Environment documentation lists names only; browser-safe and server-only variables are distinguished and no value is committed.
- [ ] Supabase migration, seed, generated-type, and demo-user steps match the checked-in files and do not imply that the seed creates credentials.
- [ ] `npm ci`, local development, production build, and test commands have been followed from a clean checkout.
- [ ] Repository structure and actual routes match the final tree.
- [x] Deployment instructions name the confirmed manual Vercel Hobby project `chi944s-projects/inordo` and no alternate hosting path.

## Final QA gate

- [x] All current-branch commands in `docs/qa-checklist.md` are checked with results from the final worktree.
- [ ] A real owner/admin account completes the authenticated manual checks that are possible in the final build.
- [x] Authenticated local responsive checks pass at 375, 768, and 1440 pixels with no horizontal overflow.
- [ ] Keyboard, focus, headings, landmarks, labels, status text, error announcements, and reduced-motion behavior are verified on the exact deployed production route.
- [ ] A private/incognito production pass covers landing, login, protected route, source intake, the last working analysis step, safe approval gating, history visibility, logout, and refresh behavior.
- [ ] Exactly one funded synthetic live GPT-5.6 analysis is verified with safe metadata only, or all public copy states that a live model call was not verified.
- [ ] Public repository, production, video, and Devpost links are tested from a browser with no team session.

## Codex submission evidence

- [ ] Run `/feedback` from the primary Codex task used for the submission evidence.
- [ ] Paste only the returned identifier into `<PRIMARY_FEEDBACK_SESSION_ID>` in README, submission copy, and `docs/codex-log.md`.
- [ ] Confirm no private transcript, prompt history, secret, or unrelated Session ID is committed.
- [ ] Confirm the submitted Codex explanation names the relevant work packages: repository/architecture foundation, secure data and operation boundaries, deterministic graph work, impact-review UX, tests/QA, and submission documentation.

## Team, deadline, and final lock

- [ ] Replace `<TEAM_MEMBER_NAMES_AND_ROLES>` with the exact public team-member names and roles approved by the team.
- [x] Confirmed from the [official Devpost schedule](https://openai.devpost.com/details/dates): submissions close July 21, 2026 at 5:00 PM PDT (July 22, 2026 at 8:00 AM SGT).
- [ ] After the final repository commit exists, record its SHA in the external submission notes and make Devpost reference it. Separately confirm production still identifies the recorded application release SHA; do not create a circular self-referential commit merely to embed either SHA.
- [ ] Submit before the official deadline.
- [ ] After the deadline, make **no edits** to the submitted repository branch/commit, production artifact, Devpost entry, or public video unless the event rules explicitly permit them.

## Placeholder inventory

Replace every remaining submission token below before publishing. Search with `rg -n '<(DEVPOST_URL|PUBLIC_YOUTUBE_VIDEO_URL|DEMO_ACCESS_INSTRUCTIONS_OR_TEST_PATH|PRIMARY_FEEDBACK_SESSION_ID|TEAM_MEMBER_NAMES_AND_ROLES)>' README.md docs` and resolve every result intentionally.

| Placeholder | Human-supplied value | Verification |
| --- | --- | --- |
| Public repository | `https://github.com/Chi944/InOrdo-Hackathon` | Open signed out and confirm the final intended commit and README are visible. |
| Production application | `https://inordo.vercel.app` | Open incognito and run the production checklist. |
| Hosting platform/project | Manual Vercel Hobby project `chi944s-projects/inordo` | Confirm the project remains manually deployed with no Git-connected automatic deployment. |
| Deployed application SHA | `dad6b33e8fe99ae134f6949a4c46e8311352691d` | Compare the deployment metadata and final submission reference. |
| `<DEVPOST_URL>` | Final public Devpost entry. | Open signed out after submission. |
| `<PUBLIC_YOUTUBE_VIDEO_URL>` | Public voiceover video URL, duration at most 3:00. | Play signed out and compare against the final build. |
| `<DEMO_ACCESS_INSTRUCTIONS_OR_TEST_PATH>` | Judge-safe test path or separately delivered account instructions; never a committed password. | Follow from a private browser with the approved access method. |
| `<PRIMARY_FEEDBACK_SESSION_ID>` | Identifier returned by the primary `/feedback` command. | Confirm the exact ID; do not attach a private transcript. |
| `<TEAM_MEMBER_NAMES_AND_ROLES>` | Exact public team-member names and roles. | Cross-check the team’s event registration. |
| Submission deadline | July 21, 2026 at 5:00 PM PDT (July 22, 2026 at 8:00 AM SGT). | Confirmed against the official Devpost schedule. |

Two setup examples are deliberately not submission fields: `<SUPABASE_PROJECT_REF>` in README and `<AUTH_USER_UUID>` in `docs/demo-user-setup.md`. Replace them only in a local command or reviewed dashboard query when configuring an environment. Do not commit a real Auth UUID, credential, or environment value merely to remove an instructional placeholder.

## Final sign-off

- [ ] Andres — UX, responsive, accessibility, screenshots, and copy review complete.
- [ ] Deston — database/server contracts, production configuration, model call, readiness invariants, and operation safety review complete.
- [ ] Shared — public access, end-to-end truth check, video, `/feedback` Session ID, team details, deadline, and no-post-deadline-edit lock complete.
