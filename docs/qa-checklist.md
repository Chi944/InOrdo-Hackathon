# QA checklist

## 2026-07-20 production release execution and follow-up hardening

- [x] Existing manual Vercel project is `chi944s-projects/inordo`; project ID and Git remote are unchanged; canonical alias is `https://inordo.vercel.app`; the final leftover `inordo-hackathon.vercel.app` alias was removed.
- [x] Local and Vercel Production inventories contain all seven required names, including encrypted `OPENAI_API_KEY`; no value was printed, logged, or committed. Exact production deployment `dpl_C2CffFF14AyqYkNjgs8sYrtHQyQZ` is `READY` and returned health `200 ready`.
- [x] Hosted Supabase Auth uses Site URL `https://inordo.vercel.app` and redirect `https://inordo.vercel.app/**`, retaining only the approved Preview/local redirects. An operator-managed account is confirmed and mapped as demo admin.
- [x] Expand migration `20260719140000` is applied and hosted parity is exact through that tail. The deployed artifact passed item create/update, dependency add/remove, exact replay, rollback-only authorization/generation assertions, and reset to 24 active items/26 edges with no temporary residue.
- [x] One bounded production analysis reached OpenAI and failed closed during extraction with safe `model_unavailable` metadata. The configured OpenAI organization/project has no credits, so there was no retry and no successful proposal/apply/history/undo claim.
- [x] Deston confirmed on July 20, 2026 that current Vercel Hobby terms permit this hackathon demo; this checklist is operational evidence, not legal advice.
- [x] Authenticated local layout smoke passed at 375×812, 768×1024, and 1440×1000 with no horizontal overflow. A red/green regression fixes skip-link focus without changing visual design.
- [ ] Merge reviewed PR #17, then obtain exact approval `apply-20260720190000`, apply only that contract migration, and rerun hosted parity/read/denial/RPC/replay/rollback verification.
- [ ] Fund the OpenAI API organization, then run exactly one synthetic analysis retry and complete proposal selection, apply, ordered history, undo, and reset evidence.
- [ ] Decide whether to remove Vercel Authentication for judge access; then verify landing, login, protected routing, logout, keyboard order, announcements, and every submission link in a signed-out profile.

## Prompt 14 final release evidence (`andres/06-final-evidence`)

- [x] The Prompt 14 branch started from clean deployed application SHA `d581b0a9d736bd12046a4314e15b359ec8fd8205` as documentation-only work. It later incorporated the normally merged release-boundary hardening from current `main` without rewriting either work package.
- [x] Vercel reports deployment `dpl_3JrXGeW9ptujQ8u4yCRDwfo3TNEV` as `READY`, target `production`, Node `22.x`, and `githubCommitSha` equal to the application SHA.
- [x] At the 2026-07-19 pre-rename smoke, the then-current production alias resolved to that deployment; `/` and `/login` returned `200`, and signed-out `/app` returned `307` to `/login?next=%2Fapp` without tenant data. This is historical evidence, not a smoke result for `https://inordo.vercel.app`.
- [x] With `OPENAI_API_KEY` intentionally absent, production `/api/health` returns the expected generic `503 not_ready` with `Cache-Control: no-store`.
- [x] Three independent final read-only reviews found no P0/P1 security, migration, concurrency, test, or deployment blocker after the expired-claim repair merged.
- [x] Prompt 14 `npm run lint` on the settled documentation branch.
- [x] Prompt 14 `npm run typecheck` on the settled documentation branch.
- [x] Prompt 14 `npm run test:run` on the settled documentation branch: 305 tests across 54 files.
- [x] Prompt 14 `npm run build` on the settled documentation branch with Next.js 16.2.10.
- [x] Prompt 14 `git diff --check` on the settled documentation branch.
- [x] Refreshed the ignored, untracked local `.env.local` from the verified six-name Vercel Production configuration without reading or printing values; an obsolete local OpenAI entry was deliberately excluded.
- [x] Node 22 local smoke returned `/` and `/login` `200`, signed-out `/app` `307` to the bounded login path, and generic no-store health `503`; the server identified only the intentionally absent `OPENAI_API_KEY` name.
- [x] The local-parity handoff completed clean install, lint, typecheck, 305 Vitest tests across 54 files, one Chromium journey, production build, zero dependency vulnerabilities, and whitespace checks. After the cross-platform runbook update, lint, typecheck, the complete unit suite, build, and diff checks were run again.
- [x] At the original Prompt 14 checkpoint, an unauthenticated GitHub API/raw-file audit confirmed the repository was public, `main` pointed to the deployed application SHA, and README plus MIT license returned `200` without a team session.
- [x] At that checkpoint, a filename/count-only scan across the then-current tree and all 27 reachable commits found zero credential-format matches and zero tracked environment paths other than `.env.example`; no candidate value was printed. A current-tree scan is repeated after reconciliation.
- [x] The official Devpost schedule confirms the July 21, 2026 at 5:00 PM PDT submission deadline (July 22, 2026 at 8:00 AM SGT).
- [x] After merging current `main`, the complete gate ran under Node 22.23.1/npm 10.9.8: fresh `npm ci` without lockfile drift, lint, typecheck, 358 Vitest tests across 55 files, one guarded Chromium journey, Next.js 16.2.10 production build, and zero production dependency vulnerabilities.
- [x] The reconciled optimized build returned `/` and `/login` `200`, signed-out `/app` `307` to `/login?next=%2Fapp`, and expected no-store `/api/health` `503`; its only readiness log named the intentionally absent `OPENAI_API_KEY`.
- [x] A fresh unauthenticated audit found the GitHub repository public, public `main` at exact SHA `72a6fc5a02a55ec5efe52e0b14f8ac831ec2685c`, and README plus MIT license reachable with `200` responses.
- [x] A current-tree/all-reachable-history filename-and-count-only scan found no credential-format match, no unexpected tracked environment path, and only the expected `.env.example`; no candidate content was printed.
- [x] PR #12 passed CI and merged normally as current public `main` `debe2be4a20dc0f8f75eb3e67d17cca118d868f0`; this branch merged that exact `main` without rewriting the approval-copy repair. A fresh unauthenticated GitHub API/raw audit confirmed that SHA, the public repository/default branch, and `200` responses for README and MIT license.
- [x] The Vercel project runtime default is now Node `22.x`, matching `package.json` and the already-recorded Node `22.x` Production/Preview artifacts. The supported project-setting update did not trigger a deployment or alter an environment value, alias, or Git connection.
- [x] Supabase remains `ACTIVE_HEALTHY`, migration-aligned through `20260719113000`, with no security-advisor finding; expected small-dataset unused-index notices remain informational.
- [x] The Windows/macOS handoff now keeps Andres on a least-privilege UI path: deployed QA or the two browser-safe Supabase values only, with service-role, reset, OpenAI, and Vercel Production-secret access remaining Deston-owned by default.
- [x] On the exact final reconciliation, Node 22.23.1/npm 10.9.8 completed fresh `npm ci`, lint, typecheck, 359 Vitest tests across 55 files, one guarded Chromium journey, the Next.js 16.2.10 production build, and a zero-vulnerability production dependency audit.
- [x] Final lockfile/ignore/credential-boundary checks found the lockfile byte-identical to `HEAD`, `.env.local` ignored, zero unexpected tracked environment paths, and zero credential-format file matches in the working tree or all 34 reachable commits; no candidate content was printed.

