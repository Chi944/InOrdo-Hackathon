# InOrdo final release evidence

This document records the factual release state produced by the final merged application review. It separates automated and public evidence from checks that still require a human-held credential, a funded provider request, or submission-account access.

## Release identity

| Field | Recorded value |
| --- | --- |
| Current production application SHA | `d581b0a9d736bd12046a4314e15b359ec8fd8205` |
| Production release merge | PR [#9](https://github.com/Chi944/InOrdo-Hackathon/pull/9), merged normally into `main` |
| Production alias | [inordo-hackathon.vercel.app](https://inordo-hackathon.vercel.app) |
| Immutable deployment | `inordo-hackathon-e9t278oun-chi944s-projects.vercel.app` |
| Vercel deployment ID | `dpl_3JrXGeW9ptujQ8u4yCRDwfo3TNEV` |
| Production metadata | `READY`, `production`, Node `22.x`, `githubCommitSha` equal to the production SHA above |
| Current merged application `main` SHA | `72a6fc5a02a55ec5efe52e0b14f8ac831ec2685c` |
| Hardening release merge | PR [#11](https://github.com/Chi944/InOrdo-Hackathon/pull/11), merged normally into `main` |
| Exact-SHA Preview | `dpl_ChQL8nigyoc1M6LSEGjdS8seP4bD`; `inordo-hackathon-3w91bc8k0-chi944s-projects.vercel.app` |
| Preview metadata | `READY`, Preview, Node `22.x`, `githubCommitSha` equal to the current merged SHA above, ref `main` |
| Linked Supabase project | Project reference `hctvqaxkxqmqodzeshjm`; migrations aligned through `20260719113000` |

Prompt 14 started as a documentation-only branch at the production SHA, then merged current `main` normally to reconcile the completed release-boundary hardening. The production and Preview identities remain separate: production still serves `d581b0a9...`; the newer `72a6fc5...` hardening is exact-SHA Preview evidence until Deston completes the explicit Vercel terms gate and production redeploy. Record the final documentation merge SHA externally after this draft PR merges.

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
| Guarded browser journey | `tests/e2e/core-demo.spec.ts`, `src/lib/e2e/` | One Chromium journey over production components with provider/database seams intercepted |
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

The checked-in default model setting is `gpt-5.6-luna`. Calls are server-only, use strict structured output, have no tools or direct data-mutation path, disable provider storage, and are bounded by application timeouts and a fixed database claim lease. No funded live provider request has been completed, so this release does not claim a verified live GPT-5.6 response.

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
- Reset requires owner/admin access, the exact configured synthetic project, explicit confirmation, rate/idempotency controls, and a server-held secret that is never supplied by the browser.
- Reset advances workflow generation, restores the canonical 24-item/26-edge baseline, retires nonbaseline records, and preserves archived evidence and operations.

## Verification record

The current production application SHA passed the following under Node `22.23.1` and npm `10.9.8`:

- clean `npm ci`;
- `npm run lint`;
- `npm run typecheck`;
- `npm run test:run`: 305 tests across 54 Vitest files;
- `npm run test:e2e`: one Chromium core-demo journey;
- `npm run build`;
- `npm audit --omit=dev`: zero production vulnerabilities; and
- `git diff --check` with a clean synchronized `main`.

Linked Supabase evidence includes aligned local/remote migrations through `20260719113000`, generated database types matching the hosted schema after line-ending normalization, clean public/private schema lint and security advisors, and passing rollback-wrapped `verify_p0.sql`, `verify_analysis_pipeline.sql`, and `verify_operations.sql`. The verification transactions retained no test rows.

The current merged hardening SHA `72a6fc5...` separately passed a clean Node `22.23.1` gate: lint, typecheck, 358 Vitest tests across 55 files, one guarded Chromium journey, production build, zero production dependency vulnerabilities, and whitespace checks. Its exact-SHA Preview inspection is recorded below; this does not turn it into production evidence.

Before reconciliation, the Prompt 14 documentation branch passed lint, typecheck, 305 Vitest tests across 54 files, and the Next.js 16.2.10 production build. After merging current `main`, Node `22.23.1` and npm `10.9.8` completed a fresh `npm ci`, lint, typecheck, 358 Vitest tests across 55 files, one guarded Chromium journey, the Next.js 16.2.10 production build, and a zero-vulnerability production dependency audit. Final staged/unstaged whitespace checks are recorded in `docs/qa-checklist.md` immediately before the merge-resolution commit.

## Production smoke recorded 2026-07-19

| Check | Result |
| --- | --- |
| Production alias resolves to the recorded deployment ID | Pass |
| `/` | `200` |
| `/login` | `200` |
| Signed-out `/app` | `307` to `/login?next=%2Fapp`; no tenant data returned |
| `/api/health` with intentionally absent `OPENAI_API_KEY` | Expected `503 not_ready`, `Cache-Control: no-store`, generic configuration-only body |

The six non-OpenAI production variable names are configured and hosted Supabase Auth URLs include the production host and documented local/Preview redirects. Values are intentionally not recorded here. Analysis remains unavailable until the OpenAI key is supplied through the deployment secret store and a new deployment returns `200 ready`.

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

- No operator-provisioned demo Auth account has completed a production login/session/logout run.
- No funded live GPT-5.6 request has been verified.
- Production still serves the Prompt 13 SHA; release-boundary hardening requires Deston's explicit confirmation that current Vercel Hobby terms permit the demo before it is redeployed.
- The exact hardening Preview is protected by Vercel SSO and intentionally lacks Supabase configuration; neither state should be weakened merely to manufacture a public Preview claim.
- The complete authenticated production evidence -> impact -> selective apply -> history -> undo -> reset journey is pending.
- Viewer/nonmember/cross-project denial has linked and automated coverage but still needs the final deployed-browser check.
- Production responsive, keyboard, focus, announcement, and no-overflow checks at approximately 375, 768, and 1440 pixels are pending.
- Undo intentionally supports only operations made entirely of reversible field updates whose after-state is still current.
- Vercel Hobby eligibility still requires the operator's current terms review; this repository is not legal advice.
- The final video, Devpost page, judge access path, team list, and primary Codex `/feedback` Session ID remain human-owned.
- The hosted live-journey work is tracked in GitHub [issue #4](https://github.com/Chi944/InOrdo-Hackathon/issues/4); automated/guarded evidence does not close it.
- The [official Devpost schedule](https://openai.devpost.com/details/dates) sets the submission deadline at July 21, 2026 at 5:00 PM PDT (July 22, 2026 at 8:00 AM SGT).

## Devpost placeholder audit

The confirmed repository, production host, platform/project, and deployed application SHA are recorded. The following submission placeholders remain because no factual value was supplied:

- `<PUBLIC_YOUTUBE_VIDEO_URL>`
- `<DEVPOST_URL>`
- `<DEMO_ACCESS_INSTRUCTIONS_OR_TEST_PATH>`
- `<PRIMARY_FEEDBACK_SESSION_ID>`
- `<TEAM_MEMBER_NAMES_AND_ROLES>`

`<SUPABASE_PROJECT_REF>`, `<AUTH_USER_UUID>`, and deployment/rollback command placeholders are instructional examples, not Devpost fields. Never replace an instructional token by committing a credential, private user identifier, or environment value.
