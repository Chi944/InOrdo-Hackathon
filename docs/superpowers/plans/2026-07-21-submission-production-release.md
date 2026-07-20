# Submission Production Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Safely prepare, deploy, record, document, and hand off the verified InOrdo Build Week release while protecting credentials, preserving the one paid analysis result, and keeping final submission under the project owner's control.

**Architecture:** This operational plan follows the analysis-access and judge-experience plans. Repository documentation defines a reproducible release contract; production configuration and account work occur only through secret-safe Supabase, Vercel, OpenAI, Devpost, and YouTube interfaces. Raw media stays outside Git, and the final video uses genuine Production behavior and persisted evidence.

**Tech Stack:** PowerShell, Node.js 22, npm, Next.js, Supabase CLI and Dashboard, Vercel CLI and Dashboard, Playwright, Edge or Chrome, Xbox Game Bar, Clipchamp, FFmpeg/FFprobe, YouTube, Devpost.

## Global Constraints

- Start only after `2026-07-21-analysis-access-and-fallback.md` and `2026-07-21-judge-project-experience.md` are implemented, review-ready, and locally verified on `codex/19-submission-production`. Task 3 performs their integration; they are not expected to be on `main` before Tasks 1–2.
- Never read, print, echo, log, commit, screenshot, or expose an environment value, API key, password, token, Auth session, service-role key, or private Devpost credential.
- Secret values are entered only by the project owner through a hidden interactive prompt or provider dashboard. They never appear in a shell argument.
- The recording permits one exact GPT-5.6 grant and one provider attempt. A capture or editing failure does not authorize another analysis.
- Revoke the purpose-specific OpenAI key at the provider after the verified raw recording, then remove it from Vercel and redeploy.
- Production uses `auto` only if the dedicated Gateway key has a verified hard quota of USD 1 or less, refresh period `none`, and automatic top-up disabled. Otherwise Production uses `disabled`.
- The dedicated judge account is a `viewer`; it never receives contributor or administrator privileges and cannot start paid or fallback analysis.
- Raw captures, voice recordings, browser profiles, edit projects, exports, secret/private account identifiers, and private submission material remain outside Git. Public repository/team/deployment names may appear only where needed for exact commands.
- Do not use Higgsfield. The approved thumbnail and video need genuine product footage, typography, and standard editing only.
- Saving a Devpost draft is allowed during execution. Clicking final **Submit** requires a fresh action-time confirmation from the project owner.
- Do not claim a Production, media, account, migration, or submission check passed unless the exact check was run and its non-secret evidence recorded.
- Before every repository commit in this plan, run `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build`, and `git diff --check` under Node 22; also run `npm run test:e2e` when the committed state includes browser behavior.

---

## File map

Create:

- `docs/video-production/production-runbook.md` — exact capture order, filenames, key lifecycle, editorial timeline, and export checks.
- `docs/video-production/andres-voiceover.md` — Andres's five approved sections and recording specification.
- `docs/video-production/deston-voiceover.md` — Deston's four approved sections and recording specification.
- `docs/video-production/thumbnail-brief.md` — genuine Production frame, layout, privacy, and export requirements.

Modify:

- `docs/video-script.md` — authoritative 2:47 timeline and links to the separate speaker scripts.
- `docs/devpost-handoff.md` — final verified public fields and credential-safe private handoff procedure.
- `docs/demo-user-setup.md` — operator/viewer provisioning, verification, and retirement.
- `docs/submission-copy.md` — reconcile every claim with the final deployed evidence.
- `docs/submission-checklist.md` — add cost, key, viewer, media, team, and final-submit gates.
- `docs/qa-checklist.md` — record exact Production and viewer checks.
- `docs/release-evidence.md` — record commit, deployment, migration, provider-control, and test evidence without identifiers or secrets.
- `docs/deployment-runbook.md` — mode-aware environment inventory and current migration tail.
- `docs/rollback-plan.md` — grant/provider containment and credential revocation sequence.
- `docs/local-run-and-test.md` — mode-aware local setup and current verification sequence.
- `docs/security-review.md` — viewer denial and cost-boundary evidence.
- `README.md` — supported input scope, project preview, GPT-OSS fallback, judge access, and truthful release status.
- `docs/codex-log.md` — concise public implementation and release record only.

Operational outputs outside Git:

- `C:\Users\User\Documents\Archives\InOrdo\workspace-cleanup-2026-07-21`
- `C:\Users\User\Videos\InOrdo-Build-Week`
- Production deployment, Supabase accounts/membership, Vercel variables, OpenAI key revocation, YouTube video, and Devpost draft/final submission.

## Secret-safe tracked-file gate

Run this before every release-documentation commit and once more before the final PR. It checks tracked/staged paths first without opening forbidden environment files, then scans tracked text while reporting filenames only—never matching content:

```powershell
$forbiddenEnvironmentPaths = @(
  git ls-files |
    Where-Object {
      $_ -match '(^|/)\.env($|\.)' -and
      $_ -notmatch '(^|/)\.env\.example$'
    }
)
if ($forbiddenEnvironmentPaths.Count -ne 0) {
  throw "Forbidden tracked environment paths: $($forbiddenEnvironmentPaths -join ', ')"
}

$forbiddenStagedMedia = @(
  git diff --cached --name-only --diff-filter=ACMR |
    Where-Object {
      $_ -match '(?i)\.(mp4|mov|mkv|wav|aiff|mp3|m4a)$' -or
      $_ -match '(?i)(^|/)browser-profile(/|$)'
    }
)
if ($forbiddenStagedMedia.Count -ne 0) {
  throw "Private media/profile paths are staged: $($forbiddenStagedMedia -join ', ')"
}

$secretPattern = '(sk-(proj-)?[A-Za-z0-9_-]{20,}|sb_secret_[A-Za-z0-9_-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|(SUPABASE_SERVICE_ROLE_KEY|OPENAI_API_KEY|AI_GATEWAY_API_KEY|DEMO_RESET_SECRET)=[^[:space:]]+)'
$suspectTrackedFiles = @(git grep -Il -E $secretPattern -- .)
if ($LASTEXITCODE -notin @(0, 1)) {
  throw 'Tracked-file secret scan failed to run.'
}
if ($suspectTrackedFiles.Count -ne 0) {
  throw "Potential credential material found in tracked files: $($suspectTrackedFiles -join ', ')"
}
```

The scanner deliberately excludes ignored local environment files by operating through Git. Never alter it to print matching lines or inspect `.env`/`.env.local`.

## Release branch preflight

Tasks 1–3 begin on the same clean implementation branch as the first two plans:

```powershell
git branch --show-current
git status --short
git fetch origin
git merge-base --is-ancestor origin/main HEAD
```

Expected before Task 1: exact branch `codex/19-submission-production`, empty status, and current `origin/main` is an ancestor. Tasks 1–2 commit their review-ready media/runbook documentation there. Task 3 merges that complete branch through a PR, then creates `codex/20-submission-release` for all later evidence commits.

### Task 1: Recoverably clean the Hackathons workspace and create the media workspace

**Files:**