The deployed Prompt 13 artifact remains the recorded production release; this is not evidence that live analysis is operational or that current `main` is serving production. The OpenAI key, operator Auth account, funded model request, authenticated production workflow, production redeploy, and final responsive/accessibility pass remain human-owned.

## Approval reversibility copy repair (`deston/11-approval-reversibility-copy`)

- [x] A test-first regression distinguishes conditionally undo-eligible field updates from nonreversible create-item and confirmation actions.
- [x] Default and **Select all safe actions** behavior includes only pending `update_item` actions without a human-input requirement; nonreversible actions require explicit individual selection.
- [x] Every action card states either **Undo may be available** or **Cannot be undone** and no longer uses the ambiguous per-action **Safe default** label.
- [x] Final confirmation warns that selecting any nonreversible action makes the entire operation ineligible for undo and requires a separate reviewed forward recovery action.
- [x] Node 22.23.1/npm 10.9.8 clean install, lint, typecheck, 359 Vitest tests across 55 files, one guarded Chromium journey, production build, and zero-vulnerability production audit passed.
- [x] Focused independent review found and then verified the fix for the original unsafe bulk-selection contradiction; the settled diff has no remaining review blocker.
- [x] Commit `90ac845f90e0f6c0eb60e40eef958cc7baafe369` passed PR #12 CI and merged normally into `main` as `debe2be4a20dc0f8f75eb3e67d17cca118d868f0`; reconciliation into this final-evidence branch preserves the reviewed implementation and its original authorship.

## Release-boundary hardening (`deston/10-release-boundary-hardening`)

- [x] TDD regressions cover cumulative encoded request bytes across individually sub-limit chunks, missing/dishonest `Content-Length`, cancellation, multibyte UTF-8, remote plaintext and credential-bearing Supabase URLs, exact loopback development URLs, and disposable ordinary/merge/root/octopus/disconnected Git histories.
- [x] The shared reader stops analysis/operation bodies at 24,000/32,000 bytes before orchestration; readiness requires remote HTTPS, rejects embedded credentials and padded/blank values, and shares its parser with runtime construction.
- [x] The executable revert planner proves target ancestry, uses one reviewed merge parent for both migration inventory and `git revert -m`, rejects unsupported histories, and uses explicit ordinary/merge commands compatible with macOS system Bash 3.2.
- [x] Two independent focused re-reviews found no remaining P0/P1 issue after the unsafe remote-HTTP, disconnected-target, and Bash 3.2 findings were fixed.
- [x] Node 22.23.1/npm 10.9.8 `npm ci` completed without a lockfile change; lint and typecheck completed without errors; Vitest passed 358 tests across 55 files; the guarded Chromium journey passed; the production build completed; and the production dependency audit reported zero vulnerabilities.
- [x] The ignored Windows `.env.local` contains the six required non-OpenAI settings without exposing a value. A rebuilt local production server returned `/` 200, `/login` 200, signed-out `/app` 307 to `/login?next=%2Fapp`, and `/api/health` 503/no-store while logging only the intentionally absent `OPENAI_API_KEY` name.
- [x] The same six names were replaced in Vercel Production as sensitive values. The temporary Development-only handoff used to create the ignored local file was removed; a names-only listing confirmed no Development variables remain.
- [x] Final unstaged `git diff --check` completed without an error; staged whitespace verification is repeated immediately before commit.
- [x] Commit `efff09c471d1336edf401085f8eaf5842189ab90` passed PR #11 CI and merged normally into `main` as `72a6fc5a02a55ec5efe52e0b14f8ac831ec2685c`; local `main` and `origin/main` were then verified at divergence `0 0` with the complete Node 22 gate.
- [x] Preview deployment `dpl_ChQL8nigyoc1M6LSEGjdS8seP4bD` is `READY`, target Preview, Node `22.x`, with `githubCommitSha` equal to the merged hardening SHA and ref `main`. Behind the authenticated Vercel bypass, `/` and `/login` returned `200` and `/api/health` returned expected no-store `503`; `/app` failed closed because Preview intentionally has no Supabase configuration.
- [ ] Public Preview route verification remains unavailable because anonymous access redirects to Vercel SSO. Protection was not weakened. Production still serves `d581b0a9...`; redeploying hardening remains behind Deston's current Vercel Hobby-terms confirmation.

## Prompt 13 expired-analysis-claim repair (`deston/09-analysis-claim-recovery`)

- [x] Read-only full-repository reviewer pass identified one genuine submission blocker: an interrupted analysis claim could return `processing` forever on exact retries.
- [x] TDD coverage proves active duplicates carry the bounded database retry window, expired duplicates never call either model stage, failed reconciliation refreshes the review pane, contradictory retry states fail closed, and the route preserves `Retry-After`.
- [x] Forward migration `20260719113000_expire_stale_analysis_claims.sql` assigns an immutable three-minute lease, reconciles the same expired row to a terminal failure, and fences late success so all derived writes roll back.
- [x] Three independent focused re-reviews found no remaining security, migration, concurrency, type, UX, or test blocker after the existing-row backfill and late-completion findings were fixed.
- [x] Linked dry run/apply and ledger alignment through `20260719113000`; generated TypeScript matches the linked schema after line-ending normalization.
- [x] Linked public/private schema lint and security advisors reported no findings. Performance advisors reported only informational unused-index notices expected on the small dataset.
- [x] Rollback-wrapped `verify_p0.sql`, `verify_analysis_pipeline.sql`, and `verify_operations.sql` passed. The analysis suite covers active-delay response, fixed lease assignment, expired direct-completion rollback, one-time terminal reconciliation, stable replay IDs/state, preserved evidence, late-worker rejection, and private helper privileges. A follow-up query found zero retained lease-verifier sources or requests.
- [x] Node 22.23.1 clean install, lint, typecheck, 305 Vitest tests across 54 files, one Chromium demo journey, production build, zero production dependency vulnerabilities, and `git diff --check` passed.

PR #9 merged normally as `d581b0a9d736bd12046a4314e15b359ec8fd8205`; that exact clean `main` SHA was deployed as Vercel production deployment `dpl_3JrXGeW9ptujQ8u4yCRDwfo3TNEV` and the public signed-out routes were rechecked. PR #11 later merged hardening as `72a6fc5a02a55ec5efe52e0b14f8ac831ec2685c` and that exact SHA passed Preview inspection, but it is not yet the production artifact. The intentionally absent `OPENAI_API_KEY`, operator-provisioned Auth account, funded GPT-5.6 smoke, and authenticated browser journey remain human-owned release evidence.

