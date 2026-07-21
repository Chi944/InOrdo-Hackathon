# Local run and test guide

This guide gives Deston on Windows and Andres on macOS repeatable, role-appropriate workflows. It uses the hosted InOrdo Supabase project and the manually linked Vercel project; Docker is not required unless someone intentionally starts a disposable local Supabase stack.

## Shared safety rules

- Use Node.js 22.x. Confirm with `node --version` before installing dependencies.
- Never commit, paste, screenshot, or send `.env.local`, passwords, API keys, cookies, service-role values, or reset secrets.
- Grant only the provider access required for the assigned work. Deston owns privileged database, deployment, reset, and model configuration. Andres's normal interface QA does not require a service-role key, reset secret, OpenAI key, or Vercel Production-secret access.
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are browser-configured values. Every other configured name is server-only.
- Provider readiness is mode-specific. Disabled mode performs no provider request; recording and Gateway fallback remain unavailable until their separately documented configuration and authorization gates pass.
- Use only the fictional Regional Climate Action Summit workspace and the operator-provisioned demo Auth account.

The current environment contract is the following ten names from `.env.example`; this names-only inventory is not evidence that any value is configured locally or on Vercel:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
OPENAI_MODEL
DEMO_PROJECT_SLUG
DEMO_RESET_SECRET
ANALYSIS_MODE
AI_GATEWAY_API_KEY
AI_GATEWAY_MODEL
```

Deston's privileged local values remain only in the ignored local file and approved provider secret stores. Andres should prefer the deployed production application for authenticated interface QA. For local read-only inspection, configure only the two browser-safe Supabase names and the demo-project selector through an authorized private source, retain disabled analysis mode, and use an operator-provisioned account. Provider model names in `.env.example` do not enable a request without the matching mode and credential. Every credential and privileged server value remains absent from Andres's least-privilege setup.

A Vercel CLI-managed `VERCEL_OIDC_TOKEN`, if present, is also a secret: do not inspect, copy, document, or commit it. If Andres is later assigned a specific privileged local operation, the project owner must approve the narrow access and deliver each required server value through the approved secret manager; never grant the full secret set merely for environment parity.

## Deston: Windows setup

Use PowerShell. Install Git and a Node version manager if they are not already available. With nvm-windows, select Node 22 and then verify the active runtime:

```powershell
nvm install 22.23.1
nvm use 22.23.1
node --version
npm --version
```

Clone and install from a clean checkout:

```powershell
git clone https://github.com/Chi944/InOrdo-Hackathon.git
Set-Location InOrdo-Hackathon
git switch main
git pull --ff-only origin main
npm ci
```

Link the checkout to the existing Vercel project and confirm the Production variable **names and scopes**. Public configuration and sensitive credentials have different visibility rules; do not use `vercel env pull` as a teammate secret-distribution mechanism or assume every Production value is recoverable:

```powershell
npx --yes vercel@56.3.2 login
npx --yes vercel@56.3.2 link --yes --project inordo --scope chi944s-projects
npx --yes vercel@56.3.2 env ls production --scope chi944s-projects
if (-not (Test-Path -LiteralPath .env.local)) {
    Copy-Item -LiteralPath .env.example -Destination .env.local
}
git check-ignore -q .env.local
git status --short
```

Populate only the names authorized for the intended local role through a private editor or approved secret manager. Full local configuration and a ready health response need the two public Supabase values plus the server-only Supabase, project-selector, and reset configuration; provider credentials are optional and must remain absent unless the corresponding recording or Gateway gate is deliberately being exercised. `git check-ignore -q` must exit successfully and `git status --short` must not list the file. Never use `Get-Content`, `type`, `echo`, or a shell argument to inspect or set a value.

## Andres: macOS setup

Use Terminal with zsh or bash. With nvm, select Node 22 and verify it before installing:

```bash
nvm install 22
nvm use 22
node --version
npm --version
```

Clone and install from a clean checkout:

```bash
git clone https://github.com/Chi944/InOrdo-Hackathon.git
cd InOrdo-Hackathon
git switch main
git pull --ff-only origin main
npm ci
```

For routine interface work, Andres does not need to link Vercel or list Production variables. Prefer the deployed production URL for the final authenticated QA. For an optional local Auth/UI pass, create the ignored local file and populate the two browser-safe Supabase names through an authorized project source plus the fixed, non-secret demo-project slug:

```bash
if [ ! -e .env.local ]; then
  cp .env.example .env.local