- Move outside Git: `.playwright-mcp`, `inordo-desktop.png`, `inordo-mobile.png`
- Remove after exact validation: empty parent `.agents`, empty parent `.git`, audited dangling parent `Program` reparse point
- Preserve: `InOrdo-Hackathon`
- Create outside Git: `C:\Users\User\Videos\InOrdo-Build-Week\...`

- [ ] **Step 1: Re-audit the exact parent contents without following reparse points**

Run from `C:\Users\User\Documents\Projects\Hackathons`:

```powershell
$hackRoot = [IO.Path]::GetFullPath('C:\Users\User\Documents\Projects\Hackathons')
$repoPath = [IO.Path]::GetFullPath((Join-Path $hackRoot 'InOrdo-Hackathon'))

Get-ChildItem -LiteralPath $hackRoot -Force |
  Select-Object Name, FullName, Length, Attributes, LinkType, Target
git -C $repoPath status --short
git -C $repoPath remote -v
```

Expected: the exact audited candidates plus `InOrdo-Hackathon`; the repository remote remains `https://github.com/Chi944/InOrdo-Hackathon.git`. Stop if any unexpected entry or unreviewed reparse target appears.

- [ ] **Step 2: Execute the recoverable, exact-target cleanup**

Use native PowerShell end to end:

```powershell
$hackRoot = [IO.Path]::GetFullPath(
  'C:\Users\User\Documents\Projects\Hackathons'
)
$archiveRoot = [IO.Path]::GetFullPath(
  'C:\Users\User\Documents\Archives\InOrdo\workspace-cleanup-2026-07-21'
)
$repoPath = Join-Path $hackRoot 'InOrdo-Hackathon'

if (-not (Test-Path -LiteralPath $repoPath -PathType Container)) {
  throw 'The InOrdo repository is missing.'
}

$allowed = @(
  '.agents',
  '.git',
  '.playwright-mcp',
  'InOrdo-Hackathon',
  'inordo-desktop.png',
  'inordo-mobile.png',
  'Program'
)
$current = @(Get-ChildItem -LiteralPath $hackRoot -Force)
$unexpected = @($current | Where-Object Name -NotIn $allowed)
if ($unexpected.Count -ne 0) {
  throw "Unexpected Hackathons entries: $($unexpected.Name -join ', ')"
}

foreach ($name in @('.agents', '.git')) {
  $path = Join-Path $hackRoot $name
  if (-not (Test-Path -LiteralPath $path -PathType Container)) {
    throw "$path is missing or is not a directory."
  }
  if (@(Get-ChildItem -LiteralPath $path -Force).Count -ne 0) {
    throw "$path is not empty."
  }
}

$programPath = Join-Path $hackRoot 'Program'
$program = Get-Item -LiteralPath $programPath -Force
if (
  $program.PSIsContainer -or
  $program.Length -ne 0 -or
  -not ($program.Attributes -band [IO.FileAttributes]::ReparsePoint)
) {
  throw 'Program is not the audited zero-byte reparse point.'
}
$reparseAudit = (& fsutil reparsepoint query $programPath | Out-String)
if ($LASTEXITCODE -ne 0 -or $reparseAudit -notmatch '0xa000001d') {
  throw 'Program reparse metadata changed.'
}

if (Test-Path -LiteralPath $archiveRoot) {
  throw 'Archive destination already exists; inspect it before retrying.'
}

$moveNames = @(
  '.playwright-mcp',
  'inordo-desktop.png',
  'inordo-mobile.png'
)
$movePairs = @()
foreach ($name in $moveNames) {
  $source = [IO.Path]::GetFullPath((Join-Path $hackRoot $name))
  $destination = [IO.Path]::GetFullPath((Join-Path $archiveRoot $name))

  if (-not $source.StartsWith(
    "$hackRoot\",
    [StringComparison]::OrdinalIgnoreCase
  )) {
    throw "Source escaped Hackathons: $source"
  }
  if (-not $destination.StartsWith(
    "$archiveRoot\",
    [StringComparison]::OrdinalIgnoreCase
  )) {
    throw "Destination escaped the archive: $destination"
  }
  if (-not (Test-Path -LiteralPath $source)) {
    throw "Expected source is missing: $source"
  }
  $sourceItem = Get-Item -LiteralPath $source -Force
  if ($sourceItem.Attributes -band [IO.FileAttributes]::ReparsePoint) {
    throw "Move source must not be a reparse point: $source"
  }
  if ($name -eq '.playwright-mcp' -and -not $sourceItem.PSIsContainer) {
    throw '.playwright-mcp is not the audited directory.'
  }
  if ($name -ne '.playwright-mcp' -and $sourceItem.PSIsContainer) {
    throw "Expected screenshot is not a regular file: $source"
  }
  if (Test-Path -LiteralPath $destination) {
    throw "Archive collision: $destination"
  }

  $movePairs += [pscustomobject]@{
    Source = $source
    Destination = $destination
  }
}

New-Item -ItemType Directory -Path $archiveRoot | Out-Null
$movedPairs = New-Object System.Collections.Generic.List[object]
try {
  foreach ($pair in $movePairs) {
    Move-Item -LiteralPath $pair.Source -Destination $pair.Destination
    $null = $movedPairs.Add($pair)
  }
} catch {
  for ($index = $movedPairs.Count - 1; $index -ge 0; $index--) {
    $pair = $movedPairs[$index]
    if (
      (Test-Path -LiteralPath $pair.Destination) -and
      -not (Test-Path -LiteralPath $pair.Source)
    ) {
      Move-Item -LiteralPath $pair.Destination -Destination $pair.Source
    }
  }
  if (@(Get-ChildItem -LiteralPath $archiveRoot -Force).Count -eq 0) {
    Remove-Item -LiteralPath $archiveRoot -Force
  }
  throw
}

try {
  foreach ($name in @('.agents', '.git')) {
    Remove-Item -LiteralPath (Join-Path $hackRoot $name) -Force
  }
  Remove-Item -LiteralPath $programPath -Force
} catch {
  throw 'Media was archived safely, but an exact empty entry or dangling link could not be removed. Inspect the final listing before retrying.'
}

$remaining = @(Get-ChildItem -LiteralPath $hackRoot -Force)
if ($remaining.Count -ne 1 -or $remaining[0].Name -ne 'InOrdo-Hackathon') {
  throw "Unexpected final contents: $($remaining.Name -join ', ')"
}

$remaining | Select-Object Name, FullName
Get-ChildItem -LiteralPath $archiveRoot -Force |
  Select-Object Name, FullName, Length
```

Expected: Hackathons contains only `InOrdo-Hackathon`; screenshots and Playwright output are recoverable from the dated archive; only the two audited empty directories and dangling link were removed.

If the deletion phase reports a partial result, do not rerun the whole script. List both roots, verify the three archived entries, then remove only a still-present audited empty directory or the unchanged `Program` reparse point. Never move an archived entry again or follow the reparse target.

- [ ] **Step 3: Create the private media directory tree**

