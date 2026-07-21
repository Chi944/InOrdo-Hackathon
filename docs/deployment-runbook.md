# InOrdo Vercel Hobby deployment runbook

This runbook is for the Build Week P0 only. Deston is the single Vercel operator and deploys manually from a reviewed, clean `main` checkout. The Vercel project must not be connected to Git for automatic deployments. Preserve every Git author and committer exactly as recorded; a deployment restriction is never permission to amend, squash, or forge someone else's authorship.

The intended hosting scope is one small, non-commercial hackathon demo on Vercel Hobby. Immediately before deployment, a human operator must review the current Vercel plan limits and terms and confirm that the project is still eligible. This document is an engineering procedure, not a legal or plan-eligibility determination.

No analytics, paid monitoring, custom domain, background worker, scheduled job, Railway service, or automatic deployment pipeline is part of this release.

## Release invariants

- Deploy only a reviewed commit whose full SHA equals both `HEAD` and `origin/main`; a clean working tree alone is insufficient.
- Use Node.js 22 and npm. Do not deploy if `git status --short` prints anything.
- Keep `.env.local`, `.vercel/`, credentials, cookies, tokens, provider payloads, and private project data out of Git, tickets, screenshots, and copied command output.
- The browser may receive only the two `NEXT_PUBLIC_` values. `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `DEMO_PROJECT_SLUG`, `DEMO_RESET_SECRET`, `ANALYSIS_MODE`, `AI_GATEWAY_API_KEY`, and `AI_GATEWAY_MODEL` are server-only.
- Model output never mutates project data. Authorization, deterministic traversal, selective approval, mutation, history, undo, and reset remain application/database responsibilities.
- The production artifact must build without calling OpenAI. `/api/health` is a configuration-readiness check and must not spend model tokens or disclose values.
- Record the full Git SHA and the deployment URL privately in the release evidence. Do not claim the live provider or authenticated workflow passed until its smoke step has actually run.

## Environment inventory and scopes

Configure values interactively in Vercel's secret store. The commands below contain names and scopes only; never put values on a command line, in shell history, or in this document.

| Name | Vercel scope | Exposure | Required behavior |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Production | Browser-safe | Exact hosted Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production | Browser-safe | Publishable/anonymous browser key used with Auth and RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | Production, sensitive | Server only | Used only after request-scoped authorization by constrained persistence/operation services. |
| `OPENAI_API_KEY` | Recording deployment only, sensitive | Server only | Ignored outside `recording`; enables only an approved exact recording grant and is removed immediately after the recording attempt. |
| `OPENAI_MODEL` | Recording deployment only | Server only | Must be exactly `gpt-5.6-luna`; recording never falls back. |
| `DEMO_PROJECT_SLUG` | Production | Server only | Selects the synthetic project for protected workspace lookup and reset. |
| `DEMO_RESET_SECRET` | Production, sensitive | Server only | Server-held reset guard; never accepted from a browser request. |
| `ANALYSIS_MODE` | Production | Server only | Exactly `disabled`, `recording`, or `auto`; absent/invalid is disabled. |
| `AI_GATEWAY_API_KEY` | Auto deployment only, sensitive | Server only | Dedicated key with a nonrenewing hard quota of USD 1 or less and automatic top-up disabled. |
| `AI_GATEWAY_MODEL` | Auto deployment only | Server only | Must be exactly `openai/gpt-oss-20b`. |

Do not point a Preview deployment at the production Supabase database or production reset secret. By default, leave all application variables out of Preview. A public Preview can still be inspected, while `/api/health` honestly returns `503 not_ready` and authenticated/live-analysis paths remain unavailable. Configure Preview variables only if the team provisions a separate disposable Supabase project, separate demo reset guard, and explicitly accepts any model spend.

Base application readiness no longer requires either provider credential. `/api/health` may return `200 ready` while its generic analysis status is disabled or unavailable. A configured status proves environment shape only, not an exact recording grant, Gateway quota, provider funding, or a successful model call. The current names-only release inventory records `ANALYSIS_MODE=disabled`, no `OPENAI_API_KEY` in Production/Preview/Development, and no `AI_GATEWAY_API_KEY` in Production; no value was read or copied.

### Interactive production configuration

Run these commands one at a time and enter each value only at Vercel's hidden prompt:

```bash
npx --yes vercel@56.3.2 env add NEXT_PUBLIC_SUPABASE_URL production
npx --yes vercel@56.3.2 env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
npx --yes vercel@56.3.2 env add SUPABASE_SERVICE_ROLE_KEY production --sensitive
npx --yes vercel@56.3.2 env add OPENAI_MODEL production
npx --yes vercel@56.3.2 env add DEMO_PROJECT_SLUG production
npx --yes vercel@56.3.2 env add DEMO_RESET_SECRET production --sensitive
npx --yes vercel@56.3.2 env add ANALYSIS_MODE production
```

When Deston is ready to enable live analysis:

```bash
npx --yes vercel@56.3.2 env add OPENAI_API_KEY production --sensitive --scope chi944s-projects
```

For the capped fallback, create a dedicated Vercel AI Gateway key in its console, set a hard quota of USD 1 or less, choose no refresh period, disable automatic top-up, and verify those settings before adding it interactively. Do not use Vercel OIDC fallback.

```bash
npx --yes vercel@56.3.2 env add AI_GATEWAY_API_KEY production --sensitive --scope chi944s-projects
npx --yes vercel@56.3.2 env add AI_GATEWAY_MODEL production --scope chi944s-projects
```

Use `npx --yes vercel@56.3.2 env ls production --scope chi944s-projects` to verify names and scopes only. Do not print, pull, or copy values as release evidence. A changed environment variable affects only a new deployment, so redeploy after every required configuration change. The CLI version is pinned here so a release does not silently resolve a different command contract.

## Supabase Auth URL configuration

Local CLI configuration is versioned in `supabase/config.toml` with:

- Site URL: `http://localhost:3000`
- Redirects: `http://localhost:3000/**` and `http://127.0.0.1:3000/**`