## Prompt 13 evidence-integrity bridge (`deston/13-evidence-integrity`)

- [x] Forward migration `20260719120000_preserve_analysis_provenance_and_supersede_stale_proposals.sql` preserves a canonical normalized-input provider claim while recording append-only source-capture provenance in `analysis_request_sources`.
- [x] Focused SQL coverage verifies exact replay preserves one canonical claim while retaining capture cardinality, the same capture supports a fresh claim after a revision change, and current live proposals close after any project-item or dependency mutation; historic live proposals are conservatively closed rather than reopened.
- [x] Local migration replay passed; database lint passed; rollback-wrapped `verify_p0.sql`, `verify_analysis_pipeline.sql`, and `verify_operations.sql` passed; and the focused verifier passed after correction.
- [x] Exact Windows local focused-verifier command: `Get-Content supabase/tests/verify_prompt13_evidence_integrity.sql -Raw | docker exec -i supabase_db_InOrdo-Hackathon psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres`.

These are local database checks plus the generated database-type update and a focused closed-proposal UI regression. They do not claim a linked/remote migration, browser journey, provider call, or production deployment.

## Prompt 12 production-readiness gate (`deston/08-production-readiness`)

This section records each command or live step individually. Checked items have settled-branch/deployment evidence; unchecked items remain pending. The exact operator commands and evidence limits are in [`docs/deployment-runbook.md`](deployment-runbook.md).

- [x] Clean `npm ci` under Node 22 reproduced the lockfile after adding the exact Supabase CLI `2.109.1` development pin.
- [x] `npm run lint`.
- [x] `npm run typecheck`.
- [x] `npm run test:run` — 299 tests across 53 files.
- [x] `npm run test:e2e` — one guarded Chromium journey.
- [x] `npm run build` without an OpenAI request.
- [x] `npm audit --omit=dev` — zero production vulnerabilities reported.
- [x] `git diff --check` and both staged/unstaged whitespace checks.
- [x] Formal multi-persona review against current `main`, independent validation, applied-fix re-review, and adversarial re-review completed with every surviving finding resolved; the documented route-deadline/log-volume concerns remain explicit residual operational risks.
- [x] Linked migration dry-run/apply through `20260719101500`, ledger comparison, generated-type comparison, schema lint, security advisor, and all four rollback-wrapped SQL verifiers passed. The public generated TypeScript types match exactly; the security advisor reports no findings.
- [x] `/api/health` returns non-cacheable `200 ready` with complete test configuration, makes no database/provider call, and exposes no values.
- [x] With `OPENAI_API_KEY` absent, the built local server returned `503 not_ready`, logged only `OPENAI_API_KEY`, and returned no secret, stack, or internal database/provider detail.
- [x] Static/build boundary checks prove browser modules cannot import service-role/OpenAI configuration and server-only modules fail closed if pulled into a client graph.
- [x] Safe response and persisted metadata retain the provider-returned actual model name; default request configuration remains `gpt-5.6-luna`.
- [x] The current metadata envelope and prior artifact's exact legacy envelope both validate during the rollback window; malformed model names, unknown fields, and direct public/API-role execution remain denied.
- [x] Missing/invalid model configuration fails safely before the idempotency claim is created, while runtime construction and production build remain provider-free.
- [x] `vercel.json` enables Fluid Compute; analyze uses a 90-second application duration below the supported 300-second Hobby Fluid maximum, two sequential 30-second provider limits, no SDK/request retry, and approximately 30 seconds of application headroom. Other mutation/history routes use 30 seconds.
- [x] Local Supabase Auth config uses `http://localhost:3000`, plus `http://localhost:3000/**` and `http://127.0.0.1:3000/**`; it contains no `https://127.0.0.1` redirect.
- [x] Reset still requires owner/admin authorization, the exact configured synthetic slug/demo marker, explicit confirmation, idempotency, server-held guard, and rate limiting; no demo password or reset secret is committed.
- [x] No analytics, paid monitoring, custom domain, worker, scheduled job, Railway service, Git-connected automatic deployment, or authorship rewrite was introduced.
- [x] The fail-closed release helpers pin Supabase CLI `2.109.1`, reject malformed/unknown ledger shapes and versions, preserve applied migrations, check staged and unstaged patches, and passed dedicated parser/runbook tests plus Bash syntax validation. The executable Git planner requires an explicit reviewed mainline for a two-parent merge, uses that same parent for migration inventory and `git revert -m`, rejects roots/octopus/disconnected targets, and avoids the macOS Bash 3.2 empty-array hazard. This is implementation evidence; a human live rollback drill remains a separate release check.

### Vercel/Supabase release evidence

- [x] Deston confirmed on July 20, 2026 that current Vercel Hobby terms permit this small non-commercial hackathon demo; this checklist does not present that confirmation as legal advice.
- [x] Deston logged in, verified the `chi944s-projects` scope, linked the manual `inordo` project, and confirmed through project metadata that no Git repository/automatic deployment is connected.
- [x] Production has all seven required names in the correct Production scope. Names/scopes only were recorded; no value was copied.
- [x] `OPENAI_API_KEY` is configured and the deployed health route returns `200 ready`. One synthetic request failed closed with `model_unavailable` because the organization has no credits; no successful live result is claimed.
- [x] Hosted Supabase Auth uses Site URL `https://inordo.vercel.app` and redirect `https://inordo.vercel.app/**`; approved local HTTP and account-scoped Vercel Preview redirects were retained.
- [x] Preview deploy proved `HEAD == origin/main == 72a6fc5a02a55ec5efe52e0b14f8ac831ec2685c` and divergence `0 0`; deployment `dpl_ChQL8nigyoc1M6LSEGjdS8seP4bD` is `READY`, target Preview, Node `22.x`, and reports the same `githubCommitSha`/`main` ref. Authenticated Vercel curl reached `/` and `/login` with `200` and expected missing-config health `503`; anonymous requests remain intentionally SSO-protected and therefore are not called a public Preview pass.
- [x] Production deploy `dpl_C2CffFF14AyqYkNjgs8sYrtHQyQZ` proved exact reviewed `main` SHA `38067619a81c1118c46d9709f6403193fdc0f0c4`, Node `22.x`, `READY`, target `production`, canonical alias `https://inordo.vercel.app`, and health `200 ready`.
- [ ] In a fresh incognito profile, `/`, `/login`, signed-out `/app`, login/session refresh/logout, and tenant denial behave as documented.
- [ ] After Deston funds the OpenAI API organization, exactly one synthetic venue analysis retry records only safe actual-model/ID/status metadata and no prompt, source body, output, key, header, or cookie.
- [ ] Owner/admin completes the canonical evidence -> deterministic impact -> selective apply -> ordered history -> compensating undo -> protected reset flow; viewer/nonmember/cross-project attempts fail closed.
- [ ] The exact deployed UI passes full keyboard, visible-focus, and status-announcement checks. Authenticated local no-overflow checks passed at 375, 768, and 1440 pixels; the skip-link focus fix still needs merge/deploy verification.
- [x] The previous schema-compatible deployment `dpl_8znxpQsmZsBH7hoqWmLqui4HXtqc` is identified; the Vercel rollback path, mandatory reset/native-mutation containment for any pre-RPC artifact, and migration-preserving Git forward-repair path are reviewed.