```powershell
$mediaRoot = [IO.Path]::GetFullPath(
  'C:\Users\User\Videos\InOrdo-Build-Week'
)
$directories = @(
  '00-production',
  '01-screen-captures',
  '02-voiceover\andres',
  '02-voiceover\deston',
  '02-voiceover\room-tone',
  '03-assets',
  '04-edit',
  '05-exports\review',
  '05-exports\final',
  '99-private-temp\browser-profile'
)

foreach ($relative in $directories) {
  $target = [IO.Path]::GetFullPath((Join-Path $mediaRoot $relative))
  if (-not $target.StartsWith(
    "$mediaRoot\",
    [StringComparison]::OrdinalIgnoreCase
  )) {
    throw "Media path escaped its root: $target"
  }
  New-Item -ItemType Directory -Path $target -Force | Out-Null
}

Get-ChildItem -LiteralPath $mediaRoot -Directory -Recurse |
  Select-Object FullName
```

- [ ] **Step 4: Record the non-secret cleanup evidence**

Add only the archive path, moved filenames, removed empty entries/link, final parent listing, and date to `docs/release-evidence.md`. Do not record file contents, browser state, usernames, or identifiers.

This task has no Git commit until Task 2 updates the release documentation.

### Task 2: Create the production video, voiceover, and thumbnail package

**Files:**

- Create: `docs/video-production/production-runbook.md`
- Create: `docs/video-production/andres-voiceover.md`
- Create: `docs/video-production/deston-voiceover.md`
- Create: `docs/video-production/thumbnail-brief.md`
- Modify: `docs/video-script.md`
- Modify: `docs/submission-checklist.md`
- Modify: `docs/codex-log.md`

- [ ] **Step 1: Establish the documentation acceptance assertions**

Use these assertions as the review checklist for every file in this task; no extra temporary file is required:

- Total timeline is 2:47 and below 3:00.
- Andres owns A1 through A5; Deston owns D1 through D4.
- The scripts say GPT-5.6 was bounded and server-only, not autonomous.
- Deterministic TypeScript, not GPT, determines dependency reach.
- Model output never directly mutates project records.
- The workspace and names are synthetic.
- Raw media and credentials remain outside Git.
- The recording key is revoked immediately after the playable raw capture is verified.
- The thumbnail uses a genuine Production frame and no generated interface.

- [ ] **Step 2: Author the speaker scripts verbatim from the approved specification**

`andres-voiceover.md` must contain these exact sections:

**A1, 0:00–0:16 — Problem and hook**

> One changed fact can invalidate work several steps away. A venue date moves, and suddenly speaker confirmation, catering, programme deadlines, travel, and briefing materials may all be stale. Small teams usually reconstruct that chain by hand.

**A2, 0:16–0:33 — Product promise**

> InOrdo makes the response reviewable. It preserves the evidence, separates source fact from inference, explains downstream impact, and keeps every proposed change inert until a person approves it.

**A3, 0:33–0:54 — Synthetic source**

> This workspace and every name in it are synthetic. I insert one venue update: the hall is unavailable on September twelfth and offers September twenty-sixth instead. InOrdo preserves the exact source and warns us never to paste secrets or customer data.

**A4, 1:41–2:04 — Human approval**

> Recovery actions are proposals, not permission. I can review them individually, leave anything requiring human confirmation pending, and approve only the safe internal deadline change. The confirmation names exactly what will be applied.

**A5, 2:38–2:47 — Close**

> InOrdo's promise is simple: when evidence changes a project, every consequence stays visible, attributable, and safely under human control.

`deston-voiceover.md` must contain these exact sections:

**D1, 0:54–1:18 — Bounded GPT-5.6 use**

> On the server, GPT-5.6 has two bounded jobs: extract one structured candidate change, then draft recovery actions. Strict schemas and canonical-state checks validate identifiers, values, dates, and the exact evidence span. The model has no tools and cannot write a project record.

**D2, 1:18–1:41 — Deterministic graph**

> GPT never decides reach. Deterministic TypeScript follows explicit dependency edges, terminates cycles, keeps a stable shortest path, and labels depth one as direct and later steps as indirect. Every affected record is therefore explainable, not merely plausible.

**D3, 2:04–2:28 — Apply and undo**

> Before applying anything, the server rechecks role, proposal state, selected action IDs, required human input, item versions, and idempotency. History records the actor and ordered before-and-after state. Undo never erases history; it creates a linked compensating operation only when current state still matches.

**D4, 2:28–2:38 — Codex contribution**

> Codex accelerated our schema and RLS review, graph and model contracts, operation and undo tests, and release hardening—while preserving the rule that model output never mutates data directly.

Both files specify mono PCM WAV, 48 kHz, 24-bit, no clipping, two seconds between sections, and approximately five seconds of separately recorded room tone. Expected files:

- `02-voiceover\andres\Andres.wav`
- `02-voiceover\andres\Andres-room-tone.wav`
- `02-voiceover\deston\Deston.wav`
- `02-voiceover\deston\Deston-room-tone.wav`

- [ ] **Step 3: Author the capture and edit runbook**

Specify these Production-only files:

- `01-screen-captures\01-landing-and-workflow.mp4`
- `01-screen-captures\02-source-evidence.mp4`
- `01-screen-captures\03-gpt56-analysis.mp4`
- `01-screen-captures\04-deterministic-impact.mp4`
- `01-screen-captures\05-approval-history-undo.mp4`
- `01-screen-captures\06-project-preview.mp4`
- `01-screen-captures\07-codex-evidence.mp4`

`07-codex-evidence.mp4` is a sanitized capture of public GitHub commits, public CI results, public test evidence, or a purpose-built non-secret slide. It must never show the Codex task transcript, terminal history, shell prompt, local file explorer, browser profile, environment output, account details, or private review notes.

Specify 1920×1080, browser zoom 100%, full-screen browser, notifications disabled, synthetic label visible, and no `__e2e__` route. Map every capture to the 2:47 voiceover timeline. Add captions, restrained cursor movement, short holds on evidence/path/approval state, and a privacy frame check before every take.

- [ ] **Step 4: Author the exact thumbnail brief**

Require `C:\Users\User\Videos\InOrdo-Build-Week\05-exports\final\inordo-thumbnail-1280x720.png` at 1280×720 with:

- a genuine Production impact-review crop on the right;
- `InOrdo` as the large title;
- `Evidence → Impact → Human Approval` as the subtitle;
- cobalt badge `GPT-5.6 + deterministic dependency graph`;
- visible `Synthetic demo` label;
- warm off-white and dark forest palette matching the app;
- no browser chrome, email, password, personal data, key, source secret, fabricated UI, or Higgsfield asset.

- [ ] **Step 5: Verify the documentation package**

```powershell
rg -n "0:00|0:16|0:33|0:54|1:18|1:41|2:04|2:28|2:38|2:47" docs/video-production docs/video-script.md
rg -n "Andres\.wav|Deston\.wav|1920×1080|1280×720|Synthetic demo|revoke" docs/video-production docs/video-script.md docs/submission-checklist.md
rg -n "Higgsfield|__e2e__|model output never" docs/video-production docs/video-script.md
git diff --check
```

Expected: all timeline boundaries and output requirements are present; Higgsfield appears only in the prohibition; `__e2e__` appears only in the prohibition; no credential or account value appears.

- [ ] **Step 6: Commit the video-production package**