Deston must open the linked hosted Supabase project's **Authentication -> URL Configuration** and set:

1. **Site URL** to the assigned canonical production origin, `https://inordo.vercel.app`.
2. **Redirect URLs** to both local HTTP wildcards above.
3. **Redirect URL** `https://inordo.vercel.app/**`.
4. **Redirect URL** `https://*-chi944s-projects.vercel.app/**` for account-scoped Vercel previews.

Replace the retired production hostname rather than retaining it as an alternate callback. Prefer the exact production redirect over a broad production wildcard. Do not add `http://` redirects for hosted deployments, do not use `https://127.0.0.1`, and do not add an unrelated domain. Save the hosted Auth settings, verify the saved values in the authoritative dashboard state, then test login and logout from a fresh browser profile.

## One-time Deston CLI link

Run from the repository root. These commands intentionally create a manual CLI project under the known Deston scope; they do not configure Git-based deployments.

```bash
npx --yes vercel@56.3.2 login
npx --yes vercel@56.3.2 whoami
npx --yes vercel@56.3.2 project ls --scope chi944s-projects
npx --yes vercel@56.3.2 project add inordo --scope chi944s-projects
npx --yes vercel@56.3.2 link --yes --project inordo --scope chi944s-projects
```

Run `project add` only when `project ls` confirms that `inordo` does not already exist. If it exists, link the existing project instead. The canonical production alias is `https://inordo.vercel.app`; an older immutable deployment hostname may still contain the former project name, but it is not the public alias. Confirm in Vercel Project Settings that no Git repository is connected, automatic Git deployments are disabled, and the project Node.js Version is `22.x`, matching `package.json`. `.vercel/` is local ignored state and must not be committed.

Vercel Hobby may reject a deployment associated with a commit authored by someone who is not allowed on the project. Deston still must not rewrite that author, manufacture a co-author, or amend/cherry-pick solely to change identity. Keep the original authored commits intact. Deploy through Deston's authenticated manual CLI from the accepted integration commit. If Vercel still rejects that exact commit, stop and resolve account/plan access under the current Vercel terms, or create a truthful Deston-authored release commit containing an actual reviewed release change and rerun every gate. Never create an empty attribution workaround.

## Preview sequence

Preview is a build and public-route check, not evidence for the production database, Auth, reset, or OpenAI.

```bash
set -euo pipefail
git switch main
git fetch --prune origin main
git pull --ff-only origin main
git status --short
test -z "$(git status --porcelain=v1 --untracked-files=all)"
RELEASE_SHA="$(git rev-parse --verify HEAD)"
REMOTE_SHA="$(git rev-parse --verify origin/main)"
DIVERGENCE="$(git rev-list --left-right --count origin/main...HEAD | tr '\t' ' ')"
printf 'release=%s\nremote=%s\ndivergence=%s\n' \
  "$RELEASE_SHA" "$REMOTE_SHA" "$DIVERGENCE"
test "$RELEASE_SHA" = "$REMOTE_SHA"
test "$DIVERGENCE" = "0 0"
npm ci
npm run lint
npm run typecheck
npm run test:run
npm run test:e2e
npm run build
npm audit --omit=dev
git diff --check
git status --short
test -z "$(git status --porcelain=v1 --untracked-files=all)"
git fetch --prune origin main
test "$(git rev-parse --verify HEAD)" = "$RELEASE_SHA"
test "$(git rev-parse --verify origin/main)" = "$RELEASE_SHA"
test "$(git rev-list --left-right --count origin/main...HEAD | tr '\t' ' ')" = "0 0"
npx --yes vercel@56.3.2
npx --yes vercel@56.3.2 inspect <PREVIEW_DEPLOYMENT_URL>
npx --yes vercel@56.3.2 curl /api/health --deployment <PREVIEW_DEPLOYMENT_URL>
```