## Prompt 11 submission integration gate (`codex/andres-05-integration`)

- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm run test:run`
- [x] `npm run test:e2e`
- [x] `npm run build`
- [x] `npm audit --omit=dev`
- [x] `git diff --check`
- [x] Confirm the resolved patch changes only the nine intended README/documentation/screenshot paths and preserves Andres’s original commit authorship.

Exact integration evidence on 2026-07-19 used Node 22.23.1 and npm 10.9.8. ESLint and TypeScript completed without errors; Vitest passed 270 tests across 48 files; the guarded Chromium core-demo journey passed; the Next.js 16.2.10 production build completed; and the production dependency audit reported zero vulnerabilities. Both screenshots were visually inspected and contain only the public, clearly labeled illustrative landing content—no authenticated data, credential, or live-model claim. The final whitespace check is recorded immediately before the integration commit.

## Prompt 10 integrated P0 gate (`deston/07-integration-deploy`)

This is the historical Prompt 10 integration checkpoint. The current release evidence is at the top of this file; earlier prompt/branch sections below must not be read as proof for the final artifact.

- [x] `npm ci` under the pinned Node 22 toolchain without a lockfile change
- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm run test:run`
- [x] `npm run test:e2e`
- [x] `npm run build`
- [x] `npm audit --omit=dev` interpreted for production dependencies
- [x] `git diff --check`
- [x] Linked migration dry run/apply, migration-ledger alignment, generated-type comparison, schema lint, security advisor, and rollback-wrapped SQL verification
- [x] Formal review against current `main`, with all P0 and high-confidence critical findings resolved

The CI-safe Playwright route is a guarded test seam, not a hidden demo mode. It is unavailable in production, requires an exact test-only opt-in during local/CI development, renders a conspicuous synthetic-fixture banner, and exercises the real impact, approval, history, undo, and reset components. Playwright intercepts only the analyze/apply/undo/reset HTTP seams, validates outgoing JSON with the production Zod contracts, and uses stable roles/labels. It does not claim to test live authentication, cookies, RLS, Supabase RPC behavior, or OpenAI.

After the readiness migration, run `supabase/tests/verify_proposal_readiness_reconciliation.sql` as a read-only linked query. Record `eligible_succeeded_ready` as the inventory baseline; `eligible_succeeded_still_draft` and `ready_invariant_violations` must both be zero before analyze/apply routes reopen. Investigate any nonzero anomaly rather than bulk-promoting or rewriting history.

Exact integrated evidence on 2026-07-19 used Node 22.23.1 and npm 10.9.8. Fresh `npm ci` installed 470 packages without changing the lockfile; lint and typecheck passed; Vitest passed 270 tests across 48 files; Playwright passed the one Chromium core-demo journey; the production build completed; `npm audit --omit=dev` reported zero vulnerabilities; and both staged/unstaged diff checks passed. A production server started with `INORDO_E2E_FIXTURES=1` still returned 404 for `/__e2e__/core-demo`. Formal review found no P0 issue; its confirmed completed-reset key reuse and workflow-outage truthfulness findings were fixed and regression-tested. The linked readiness reconciliation returned `eligible_succeeded_ready=0`, `eligible_succeeded_still_draft=0`, and `ready_invariant_violations=0`.

The required production environment names were absent from this process, so the authenticated/provider smoke below was not attempted. No environment value, credential, cookie, or private provider/database payload was read or recorded.

### Live production smoke path

Use an operator-created owner/admin account and only the configured synthetic project. Never record credentials, cookies, authorization headers, environment values, raw provider payloads, or private source/operation content.

1. Open the deployed landing page in a clean browser profile, follow `Open demo workspace`, and verify redirect to the local-only login path, invalid-password safe feedback, successful login, session refresh, and logout.
2. Confirm the dashboard, 24 active seeded records, 26 dependency edges, decisions, risks, item detail, and text-first dependency direction at 375, 768, and 1440 pixels. Verify no sponsor record is fabricated.
3. Insert the canonical venue update and submit once. Confirm only one analyze request, bounded loading, preserved evidence, a GPT-5.6 candidate for `EVT-01.event_date` from `2026-09-12` to `2026-09-26`, and no item mutation.
4. Confirm deterministic direct/indirect paths, including the documented event-to-speaker-to-programme-to-briefing path. Distinguish source fact, model inference, confidence, and graph explanation visibly.
5. Select only one reversible field-update action, leave a sensitive/human-input action pending, inspect the exact confirmation summary, and apply. Confirm actor-attributed ordered before/after history and no unselected mutation.
6. Undo the eligible operation. Confirm the original history remains and a linked compensating operation appears. Exercise one stale conflict and verify it applies nothing and a subsequent newly reviewed attempt uses a fresh idempotency key.
7. Open reset review, explicitly confirm, and reset once. Confirm the event date, 24 records, and 26 edges return to baseline, the workflow generation advances exactly once, and archived history remains available. Verify duplicate replay is stable and a distinct immediate reset receives safe rate-limit feedback.
8. Repeat read-only checks as a viewer and verify apply/undo/reset are unavailable. Test a nonmember/cross-project identifier and confirm it fails closed without tenant details.
9. Record only date, deployed commit, browser/viewport, route/status outcomes, counts, operation IDs when safe, and pass/fail notes in this checklist. Until that evidence is present, the live smoke remains pending.

### Integrated known limitations

- [ ] The live authenticated/provider smoke above is pending operator-held deployment configuration.
- [x] The P0 supports one named synthetic project, not general project onboarding.
- [x] Project/dependency presentation is bounded for the 24-item/26-edge fixture; larger-workspace pagination is deferred.
- [x] The impact workflow remains a large Client Component; further server/client splitting is a post-P0 performance improvement.
- [x] Vercel's deployment-level body limit, session monitoring, secret rotation, and abuse monitoring remain operational controls outside this CI artifact. The application itself now streams and cancels analysis/operation requests at 24,000/32,000 bytes; fixed-lease stuck-analysis reconciliation is also implemented and tested.

## Project views branch gate (`andres/03-project-views`)

These checks are pending until the complete branch diff is settled. Earlier checked gates below are historical evidence for their named implementation slices, not evidence for this branch.