```powershell
git add docs/video-production docs/video-script.md docs/submission-checklist.md docs/release-evidence.md docs/codex-log.md
git diff --cached --check
git commit -m "docs: add production video package"
```

### Task 3: Integrate, verify, and deploy the reviewed application release

**Files:**

- Modify: `docs/deployment-runbook.md`
- Modify: `docs/local-run-and-test.md`
- Modify: `docs/qa-checklist.md`
- Modify: `docs/release-evidence.md`
- Modify: `docs/rollback-plan.md`
- Modify: `docs/codex-log.md`

- [ ] **Step 1: Update the deployment and rollback documentation before touching Production**

Document all ten names without values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `ANALYSIS_MODE`
- `AI_GATEWAY_API_KEY`
- `AI_GATEWAY_MODEL`
- `DEMO_PROJECT_SLUG`
- `DEMO_RESET_SECRET`

Record that `OPENAI_API_KEY` is ignored outside `recording`; `AI_GATEWAY_MODEL` is fixed to `openai/gpt-oss-20b`; absent/invalid mode is `disabled`. Add the forward-only containment sequence from the approved spec, including revocation at both providers, disabling mode, revoking available grants through a reviewed containment migration, preserving evidence/history, and verifying canonical and older deployment URLs.

- [ ] **Step 2: Run the complete local Node 22 gate**

```powershell
$nodeRoot = 'C:\Users\User\AppData\Local\Temp\inordo-node-v22.23.1\runtime\node-v22.23.1-win-x64'
$env:Path = "$nodeRoot;$env:Path"

node --version
npm --version
npm ci
npm run lint
npm run typecheck
npm run test:run
npm run test:e2e
npm run build
npm audit --omit=dev
git diff --check
git status --short
```

Expected: Node major version 22; every command exits 0; no unexpected worktree file appears. Record exact test counts and audit result without overstating manual coverage.

- [ ] **Step 3: Verify the local database from a disposable Supabase instance**

```powershell
npx --no-install supabase db reset
Get-Content supabase/tests/verify_analysis_access_policy.sql -Raw |
  docker exec -i supabase_db_InOrdo-Hackathon psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres
Get-Content supabase/tests/verify_analysis_pipeline.sql -Raw |
  docker exec -i supabase_db_InOrdo-Hackathon psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres
Get-Content supabase/tests/verify_operations.sql -Raw |
  docker exec -i supabase_db_InOrdo-Hackathon psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres
Get-Content supabase/tests/verify_prompt13_evidence_integrity.sql -Raw |
  docker exec -i supabase_db_InOrdo-Hackathon psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres
```

Expected: all rollback-wrapped verifiers exit 0; one-use, viewer, cross-project, duplicate, disabled, and rollback assertions pass.

- [ ] **Step 4: Review and integrate through a pull request**

Push `codex/19-submission-production` without force, create a ready PR describing provider invariants, viewer denials, tests, migration, rollback, and manual gates. Wait for required CI/review. Merge only the reviewed head SHA and update local `main` with a fast-forward pull. Never bypass a failing check.

- [ ] **Step 5: Review the linked migration tail before applying it**

Immediately before the dry run, the owner uses an uncaptured terminal/Dashboard session to compare the local Supabase link's exact project reference with the **Project ID/Reference** shown in the intended InOrdo Supabase Dashboard. Codex does not run or capture `supabase projects list` and receives only `linked project identity confirmed: yes/no`. Stop on `no` or no answer.

```powershell
npx --no-install supabase migration list --linked
npx --no-install supabase db push --dry-run --linked
node scripts/verify-migration-parity.mjs
```

Expected: the dry run proposes only the reviewed provider-policy migration tail; parity fails before apply only because that exact migration is pending. Record its literal filename and checksum. Immediately before the consequential apply, require the owner to repeat the same uncaptured reference comparison and provide only a fresh yes/no attestation, then obtain action-time confirmation; then run:

```powershell
npx --no-install supabase db push --linked
npx --no-install supabase migration list --linked
node scripts/verify-migration-parity.mjs
```

Expected after apply: local and linked migration histories match exactly.

- [ ] **Step 6: Contain every pre-existing shared OpenAI credential before public deployment**

Before relying on `ANALYSIS_MODE`, neutralize older immutable deployments that may contain a valid key and old code that does not understand the new mode:

1. The owner revokes every pre-existing InOrdo/shared OpenAI API key at the OpenAI project. Record only the revocation status and timestamp.
2. Remove `OPENAI_API_KEY` from Vercel Production, Preview, and Development if present, without inspecting a value:

```powershell
npx --yes vercel@56.3.2 env rm OPENAI_API_KEY production --scope chi944s-projects
npx --yes vercel@56.3.2 env rm OPENAI_API_KEY preview --scope chi944s-projects
npx --yes vercel@56.3.2 env rm OPENAI_API_KEY development --scope chi944s-projects
```

3. The owner opens `.env.local` in their editor and deletes only the `OPENAI_API_KEY` entry. Codex must not read, print, parse, diff, or otherwise inspect that file. Provider-side revocation is the security boundary even if a local copy is missed.
4. Confirm no purpose-specific recording key exists yet. A fresh key is created only in Task 6 and is never added to `.env.local`.

If the owner cannot confirm provider-side revocation, stop public release work and report this as a security blocker.

- [ ] **Step 7: Deploy reviewed `main` with AI disabled**

Verify the Vercel project is exactly `inordo` in the expected team and Git source is the shared repository. Set non-secret `ANALYSIS_MODE=disabled`, verify all required non-secret names/configurations exist without reading secret values, and deploy reviewed `main`. Record only deployment URL, deployment ID, Git SHA, time, and generic `/api/health` response.

- [ ] **Step 8: Verify the canonical disabled deployment and older snapshots**

In a fresh signed-out and authenticated session, verify login, project catalog, synthetic project, ordinary preview, persisted records, and disabled analysis message. Confirm the message states that no paid request was made and no project item/proposal changed. Test an older deployment URL if accessible; it must not have a valid paid credential.

- [ ] **Step 9: Create the short-lived release-evidence branch**

After `main` is integrated and deployed, branch before making any operational evidence commit:

```powershell
git switch main
git pull --ff-only origin main
git switch -c codex/20-submission-release
```

All remaining repository edits in this plan stay on `codex/20-submission-release` until Task 9 creates and merges a reviewed PR. Do not commit release evidence directly to `main`.

- [ ] **Step 10: Commit non-secret release documentation**

```powershell
git add docs/deployment-runbook.md docs/local-run-and-test.md docs/qa-checklist.md docs/release-evidence.md docs/rollback-plan.md docs/codex-log.md
git diff --cached --check
git commit -m "docs: record production release controls"
```

### Task 4: Configure the capped fallback and provision operator/judge access

**Files:**

- Modify: `docs/demo-user-setup.md`
- Modify: `docs/security-review.md`
- Modify: `docs/qa-checklist.md`
- Modify: `docs/release-evidence.md`
- Modify: `docs/devpost-handoff.md`

- [ ] **Step 1: Verify the dedicated Gateway cost boundary**

In Vercel AI Gateway, create or inspect a purpose-specific key. Confirm without exposing the key:

- model path is fixed in the app to `openai/gpt-oss-20b`;
- hard quota is USD 1 or less;
- refresh period is `none`/non-renewing;
- automatic top-up is disabled;
- no implicit Vercel OIDC credential path is accepted when this explicit key is absent.

If any property cannot be enforced or independently observed, stop fallback setup and retain `ANALYSIS_MODE=disabled`. Record only provider, upper bound, refresh mode, top-up state, and verification timestamp.

- [ ] **Step 2: Add the Gateway credential to Preview through hidden input only**

Keep canonical Production at `ANALYSIS_MODE=disabled`. The owner uses Vercel Dashboard or the CLI's interactive sensitive prompt to configure a protected Preview only. First verify CLI syntax:

```powershell
npx --yes vercel@56.3.2 env add --help
```

Then invoke the interactive prompt without a value argument:

```powershell
npx --yes vercel@56.3.2 env add AI_GATEWAY_API_KEY preview --force --sensitive --scope chi944s-projects
```

Do not pipe, echo, paste into task chat, or inspect the resulting value. Set Preview `AI_GATEWAY_MODEL=openai/gpt-oss-20b` and Preview `ANALYSIS_MODE=auto` only after Step 1 succeeds. Verify the Preview is protected from anonymous access and uses the reviewed application SHA. Production remains disabled throughout this task.

- [ ] **Step 3: Provision the owner issuer, operator, and judge through Supabase's secret-safe UI**

First verify that the project owner's real Auth profile exists and has `owner` membership in the synthetic workspace. This is the audited grant issuer; do not use a fictional seed UUID or elevate the recording operator. If the real owner profile is absent, provision it through the controlled owner bootstrap. Then create:

- one operator Auth user mapped to the synthetic workspace as `admin`;
- one judge Auth user mapped to the same workspace as `viewer`.

For each identity, verify the Auth trigger created a matching `public.profiles` row, then use the reviewed owner procedure to add exactly the intended membership. The owner issuer, operator target actor, and judge remain three distinct attributable identities. Actual emails, passwords, UUIDs, and sessions stay out of Git, shell output, screenshots, and task messages.

- [ ] **Step 4: Run the real two-stage GPT-OSS compatibility check in protected Preview**

As the recording operator, submit one bounded, fully synthetic update through the protected Preview. Verify all of the following from persisted state and safe UI output:

- extraction satisfies the current strict change schema;
- proposal drafting satisfies the current strict action schema;
- canonical identifier/value/date/evidence-span checks pass;
- persisted provider/model attribution is `Vercel AI Gateway · GPT-OSS 20B` / `openai/gpt-oss-20b`;
- deterministic TypeScript, not the model, produces the impact paths;
- no project item, dependency, or operation changes without explicit approval;
- invalid output, timeout, or quota failure produces the approved failed-analysis state and no derived proposal/item mutation.

Do not approve any action during this compatibility run. Whether it succeeds or fails, run the scoped synthetic demo reset afterward and verify the canonical recording source has no terminal duplicate. If compatibility fails, remove `AI_GATEWAY_API_KEY` from Preview, set Preview mode to `disabled`, redeploy, record fallback as unavailable, and do not configure it in Production later.

After a successful check, still remove the Preview credential and return Preview to disabled so the capped key is not left on an unnecessary deployment:

```powershell
npx --yes vercel@56.3.2 env rm AI_GATEWAY_API_KEY preview --scope chi944s-projects
```

Retain only the non-secret compatibility result and cost-control attestation. The owner will enter the capped key into Production after the paid recording is revoked.

- [ ] **Step 5: Verify operator and judge sessions separately**

Use fresh private browser profiles. The judge must open overview, projects, items, item details, decisions, risks, dependencies, evidence, impact paths, proposal details, operation history, and ordinary-project preview. It must be unable to analyze, create/update items, create/remove dependencies, apply, undo, reset, or delete. Test both the UI state and direct server requests. The operator must have the expected admin flows but no owner-only account-management shortcut.

- [ ] **Step 6: Verify provider denial under the judge identity**

Submit an analysis request directly as the viewer and confirm authorization rejects before a grant query, claim, adapter construction, evidence write, or network call. Confirm no analysis/evidence row count changes. The UI must say the persisted synthetic result is available while this account cannot start an AI request.

- [ ] **Step 7: Record credential-safe provisioning and compatibility evidence**

Update docs with role names, successful/failed route matrix, timestamps, and retirement procedure only. `docs/devpost-handoff.md` describes where the owner will type judge credentials privately but contains no credential value.

- [ ] **Step 8: Commit the account and security procedures**

```powershell
git add docs/demo-user-setup.md docs/security-review.md docs/qa-checklist.md docs/release-evidence.md docs/devpost-handoff.md
git diff --cached --check
git commit -m "docs: add judge access and provider release evidence"
```

### Task 5: Complete every currently available Devpost draft field

**Files:**

- Modify: `docs/devpost-handoff.md`
- Modify: `docs/submission-copy.md`
- Modify: `docs/submission-checklist.md`
- Modify: `docs/release-evidence.md`
- Modify: `docs/codex-log.md`

- [ ] **Step 1: Re-derive the connected InOrdo draft before any write**

Open the currently connected Devpost project read-only and confirm its title, owner/team, current URL, and draft state. Do not rely on a historical numeric ID or slug. If the connected project is not clearly the team's InOrdo draft, stop without editing and report the mismatch.

- [ ] **Step 2: Reconcile the available story against deployed behavior**

Prepare accurate copy for the problem, evidence-preservation approach, bounded GPT-5.6 role, deterministic graph, human approval, reversible history, read-only judge experience, ordinary-project informational preview, supported input scope, Codex contribution, challenges, and next steps. Describe missing files/connectors and ordinary-workspace provisioning as unavailable/planned, never as working.

- [ ] **Step 3: Fill and save all non-media public fields**

Use:

- Name: `InOrdo`
- Elevator pitch: `Turn project updates into evidence-backed, human-approved recovery actions.`
- Track: `Work & Productivity`
- Try it out: `https://inordo.vercel.app`
- Repository: `https://github.com/Chi944/InOrdo-Hackathon`
- Built with: `Next.js`, `React`, `TypeScript`, `Tailwind CSS`, `Supabase`, `PostgreSQL`, `OpenAI API`, `GPT-5.6`, `GPT-OSS`, `Vercel`, `Vitest`, `Playwright`, `Codex`
- Feedback: the exact primary `/feedback` Codex Session ID supplied by the owner

Fill the verified story and save the draft. Leave only genuinely media-dependent fields, such as the final YouTube URL and final thumbnail, incomplete. Do not add a temporary or fabricated URL.

- [ ] **Step 4: Enter judge access only in Devpost's private testing field**

The owner enters the actual dedicated judge email and password directly in Devpost's private field, together with the stable credential-safe instructions from `docs/devpost-handoff.md`. Verify the field is private before entering anything. Omit the mutually exclusive recording-outcome sentence until Task 8 knows the verified result; do not guess it. Neither Codex nor repository documentation may receive or repeat the values.

- [ ] **Step 5: Invite Andres immediately**