Stop if either status command prints a path, a gate fails, either pair of full SHAs differs, either divergence count is not exactly `0 0`, the inspected deployment is not ready, or the deployed Git SHA differs from the recorded SHA. The second fetch catches `origin/main` moving during the gate; restart from the new reviewed commit instead of deploying the stale one. With Preview variables intentionally absent, health should report only non-secret missing configuration names and return `503`; that is expected and is not production-readiness evidence. Inspect `/` and `/login` through the preview URL. Use `vercel curl` for the protected Preview and preserve the reviewed Preview-only protection setting; public Production access does not authorize exposing Preview deployments.

## Production sequence

Production deployment starts over from a clean, current `main`. Do not reuse an old preview working tree or deploy a feature branch. The generation-fenced mutation expand/deploy/contract rollout and policy migration `20260721100000_add_analysis_access_policy.sql` are complete; linked migrations have exact parity through that applied migration and no migration is pending. Do not rerun the historical policy-migration procedure below. A future migration requires a new, purpose-specific target, ledger, dry-run, and action-time approval gate; an older approval never authorizes a new push.

The following block is the completed 21 July 2026 policy-migration record, retained for audit only; it is not a current deployment command sequence.

```bash
set -euo pipefail
git switch main
git fetch --prune origin main
git pull --ff-only origin main
git status --short
test -z "$(git status --porcelain=v1 --untracked-files=all)"
RELEASE_SHA="$(git rev-parse --verify HEAD)"
REMOTE_SHA="$(git rev-parse --verify origin/main)"
DIVERGENCE="$(git rev-list --left-right --count origin/main...HEAD | tr '\t' ' ')"
printf 'release=%s\nremote=%s\ndivergence=%s\n' \
  "$RELEASE_SHA" "$REMOTE_SHA" "$DIVERGENCE"
test "$RELEASE_SHA" = "$REMOTE_SHA"
test "$DIVERGENCE" = "0 0"
npm ci
npm run lint
npm run typecheck
npm run test:run
npm run test:e2e
npm run build
npm audit --omit=dev
git diff --check
git status --short
test -z "$(git status --porcelain=v1 --untracked-files=all)"
git fetch --prune origin main
test "$(git rev-parse --verify HEAD)" = "$RELEASE_SHA"
test "$(git rev-parse --verify origin/main)" = "$RELEASE_SHA"
test "$(git rev-list --left-right --count origin/main...HEAD | tr '\t' ' ')" = "0 0"
POLICY_MIGRATION_TAIL="20260721100000"
POLICY_MIGRATION_FILENAME="${POLICY_MIGRATION_TAIL}_add_analysis_access_policy.sql"
EXPECTED_REMOTE_TAIL="20260720190000"
test -f "supabase/migrations/$POLICY_MIGRATION_FILENAME"

# Compare the existing local link with the intended dashboard target without
# printing either private project reference.
test -r supabase/.temp/project-ref
read -r -s -p 'Privately enter the intended linked Supabase project ref: ' \
  EXPECTED_LINKED_PROJECT_REF
printf '\n'
test -n "$EXPECTED_LINKED_PROJECT_REF"
LINKED_PROJECT_REF="$(tr -d '\r\n' < supabase/.temp/project-ref)"
test -n "$LINKED_PROJECT_REF"
test "$LINKED_PROJECT_REF" = "$EXPECTED_LINKED_PROJECT_REF"
unset EXPECTED_LINKED_PROJECT_REF LINKED_PROJECT_REF

policy_pending_set() {
  LEDGER_JSON="$1" node <<'NODE'
const ledger = JSON.parse(process.env.LEDGER_JSON ?? "");
if (
  ledger === null ||
  typeof ledger !== "object" ||
  Array.isArray(ledger) ||
  Object.keys(ledger).sort().join(",") !== "message,migrations" ||
  ledger.message !== "Migrations listed" ||
  !Array.isArray(ledger.migrations) ||
  ledger.migrations.length > 1000
) process.exit(4);
let previousTail = "";
for (const row of ledger.migrations) {
  if (
    row === null ||
    typeof row !== "object" ||
    Array.isArray(row) ||
    Object.keys(row).sort().join(",") !== "local,remote,time" ||
    typeof row.local !== "string" ||
    typeof row.remote !== "string" ||
    (row.local !== "" && !/^\d{14}$/.test(row.local)) ||
    (row.remote !== "" && !/^\d{14}$/.test(row.remote)) ||
    (row.local === "" && row.remote === "") ||
    (row.remote !== "" && row.local !== row.remote)
  ) process.exit(4);
  const currentTail = row.local || row.remote;
  if (currentTail <= previousTail) process.exit(4);
  previousTail = currentTail;
}
const remote = ledger.migrations.filter((row) => row.remote !== "");
const pending = ledger.migrations.filter(
  (row) => row.local !== "" && row.remote === "",
);
process.stdout.write(
  `${remote.at(-1)?.remote ?? ""}\t${pending.map((row) => row.local).join(",")}\n`,
);
NODE
}

PRE_PUSH_LEDGER_JSON="$(
  npx --no-install supabase --output-format json migration list --linked
)"
IFS=$'\t' read -r REMOTE_TAIL PENDING_TAILS <<< "$(
  policy_pending_set "$PRE_PUSH_LEDGER_JSON"
)"
test "$REMOTE_TAIL" = "$EXPECTED_REMOTE_TAIL"
test "$PENDING_TAILS" = "$POLICY_MIGRATION_TAIL"

POLICY_DRY_RUN="$(npx --no-install supabase db push --dry-run 2>&1)"
DRY_RUN_MIGRATIONS="$(
  printf '%s\n' "$POLICY_DRY_RUN" |
    grep -Eo '[0-9]{14}_[A-Za-z0-9_]+\.sql' |
    sort -u
)"
test "$DRY_RUN_MIGRATIONS" = "$POLICY_MIGRATION_FILENAME"

# Re-read the linked ledger at the action boundary. Any concurrent or
# unexpected local/remote migration stops this procedure before confirmation.
ACTION_LEDGER_JSON="$(
  npx --no-install supabase --output-format json migration list --linked
)"
IFS=$'\t' read -r REMOTE_TAIL PENDING_TAILS <<< "$(
  policy_pending_set "$ACTION_LEDGER_JSON"
)"
test "$REMOTE_TAIL" = "$EXPECTED_REMOTE_TAIL"
test "$PENDING_TAILS" = "$POLICY_MIGRATION_TAIL"
printf '%s\n' \
  "Validated exact pending migration: $POLICY_MIGRATION_FILENAME" \
  "Type apply-$POLICY_MIGRATION_TAIL to authorize only this hosted mutation."
read -r MIGRATION_APPROVAL
test "$MIGRATION_APPROVAL" = "apply-$POLICY_MIGRATION_TAIL"
npx --no-install supabase db push
LEDGER_JSON="$(
  npx --no-install supabase --output-format json migration list --linked
)"
LEDGER_JSON="$LEDGER_JSON" \
EXPECTED_MIGRATION_TAIL="$POLICY_MIGRATION_TAIL" \
  node scripts/verify-migration-parity.mjs
git status --short
test -z "$(git status --porcelain=v1 --untracked-files=all)"
git fetch --prune origin main
test "$(git rev-parse --verify HEAD)" = "$RELEASE_SHA"
test "$(git rev-parse --verify origin/main)" = "$RELEASE_SHA"
test "$(git rev-list --left-right --count origin/main...HEAD | tr '\t' ' ')" = "0 0"
npx --yes vercel@56.3.2 --prod
npx --yes vercel@56.3.2 inspect <PRODUCTION_DEPLOYMENT_URL>
npx --yes vercel@56.3.2 logs <PRODUCTION_DEPLOYMENT_URL>
```