fi
git check-ignore -q .env.local
git status --short
```

Populate only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `DEMO_PROJECT_SLUG` through an authorized private source. Keep `ANALYSIS_MODE` disabled, retain the non-secret model defaults from `.env.example`, and leave both provider credentials plus `SUPABASE_SERVICE_ROLE_KEY` and `DEMO_RESET_SECRET` blank. The project selector is server-only but is not a credential. This least-privilege setup can browse the authenticated project through the user's RLS-scoped session, but health may report base configuration as not ready and reset, analysis, and privileged persistence remain unavailable. Do not send Andres Deston's `.env.local` or privileged values, and do not temporarily demote Production secrets into Preview or Development merely to make them pullable.

## Confirm the hosted Supabase link

This is Deston's read-only release verification. Andres should run it only if he is explicitly assigned database review and receives the corresponding provider role. It does not push or reset the database:

```bash
npx --no-install supabase login
# Privately compare the existing local link with the intended Dashboard
# project before continuing. Never place the project ref in Git or output.
npx --no-install supabase migration list --linked
```

The hosted rollout has exact parity through `20260721100000`. The exact `20260721100000_add_analysis_access_policy.sql` migration was applied after a sanitized linked-target match, a second dry run, and owner approval. Post-apply parity found no pending migration and linked database lint passed. Future migrations require their own target check, exact pending-set proof, dry run, fresh action-time approval, push, and parity/lint checks. Do not accept an older remote tail, a remote-only version, a gap, or an unexpected pending migration.

Never run `supabase db reset` against the hosted project. `npx --no-install supabase db reset` is only for a disposable local Supabase stack started with the repository configuration and Docker; it reconstructs the checked-in synthetic fixture and is unrelated to the application's history-preserving demo-reset operation. The application reset requires an authorized owner/admin, the configured synthetic project, privileged server configuration, and the server-held reset guard. Andres's least-privilege setup intentionally cannot reset. Run `supabase db push` only through the reviewed, fail-closed production sequence in `docs/deployment-runbook.md` when the exact migration is intentionally being released.

## Start the application

Windows PowerShell and macOS use the same application commands:

```bash
npm run dev
```

Open `http://localhost:3000`. In Deston's fully configured environment, verify:

- `/` renders the public landing page;
- `/login` renders the email/password form;
- signed-out `/app` redirects to `/login?next=%2Fapp`;
- `/api/health` returns generic `200 ready`; and
- the server log never exposes a value. Andres's least-privilege local setup may instead return `503 not_ready` and identify only intentionally absent privileged names from the fixed allowlist; that is expected and does not authorize live analysis.

Stop the development server with `Ctrl+C`.