Invite Andres using the owner-provided Devpost identity and ask him to accept before the deadline. Record only invitation/acceptance status, never his private account details. Do not wait for the voice files to complete this team gate.

- [ ] **Step 6: Save without final submission and record the remaining media gates**

Save the draft, do not click **Submit**, and record only non-secret completion states. The expected remaining Devpost work is the truthful recording-outcome sentence, verified YouTube URL, real thumbnail, final signed-out link check, teammate acceptance if pending, and action-time submission confirmation.

- [ ] **Step 7: Commit the non-secret draft handoff**

```powershell
git add docs/devpost-handoff.md docs/submission-copy.md docs/submission-checklist.md docs/release-evidence.md docs/codex-log.md
git diff --cached --check
git commit -m "docs: prepare Devpost submission draft"
```

### Task 6: Perform the exact one-use Production recording and revoke the paid key

**Files:**

- Modify: `docs/qa-checklist.md`
- Modify: `docs/release-evidence.md`
- Modify: `docs/submission-checklist.md`
- Modify: `docs/codex-log.md`
- Create outside Git: the seven raw Production captures

- [ ] **Step 1: Freeze and verify the recording inputs**

Verify exact Production SHA and migration parity, operator identity, project UUID, normalized source hash, current project revision, reset state, viewer denial, and absence of a terminal duplicate. Do not print identifiers or source hash. If a terminal claim exists for the exact revision/source, perform the documented scoped synthetic reset before grant issuance; do not try to bypass it with a second source spelling.

- [ ] **Step 2: Create the fresh purpose-specific key and switch Production to recording intent**

Only after Task 3 revoked every earlier key, the owner creates one fresh purpose-specific key in the OpenAI API project. Verify CLI syntax, set the non-secret mode to `recording`, and set the exact allowlisted `OPENAI_MODEL` to `gpt-5.6-luna`. The owner enters the new key through Vercel Dashboard or the interactive sensitive prompt only:

```powershell
npx --yes vercel@56.3.2 env add --help
npx --yes vercel@56.3.2 env add OPENAI_API_KEY production --force --sensitive --scope chi944s-projects
```

Do not reveal or inspect the value and do not add this fresh key to `.env.local`, Preview, or Development. Redeploy reviewed `main` and verify generic readiness without claiming grant eligibility.

- [ ] **Step 3: Issue one exact, short-lived recording grant**

Through the audited Supabase owner procedure, the distinct real workspace owner issues one grant for the exact operator/project/normalized-hash tuple with expiry no more than 15 minutes ahead. The procedure returns only grant ID, state, and expiry; do not copy any of those into public docs or task output.

- [ ] **Step 4: Capture the one live GPT-5.6 journey**

Record Production at 1920×1080: source evidence, validated extraction, deterministic impact paths, proposal review, selective approval, operation history, and compensating undo. Do not expose dashboards, developer tools, environment panels, account email, password managers, notifications, or browser autofill. Run exactly one analysis. If capture fails after a successful provider response, re-record the persisted state without another analysis.

- [ ] **Step 5: Classify the single attempt without exercising replay**

Use `private.verify_analysis_recording_grant(grant_id, owner_id)` through the audited Supabase owner procedure. Require `status = claimed` and `claim_consistent = true`; do not copy its private inputs/output identifiers and do not submit the source again while the paid key is valid.

For a successful attempt, confirm the raw capture opens and plays, the analysis is completed, provider/model attribution is accurate, the exact evidence span and graph paths are visible, and the selective operation plus compensating undo remain persisted.

If the provider attempt is absent, failed, invalid, or the capture does not contain a verified result, do not issue another grant automatically. Continue immediately to credential revocation. After teardown, present exactly two branches to the owner:

1. explicitly authorize one diagnosed retry with a newly created purpose-specific key and grant; or
2. make no retry, remove every “recorded GPT-5.6 result” claim from scripts, thumbnail, README, Devpost, judge instructions, and release evidence, and show the truthful disabled/failed state instead.

For the no-retry branch, replace D1's opening with: `InOrdo's GPT-5.6 integration is designed for two bounded server-side jobs: structured change extraction and recovery-action drafting. In this public release, live paid analysis is disabled; the model has no tools and cannot write a project record.` Replace the thumbnail badge with `Bounded AI contract + deterministic dependency graph`, use the no-verified-result judge sentence from the judge plan, and remove any shot that labels a failed or seeded result as the new paid run. Never preserve a successful-result claim after a failed single attempt.

- [ ] **Step 6: Announce the revocation gate and revoke in the correct order**

For a successful, playable recording report this exact sentence to the owner:

> The recording is secured; revoke the OpenAI key now.

For a failed attempt, report that the single attempt was not verified and that revocation is starting; do not use the success sentence. In both branches, immediately revoke/delete the purpose-specific key in the OpenAI API project first. Then remove it from Vercel without reading it:

```powershell
npx --yes vercel@56.3.2 env rm OPENAI_API_KEY production --scope chi944s-projects
```

The owner confirms in their editor that `.env.local` still contains no `OPENAI_API_KEY`; Codex does not open or inspect the file.

If and only if Task 4's hard-cap and two-stage Preview compatibility checks passed, the owner enters the capped `AI_GATEWAY_API_KEY` into Vercel Production through the hidden sensitive prompt:

```powershell
npx --yes vercel@56.3.2 env add AI_GATEWAY_API_KEY production --force --sensitive --scope chi944s-projects
```

Then set `AI_GATEWAY_MODEL=openai/gpt-oss-20b` and `ANALYSIS_MODE=auto`. Otherwise set Production to `disabled` and ensure no Gateway key is present there. Redeploy. Production was never `auto` before this teardown. This sequence is mandatory because older immutable deployments may retain previous environment snapshots until the OpenAI key is revoked at the provider.

- [ ] **Step 7: Verify post-revocation Production**

Test canonical and any accessible older deployment URL. The judge remains read-only and no URL can spend the revoked OpenAI key. Only after revocation, submit the exact source again as the operator and verify the existing duplicate is returned without a provider call. Through an owner-only transaction, verify the claimed grant cannot transition back to `available` or link to a second request; roll back the test transaction and preserve the terminal row. For the success branch, the persisted GPT-5.6 result, proposal, operation, and undo remain visible. Do not reset Production after recording.

- [ ] **Step 8: Record non-secret evidence and commit**

Record timestamps, success/failed branch, mode, route/result statuses, key-revoked yes/no, local-entry-removed owner attestation, Vercel-variable-removed yes/no, deployment SHA/URL, and replay-denied yes/no. Do not record account/provider identifiers or request content.

```powershell
git add docs/qa-checklist.md docs/release-evidence.md docs/submission-checklist.md docs/codex-log.md
git diff --cached --check
git commit -m "docs: record production analysis outcome"
```

### Task 7: Assemble, validate, and hand off the demonstration media

**Files:**

- Read outside Git: raw captures and voiceover WAV files
- Create outside Git: edit project, review export, final MP4, thumbnail PNG
- Modify: `docs/qa-checklist.md`
- Modify: `docs/release-evidence.md`
- Modify: `docs/submission-copy.md`
- Modify: `docs/devpost-handoff.md`

- [ ] **Step 1: Validate the supplied voice recordings before editing**

```powershell
ffprobe -v error -show_entries stream=codec_name,sample_rate,channels,bits_per_sample -of json 'C:\Users\User\Videos\InOrdo-Build-Week\02-voiceover\andres\Andres.wav'
ffprobe -v error -show_entries stream=codec_name,sample_rate,channels,bits_per_sample -of json 'C:\Users\User\Videos\InOrdo-Build-Week\02-voiceover\deston\Deston.wav'
ffmpeg -hide_banner -i 'C:\Users\User\Videos\InOrdo-Build-Week\02-voiceover\andres\Andres.wav' -af volumedetect -f null NUL
ffmpeg -hide_banner -i 'C:\Users\User\Videos\InOrdo-Build-Week\02-voiceover\deston\Deston.wav' -af volumedetect -f null NUL
```

Expected: PCM WAV, 48,000 Hz, mono, 24-bit, and `max_volume` no higher than −1.0 dBFS for each source. A reported 0.0 dBFS or sample peak above −1.0 dBFS fails the source check and requires a corrected export. If a file is missing or unusable, stop editing and request a replacement; do not synthesize either teammate's voice without explicit authorization.

- [ ] **Step 2: Assemble the approved 2:47 timeline**

Use the exact time slots from Task 2. Show only genuine Production behavior. Use captions and restrained transitions; remove dead time while preserving enough hold time to read the source evidence, deterministic path, proposal, selected action, history, and undo. Do not imply unavailable ordinary project or connector functionality.

- [ ] **Step 3: Mix and export the review master**

Target H.264 High, 1920×1080, `yuv420p`, CRF 16–18, AAC 48 kHz at 256 kbps, approximately −14 LUFS integrated, no peak above −1 dBTP, and total duration 2:40–2:50. Export to `05-exports\review` first and review it end to end with headphones and speakers.

- [ ] **Step 4: Produce the genuine-UI thumbnail**

Use the approved brief and a privacy-checked frame from the final Production recording. Export `05-exports\final\inordo-thumbnail-1280x720.png`. Verify text legibility at small size and compare all claims with the recorded behavior.

- [ ] **Step 5: Export and technically validate the final video**

```powershell
$finalVideo = 'C:\Users\User\Videos\InOrdo-Build-Week\05-exports\final\inordo-build-week-demo-final.mp4'