For that historical rollout, every status check was empty, every full-SHA comparison was identical, and every divergence count was `0 0`. The private linked-target comparison succeeded without printing a project reference. The ledger showed remote tail `20260720190000` with the one-element pending set `20260721100000`, then the dry run named only `20260721100000_add_analysis_access_policy.sql`; fresh action-time approval authorized that exact push. Afterward, `scripts/verify-migration-parity.mjs` proved exact local/remote parity through `20260721100000`. The current linked pending set is empty. Never edit or delete an applied migration; a future correction requires a newly reviewed forward migration and fresh approval. Before the pinned Vercel production command, the operator recorded the identical full Git SHA as the release SHA. A post-build Git-SHA comparison applies only when deployment metadata exposes one; the current direct-CLI release does not, so its source identity rests on the recorded clean exact-SHA worktree together with the inspected deployment ID and URLs. Review logs only for status and safe error codes/configuration names. Never paste a log containing a credential, request body, source evidence, human response, provider payload, authorization header, or cookie.

The project explicitly enables Fluid Compute in `vercel.json`. The analysis route sets a conservative 90-second function duration, below the currently supported 300-second Hobby Fluid maximum; 90 seconds is the application's release budget, not the plan maximum. Its two sequential OpenAI calls each have a 30-second internal limit with SDK/request retries disabled, leaving about 30 seconds for authorization, graph work, persistence, and safe failure handling. The database assigns a fixed three-minute claim lease, providing a second full route-runtime margin. Active duplicate responses expose the remaining bounded delay; resubmitting the exact update after expiry terminalizes the existing claim without another provider call. A late success is rejected transactionally. Other mutation/history routes use a 30-second duration. A deployment-time function limit is not permission to wait indefinitely or add background work. OpenAI must never be contacted during `npm run build` or the Vercel build phase.

