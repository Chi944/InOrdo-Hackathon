# InOrdo Vercel Hobby deployment runbook

This runbook is for the Build Week P0 only. Deston is the single Vercel operator and deploys manually from a reviewed, clean `main` checkout. The Vercel project must not be connected to Git for automatic deployments. Preserve every Git author and committer exactly as recorded; a deployment restriction is never permission to amend, squash, or forge someone else's authorship.

The intended hosting scope is one small, non-commercial hackathon demo on Vercel Hobby. Immediately before deployment, a human operator must review the current Vercel plan limits and terms and confirm that the project is still eligible. This document is an engineering procedure, not a legal or plan-eligibility determination.

No analytics, paid monitoring, custom domain, background worker, scheduled job, Railway service, or automatic deployment pipeline is part of this release.

## Release invariants

- Deploy only a reviewed commit whose full SHA equals both `HEAD` and `origin/main`; a clean working tree alone is insufficient.
- Use Node.js 22 and npm. Do not deploy if `git status --short` prints anything.
- Keep `.env.local`, `.vercel/`, credentials, cookies, tokens, provider payloads, and private project data out of Git, tickets, screenshots, and copied command output.
- The browser may receive only the two `NEXT_PUBLIC_` values. `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `DEMO_PROJECT_SLUG`, and `DEMO_RESET_SECRET` are server-only.
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
| `OPENAI_API_KEY` | Production, sensitive | Server only | Required for live analysis; intentionally absent until Deston supplies it. |
| `OPENAI_MODEL` | Production | Server only | Use `gpt-5.6-luna` unless a reviewed release explicitly changes it. |
| `DEMO_PROJECT_SLUG` | Production | Server only | Names the one synthetic project eligible for reset. |
| `DEMO_RESET_SECRET` | Production, sensitive | Server only | Server-held reset guard; never accepted from a browser request. |

Do not point a Preview deployment at the production Supabase database or production reset secret. By default, leave the seven application variables out of Preview. A public Preview can still be inspected, while `/api/health` honestly returns `503 not_ready` and authenticated/live-analysis paths remain unavailable. Configure Preview variables only if the team provisions a separate disposable Supabase project, separate demo reset guard, and explicitly accepts any model spend.

With `OPENAI_API_KEY` absent, production can build and public/authenticated non-analysis routes can be deployed, but `/api/health` must return `503 not_ready` and live analysis is unavailable. Add that one value only through Deston's interactive Vercel session, redeploy, then require `200 ready` before running the funded analysis smoke.

### Interactive production configuration

Run these commands one at a time and enter each value only at Vercel's hidden prompt:

```bash
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
npx vercel env add SUPABASE_SERVICE_ROLE_KEY production --sensitive
npx vercel env add OPENAI_MODEL production
npx vercel env add DEMO_PROJECT_SLUG production
npx vercel env add DEMO_RESET_SECRET production --sensitive
```

When Deston is ready to enable live analysis:

```bash
npx vercel env add OPENAI_API_KEY production --sensitive
```

Use `npx vercel env ls production` to verify names and scopes only. Do not print, pull, or copy values as release evidence. A changed environment variable affects only a new deployment, so redeploy after every required configuration change.

## Supabase Auth URL configuration

Local CLI configuration is versioned in `supabase/config.toml` with:

- Site URL: `http://localhost:3000`
- Redirects: `http://localhost:3000/**` and `http://127.0.0.1:3000/**`

After Vercel assigns real hosts, Deston must open the linked hosted Supabase project's **Authentication -> URL Configuration** and set:

1. **Site URL** to the exact production origin, for example the actual `https://<production-host>` returned for this project. Do not use a guessed URL.
2. **Redirect URLs** to both local HTTP wildcards above.
3. **Redirect URL** for the exact production origin with `/**` appended.
4. **Redirect URL** for Vercel previews using `https://*-<vercel-team-or-account-slug>.vercel.app/**`, after replacing the placeholder with the actual Vercel slug shown by the project.

Prefer the exact production redirect over a broad production wildcard. Do not add `http://` redirects for hosted deployments, do not use `https://127.0.0.1`, and do not add an unrelated domain. Save the hosted Auth settings, then test login and logout from a fresh browser profile.

## One-time Deston CLI link

Run from the repository root. These commands intentionally create a manual CLI project under the known Deston scope; they do not configure Git-based deployments.

```bash
npx vercel login
npx vercel whoami
npx vercel project ls --scope chi944s-projects
npx vercel project add inordo-hackathon --scope chi944s-projects
npx vercel link --yes --project inordo-hackathon --scope chi944s-projects
```

Run `project add` only when `project ls` confirms that `inordo-hackathon` does not already exist. If it exists, link the existing project instead. Confirm in Vercel Project Settings that no Git repository is connected and automatic Git deployments are disabled. `.vercel/` is local ignored state and must not be committed.

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
npx vercel
npx vercel inspect <PREVIEW_DEPLOYMENT_URL>
npx vercel curl /api/health --deployment <PREVIEW_DEPLOYMENT_URL>
```

Stop if either status command prints a path, a gate fails, either pair of full SHAs differs, either divergence count is not exactly `0 0`, the inspected deployment is not ready, or the deployed Git SHA differs from the recorded SHA. The second fetch catches `origin/main` moving during the gate; restart from the new reviewed commit instead of deploying the stale one. With Preview variables intentionally absent, health should report only non-secret missing configuration names and return `503`; that is expected and is not production-readiness evidence. Inspect `/` and `/login` through the preview URL. Use `vercel curl` when deployment protection is enabled; do not disable protection.

## Production sequence

Production deployment starts over from a clean, current `main`. Do not reuse an old preview working tree or deploy a feature branch.

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
npx vercel --prod
npx vercel inspect <PRODUCTION_DEPLOYMENT_URL>
npx vercel logs <PRODUCTION_DEPLOYMENT_URL>
```