ffprobe -v error -show_entries 'format=duration:stream=index,codec_name,codec_type,profile,width,height,pix_fmt,sample_rate,channels' -of json $finalVideo

$duration = [double](
  ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 $finalVideo
)
if ($duration -ge 180) {
  throw "Video exceeds three minutes: $duration seconds"
}

ffmpeg -hide_banner -i $finalVideo -filter_complex 'ebur128=peak=true' -f null NUL
```

Expected: under 180 seconds, H.264 High, 1920×1080, `yuv420p`, AAC 48 kHz, approximately −14 LUFS, no peak above −1 dBTP. Watch the exact final file from beginning to end before upload.

- [ ] **Step 6: Hand the verified media to the owner for YouTube upload**

Provide the owner with the exact final MP4 and thumbnail paths plus accurate title/description copy, repository link, and Production link. The owner uploads to YouTube as requested. Publish as Public or Unlisted only if the current Build Week rules accept that visibility. After the owner returns the URL, open it signed out, confirm audio/video playback and duration, and record the URL. Do not expose judge credentials in the description, captions, or comments. If the owner has not uploaded yet, continue every non-video submission check and report the YouTube URL as the single media handoff gate rather than attempting the upload.

- [ ] **Step 7: Remove the private browser profile after all capture work**

Resolve and verify the exact target `C:\Users\User\Videos\InOrdo-Build-Week\99-private-temp\browser-profile`, confirm it is beneath the media root and contains no needed media, then remove only that directory with native PowerShell. Report that the private profile is not recoverable; do not remove the surrounding media workspace.

- [ ] **Step 8: Record media evidence and commit**

Record only final filename, technical properties, public YouTube URL, signed-out verification, and thumbnail filename.

```powershell
git add docs/qa-checklist.md docs/release-evidence.md docs/submission-copy.md docs/devpost-handoff.md
git diff --cached --check
git commit -m "docs: record final demo media"
```

### Task 8: Finalize and verify the Devpost draft

**Files:**

- Modify: `docs/devpost-handoff.md`
- Modify: `docs/submission-copy.md`
- Modify: `docs/submission-checklist.md`
- Modify: `docs/release-evidence.md`
- Modify: `README.md`
- Modify: `docs/codex-log.md`

- [ ] **Step 1: Reconcile public copy against deployed evidence**

Every public claim must be demonstrable in Production or clearly described as planned. Include exact-text/manual-note inputs, meeting minutes/summaries, deterministic graph traversal, human approval, reversible operations, read-only judge access, ordinary-project informational preview, and the current GPT-OSS/disabled mode. Include “one recorded bounded GPT-5.6 result” only if Task 6 took the verified-success branch; otherwise use the truthful failed/disabled wording required there. Remove obsolete gates and unverified claims.

- [ ] **Step 2: Prepare the non-secret Devpost fields**

Use:

- Name: `InOrdo`
- Elevator pitch: `Turn project updates into evidence-backed, human-approved recovery actions.`
- Track: `Work & Productivity`
- Try it out: `https://inordo.vercel.app`
- Repository: `https://github.com/Chi944/InOrdo-Hackathon`
- Built with: `Next.js`, `React`, `TypeScript`, `Tailwind CSS`, `Supabase`, `PostgreSQL`, `OpenAI API`, `GPT-5.6`, `GPT-OSS`, `Vercel`, `Vitest`, `Playwright`, `Codex`
- Video: final verified public YouTube URL
- Feedback: exact primary `/feedback` Codex Session ID supplied by the owner
- Team: invite Andres using the owner-provided Devpost identity; Andres must accept

Re-derive and verify the currently connected InOrdo draft exactly as in Task 5 before editing; do not trust or publish a historical numeric project ID or slug.

- [ ] **Step 3: Add private judge instructions without leaking credentials**

Use this body, with actual email and password entered by the owner only in Devpost's private field:

> Production URL: https://inordo.vercel.app
> Login: https://inordo.vercel.app/login
> Judge email: entered privately by the project owner
> Judge password: entered privately by the project owner
>
> This is a dedicated read-only viewer account for the fully synthetic “Regional Climate Action Summit 2026” workspace. You can open the project overview, items and item details, decisions, risks, dependencies, preserved source evidence, deterministic impact paths, recovery proposals, and operation history. You cannot analyze, create, edit, apply, undo, reset, or delete; those restrictions are enforced by server authorization and Supabase row-level security.
>
> The visible GPT-5.6 result is the same persisted synthetic result shown in the demo video. Live paid OpenAI analysis is disabled for this judge account and will not consume the team's API budget.
>
> Suggested path: sign in → Projects → Regional Climate Action Summit 2026 → Items → Dependencies → latest impact review and proposal → Operation history → Projects → ordinary-project informational preview.
>
> All names and project data are synthetic.