## Post-deploy smoke

Use a fresh private/incognito browser and the operator-provisioned synthetic account. Do not record its password, session, cookies, authorization headers, or private response bodies.

1. Request `https://inordo.vercel.app/api/health` through authorized deployment access and require `200 ready`; the body may identify configuration names/status only and must never expose values or test the provider by spending tokens. Treat provider billing/funding as a separate gate.
2. Check `npx --yes vercel@56.3.2 logs <PRODUCTION_DEPLOYMENT_URL>` for configuration-name-only failures, route timeouts, server/client boundary violations, or build-time provider activity. Any credential/value leak is an incident and blocks release.
3. Open `/`, `/login`, and the protected `/app` path signed out. Confirm the protected path redirects safely to login and no tenant data appears.
4. Sign in with the out-of-band synthetic owner/admin account. Confirm session refresh and logout, then verify the seeded dashboard, 24 active records, 26 edges, decision/risk/item/dependency pages, and documented dependency direction.
5. Verify the already-contracted RPC-only mutation path: use the deployed UI to create and edit one synthetic item, add and remove one dependency, and repeat each unchanged ambiguous retry with its original key when applicable. Confirm the four RPCs succeed, exact replay does not double-write, and authenticated direct table DML remains denied. Verify source identity against a deployment Git SHA only when inspection exposes one; for a direct-CLI deployment without that metadata, use the recorded clean-worktree release SHA together with the inspected deployment ID and URLs.
6. Branch on the approved analysis mode. In the default disabled release, verify the authenticated interface reports analysis unavailable, confirm no provider request occurs, and do not submit evidence. Only inside a separately approved recording window with a fresh purpose-specific key and one-use grant may the operator submit the canonical synthetic venue update exactly once and verify preserved evidence, safe model metadata, deterministic paths, inert proposals, and no pre-approval item mutation.
7. Only when step 6 used an approved recording window, select one reversible field update, leave the separate request-human-confirmation proposal pending, supply any required response for the selected internal action, apply once, inspect actor-attributed ordered history, and undo through the compensating operation. Otherwise verify only the already-saved result and disabled mutation boundary. Exercise stale-conflict behavior in an approved non-production or rollback-wrapped test, not by creating an unplanned Production mutation.
8. Open the reset review as owner/admin, explicitly confirm the named synthetic project, reset once, and verify 24 records, 26 edges, baseline event date, one workflow-generation advance, and retained archived history. Confirm viewer/nonmember/cross-project attempts fail closed and duplicate/rate-limit behavior is safe.
9. Repeat the real interface at approximately 375, 768, and 1440 pixels with keyboard-only navigation, visible focus, status announcements, and no horizontal overflow.
10. Record only date/time, full release SHA, deployment URL, browser/viewport, HTTP status, safe IDs/counts, actual model name, and pass/fail. Update public claims only for steps that passed.

### Current release checkpoint — 2026-07-21

- Release source `4f54cc1eec37d49aa6b1da6e0dafbc6f7d738d03` passed the exact-main gate under Node `22.23.1` and npm `10.9.8`: lint, typecheck, 514 tests across 64 Vitest files, two Chromium tests, the Next.js `16.2.10` build, a zero-vulnerability production audit, and whitespace checks.
- The interim recording deployment reached `READY`, and health reported analysis `recording_configured`. Canonical-source and fresh-duplicate gates passed; the operator display was sanitized.
- Exactly one 14-minute grant was issued. Exactly one GPT-5.6 Production run succeeded, and post-capture verification found one claimed, consistent, expiry-valid grant. Genuine saved evidence, direct and indirect impact, and the recovery proposal were captured.
- One internal date action was selected with an explicit human response. Apply and compensating undo succeeded, and their linked history remains.
- Before the run, an older duplicate active InOrdo provider key was discovered and revoked. After the playable capture, the fresh recording key was revoked; zero active InOrdo keys remained, the Vercel `OPENAI_API_KEY` was removed, and local `.env.recording.local` was deleted.
- Production returned to `ANALYSIS_MODE=disabled`. Direct CLI deployment `dpl_BW4kvr2zMUNkwv46XEeMMFRJeisJ` is `READY` at canonical `https://inordo.vercel.app` and immutable `https://inordo-caheq8v2h-chi944s-projects.vercel.app`; `/api/health` is ready with analysis disabled. The direct deployment did not expose a Git SHA, so source identity remains the clean exact-SHA worktree proof rather than a Vercel metadata claim.
- Judge-viewer QA confirmed saved-state view access and that provider and mutation controls were denied, disabled, or absent. Exactly one owner, one admin recording operator, and one viewer judge were three distinct real Auth identities; no private identifier is recorded.

