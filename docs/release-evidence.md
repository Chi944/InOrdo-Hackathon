# InOrdo final release evidence

This document records the factual release state produced by the merged application review, verified Production recording, post-recording teardown, live browser QA, and completed review export. It separates that evidence from the public YouTube, `/feedback`, final repository reference, and final-submission checks that remain.

## Production recording and video package status — 2026-07-21

- The repository retains the original 2:47 storyboard and separate Andres A1–A5 / Deston D1–D4 recording masters. The completed verified-success review export follows the natural performances and runs 2:44.067; its 1280×720 thumbnail is also complete outside Git.
- The package requires genuine Production frames, synthetic data, a privacy check before every take, bounded server-only GPT-5.6 work, deterministic TypeScript dependency reach, inert model output, and human approval before internal mutations.
- Raw captures, voice files, edit projects, browser profiles, exports, credentials, account identifiers, and private notes remain outside Git under the owner-managed media workspace.
- The single authorized GPT-5.6 Production run succeeded. Genuine saved evidence, direct and indirect impact paths, the recovery proposal, one selected internal date action with an explicit human response, successful apply, linked history, and compensating undo were captured from Production.
- The recording-key lifecycle is complete. An older duplicate active InOrdo provider key discovered before the run was revoked; after the playable capture, the fresh recording key was revoked, zero active InOrdo keys remained, the Vercel `OPENAI_API_KEY` was removed, local `.env.recording.local` was deleted, and Production was redeployed with analysis disabled.
- The verified-success editorial branch is selected. The no-retry branch remains documented only as an unused contingency and must not be mixed into the final edit.
- The completed export is H.264, 1920×1080, 30 fps, with 48 kHz AAC mono audio. Integrated loudness is -15.1 LUFS with -1.1 dBFS true peak; the scan found no black segment or silence longer than two seconds. Deston's natural D4 runs 12.229 seconds, with no time-stretch or synthesis; captions follow its audible wording and non-spoken holds were tightened. Representative-frame privacy review found no secret, account identifier, customer data, private transcript, fixture route, fabricated interface, or generative media.

## Recoverable workspace cleanup recorded 2026-07-21

- Archive: `C:\Users\User\Documents\Archives\InOrdo\workspace-cleanup-2026-07-21`
- Moved for recovery: `.playwright-mcp`, `inordo-desktop.png`, and `inordo-mobile.png`
- Removed after exact validation: empty `.agents`, empty `.git`, and the unchanged audited zero-byte `Program` reparse point
- Final `C:\Users\User\Documents\Projects\Hackathons` listing: `InOrdo-Hackathon`

## Release identity