The preceding recorded-result sentence is permitted only for Task 6's verified-success branch; replace it with truthful failed/disabled copy otherwise. The actual credential lines must already have been entered privately in Task 5. Verify them in Devpost without copying their values into task output or Git.

- [ ] **Step 4: Fill and save the Devpost draft**

Using the connected browser session, preserve the verified fields from Task 5, upload the real thumbnail, add the owner-supplied verified YouTube URL, and save the draft. Do not click final **Submit**. If a field's privacy is ambiguous, leave it empty and report the blocker instead of placing a credential in a public field.

- [ ] **Step 5: Verify teammate and draft completeness**

Confirm Andres has accepted, the category and built-with tags are selected, the story accurately describes Codex and GPT-5.6, the primary `/feedback` Session ID is present, the video is public/unlisted as allowed, and no required field is missing. Record only non-secret completion states.

- [ ] **Step 6: Run a public unfinished-copy and claim scan**

```powershell
$unfinishedMarkers = @(
  ('T' + 'BD'),
  ('T' + 'ODO'),
  ('FIX' + 'ME'),
  ('place' + 'holder'),
  'coming soon',
  'unfunded',
  'unverified',
  'password',
  'judge email'
)
rg -n -i ($unfinishedMarkers -join '|') README.md docs --glob '!docs/superpowers/plans/**'
git diff --check
```

Review every match. Legitimate security instructions may use `password`; no actual password/email, obsolete submission marker, or public stand-in may remain.

- [ ] **Step 7: Commit the final public documentation**

```powershell
git add README.md docs/devpost-handoff.md docs/submission-copy.md docs/submission-checklist.md docs/release-evidence.md docs/codex-log.md
git diff --cached --check
git commit -m "docs: finalize Build Week submission handoff"
```

### Task 9: Run the signed-out release gate and request final submission confirmation

**Files:**

- Modify: `docs/submission-checklist.md`
- Modify: `docs/qa-checklist.md`
- Modify: `docs/release-evidence.md`
- Modify: `docs/codex-log.md`

- [ ] **Step 1: Re-run the repository gate on the exact final commit**

```powershell
$nodeRoot = 'C:\Users\User\AppData\Local\Temp\inordo-node-v22.23.1\runtime\node-v22.23.1-win-x64'
$env:Path = "$nodeRoot;$env:Path"

node --version
npm --version
npm ci
npm run lint
npm run typecheck
npm run test:run
npm run test:e2e
npm run build
npm audit --omit=dev
git diff --check
git status --short
git rev-parse HEAD
```

Expected: every command exits 0, the worktree is clean, and the SHA is the release-evidence branch candidate that will be reviewed in the final PR.

- [ ] **Step 2: Verify all public links signed out**

Open the repository, `https://inordo.vercel.app`, `/login`, YouTube video, and public Devpost preview in a fresh signed-out browser. Confirm correct project name, no Vercel protection wall, no private source, no account identifier, no broken asset, and no stale “hackathon” deployment suffix.

- [ ] **Step 3: Verify the dedicated judge journey one final time**

The owner enters credentials only into a fresh private browser. Follow the exact Devpost path and repeat the denial matrix. On Task 6's success branch, confirm the recorded result remains visible; on the failed/no-retry branch, confirm the truthful disabled/failed state. In both cases no paid provider request is initiated. Sign out and close the private profile.

- [ ] **Step 4: Verify schema, provider, and deployment containment**

Confirm migration parity, generic health, exact Production SHA, OpenAI key revoked at provider, Vercel OpenAI variable absent, Gateway hard cap/non-renewing/no-top-up or disabled mode, recording grant replay denial, and no paid access from older deployment URLs.

- [ ] **Step 5: Verify submission completeness and deadline**

Confirm the current Build Week rules and deadline from the official Devpost page at execution time. Verify title, story, track, built-with list, Production URL, repository, video, thumbnail, audio, Codex/GPT-5.6 explanation, primary `/feedback` Session ID, private judge credentials, synthetic-data notice, and Andres's accepted team membership.

- [ ] **Step 6: Record the final non-secret evidence**

Update the four docs with exact date, final SHA, Production deployment, migration parity, automated results, signed-out link status, judge journey pass/fail, key-revoked status, fallback-control status, video technical result, and Devpost completeness. Do not include private fields.

- [ ] **Step 7: Commit and open the final release-evidence pull request**

```powershell
git add docs/submission-checklist.md docs/qa-checklist.md docs/release-evidence.md docs/codex-log.md
git diff --cached --check
git commit -m "docs: record final submission verification"
git push --set-upstream origin codex/20-submission-release
gh pr create --base main --head codex/20-submission-release --title "docs: finalize InOrdo submission release" --fill
```

Review the generated PR body and verify it contains no credential value or private field. Wait for CI and review; do not merge a failing or stale head:

```powershell
$releasePrUrl = (gh pr view codex/20-submission-release --json url --jq '.url')
gh pr checks $releasePrUrl --watch
gh pr merge $releasePrUrl --merge --delete-branch
git switch main
git pull --ff-only origin main
```

Record the public PR URL and merge status. Do not force-push or merge locally around GitHub's review result.

- [ ] **Step 8: Verify the merged `main` and resulting Production deployment**

Run `git rev-parse HEAD`, confirm it equals `origin/main`, wait for Vercel to deploy that exact merge commit, and repeat `/api/health`, signed-out Production, login, repository, YouTube, and Devpost link checks. Report the final merge/deployment SHA in the task handoff; do not create an infinite follow-up commit merely to record its own SHA.

- [ ] **Step 9: Request fresh confirmation for final Devpost submission**

Present the owner with a concise evidence table and any remaining failure. Only when every required gate passes, ask: `The Devpost draft is complete and all signed-out checks pass. Do you authorize clicking Submit now?`

Do not click **Submit** without that reply. After authorization, submit once, verify the confirmation page and public entry, and record only the public submission URL.

- [ ] **Step 10: Schedule post-judging retirement as an explicit owner action**

After judging closes on 10 August 2026 at 00:00 UTC, disable the dedicated judge Auth user, remove its viewer membership, and invalidate/rotate the shared judge password while preserving actor references and audit history. Verify no paid provider credential remains.

## Plan-wide completion audit

- [ ] Every approved specification section is covered by at least one task and verification step.
- [ ] All credential entry points are secret-safe and all repository/public outputs are credential-free.
- [ ] The provider lifecycle has one-use grant, replay denial, immediate provider revocation, Vercel removal, redeploy, and older-deployment checks.
- [ ] The judge lifecycle has viewer provisioning, full read journey, direct mutation denials, private handoff, and retirement.
- [ ] The media lifecycle has scripts, capture mapping, voice validation, genuine thumbnail, technical validation, owner upload handoff, signed-out verification, and no Higgsfield spend.
- [ ] The Devpost lifecycle has a saved draft, teammate acceptance, primary `/feedback` Session ID, signed-out links, action-time confirmation, and public submission verification.
- [ ] No unfinished-work marker, vague stand-in text, secret value, or unverified success claim remains in the plan package.
- [ ] Type names, route names, migration filenames, command paths, and cross-plan dependencies are consistent.