Both status checks must be empty, both pairs of full SHAs must be identical, and both divergence counts must be exactly `0 0`. The second fetch catches `origin/main` moving during the release gate; if it moved, restart from the new reviewed commit. Record that identical full SHA as the release SHA before `npx vercel --prod` and compare it with deployment metadata after the build. Review logs only for status and safe error codes/configuration names. Never paste a log containing a credential, request body, source evidence, human response, provider payload, authorization header, or cookie.

The project explicitly enables Fluid Compute in `vercel.json`. The analysis route sets a conservative 90-second function duration, below the currently supported 300-second Hobby Fluid maximum; 90 seconds is the application's release budget, not the plan maximum. Its two sequential OpenAI calls each have a 30-second internal limit with SDK/request retries disabled, leaving about 30 seconds for authorization, graph work, persistence, and safe failure handling. The database assigns a fixed three-minute claim lease, providing a second full route-runtime margin. Active duplicate responses expose the remaining bounded delay; resubmitting the exact update after expiry terminalizes the existing claim without another provider call. A late success is rejected transactionally. Other mutation/history routes use a 30-second duration. A deployment-time function limit is not permission to wait indefinitely or add background work. OpenAI must never be contacted during `npm run build` or the Vercel build phase.

## Post-deploy smoke

Use a fresh private/incognito browser and the operator-provisioned synthetic account. Do not record its password, session, cookies, authorization headers, or private response bodies.

1. Request `https://<production-host>/api/health`. Expect `503 not_ready` while `OPENAI_API_KEY` is absent. After Deston adds the key and redeploys, require `200 ready`; the body may identify configuration names/status only and must never expose values or test the provider by spending tokens.
2. Check `npx vercel logs <PRODUCTION_DEPLOYMENT_URL>` for configuration-name-only failures, route timeouts, server/client boundary violations, or build-time provider activity. Any credential/value leak is an incident and blocks release.
3. Open `/`, `/login`, and the protected `/app` path signed out. Confirm the protected path redirects safely to login and no tenant data appears.
4. Sign in with the out-of-band synthetic owner/admin account. Confirm session refresh and logout, then verify the seeded dashboard, 24 active records, 26 edges, decision/risk/item/dependency pages, and documented dependency direction.
5. After health is ready, submit the canonical synthetic venue update exactly once. Confirm preserved evidence, the actual model name in safe response/persisted metadata, deterministic direct/indirect paths, inert recovery actions, and no item mutation before approval.
6. Select only a reversible field update, leave a sensitive/human-input action pending, apply once, inspect actor-attributed ordered history, and undo through the compensating operation. Exercise a stale conflict and confirm it applies nothing.
7. Open the reset review as owner/admin, explicitly confirm the named synthetic project, reset once, and verify 24 records, 26 edges, baseline event date, one workflow-generation advance, and retained archived history. Confirm viewer/nonmember/cross-project attempts fail closed and duplicate/rate-limit behavior is safe.
8. Repeat the real interface at approximately 375, 768, and 1440 pixels with keyboard-only navigation, visible focus, status announcements, and no horizontal overflow.
9. Record only date/time, full release SHA, deployment URL, browser/viewport, HTTP status, safe IDs/counts, actual model name, and pass/fail. Update public claims only for steps that passed.

## Rollback

Contain a bad release before investigating it. For a pure application/runtime/config regression, return the production alias to the last known-good Vercel deployment:

```bash
npx vercel ls
npx vercel inspect <LAST_KNOWN_GOOD_DEPLOYMENT_URL_OR_ID>
npx vercel rollback <LAST_KNOWN_GOOD_DEPLOYMENT_URL_OR_ID>
npx vercel inspect <PRODUCTION_DEPLOYMENT_URL>
```

Recheck `/api/health`, `/`, `/login`, signed-out `/app`, Auth, and the affected read/write route after rollback. A Vercel rollback changes the served artifact; it does not reverse an applied database migration or user operation. Keep the database ledger forward-only and use the domain compensation/containment procedures in `docs/rollback-plan.md`.

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

Open and review a PR, merge it without force, then return to `main`, pull with `--ff-only`, prove `HEAD == origin/main` with the SHA/divergence guard, rerun the complete gate, and run `npx vercel --prod`. Do not bypass review for a non-containment repair, do not force-push, and do not delete or edit an applied migration. The provider-model metadata validator intentionally accepts both the prior artifact's exact legacy envelope and the current exact envelope during the rollback window; new writes still persist the provider-returned model name. Rotate a key only in the provider and Vercel secret stores if exposure is suspected; never put the replacement in Git or a command argument.

## Evidence that remains human-owned

The production alias, Vercel deployment identity, linked Supabase project reference, hosted Auth URL configuration, and six non-OpenAI production variable names are recorded in `docs/release-evidence.md`; no value is recorded. Deston must still supply the OpenAI key, provision the Auth demo account, and confirm current Vercel Hobby eligibility. The team must complete the authenticated production smoke, funded synthetic analysis, final responsive/accessibility pass, public-video/Devpost links, judge access path, team/deadline details, and primary `/feedback` Session ID. Placeholders are not release evidence and must never be filled with invented values.