| Field | Recorded value |
| --- | --- |
| Current release source SHA | `4f54cc1eec37d49aa6b1da6e0dafbc6f7d738d03` |
| Release source proof | Direct Vercel CLI deployment from a clean worktree at the exact reviewed `main` SHA; Vercel did not expose a Git SHA for this direct deployment |
| Production alias | Public [inordo.vercel.app](https://inordo.vercel.app), assigned to the current production deployment; Vercel Authentication protects Preview only |
| Immutable deployment | [inordo-caheq8v2h-chi944s-projects.vercel.app](https://inordo-caheq8v2h-chi944s-projects.vercel.app) |
| Vercel deployment ID | `dpl_BW4kvr2zMUNkwv46XEeMMFRJeisJ` |
| Production metadata | `READY`; `/api/health` is `ready` with analysis disabled |
| Current merged application `main` SHA before this release-evidence branch | `4f54cc1eec37d49aa6b1da6e0dafbc6f7d738d03` |
| Hardening release merge | PR [#11](https://github.com/Chi944/InOrdo-Hackathon/pull/11), merged normally into `main` |
| Approval-copy safety merge | PR [#12](https://github.com/Chi944/InOrdo-Hackathon/pull/12), merged normally into `main` |
| Evidence-integrity merge | PR [#13](https://github.com/Chi944/InOrdo-Hackathon/pull/13), merged normally into `main` |
| Approval-integrity merge | PR [#14](https://github.com/Chi944/InOrdo-Hackathon/pull/14), merged normally into `main` |
| Native-write contract merge | PR [#17](https://github.com/Chi944/InOrdo-Hackathon/pull/17), merged normally into `main` |
| Release hardening merge | PR [#18](https://github.com/Chi944/InOrdo-Hackathon/pull/18), merged normally into `main` |
| Hydration-safe focus repair | PR [#19](https://github.com/Chi944/InOrdo-Hackathon/pull/19), merged normally into `main` after local and CI verification |
| Ambiguous retry payload repair | PR [#20](https://github.com/Chi944/InOrdo-Hackathon/pull/20), merged normally into `main`; retained idempotency keys restore the submitted payload before the retry action is paint-visible |
| Exact-SHA Preview | `dpl_ChQL8nigyoc1M6LSEGjdS8seP4bD`; `inordo-hackathon-3w91bc8k0-chi944s-projects.vercel.app` |
| Preview metadata | `READY`, Preview, Node `22.x`, `githubCommitSha` `72a6fc5a02a55ec5efe52e0b14f8ac831ec2685c`, ref `main` |
| Vercel project runtime default | Node `22.x`, aligned with `package.json` and both recorded deployment artifacts |
| Vercel project | `chi944s-projects/inordo`; renamed from the bootstrap name without changing project ID or the immutable historical deployment |
| Linked Supabase project | Sanitized identity match completed; hosted migrations have exact parity through `20260721100000`; no project reference is recorded |

The current post-recording Production deployment was created from the same clean exact-SHA release worktree at reviewed `main` SHA `4f54cc1...`. This is operator-side source evidence: the direct CLI deployment did not expose a Vercel Git SHA, so this record does not claim that it did. Deston confirmed Vercel Hobby eligibility for this hackathon demo on July 20, 2026. Public Production access is verified; Preview remains intentionally protected.

## Implemented feature evidence

| Capability | Primary implementation evidence | Automated or linked evidence |
| --- | --- | --- |
| Public entry, email/password login, and protected workspace | `src/app/page.tsx`, `src/app/login/`, `src/app/app/`, `src/proxy.ts` | Landing, login, auth, proxy, and repository tests under `src/app/` and `src/lib/` |
| Native project records | `src/features/project-records/`, `src/app/app/items/`, `src/app/app/decisions/`, `src/app/app/risks/` | Schema, operation, action, repository, and component tests |
| Explicit dependency management | `src/app/app/dependencies/`, `src/features/project-records/operations.ts` | Dependency direction, authorization, stale-write, and view tests |
| Immutable source intake and analysis | `src/app/api/projects/[projectId]/analyze/route.ts`, `src/features/analysis/` | Adapter, prompt, schema, postvalidation, persistence, service, route, and claim-lease tests |
| Evidence-backed review interface | `src/app/app/source-update-form.tsx`, `src/app/app/impact-workflow.tsx`, `src/app/app/recovery-action-review.tsx` | Source intake, impact presentation, selection, confirmation, conflict, focus, and undo-control tests |
| Deterministic downstream impact | `src/features/impact/` | Chain, fan-out, fan-in, cycle, duplicate, archive, depth, ordering, and shortest-path tests |
| Selective human approval | `src/app/api/projects/[projectId]/proposals/[proposalId]/apply/route.ts`, `src/features/operations/` | Request-schema, authorization, idempotency, atomicity, and route/service tests |
| Ordered history and compensating undo | `src/app/api/projects/[projectId]/operations/`, `src/features/operations/history.ts` | History ordering, replay, reversibility, stale-state, and undo tests |
| Named synthetic demo reset | `src/app/api/projects/[projectId]/demo/reset/route.ts`, `src/app/app/demo-reset-control.tsx` | Role, slug, confirmation, rate, generation, baseline, and replay tests plus linked SQL |
| Guarded browser journeys | `tests/e2e/core-demo.spec.ts`, `src/lib/e2e/` | Two Chromium journeys over production components with provider/database seams intercepted |
| Configuration readiness | `src/app/api/health/route.ts`, `src/lib/env/readiness.ts` | Complete/missing configuration tests and public production smoke |
| Streaming request boundary | `src/lib/http/read-bounded-request-body.ts`, analysis and operation route handlers | Missing/dishonest-length, cumulative-byte, cancellation, UTF-8, and user-safe-error tests |

The guarded browser route is test-only and is not live Supabase, Auth, RLS, or OpenAI evidence.

## GPT-5.6 integration evidence

The server entry is `src/app/api/projects/[projectId]/analyze/route.ts`. `src/features/analysis/route-handler.ts`, `service.ts`, and `runtime.ts` own request handling and orchestration; `openai-adapter.ts`, `prompts.ts`, and `model-schemas.ts` own the bounded OpenAI Responses API contracts; `context.ts`, `model-context.ts`, and `post-validation.ts` constrain canonical context and validate all returned identifiers, values, evidence spans, actions, and impacts; `supabase-persistence.ts` persists only a completely validated result through constrained server-only database functions.

The workflow is:

1. authenticate and authorize a contributor, validate bounds, revision, source hash, rate, and duplicate state;
2. preserve immutable source evidence and claim the analysis request;
3. ask the configured GPT-5.6 model for one structured candidate change or no change;
4. validate that candidate against canonical project state;
5. compute impact paths in pure deterministic TypeScript;
6. ask GPT-5.6 for bounded recovery drafts over those computed paths;
7. postvalidate the complete output and atomically persist inert review records; and
8. require a separate authorized human selection before any operation can mutate project data.

The checked-in default model setting is `gpt-5.6-luna`. Calls are server-only, use strict structured output, have no tools or direct data-mutation path, disable provider storage, and are bounded by application timeouts and a fixed database claim lease. A historical Production request failed closed during extraction. The later purpose-specific recording window passed the canonical-source and fresh-duplicate gates; exactly one 14-minute grant was issued, exactly one GPT-5.6 Production run succeeded, and post-capture verification returned one claimed, consistent, expiry-valid grant. No private grant, request, account, or provider identifier is recorded here.

## Deterministic graph evidence

`src/features/impact/types.ts` defines Supabase-independent domain structures. `schemas.ts` validates graph input/output. `traverse.ts` implements the pure traversal, and `loader.ts` loads one authorized project's bounded active graph before invoking it.

An edge means `from_item_id` is the dependent record and `to_item_id` is its upstream prerequisite or context. Starting from a changed upstream item, traversal builds `to -> from` adjacency and follows it toward dependent records. Its breadth-first search filters archived records, ignores defensive self-loops and duplicate edges, terminates cycles with a best-depth map, returns full paths and direct/indirect depth, keeps one shortest discovered path, and applies stable tie-breaking and ordering. The default maximum depth is 5 and validated input cannot exceed 20. It makes no model or network call.

## Approval, undo, and reset safety

The operation boundary is implemented in `src/features/operations/`, the apply/history/undo/reset route files under `src/app/api/projects/[projectId]/`, and migrations `20260718190000_add_approval_undo_demo_reset.sql` plus `20260718191000_harden_prompt9_operations.sql`.

- Model output remains inert and never grants authorization.
- Owner/admin membership, proposal ownership/state, selected action IDs, allowlisted payloads, required human input, item versions, and idempotency are rechecked server-side.
- Selected actions and ordered audit records commit in one transaction or none do.
- Undo never edits history. It appends one linked compensating operation only when the entire original operation is reversible field updates and every current version/after-state still matches.
- Created task/risk and confirmation actions are intentionally nonreversible.
- Default and bulk safe selection includes only pending field updates without required human input. Create-item and confirmation actions require explicit individual selection, are labeled nonreversible, and make the whole mixed operation ineligible for undo.
- Reset requires owner/admin access, the exact configured synthetic project, explicit confirmation, rate/idempotency controls, and a server-held secret that is never supplied by the browser.
- Reset advances workflow generation, restores the canonical 24-item/26-edge baseline, retires nonbaseline records, and preserves archived evidence and operations.

## Verification record

The exact release source SHA `4f54cc1eec37d49aa6b1da6e0dafbc6f7d738d03` passed the following under Node `22.23.1` and npm `10.9.8`:

- clean `npm ci`;
- `npm run lint`;
- `npm run typecheck`;
- `npm run test:run`: 514 tests across 64 Vitest files;
- `npm run test:e2e`: two Chromium journeys, including the deployed skip-link focus invariant;
- `npm run build`;
- `npm audit --omit=dev`: zero production vulnerabilities; and
- `git diff --check` with a clean synchronized `main`; and
- the Next.js `16.2.10` production build from the exact source.

Linked Supabase evidence includes the exact migration `20260721100000_add_analysis_access_policy.sql`, SHA-256 `0F4125F0897FE96A942889EF57C8A4CC186F730539597149EB98CABEA4939B1F`. It was applied only after the sanitized linked-target comparison, a second exact dry run, and owner approval. Post-apply migration parity passed through `20260721100000`, the pending set was empty, and linked database lint passed. A nonfatal `pg-delta` catalog-cache warning occurred during the release sequence; the subsequent successful dry-run, parity, and lint proofs are authoritative. Earlier linked evidence includes generated database types matching the hosted schema and passing rollback-wrapped SQL verification. The exact deployed RPC artifact passed item create/update, dependency add/remove, exact replay, generation/version rejection, viewer/anonymous/cross-project denial, and reset back to the 24-item/26-edge baseline. The post-contract verifier additionally proves legacy table/column writes are denied, all four guarded RPCs remain executable, member reads remain, and true nonmembers are rejected. Verification transactions and the final reset retained no temporary test records.

Historical hardening SHA `72a6fc5...` separately passed a clean Node `22.23.1` gate: lint, typecheck, 358 Vitest tests across 55 files, one guarded Chromium journey, production build, zero production dependency vulnerabilities, and whitespace checks. Its exact-SHA Preview inspection is recorded below; this does not turn it into current production evidence.

The historical approval-copy repair commit `90ac845...` passed a fresh Node `22.23.1` clean install, lint, typecheck, 359 Vitest tests across 55 files, one guarded Chromium journey, production build, zero production dependency vulnerabilities, focused independent re-review, and PR #12 CI before its normal merge as then-current `main` `debe2be4...`. This closed the product-copy security gate without claiming a credentialed browser run.

Before reconciliation, the Prompt 14 documentation branch passed lint, typecheck, 305 Vitest tests across 54 files, and the Next.js 16.2.10 production build. After merging current `main`, Node `22.23.1` and npm `10.9.8` completed a fresh `npm ci`, lint, typecheck, 358 Vitest tests across 55 files, one guarded Chromium journey, the Next.js 16.2.10 production build, and a zero-vulnerability production dependency audit. Final staged/unstaged whitespace checks are recorded in `docs/qa-checklist.md` immediately before the merge-resolution commit.

## Verified Production recording and post-recording disabled-mode smoke — 2026-07-21

| Check | Result |
| --- | --- |
| Recording deployment | Interim Production deployment reached `READY`; health reported analysis `recording_configured` |
| Auth identities | Exactly one owner, one admin recording operator, and one viewer judge were verified as three distinct real Auth identities |
| Preflight | Canonical-source and fresh-duplicate gates passed; the operator display was sanitized |
| One-use authorization | Exactly one 14-minute grant was issued; post-capture verification found one claimed, consistent, expiry-valid grant |
| GPT-5.6 result | Exactly one Production run succeeded; genuine saved evidence, direct and indirect impact, and a recovery proposal were captured |
| Human approval and undo | One internal date action was selected with an explicit human response; apply and compensating undo succeeded, and linked history remains |
| Judge viewer QA | Saved evidence and read surfaces were accessible; provider and mutation controls were denied, disabled, or absent as required |
| Credential teardown | An older duplicate active InOrdo key was revoked before the run; the fresh key was revoked after playable capture; zero active InOrdo keys remained; the Vercel `OPENAI_API_KEY` was removed; local `.env.recording.local` was deleted |
| Current deployment | `dpl_BW4kvr2zMUNkwv46XEeMMFRJeisJ` is `READY`; canonical [inordo.vercel.app](https://inordo.vercel.app) and immutable [inordo-caheq8v2h-chi944s-projects.vercel.app](https://inordo-caheq8v2h-chi944s-projects.vercel.app) are reachable |
| Release source | Direct CLI deployment from a clean worktree at exact SHA `4f54cc1eec37d49aa6b1da6e0dafbc6f7d738d03`; Vercel did not expose a Git SHA for this direct deployment |
| Current health and mode | `/api/health` is `ready`; `ANALYSIS_MODE` is `disabled`; new paid analysis is disabled while the verified saved result remains viewable |
| Devpost handoff | Andres is a confirmed Devpost team member; judge-only credentials and instructions are saved privately in Devpost |

No private ID, email, password, project reference, provider-key metadata, grant ID, or request ID is recorded. The verified review export and thumbnail are complete outside Git. The public YouTube URL and primary Codex feedback Session ID remain pending, so Devpost finalization is not claimed.

## Historical pre-recording disabled-mode Production smoke — 2026-07-21

Deployment `dpl_EygrifPbthqu1sdbrUDNog4deNXf` at immutable `https://inordo-oq86578uo-chi944s-projects.vercel.app` was the earlier disabled-mode release from the same clean exact-SHA source. It was `READY`, canonical health returned `200 ready`, public landing/login checks passed, signed-out protected access redirected to login, and names-only checks found no usable provider key. It was superseded first by the bounded recording deployment and then by the current post-recording disabled deployment above; it is not the current canonical artifact.

## Historical pre-rename production smoke recorded 2026-07-19

| Check | Result |
| --- | --- |
| Then-current production alias resolved to the recorded deployment ID | Pass; not evidence for the renamed alias |
| `/` | `200` |
| `/login` | `200` |
| Signed-out `/app` | `307` to `/login?next=%2Fapp`; no tenant data returned |
| `/api/health` with intentionally absent `OPENAI_API_KEY` | Expected `503 not_ready`, `Cache-Control: no-store`, generic configuration-only body |

At that historical checkpoint, all seven Production variable names were configured; values are intentionally not recorded here. Hosted Supabase Auth used the canonical Site URL and approved Production, Preview, and local callbacks. An operator-provisioned admin account completed authenticated project-record, dependency, rollback, and reset smoke. The then-current deployment reported `READY` and health `200 ready`. The current post-recording deployment and provider teardown are recorded above.

## Hardening Preview smoke recorded 2026-07-19

| Check | Result |
| --- | --- |
| Deployment identity | `dpl_ChQL8nigyoc1M6LSEGjdS8seP4bD`, `READY`, exact `72a6fc5...` SHA on `main` |
| Anonymous access | Redirects to Vercel SSO; deployment protection was not weakened |
| Authenticated deployment access `/` and `/login` | `200` |
| Authenticated deployment access `/api/health` | Expected no-store `503 not_ready` |
| Authenticated deployment access `/app` | Fails closed because Preview intentionally has no Supabase variables |

This is deployment-identity and fail-closed configuration evidence, not a public Preview pass or a live Auth/OpenAI workflow. The six sensitive non-OpenAI values remain Production-only.

## Known limitations and human-owned gates

- Exactly one owner, one admin recording operator, and one viewer judge were verified as three distinct real Auth identities. The operator journey and judge read/denial QA are complete. A fresh isolated Production session covered signed-out redirect, login/session refresh, five authenticated routes at 375/768/1440, keyboard focus, reduced-motion preference, no overflow, and viewer-only controls; the public YouTube URL remains the only unverified media link.
- One purpose-specific funded GPT-5.6 Production run succeeded and its saved result remains viewable. Production analysis is now disabled, zero active InOrdo provider keys remained after teardown, and no usable OpenAI or Gateway key is configured for the current deployment.
- Production was redeployed directly from the clean exact-SHA release worktree at reviewed `main` SHA `4f54cc1...`; Deston confirmed current Vercel Hobby eligibility on July 20, 2026. Preview remains protected by Vercel Authentication.
- The authenticated evidence -> direct/indirect impact -> recovery proposal -> selective apply -> linked history -> compensating undo journey is verified for one internal date action with explicit human response.
- PR #17 and contract migration `20260720190000` are merged and hosted. Policy migration `20260721100000` is also applied with exact checksum, approval, post-apply parity, empty pending set, and linked lint evidence.
- Judge-viewer Production QA confirmed saved-state read access and denied or disabled analysis and mutation controls. Broader nonmember/cross-project browser coverage remains limited to the recorded hosted/automated evidence.
- Fresh isolated Production checks passed at 375, 768, and 1440 pixels with no horizontal overflow, valid main/heading structure, keyboard focus, reduced-motion preference, and session refresh. The skip-link focus repair is merged and deployed. Status announcements, dialog focus return, and non-color meaning retain automated component/Playwright evidence and are a documented nonblocking evidence limitation rather than another provider-run gate.
- Undo intentionally supports only operations made entirely of reversible field updates whose after-state is still current.
- Vercel Hobby eligibility was confirmed by Deston on July 20, 2026; this repository is not legal advice.
- The judge-only credentials and instructions are saved privately in Devpost, and Andres is a confirmed Devpost team member. The replacement viewer credential was rechecked against Production without exposing its value: authentication reached the synthetic workspace, analysis controls were disabled, the read-only notice was present, and sign-out returned to the login page. The public Devpost project and team-role copy are recorded. The 2:44.067 review export and thumbnail are complete outside Git; team media/likeness rights, the temporary **InOrdo Hackathon Team** attribution, and D4 timing are approved. Only the public YouTube URL, primary Codex `/feedback` Session ID, and explicit final-submit approval remain human-owned.
- GitHub issue [#4](https://github.com/Chi944/InOrdo-Hackathon/issues/4) is closed after the authenticated Production journey, viewer-denial checks, teardown, and release evidence were completed.
- The [official Devpost schedule](https://openai.devpost.com/details/dates) sets the submission deadline at July 21, 2026 at 5:00 PM PDT (July 22, 2026 at 8:00 AM SGT).

## Devpost placeholder audit

The confirmed repository, production host, platform/project, deployed application SHA, private judge handoff, and Andres's Devpost membership are recorded. The following submission placeholders remain because no factual value was supplied:

- `<PUBLIC_YOUTUBE_VIDEO_URL>`
- Public Devpost project: `https://devpost.com/software/chimera-i4oz8d` (verified signed out; hackathon finalization remains pending)
- `<PRIMARY_FEEDBACK_SESSION_ID>`
- Public team copy: Deston — Engineering, Data & AI Safety; Andres — Product Design & Experience

`<SUPABASE_PROJECT_REF>`, `<AUTH_USER_UUID>`, and deployment/rollback command placeholders are instructional examples, not Devpost fields. Never replace an instructional token by committing a credential, private user identifier, or environment value.