The earlier disabled-mode deployment `dpl_EygrifPbthqu1sdbrUDNog4deNXf` at `https://inordo-oq86578uo-chi944s-projects.vercel.app` is historical. It was superseded by the bounded recording deployment and then by the current post-recording disabled deployment above.

## Analysis-policy rollout and containment

Migration `20260721100000_add_analysis_access_policy.sql`, SHA-256 `0F4125F0897FE96A942889EF57C8A4CC186F730539597149EB98CABEA4939B1F`, is applied to the sanitized identity-matched linked project. The action followed the separate second dry run and owner approval. Post-apply parity passed through `20260721100000`, no migration remains pending, and linked database lint passed. A nonfatal `pg-delta` catalog-cache warning was followed by the successful dry-run, parity, and lint proofs; it is not a failed migration. The current recording completed its real authenticated policy, grant, viewer-denial, and teardown gates. Any future provider window must repeat every mode-specific credential, quota, source, duplicate, grant, and denial gate with fresh approval.

For normal public availability, prefer `ANALYSIS_MODE=disabled`, or `auto` only after the dedicated Gateway key's nonrenewing hard quota and disabled auto-top-up are verified. Recording is an exceptional one-attempt window: issue one private grant for the exact actor/project/normalized-source tuple, set `ANALYSIS_MODE=recording`, deploy, submit that exact source once, verify the grant/request link through the owner-only metadata boundary, and immediately perform the credential teardown in the release plan. Recording never falls back, and auto never uses the OpenAI key.

If either provider path is suspect, execute this forward-containment sequence in order:

1. Revoke the OpenAI recording key in the provider console.
2. Remove `OPENAI_API_KEY` from every Vercel scope where it exists.
3. Revoke or disable the dedicated Gateway key at the provider and remove `AI_GATEWAY_API_KEY` from every Vercel scope where it exists. If no dedicated key exists, record only that name-level absence.
4. Set `ANALYSIS_MODE=disabled`, create a new deployment, and verify that its analysis status is disabled.
5. Create, review, and apply a new forward containment migration that revokes execution on `public.begin_project_analysis_with_policy` and marks every still-`available` private recording grant `revoked` with truthful owner/operator attribution. Do not edit the applied policy migration or delete grant/request/evidence history.
6. Prove exact migration parity, run the rollback-wrapped policy SQL verifier (or a reviewed containment-specific successor if wrapper denial changes its expected contract), check health, and verify viewer denial before reopening any route.
7. Test the canonical Production URL and every accessible older immutable deployment URL after both provider credentials are revoked or disabled, removed from every Vercel scope, and the disabled-mode deployment is ready. Each URL must show disabled/no-provider-call behavior, and no older URL may retain a usable provider credential.
8. Never assign or restore the production alias to an old deployment while any provider credential remains valid.

Containment is not complete merely because the UI hides analysis. Keep the analyze route closed until the database execution grants, environment names, deployment identity, and viewer-denial result all match the intended disabled state.

## Archived native-mutation contract verification

The native-DML contract rollout is complete through `20260720190000_contract_project_record_mutations.sql`, and the separate analysis-policy migration `20260721100000_add_analysis_access_policy.sql` is applied with exact post-apply parity. Do not create or apply another native-DML contract migration as part of this release. Any correction must be a new reviewed forward migration.

Keep the completed contract as a verification boundary: prove authenticated direct `INSERT`, `UPDATE`, and `DELETE` remain denied on `project_items` and `item_dependencies`, including the contracted column privileges, while all four project-record RPC mutations still work and exact replays do not double-write. A contract regression requires a new reviewed forward repair migration; never edit or replay the completed contract migration.

## Rollback

Contain a bad release before investigating it. For a pure application/runtime/config regression, return the production alias to the last known-good Vercel deployment:

**Hard precondition:** do not run `vercel rollback`, assign an alias, or otherwise serve an old deployment until credential-first containment is complete. Start the seven-step analysis containment sequence above; revoke every OpenAI recording key and Gateway key that could authorize this deployment, remove `OPENAI_API_KEY` and `AI_GATEWAY_API_KEY` from every Vercel scope where present, and privately verify both provider-side invalidation and name-only Vercel absence without displaying a value. If either credential can still work or its removal cannot be proved, keep the current route contained and do not change the production alias.

```bash
npx --yes vercel@56.3.2 ls
npx --yes vercel@56.3.2 inspect <LAST_KNOWN_GOOD_DEPLOYMENT_URL_OR_ID>
npx --yes vercel@56.3.2 rollback <LAST_KNOWN_GOOD_DEPLOYMENT_URL_OR_ID>
npx --yes vercel@56.3.2 inspect <PRODUCTION_DEPLOYMENT_URL>
```

The native-DML contract is already applied, so never roll back to a pre-RPC artifact: it will render reads but cannot write. Roll back only to an inspected RPC-capable deployment, or contain native mutation routes and ship a reviewed forward compatibility migration before serving an older artifact. Recheck `/api/health`, `/`, `/login`, signed-out `/app`, Auth, and the affected read/write route after rollback. A Vercel rollback changes the served artifact; it does not reverse an applied database migration or user operation. Keep the database ledger forward-only and use the domain compensation/containment procedures in `docs/rollback-plan.md`.

If the last known-good deployment is unavailable or the defect requires a source correction, use the following fail-closed preparation in one Bash, Git Bash, or macOS shell. It resolves the exact commit, requires clean synchronized `main`, rejects roots and octopus merges, requires an explicit reviewed mainline for a two-parent merge, reads the linked migration ledger, and automatically chooses the safe path. It never places a credential in an argument or file:

```bash
set -euo pipefail
FAULTY_COMMIT_SHA="<FULL_FAULTY_COMMIT_SHA>"
REVERT_MAINLINE=""
REVERT_BRANCH="deston/revert-production-issue"

git switch main
git fetch --prune origin main
git pull --ff-only origin main
git status --short
test -z "$(git status --porcelain=v1 --untracked-files=all)"
test "$(git rev-parse --verify HEAD)" = \
  "$(git rev-parse --verify origin/main)"
REVERT_PLAN="$(
  node scripts/revert-plan.mjs "$FAULTY_COMMIT_SHA" "$REVERT_MAINLINE"
)"
IFS=$'\t' read -r \
  FAULTY_COMMIT_SHA FAULTY_DIFF_BASE RESOLVED_MAINLINE <<< "$REVERT_PLAN"
test -n "$FAULTY_COMMIT_SHA"
test -n "$FAULTY_DIFF_BASE"
git show --stat --oneline "$FAULTY_COMMIT_SHA"
case "$RESOLVED_MAINLINE" in
  none) ;;
  1|2) ;;
  *)
    printf '%s\n' \
      'STOP: the tested revert planner returned an unexpected mainline.' >&2
    exit 5
    ;;
esac

npm ci
LEDGER_JSON="$(
  npx --no-install supabase --output-format json migration list --linked
)"
TARGET_MIGRATION_PATHS="$(
  git diff --name-only "$FAULTY_DIFF_BASE" "$FAULTY_COMMIT_SHA" \
    -- supabase/migrations | sort -u
)"
APPLIED_MIGRATION_PATHS="$(
  LEDGER_JSON="$LEDGER_JSON" \
  TARGET_MIGRATION_PATHS="$TARGET_MIGRATION_PATHS" \
  node scripts/applied-migration-paths.mjs
)"
printf 'target migrations:\n%s\napplied target migrations:\n%s\n' \
  "${TARGET_MIGRATION_PATHS:-<none>}" \
  "${APPLIED_MIGRATION_PATHS:-<none>}"

git switch -c "$REVERT_BRANCH"
test "$(git branch --show-current)" = "$REVERT_BRANCH"
if [ -z "$APPLIED_MIGRATION_PATHS" ]; then
  if [ "$RESOLVED_MAINLINE" = "none" ]; then
    git revert --no-edit "$FAULTY_COMMIT_SHA"
  else
    git revert --no-edit -m "$RESOLVED_MAINLINE" "$FAULTY_COMMIT_SHA"
  fi
else
  if [ "$RESOLVED_MAINLINE" = "none" ]; then
    git revert --no-commit "$FAULTY_COMMIT_SHA"
  else
    git revert --no-commit -m "$RESOLVED_MAINLINE" "$FAULTY_COMMIT_SHA"
  fi
  git restore --source=HEAD --staged --worktree -- supabase/migrations
  test -z "$(git diff --cached --name-only -- supabase/migrations)"
  test -z "$(git diff --name-only -- supabase/migrations)"
  git status --short
  git diff --cached
  printf '%s\n' \
    'STOP: confirm application/schema compatibility before committing.' >&2
  exit 2
fi
```