Current Production at [inordo.vercel.app](https://inordo.vercel.app) was deployed directly from a clean worktree at reviewed source SHA `4f54cc1eec37d49aa6b1da6e0dafbc6f7d738d03`. It is in disabled analysis mode with no OpenAI key in any Vercel environment and no Production Gateway key. Public smoke returned health `200 ready`, landing/login `200`, and a signed-out protected-project redirect. A new live analysis is intentionally unavailable; the fresh authenticated disabled-message smoke remains pending.

## Automated verification

Run this full gate on both operating systems before handing off a commit:

```bash
npm run lint
npm run typecheck
npm run test:run
npx playwright install chromium
npm run test:e2e
npm run build
npm audit --omit=dev
git diff --check
git status --short
```

The guarded Playwright journey uses production components with provider/database seams intercepted. It is useful regression evidence, but it is not proof of live Auth, RLS, Supabase RPC, or OpenAI behavior.

To smoke the optimized build locally after `npm run build`:

```bash
npm run start
```

Then repeat the public route checks at `http://localhost:3000` and stop with `Ctrl+C`.

## Provision each teammate's demo account

Follow `docs/demo-user-setup.md`. Create the account in **Supabase Dashboard > Authentication > Users**, keep the password outside Git, and map that Auth UUID to the seeded `civic-futures-lab-demo` workspace using the reviewed SQL block in that document. Prefer a separate account for each teammate so actor attribution remains meaningful.

With the account configured:

1. Sign in at `/login` and confirm `/app` loads the synthetic summit workspace.
2. Open items, decisions, risks, and dependencies and verify the documented dependency direction.
3. Sign out and confirm `/app` no longer returns workspace data.
4. Try an invalid password and confirm the error is useful but reveals no Supabase detail.

## Full live workflow after an analysis route is authorized

This section targets **`https://inordo.vercel.app`**, not the local server. Do not run it until the release operator has selected exactly one bounded route, completed that route's credential and authorization gates, deployed the reviewed artifact, and confirmed `https://inordo.vercel.app/api/health` returns `200 ready` with the expected generic analysis state. Recording mode requires its exact one-use grant and recording-only provider setup. Auto mode requires the separately capped Gateway configuration. Disabled mode must present an honest unavailable message and perform no provider request. Open the production URL in a fresh private/incognito browser and sign in with the operator-provisioned synthetic account.

Provider secrets do not belong in a teammate's local setup by default. If authorized local live-provider testing is needed later, each tester must enter only the approved route's credential directly into the ignored `.env.local` through a private editor, select the matching mode, restart `npm run dev`, and require `http://localhost:3000/api/health` to return `200 ready` with the expected generic analysis state. Configuration readiness does not prove a recording grant, provider validity, funding, or quota. Never transmit a credential through Git, chat, email, terminal history, screenshots, or logs; remove it again when the local live test is complete.

Use the exact synthetic update from `docs/demo-scenario.md`:

> Venue update - 20 July 2026: The campus convention hall is unavailable on 12 September 2026. The venue team has offered 26 September 2026 instead. All other venue terms remain unchanged.

Then verify, without recording private bodies or credentials:

1. The source is preserved and the candidate change proposes `event_date` from `2026-09-12` to `2026-09-26`.
2. Deterministic direct and indirect paths appear, including event -> speaker confirmation -> programme lock -> briefing pack.
3. No project item changes before explicit human approval.
4. Select only an eligible reversible field update and leave any sensitive/human-input action pending.
5. Apply once, inspect actor-attributed ordered history, and confirm replay is idempotent.
6. Undo the reversible operation and confirm the original plus compensating operation both remain visible.
7. Exercise a stale-state conflict and confirm nothing is applied.
8. Reset only the named synthetic project and confirm 24 active records, 26 dependencies, the baseline event date, one generation advance, and retained archived history.
9. Verify viewer, nonmember, and cross-project attempts fail closed.

## Andres's interface review

After the authenticated workflow works, Andres should repeat it at approximately 375, 768, and 1440 CSS pixels. Check keyboard-only navigation, visible focus, dialog focus return, labels and headings, status/error announcements, reduced-motion behavior, and absence of horizontal overflow. Capture the protected-workspace screenshot or video only after this live pass, and label all data as synthetic.

## Deston's release review

Deston should confirm the linked migration ledger, generated database types, RLS/security advisors, health state, exact deployment SHA, provider model metadata, approval/undo/reset invariants, and rollback target. Record only safe IDs, counts, statuses, timestamps, and the actual model name; never record source bodies, prompts, output, credentials, cookies, or environment values.