- [x] `npm run lint` under Node 22
- [x] `npm run typecheck` under Node 22
- [x] `npm run test:run` under Node 22 (236 tests across 40 files)
- [x] `npm run build` under Node 22
- [x] `git diff --check`
- [x] Public landing-shell browser review at 375, 768, and 1440 pixel viewport widths with no horizontal overflow
- [ ] Authenticated project-view browser review at 375, 768, and 1440 pixel viewport widths; this clean worktree has no public Supabase configuration or operator-created login
- [ ] `npm run test:e2e`; at this historical project-views branch gate, Playwright started successfully but no end-to-end test files existed yet

## Last completed automated gate (Prompt 5)

- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm run test:run`
- [x] `npm run build`
- [x] `git diff --check`
- [ ] `npm run test:e2e` for implemented browser workflows when a Playwright browser is available

The checked command results above are the preserved Prompt 5 handoff evidence. They do not imply that the Prompt 7 diff has passed.

## Prompt 7 verification gate

- [x] `npm run lint` for the complete Prompt 7 diff under Node 22
- [x] `npm run typecheck` for the complete Prompt 7 diff under Node 22
- [x] `npm run test:run` for the complete Prompt 7 diff under Node 22 (177 tests across 32 files)
- [x] `npm run build` for the complete Prompt 7 diff under Node 22
- [x] `git diff --check` for the complete Prompt 7 diff
- [x] Linked migration ledger, schema lint/security advisors, generated types, and Prompt 7 rollback-wrapped SQL verification
- [ ] Exactly one controlled live OpenAI analysis with safe metadata only
- [ ] Browser login, analysis submission, pending review display, and confirmation behavior

The linked database gate is complete: all three additive Prompt 7 migrations were applied to the confirmed project, generated types were refreshed, public/private schema lint returned no errors, security advisors returned no findings, and transaction-wrapped SQL assertions passed without retaining test rows. Performance advisors reported only unused-index informational notices expected on this new/small dataset. Node 22 lint, typecheck, 177 unit/integration tests across 32 files, and the production build passed. Live analysis and browser checks were not run because the required environment variable names were absent from the process environment.

## Prompt 9 verification gate

Prompt 9 automated and linked database verification is complete on the applied schema. Authenticated HTTP/browser verification remains a separate release gate.

- [x] `npm run lint` under Node 22
- [x] `npm run typecheck` under Node 22
- [x] `npm run test:run` under Node 22 (223 tests across 37 files)
- [x] `npm run build` under Node 22
- [x] `git diff --check`
- [x] Reviewed linked `npx supabase db push --dry-run`, followed by the operations migrations
- [x] Regenerated linked `src/types/database.ts` and confirmed no unexplained schema drift
- [x] Public/private schema lint and Supabase security advisors with no new actionable finding
- [x] Rollback-wrapped `supabase/tests/verify_operations.sql` against the linked project with no retained verification rows
- [x] One authorized linked apply → history → undo → reset RPC/audit sequence using only synthetic data, explicitly rolled back

Linked evidence on 2026-07-18: the migration ledger is aligned through `20260718191000_harden_prompt9_operations`; generated types match the linked schema after line-ending normalization; schema lint returned no errors; the security advisor returned no findings; and performance advisors reported only unused-index informational notices on the new/small dataset. `verify_p0.sql`, `verify_analysis_pipeline.sql`, and `verify_operations.sql` all completed inside rollback-wrapped linked transactions. A separate evidence query observed `apply_state=succeeded`, ordered before/after history present, `undo_state=succeeded`, `reset_state=succeeded`, workflow generation `2`, and overflow-safe item creation, then a follow-up confirmed no verification operation keys were retained. This is database RPC/audit evidence, not authenticated HTTP, cookie, route, or browser evidence.

### Prompt 9 operation and security cases

- [x] Owner/admin apply succeeds; viewer, nonmember, cross-workspace, and cross-project requests fail closed.
- [x] Only pending actions belonging to the named proposal/project can be selected.
- [x] The executable allowlist is limited to an allowlisted item-field update, constrained task creation, constrained risk creation, and confirmation activity.
- [x] Delete, membership, dependency, arbitrary-patch/SQL, external-call, unknown-field, and malformed-payload attempts are rejected.
- [x] A required human response must explicitly match one selected action; missing, duplicate, extra, or unselected responses are rejected.
- [x] Partial selection applies only selected actions in proposal ordinal order and leaves unselected actions pending.
- [x] Mutation, action/proposal transitions, the operation header, and every ordered before/after audit item commit together or all roll back.
- [x] Same-key/same-request replay returns the original operation without repeating effects; same-key/different-request reuse conflicts.
- [x] Undo restores only an entirely reversible update operation, processes reverse records in reverse order, and writes a new operation linked to the original.
- [x] Undo rejects a stale version or after-state mismatch without partial reversal; repeat undo is stable and undo-of-undo is rejected.
- [x] Current history is generation-scoped, bounded, ordered, and actor-attributed; `includeArchived=true` exposes preserved prior generations.
- [x] Reset accepts only explicit confirmation and an idempotency key; no reset secret is accepted through a browser, URL, header, body, RPC argument, fixture, audit row, or log.
- [x] Reset rechecks owner/admin access, configured slug, the demo marker, a deterministic baseline, idempotency, and rate limiting inside the reviewed database boundary.
- [x] Reset restores 24 active canonical items and 26 edges, retires nonbaseline items without deleting history, records its operation in the closing generation, and advances the generation once.

### Prompt 13 approval-integrity additions

- [x] Application postvalidation rejects duplicate updates to one target field and a same-target start/due action set whose combined range is invalid, while allowing null endpoints and isolating different targets.
- [x] The database action-set guard enforces the same invariant in either insertion order and serializes concurrent inserts on the proposal row; a local race committed exactly one duplicate candidate and rejected the other with `23514`.
- [x] Existing active invalid proposals are conservatively superseded; applied/rejected history is not rewritten.
- [x] Create-task/risk cards and final confirmation render item type, title, description, fixed initial status, priority, owner ID, start date, and due date from the immutable proposal payload.
- [x] Successful create operation items replace caller JSON with a version-2 receipt built from the committed project row; the applied result and audit history render that canonical payload, while legacy receipts do not fabricate absent fields.
- [x] A clean local migration replay, error-level schema lint, all seven rollback-wrapped SQL verifiers, focused Node 22 tests, and an exact create-apply receipt assertion passed. This is local evidence only; no linked/remote migration or authenticated browser claim is made here.
- [ ] With an operator-created owner/admin account, review and apply one synthetic create action in the deployed UI; confirm all disclosed values match the created row and version-2 audit receipt exactly.

### Prompt 13 generation-integrity additions

- [x] Clean local migration replay and database lint pass through `20260719140000_guard_project_record_mutations`.
- [x] `verify_superseded_action_reconciliation.sql` proves pending/approved staleness, attribution preservation, terminal-history preservation, and apply-safe deferred reconciliation.
- [x] `verify_generation_guarded_mutations.sql` proves RPC authorization, expand-phase legacy-policy compatibility, strict record validation, exact replay (including after mutable owner removal), key conflicts, generation/version fences, and dependency integrity. Direct-DML denial moves to the later contract verifier.
- [x] A real two-session local race proved a generation-1 mutation waited behind the project lock, rejected with `40001` after generation advanced to 2, and created zero stale items and zero ledger receipts.
- [x] Node 22.23.1/npm 10.9.8 clean install, lint, typecheck, 394 unit tests across 57 files, guarded Chromium journey, production build, zero-vulnerability production audit, generated-type comparison, local migration-parity guard, and diff check passed on the settled branch.
- [x] Release review found and corrected the incompatible migration/deploy ordering: `20260719140000` is expand-only, the RPC artifact must deploy and pass all four native mutation smokes, and a separate contract migration removes legacy DML only afterward.
- [x] Configuration-contract review corrected the protected-workspace role of `DEMO_PROJECT_SLUG`, retained the non-secret model default for least-privilege local QA, and explicitly rejects an empty `OPENAI_MODEL=` entry.
- [x] Two P2 scale limits are disclosed with mitigations and backlog owners: analysis finalization's cross-project table-lock scope and the dependency-management UI's silent 500-row cap.
- [ ] Hosted expand migration, exact-SHA RPC deployment, authenticated four-mutation smoke, and the separate contract migration remain pending until the reviewed branch is merged and the operator passes each exact typed gate.

### Pending authenticated HTTP/browser procedure

The linked SQL/RPC procedure above is complete. The following end-to-end procedure still requires an operator-created owner/admin Auth account and the configured synthetic project. Keep all credentials in untracked environment configuration; do not paste or print them.

1. Create or identify a pending proposal with one reversible field update and note its proposal/action UUIDs, target value, and expected item version.
2. `POST /api/projects/[projectId]/proposals/[proposalId]/apply` with that action UUID and a new idempotency key. Confirm a `201`, the expected value/version change, `succeeded` operation, actor attribution, action state, and ordered before/after/reverse audit item.
3. Repeat the identical request and confirm `200`, `duplicate: true`, the same operation ID, and no second version increment. Reuse the key with a changed selection and confirm a safe conflict.
4. `GET /api/projects/[projectId]/operations?limit=25&includeArchived=false` and confirm the apply header plus its item-level ordinal, before-state, after-state, expected/resulting versions, reversibility, and initiator.
5. `POST /api/projects/[projectId]/operations/[operationId]/undo` with a new idempotency key. Confirm the before-state is restored at a newer version and a new `undo` operation references the original. Repeat it to confirm a stable duplicate; separately verify a post-apply target change produces an undo conflict without partial reversal.
6. With `DEMO_PROJECT_SLUG` and `DEMO_RESET_SECRET` configured only on the server, `POST /api/projects/[projectId]/demo/reset` using `{ "confirmed": true, "idempotencyKey": "<unique-key>" }`. Confirm the 24-item/26-edge baseline, retirement of extras, a one-step generation advance, and preservation of the reset operation in the closing generation.
7. Confirm current history is clean for the new generation, `includeArchived=true` retains the apply/undo/reset trail, an identical reset replay is stable, an immediate distinct reset is rate-limited, and a non-demo/wrong-project request is denied.
8. Record exact non-secret HTTP/browser results here and in `docs/codex-log.md`; until then this browser procedure remains pending.

## Project items and dependencies manual procedure

Use an operator-created Auth account in the isolated synthetic **Regional Climate Action Summit 2026** project. Keep credentials in untracked configuration. Perform mutation checks as an owner, admin, or member; repeat the read-only portions as a viewer. Do not use or capture private customer data.

### 1. Navigation, provenance, and loading states

- [ ] Open `/app` and confirm the project navigation exposes Overview, Items, Decisions, Risks, and Dependencies with a visible current-page state and a working skip link.
- [ ] Confirm the overview and guided callout label the workspace as synthetic, use titles and links from current server-loaded records, and do not show fake customer claims.
- [ ] Confirm the seed note says the canonical seed has no sponsor record or sponsor relationship; search Items and Dependencies for `sponsor` and verify the UI does not fabricate one.
- [ ] Throttle or pause a page request, then navigate between project routes and confirm a useful loading state appears without exposing a stale editable copy as canonical state.

### 2. Project-item list, filters, and cards

- [ ] Open `/app/items`. Confirm every visible row at 1440 pixels includes key/title, type, status, priority, assignee, due date, and a detail link; compare at least `EVT-01`, `DEC-01`, `TSK-01`, `TSK-06`, `TSK-07`, `TSK-09`, and `ART-05` with their server-loaded detail pages.
- [ ] Enter `summit` in Search items, then independently filter by type `Event`, status `Not started`, priority `Critical`, and a real assignee. Confirm the live result count and records update for each filter and for a combined filter.
- [ ] Choose a combination with no matches. Confirm the empty result names the filter problem, offers Reset filters, and returns to the full server result after reset.
- [ ] At 375 and 768 pixels, confirm the table becomes labeled cards containing the same type/status/priority/assignee/due-date meaning, long titles wrap or truncate safely, and the page has no horizontal overflow.
- [ ] Verify status and priority remain understandable in grayscale or with color disabled because visible text and symbols carry the meaning.

### 3. Item detail and edit

- [ ] Open `EVT-01 — Regional Climate Action Summit 2026`. Confirm breadcrumbs return to Overview and Items; detail fields reflect the current server state; and the page separates **Depends on** upstream records from downstream records under **Affects**.
- [ ] Follow one item link in each relationship section, then use Manage relationships. Confirm the selected item is preserved in `/app/dependencies?item=<item-id>`.
- [ ] As a contributor, open Edit item using only the keyboard. Confirm focus enters the dialog, every field has a label, Escape and Close dismiss it, and focus returns to Edit item.
- [ ] Change a reversible, non-demo-critical field on a temporary QA item and save. Confirm pending text prevents repeat submission, a success result is announced, refreshed detail shows the new value/version, and the list reflects the saved server state.
- [ ] Open the same item in two tabs at the same version. Save a change in tab A, then submit a different edit from stale tab B. Confirm tab B announces an explicit conflict, does not overwrite tab A, and a refresh shows the current server value.
- [ ] Submit an invalid edit, such as a blank title. Confirm the dialog retains useful context, the validation error is announced, and no item/version change is visible after refresh.

### 4. Create-item states

- [ ] From `/app/items`, open Create item by keyboard. Confirm the initial field receives focus, all required/optional fields are labeled, Escape and Cancel close the dialog, and focus returns to Create item.
- [ ] Submit an empty form and confirm accessible browser/server validation prevents creation and communicates the missing required value.
- [ ] Create a clearly synthetic task titled `QA — temporary relationship check`, using a valid QA item key, an existing seeded assignee, and an unambiguous future due date. Confirm the pending state, announced success, and refreshed list/detail use the submitted key plus the server-owned version rather than a client-only placeholder.
- [ ] As a viewer, confirm create/edit controls are absent or explicitly read-only while item and relationship information remains available.

### 5. Decisions and risks

- [ ] Open `/app/decisions`. Confirm only decision records are presented, including `DEC-01 — Approve venue contract`, with decision status and recorded rationale or an honest “not recorded” message; follow its item link and return to the project.
- [ ] Open `/app/risks`. Confirm only open risk/blocker records are emphasized, each shows status and available risk context, and completed/cancelled records are not presented as open.
- [ ] Compare at least one focused card with its item detail. Confirm both are projections of the same current record and do not diverge after an edit and refresh.

### 6. Dependency direction, add, and remove

- [ ] Open `/app/dependencies`, select `EVT-01`, and read the direction help aloud: the dependent item (`from_item_id`) depends on the upstream prerequisite/context (`to_item_id`). Confirm every relationship card is a complete text sentence and exposes its type and rationale without requiring arrow or color interpretation.
- [ ] Select `TSK-01 — Confirm keynote speakers`. Confirm **Depends on** lists its upstream event and **Affects** lists the downstream programme lock; follow those links and confirm their item-detail relationship sections reverse the perspective correctly.
- [ ] Open Add relationship by keyboard. Confirm focus enters the dialog, Tab/Shift+Tab remain inside, Escape closes it, and focus returns to Add relationship.
- [ ] Add an edge in which `QA — temporary relationship check` is the dependent item and `DEC-01 — Approve venue contract` is the upstream prerequisite. Confirm the direction preview says the QA item depends on the venue decision, success is announced, and the edge appears under the QA item's **Depends on** and the decision's **Affects** sections after refresh.
- [ ] Attempt a duplicate or otherwise invalid relationship and confirm an error is announced with no duplicate edge. Confirm the upstream selector cannot choose the same item as the dependent.
- [ ] Remove the QA relationship. Confirm a labeled confirmation dialog appears, then confirm the pending/success states, persistent result announcement, refreshed absence from both directions, and no unrelated edge changes. Leave canonical seeded relationships intact.

### 7. Guided demo and responsive accessibility

- [ ] On `/app` and `/app/items`, follow callout links for the summit event, venue decision, speaker confirmation, media advisory/campaign work, print signage, volunteers, approval/readiness, and runbook where present in server state.
- [ ] Dismiss the guided-demo callout. Confirm it disappears without blocking navigation, moving the page unexpectedly, or hiding the synthetic-data label elsewhere.
- [ ] At 375, 768, and 1440 pixels, inspect `/app`, `/app/items`, one item detail, `/app/decisions`, `/app/risks`, and `/app/dependencies`. Confirm headings remain logical, controls and text fit, dialogs stay within the viewport, touch targets remain usable, and `document.documentElement.scrollWidth` does not exceed `clientWidth`.
- [ ] Traverse every route and interactive control using Tab, Shift+Tab, Enter/Space, and Escape. Confirm focus is always visible, control names are announced, filter/result changes use status announcements, errors use alerts, and no keyboard trap occurs outside an open modal.
- [ ] After mutation review, use the approved synthetic demo reset procedure if configured and confirm the 24-item/26-edge baseline is restored. If reset is unavailable, record the temporary QA item as deliberate synthetic test state for the owner to reconcile.

## Impact review UI verification gate

The judge-facing workflow is implemented on `andres/04-impact-ui`. These checks apply to the complete branch diff; the authenticated live-data procedure remains separate because this worktree has no public Supabase configuration, authenticated demo session, service-role key, or OpenAI key.

- [x] `npm run lint` under Node 22
- [x] `npm run typecheck` under Node 22
- [x] `npm run test:run` under Node 22 (231 tests across 39 files)
- [x] `npm run build` under Node 22
- [x] `git diff --check`
- [ ] `npm run test:e2e` when an authenticated Playwright environment is available
- [x] Static contract review confirms the UI calls only the existing analyze, apply, history, and undo routes.
- [x] Component coverage locks source validation/double-submit behavior and safe action selection/human-input exclusion.

The final command gate used the checksum-verified official Node 22.23.1/npm 10.9.8 distribution because the desktop runtime supplied only Node 24 without npm. The production build required network access solely for the existing `next/font` Geist downloads.

### Full-screen functional QA procedure

Use only the configured synthetic demo project and an operator-created owner/admin account. Do not paste or record credentials. Capture network metadata only; never capture authorization headers, cookies, raw provider metadata, or environment values.

1. Open `/app` and confirm the workspace is visibly labeled synthetic, the optional four-step demo guide does not block navigation, and no test fixture is presented as an analysis result.
2. Tab from the skip link through the source form. Confirm every control has a visible focus state and an accessible name: title, source type, author label, occurred-at date/time, source text, seeded-update insertion, and `Analyze change`.
3. Submit an empty form. Confirm useful inline messages appear, focus moves to the first invalid field, and no analyze request is sent.
4. Select `Insert seeded demo update`. Confirm it inserts only the exact canonical source sentence from `docs/demo-scenario.md`; it must not insert or display expected candidate, impact, or action results. The occurred-at field stays blank because the canonical source gives a date but no precise time.
5. Confirm the live character count, 12,000-character guidance, privacy warning, and synthetic-data instruction. Verify the counter itself is not an `aria-live` region.
6. Submit once and immediately try mouse and keyboard submission again. Confirm exactly one `POST /api/projects/[projectId]/analyze`, a disabled `Analyzing change…` control, and one general pipeline state. The four backend steps may be listed as context but must not advance independently because the API emits no stage events.
7. On completed analysis, confirm focus moves to `Change review`. Compare immutable source text against the GPT-5.6 inference: changed item, canonical old value, inferred new value, exact evidence excerpt, percentage plus confidence text, ambiguity/warning text, and explicit confirmation requirement.
8. Confirm direct impacts are depth 1 and indirect impacts are depth greater than 1. Every card must show item status/type/owner/date, severity text, a readable deterministic dependency path, and a separately labeled GPT-generated explanation. Verify valid empty and safe failure states.
9. In Recovery actions, confirm all pending actions without `requires_human_input` are preselected. No human-input or non-pending action may be preselected. Toggle each checkbox with Space, use `Select all safe actions`, then use `Leave all pending`; confirm no reject request is sent.
10. Select a human-input action. Confirm an associated response field appears and blank input prevents confirmation. Open `Approve selected`; confirm the dialog names/counts only selected actions, Cancel/Escape returns focus, and confirmation sends exactly the existing `{ selectedActionIds, humanInputs, idempotencyKey }` contract.
11. Confirm a fully finalized eligible analysis reaches `ready`; if any proposal remains `draft` or otherwise ineligible, confirm approval stays disabled with the backend-readiness explanation. Do not bypass this by changing SQL or client state. For a `ready` or `partially_approved` proposal, confirm a partial apply leaves unselected actions pending and focus moves to Applied result.
12. Confirm Applied result shows operation type/state/actor/time, changed items with before/after values, an audit-history anchor, and safe error/conflict details. Show Undo only for a backend-history `reversible` successful apply with no successful reversal; on a stale-state 409, confirm no partial-success claim appears.

### Responsive and accessibility review

At each viewport, confirm `document.documentElement.scrollWidth <= window.innerWidth`, no card/dialog/control is clipped, paths wrap readably, native checkbox selection works, and meaningful completion/errors are announced without character-count or selection-chatter spam.

- [x] Mobile: 375 × 812
- [x] Tablet: 768 × 1024
- [x] Desktop: 1440 × 900
- [x] Approval dialog initial focus, Cancel, and trigger focus return
- [ ] Focus moves to Change review after analysis and Applied result after apply/undo refresh
- [x] Confidence, severity, operation, and proposal states all include text; none rely on color alone
- [x] Reduced-motion rules remove spinner animation and smooth scrolling

Local browser evidence on 2026-07-18 used a temporary route with an unavoidable on-screen label stating that its records were synthetic fixtures and that no AI or backend call was made. The route was removed before the final diff. All three widths matched their requested viewport, reported no horizontal document overflow or out-of-viewport controls, and produced no console error after the deterministic date-format correction. Seed insertion, blank human-input prevention, dialog contents, initial Cancel focus, and trigger-focus return passed. Confirm/apply and undo were intentionally not clicked.

### Resolved proposal-readiness gate

Successful analysis completion now promotes only an eligible, exactly linked current-generation proposal from `draft` to `ready`. The transition requires a completed impact run, a change still in `needs_confirmation`, and one-to-eight entirely pending, unattributed actions. It does not mutate a project item or create an operation. Anomalous historical drafts remain quarantined, and the UI still disables approval for every non-ready state. Linked verification for this forward migration is recorded in the current Prompt 10 gate above.

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

### Prompt 7 implementation evidence (code review, not command results)

This subsection preserves the Prompt 7 checkpoint. Prompt 12 supersedes its original one-SDK-retry setting by disabling request/SDK retries to fit the documented 90-second deployment budget; the current release gate is at the top of this file.

- [x] The request and source schemas are strict and bounded; unsupported keys, source types, depths, and oversized request bodies fail closed.
- [x] Contributor authorization and one-project context loading happen before the model boundary.
- [x] At the Prompt 7 checkpoint, the server-only Responses adapter set `store: false`, low reasoning, no tools, bounded output, a 30-second timeout per logical call, and at most one SDK retry per call. Prompt 12 later disabled SDK/request retries for the current release budget.
- [x] Prompts treat source/input as untrusted data and cannot grant tools, IDs, fields, or action types.
- [x] Strict parsing is followed by ID, field, enum, date, owner, evidence-span, current-value, version, confidence, and impact-coverage validation.
- [x] Pure deterministic traversal, not GPT, produces the downstream paths supplied to proposal drafting.
- [x] The first persistence phase stores evidence and a duplicate/rate/revision claim; final derived writes are an all-or-nothing inert transaction.
- [x] Proposal actions are persisted pending and the analysis path contains no project-item mutation.
- [x] Prompt-injection, tenant-isolation, replay/spend, stale-state, partial-write, secret-boundary, and model-mutation threats have implementation controls documented in `docs/security-review.md`.
- [x] Prompt 7 has a forward-only containment/rollback procedure that preserves evidence and reconciles an interrupted processing claim through its fixed lease and an exact POST replay.
- [x] Complete Prompt 7 repository tests and linked SQL checks pass.

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

## Build Week submission release checks

- [ ] Confirm `https://github.com/Chi944/InOrdo-Hackathon` opens signed out and exposes the final submitted `main` commit, README, screenshots, and MIT license.
- [ ] Confirm the production URL opens in a private/incognito browser and identifies the exact deployed commit.
- [ ] Confirm every required deployment variable is configured and passes the exact deployed artifact's strict readiness schema, with server-only values absent from the browser bundle, logs, screenshots, and repository.
- [ ] Before the pinned Vercel production deploy, review the linked migration list and `db push --dry-run`, type the exact approval for expand tail `20260719140000`, and require `scripts/verify-migration-parity.mjs` to prove exact local/remote parity. After the RPC smoke, repeat that entire gate for the separate contract tail; never push both stages together.
- [x] [Vercel documents a 4.5 MB Function request-body limit](https://vercel.com/docs/functions/limitations); application handlers enforce the tighter 24,000/32,000-byte caps while streaming and cancel over-limit bodies without trusting `Content-Length`.
- [ ] Run exactly one funded synthetic GPT-5.6 analysis and record safe metadata only; do not record a key, prompt, raw provider output, or source body.
- [ ] Complete the authenticated production smoke path above as owner/admin and repeat read-only/denial checks as viewer and nonmember where feasible.
- [ ] Verify the real authenticated route at approximately 375, 768, and 1440 pixels, including keyboard order, visible focus, accessible names, status announcements, and no horizontal overflow.
- [ ] Confirm Devpost copy and the public voiceover video describe only the verified artifact, use the Work and Productivity track, and never present a fixture as live model output.
- [ ] Replace the production, demo-access, Devpost, video, team, deadline, and primary `/feedback` placeholders in the submission materials.
- [ ] Test the repository, production, video, Devpost, and demo-access links without a team-authenticated browser session.
- [ ] Record the final submitted commit externally and stop repository, deployment, Devpost, and video edits at the official deadline.

## Open release issues

| Severity | Issue | Owner | Required resolution or honest fallback |
| --- | --- | --- | --- |
| High | The configured production analysis reached OpenAI but failed closed because the API organization has no credits. | Deston / Shared | Add credits or billing in the OpenAI Platform, then run one safe synthetic retry and record only non-secret metadata. Until then, keep public copy explicit that no successful live result exists. |
| High | Authenticated native-mutation/reset production smoke is recorded, but fresh incognito login/logout and the funded analysis-to-undo journey are incomplete. | Shared | Complete the remaining live smoke matrix on the recorded production URL after provider funding. There is no documentation-only substitute. |
| High | Final demo-access, Devpost, and video URLs, team roles, and primary `/feedback` Session ID are not supplied. | Shared | Replace each remaining submission placeholder from its authoritative human/external source and verify every public link before submission. The official deadline is already recorded above. |
| Medium | Production is current and configured, but Vercel Authentication blocks anonymous judges; contract PR #17 and its hosted migration remain pending. | Deston / Shared | Deliberately decide public access, merge PR #17, type `apply-20260720190000`, apply only that migration, and rerun parity/denial verification. |
| Medium | Authenticated Playwright does not cover live Supabase/Auth/OpenAI. | Andres / Shared | Use the guarded journey only as UI/contract evidence; complete the real production browser matrix before making live-service claims. |

## Submission claim rule

Submission language may claim implemented behavior and the scoped automated, linked-database, and guarded-browser verification recorded above. It must describe live GPT-5.6 behavior, authenticated production operation, production responsiveness/accessibility, and final public-asset access as unverified until their checks are completed with current, non-secret evidence.