Before a merge revert, inspect `git show --no-patch --pretty=raw "$FAULTY_COMMIT_SHA"` and choose the parent whose tree should be treated as the retained mainline. GitHub pull-request merge commits normally use parent `1`, but the operator must verify the actual parent order rather than assume it. `scripts/revert-plan.mjs` resolves and validates the commit plus parent, proves the target belongs to the synchronized current `main` history, and has disposable-Git-history tests covering ordinary commits, both parents of a two-parent merge, missing/invalid mainlines, roots, octopus merges, and a disconnected commit. The same selected parent is used both to inventory migration changes and by `git revert -m`, so the migration guard cannot compare one parent while reverting against another. Root, octopus, and disconnected-history targets exit `5` for a separate reviewed plan. The explicit ordinary/merge command branches avoid empty-array expansion and remain compatible with the macOS system Bash 3.2 used by the documented shell procedure.

The repository pins Supabase CLI `2.109.1`; `--no-install` makes this guard use that reviewed binary instead of resolving a moving latest version. The CLI's JSON flag is the global `--output-format json` option and therefore appears before `migration list`; the similarly named legacy `--output json` option renders a table and must not be substituted. An unexpected ledger envelope/row exits `4` and performs no revert. Exit `0` means the target had no applied migration and the whole-commit revert was committed. Exit `2` intentionally leaves only the non-migration revert staged on the named branch. For that path, confirm that the prior application behavior is compatible with the current forward schema. Abort the revert and keep the affected route contained if compatibility is uncertain. If database behavior must change, create a new migration with `npx --no-install supabase migration new <repair_name>`, edit it, verify it, and stage that exact new path. Never edit, remove, restore to an older version, or untrack an applied migration. Then commit a truthful repair:

```bash
set -euo pipefail
REVERT_BRANCH="deston/revert-production-issue"
test "$(git branch --show-current)" = "$REVERT_BRANCH"
test -n "$(git diff --cached --name-only)"
test -z "$(git diff --name-only -- supabase/migrations)"
MIGRATION_CHANGES="$(
  git diff --cached --name-status -- supabase/migrations
)"
UNEXPECTED_MIGRATION_CHANGES="$(
  printf '%s\n' "$MIGRATION_CHANGES" | awk 'NF && $1 != "A" { print }'
)"
test -z "$UNEXPECTED_MIGRATION_CHANGES"
git diff --check
git diff --cached --check
git commit -m "revert: contain production regression"
```

After either path has a reviewed commit, run the complete gate and require a clean branch before pushing:

```bash
set -euo pipefail
REVERT_BRANCH="deston/revert-production-issue"
test "$(git branch --show-current)" = "$REVERT_BRANCH"
npm ci
npm run lint
npm run typecheck
npm run test:run
npm run test:e2e
npm run build
npm audit --omit=dev
git diff --check
git status --short
test -z "$(git status --porcelain=v1 --untracked-files=all)"
git push -u origin HEAD
```

Open and review a PR, merge it without force, then return to `main`, pull with `--ff-only`, prove `HEAD == origin/main` with the SHA/divergence guard, rerun the complete gate, and run `npx --yes vercel@56.3.2 --prod`. Do not bypass review for a non-containment repair, do not force-push, and do not delete or edit an applied migration. The provider-model metadata validator intentionally accepts both the prior artifact's exact legacy envelope and the current exact envelope during the rollback window; new writes still persist the provider-returned model name. Credential invalidation and removal are mandatory before any old artifact or alias can be served, regardless of whether exposure is suspected. Add a replacement only after the reviewed current artifact, mode, quota, grant, and containment gates are ready; never put a key in Git or a command argument.

## Evidence that remains human-owned

The production alias/deployment identity, linked Supabase migration result, hosted Auth URLs, provider-key containment, demo account provisioning, Deston's July 20, 2026 Vercel Hobby eligibility confirmation, authenticated Production analysis-to-undo journey, disabled-message/viewer-denial checks, deployed accessibility and judge access, YouTube/Devpost links, team/legal details, and primary `/feedback` Session ID are recorded in `docs/release-evidence.md`; no secret value or Auth UUID is recorded. Any future one-use recording grant or capped-Gateway enablement remains a separate release plan. YouTube public visibility, the final merged repository SHA, explicit rules acceptance, and final Devpost submission remain human-owned. Placeholders are not release evidence and must never be filled with invented values.
