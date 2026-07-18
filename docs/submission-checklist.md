# Build Week submission checklist

Use this as the final human handoff. Check an item only after testing the exact public artifact that judges will receive. Never place a password, API key, session cookie, service-role key, private transcript, or real customer data in the repository or submission.

## Confirmed submission facts

- [x] Product: InOrdo.
- [x] Track: **Work and Productivity**.
- [x] Demo records represent the synthetic “Regional Climate Action Summit 2026” workspace; no customer account is used.
- [x] The repository contains an MIT `LICENSE` file.
- [x] The repository contains architecture, demo, security, QA, and Codex implementation evidence.
- [x] The implementation log contains summaries only and no private Codex transcript or fabricated Session ID.

## Required public assets and access

- [ ] Confirm `<PUBLIC_REPOSITORY_URL>` opens without a team-authenticated GitHub session and exposes the intended final commit.
- [ ] Confirm the public repository includes the MIT license and no secret, credential, environment value, private data, or private transcript.
- [ ] Confirm `<PRODUCTION_URL>` opens in a private/incognito window and points to the final submitted commit.
- [ ] Confirm the README renders correctly on the public repository, including Mermaid, screenshots/GIFs, setup instructions, known limitations, and links.
- [x] Confirm the checked-in landing and workflow-principle screenshots come from the real public route, include descriptive alt text, and make no authenticated or live-model claim.
- [ ] Capture a final protected-workspace screenshot or short GIF only after authenticated production QA; label synthetic data and do not present a fixture as live GPT-5.6 output.
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
- [ ] The proposal-state blocker in `docs/qa-checklist.md` is resolved and verified, or the README, Devpost, and video explicitly state that fresh-analysis approval/undo is not connected.
- [ ] Known limitations include the unverified live model/browser/deployment gates that remain open at submission time.

## README and local reproduction

- [ ] Prerequisites match `package.json` and the repository toolchain, including Node 22 and npm.
- [ ] Environment documentation lists names only; browser-safe and server-only variables are distinguished and no value is committed.
- [ ] Supabase migration, seed, generated-type, and demo-user steps match the checked-in files and do not imply that the seed creates credentials.
- [ ] `npm ci`, local development, production build, and test commands have been followed from a clean checkout.
- [ ] Repository structure and actual routes match the final tree.
- [ ] Deployment instructions name `<DEPLOYMENT_PLATFORM_OR_PROJECT>` only after the final platform is confirmed.

## Final QA gate

- [x] All current-branch commands in `docs/qa-checklist.md` are checked with results from the final worktree.
- [ ] A real owner/admin account completes the authenticated manual checks that are possible in the final build.
- [ ] Responsive checks pass on the real authenticated route at approximately 375, 768, and 1440 pixels with no horizontal overflow.
- [ ] Keyboard, focus, headings, landmarks, labels, status text, error announcements, and reduced-motion behavior are verified on the real route.
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
- [ ] Replace `<FINAL_SUBMISSION_DEADLINE_WITH_TIMEZONE>` with the official deadline and timezone from the event source of truth.
- [ ] After the final commit exists, record its SHA in the external submission notes and confirm the deployment and Devpost reference that artifact; do not create a circular self-referential commit just to embed its own SHA.
- [ ] Submit before the official deadline.
- [ ] After the deadline, make **no edits** to the submitted repository branch/commit, production artifact, Devpost entry, or public video unless the event rules explicitly permit them.

## Placeholder inventory

Replace every submission token below before publishing. Search with `rg -n '<(PUBLIC_REPOSITORY_URL|PRODUCTION_URL|DEPLOYMENT_PLATFORM_OR_PROJECT|DEVPOST_URL|PUBLIC_YOUTUBE_VIDEO_URL|DEMO_ACCESS_INSTRUCTIONS_OR_TEST_PATH|PRIMARY_FEEDBACK_SESSION_ID|TEAM_MEMBER_NAMES_AND_ROLES|FINAL_SUBMISSION_DEADLINE_WITH_TIMEZONE)>' README.md docs` and resolve every result intentionally.

| Placeholder | Human-supplied value | Verification |
| --- | --- | --- |
| `<PUBLIC_REPOSITORY_URL>` | Public final repository URL. The current Git remote is only a candidate: its anonymous default page reported an empty repository during this session. | Open signed out and confirm the final intended commit and README are visible. |
| `<PRODUCTION_URL>` | Final deployed application URL. | Open incognito and run the production checklist. |
| `<DEPLOYMENT_PLATFORM_OR_PROJECT>` | Confirmed hosting platform/project description, without secret identifiers. | Compare with the actual deployed project. |
| `<DEVPOST_URL>` | Final public Devpost entry. | Open signed out after submission. |
| `<PUBLIC_YOUTUBE_VIDEO_URL>` | Public voiceover video URL, duration at most 3:00. | Play signed out and compare against the final build. |
| `<DEMO_ACCESS_INSTRUCTIONS_OR_TEST_PATH>` | Judge-safe test path or separately delivered account instructions; never a committed password. | Follow from a private browser with the approved access method. |
| `<PRIMARY_FEEDBACK_SESSION_ID>` | Identifier returned by the primary `/feedback` command. | Confirm the exact ID; do not attach a private transcript. |
| `<TEAM_MEMBER_NAMES_AND_ROLES>` | Exact public team-member names and roles. | Cross-check the team’s event registration. |
| `<FINAL_SUBMISSION_DEADLINE_WITH_TIMEZONE>` | Official deadline with timezone. | Cross-check the event source of truth. |

Two setup examples are deliberately not submission fields: `<SUPABASE_PROJECT_REF>` in README and `<AUTH_USER_UUID>` in `docs/demo-user-setup.md`. Replace them only in a local command or reviewed dashboard query when configuring an environment. Do not commit a real Auth UUID, credential, or environment value merely to remove an instructional placeholder.

## Final sign-off

- [ ] Andres — UX, responsive, accessibility, screenshots, and copy review complete.
- [ ] Deston — database/server contracts, production configuration, model call, proposal-state transition, and operation safety review complete.
- [ ] Shared — public access, end-to-end truth check, video, `/feedback` Session ID, team details, deadline, and no-post-deadline-edit lock complete.
