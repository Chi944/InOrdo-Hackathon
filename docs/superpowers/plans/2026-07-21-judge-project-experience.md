# Judge and Project Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give judges a truthful, navigable read-only experience, expose an honest ordinary-project informational preview, and describe currently supported inputs and provider state without inventing functionality.

**Architecture:** Existing server loaders remain fixed to the synthetic demo project. New presentational components add a project catalog and informational ordinary-project page, while the provider policy from the preceding plan supplies a secret-free `AnalysisAvailability` object. Existing role allowlists and RLS remain authoritative; UI gating is verified as defense in depth.

**Tech Stack:** Next.js App Router, React Server Components, TypeScript, Tailwind CSS, Supabase Auth/RLS, Testing Library, Vitest, Playwright.

## Global Constraints

- Execute after `2026-07-21-analysis-access-and-fallback.md` so `AnalysisAvailability` exists.
- Do not add project creation, invitations, switching, uploads, CSV parsing, URL fetching, voice, email, Slack, Teams, or Drive connectors.
- Meeting minutes and summaries remain `manual_note` text within the existing 12,000-character limit.
- Planned input methods appear only as non-interactive help text: no fake buttons, disabled uploads, or implied functionality.
- The ordinary-project destination is informational and never claims a workspace was provisioned.
- `viewer` may read and navigate but may not analyze, create, update, apply, undo, reset, remove, or delete.
- UI visibility is never treated as authorization; server role checks and RLS remain mandatory.
- Preserve Andres's existing visual language and responsive behavior.
- Never commit or display the judge email, password, Auth UUID, session, or any secret.
- Before every commit in this plan, run `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run test:e2e`, `npm run build`, and `git diff --check` under Node 22 in addition to each task's focused tests.
- Continue on the clean `codex/19-submission-production` branch created and verified by the analysis-access plan; never commit these changes directly to `main` or split the two interdependent plans across branches.

---

## File map

Create:

- `src/app/app/projects/project-catalog.tsx` — pure synthetic/ordinary project cards and input availability help.
- `src/app/app/projects/project-catalog.test.tsx` — accessible links, exact copy, and absence of fake controls.
- `src/app/app/projects/page.tsx` — protected server project index.
- `src/app/app/projects/ordinary/page.tsx` — informational ordinary-project page.
- `src/app/app/projects/ordinary/ordinary-project-notice.tsx` — pure informational component.
- `src/app/app/projects/ordinary/ordinary-project-notice.test.tsx` — exact limitation and navigation assertions.
- `src/app/app/analysis-provider-label.ts` and `.test.ts` — safe persisted model attribution.
- `src/app/app/project-navigation.test.tsx` — projects route and current-state coverage.
- `docs/devpost-handoff.md` — public field values and private testing-instruction procedure without credentials.

Modify:

- `src/app/app/project-view-data.ts` — add `loadProjectIndexView()` using existing demo authorization.
- `src/app/app/project-navigation.tsx` — add Projects.
- `src/app/app/page.tsx` — load safe analysis availability server-side.
- `src/app/app/impact-workflow.tsx`, `src/app/app/impact-workflow.test.tsx` — combine role and capability, show persisted provider attribution.
- `src/app/app/source-update-form.tsx`, `src/app/app/source-update-form.test.tsx` — dynamic provider/read-only status and honest input help.
- `src/app/app/items/project-items-view.test.tsx`, `src/app/app/items/project-item-editor.test.tsx`, `src/app/app/dependencies/dependency-view.test.tsx`, `src/app/app/recovery-action-review.test.tsx`, `src/app/app/demo-reset-control.test.tsx` — viewer control matrix.
- `src/features/project-records/operations.test.ts`, `src/features/operations/service.test.ts` — prove viewer denials occur before privileged persistence.
- `supabase/tests/verify_analysis_access_policy.sql` — full viewer direct-call denial matrix.
- `docs/demo-user-setup.md`, `docs/qa-checklist.md`, `docs/submission-copy.md`, `README.md`, `docs/codex-log.md` — judge provisioning, input scope, project limitation, and truthful claims.

### Task 1: Authenticated project catalog and ordinary preview

**Files:**

- Create: `src/app/app/projects/project-catalog.tsx`
- Create: `src/app/app/projects/project-catalog.test.tsx`
- Create: `src/app/app/projects/page.tsx`
- Create: `src/app/app/projects/ordinary/page.tsx`
- Create: `src/app/app/projects/ordinary/ordinary-project-notice.tsx`
- Create: `src/app/app/projects/ordinary/ordinary-project-notice.test.tsx`
- Modify: `src/app/app/project-view-data.ts`
- Modify: `src/app/app/project-navigation.tsx`
- Create: `src/app/app/project-navigation.test.tsx`

**Interfaces:**

- Produces `loadProjectIndexView(): Promise<{ overview: ProjectOverview; role: WorkspaceRole }>`.
- Produces `ProjectCatalog({ demoProject })` with no mutation callback.
- Produces routes `/app/projects` and `/app/projects/ordinary` under the existing authenticated layout.

- [ ] **Step 1: Write the catalog and notice tests first**

```tsx
render(
  <ProjectCatalog
    demoProject={{
      name: "Regional Climate Action Summit 2026",
      description: "Synthetic planning workspace.",
      itemCount: 24,
    }}
  />,
);

expect(screen.getByRole("link", { name: /open synthetic project/i }))
  .toHaveAttribute("href", "/app");
expect(screen.getByRole("link", { name: /ordinary project preview/i }))
  .toHaveAttribute("href", "/app/projects/ordinary");
expect(screen.queryByRole("button", { name: /create|invite|import/i }))
  .not.toBeInTheDocument();
```

The ordinary notice test must match this approved sentence exactly:

```text
InOrdo's records and authorization are project-scoped. Creating and using ordinary team workspaces is not available in this Build Week demo. This informational preview is intentionally separate from the live synthetic summit workspace.
```

- [ ] **Step 2: Run focused tests and confirm failure**

Run:

```bash
npm run test:run -- src/app/app/projects/project-catalog.test.tsx src/app/app/projects/ordinary/ordinary-project-notice.test.tsx
```

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Add the authorized index loader**

Reuse the private `resolveDemoProjectContext()` helper in `project-view-data.ts`:

```ts
export async function loadProjectIndexView() {
  const { client, scope } = await resolveDemoProjectContext();
  const overview = await getProjectOverview(client, scope);
  return { overview, role: scope.membership.role };
}
```

The server page passes only project name, description, and item count to the pure component. `AuthorizationError("unauthenticated")` continues to redirect through the protected layout; nonmembers receive the existing not-found behavior.

- [ ] **Step 4: Implement the restrained catalog**

The component renders two bordered cards:

```tsx
<Link href="/app" aria-label="Open synthetic project">
  <span>Synthetic workspace · Available</span>
  <h2>{demoProject.name}</h2>
  <p>{demoProject.itemCount} canonical records</p>
</Link>

<Link href="/app/projects/ordinary" aria-label="Open ordinary project preview">
  <span>Ordinary workspace · Informational preview</span>
  <h2>Team project</h2>
  <p>Project creation, invitations, and switching are not available in this Build Week demo.</p>
</Link>
```

Add no form, button, project identifier input, or disabled control.

- [ ] **Step 5: Add Projects navigation and test active state**

```ts
const projectLinks = [
  { href: "/app", label: "Overview" },
  { href: "/app/projects", label: "Projects" },
  { href: "/app/items", label: "Items" },
  { href: "/app/decisions", label: "Decisions" },
  { href: "/app/risks", label: "Risks" },
  { href: "/app/dependencies", label: "Dependencies" },
] as const;
```

Mock `usePathname()` as `/app/projects/ordinary` and assert only Projects has `aria-current="page"`.

- [ ] **Step 6: Run tests, typecheck, and commit**

```bash
npm run test:run -- src/app/app/projects/project-catalog.test.tsx src/app/app/projects/ordinary/ordinary-project-notice.test.tsx src/app/app/project-navigation.test.tsx
npm run typecheck
git add src/app/app/projects src/app/app/project-view-data.ts src/app/app/project-navigation.tsx src/app/app/project-navigation.test.tsx
git commit -m "feat: add project availability preview"
```

### Task 2: Honest provider and input presentation

**Files:**

- Create: `src/app/app/analysis-provider-label.ts`
- Create: `src/app/app/analysis-provider-label.test.ts`
- Modify: `src/app/app/page.tsx`
- Modify: `src/app/app/impact-workflow.tsx`
- Modify: `src/app/app/impact-workflow.test.tsx`
- Modify: `src/app/app/source-update-form.tsx`
- Modify: `src/app/app/source-update-form.test.tsx`

**Interfaces:**

- Consumes: `AnalysisAvailability` and `WorkspaceRole`.
- Produces: `analysisProviderLabel(modelName: string): string`.
- Changes `ImpactWorkflow` and `SourceUpdateForm` props to require `analysisAvailability`.

- [ ] **Step 1: Write model-label tests**

```ts
expect(analysisProviderLabel("openai/gpt-oss-20b"))
  .toBe("Vercel AI Gateway · GPT-OSS 20B");
expect(analysisProviderLabel("gpt-5.6-luna"))
  .toBe("OpenAI · GPT-5.6");
expect(analysisProviderLabel("gpt-5.6-luna-2026-07-01"))
  .toBe("OpenAI · GPT-5.6");
expect(analysisProviderLabel("provider/model-safe"))
  .toBe("Recorded model · provider/model-safe");
```

Reject unsafe/unbounded labels with the neutral `Recorded model` result; never render raw control characters or more than 120 characters.

- [ ] **Step 2: Extend component tests before implementation**

Add these assertions:

- `viewer` plus configured fallback shows “Read-only judge access” and makes no fetch when submit is attempted;
- disabled capability disables the contributor form and shows the approved disabled message;
- fallback capability says “Vercel AI Gateway · GPT-OSS 20B” without mentioning GPT-5.6 in progress copy;
- recording capability says configuration is ready but exact grant is checked on submission;
- manual note help names meeting minutes and meeting summaries;
- text says files, CSV, URLs, voice, email, Slack, Teams, and Google Drive are planned/unavailable;
- `queryByRole("button", { name: /upload|import|connect/i })` is absent.

- [ ] **Step 3: Tighten props and permission calculation**

```ts
type ImpactWorkflowProps = {
  data: ImpactWorkflowData;
  projectId: string;
  role: WorkspaceRole;
  syntheticWorkspace: boolean;
  analysisAvailability: AnalysisAvailability;
};

const canAnalyze =
  role !== "viewer" && analysisAvailability.canAnalyze;
```

Load availability in the server page through the server environment helper from Plan 1, then pass only the safe object into the Client Component.

- [ ] **Step 4: Replace hardcoded provider copy**

Use:

```text
Source text is preserved and sent only through the configured bounded server-side analysis provider. Do not paste secrets, personal data, or customer content.
```

Replace “Extracting change with GPT-5.6” with “Extracting a structured change”. Near the submit action, show `analysisAvailability.message`. For viewers, override it with:

```text
Read-only judge access. You can inspect the saved synthetic workspace state and any verified persisted result available in this deployment, but this account cannot start an AI request or change project data.
```

- [ ] **Step 5: Add non-interactive input help**

```tsx
<dl aria-label="Supported evidence inputs">
  <div><dt>Available now</dt><dd>Typed or pasted updates, manual notes, meeting minutes, and meeting summaries.</dd></div>
  <div><dt>Planned</dt><dd>Text/Markdown files and reviewed CSV import.</dd></div>
  <div><dt>Future integrations</dt><dd>URLs, voice, email, Slack, Teams, and Google Drive.</dd></div>
</dl>
```

This block contains no interactive element.

- [ ] **Step 6: Show persisted attribution**

Where the latest `AnalysisReview` is rendered, add a labelled value from `analysisProviderLabel(analysis.modelName)`. This reads persisted model metadata only and does not infer current configuration.

- [ ] **Step 7: Run focused tests and commit**

```bash
npm run test:run -- src/app/app/analysis-provider-label.test.ts src/app/app/source-update-form.test.tsx src/app/app/impact-workflow.test.tsx
npm run typecheck
git add src/app/app/analysis-provider-label.ts src/app/app/analysis-provider-label.test.ts src/app/app/page.tsx src/app/app/impact-workflow.tsx src/app/app/impact-workflow.test.tsx src/app/app/source-update-form.tsx src/app/app/source-update-form.test.tsx
git commit -m "feat: explain analysis and input availability"
```

### Task 3: Viewer denial matrix

**Files:**

- Modify: `src/app/app/items/project-items-view.test.tsx`
- Modify: `src/app/app/items/project-item-editor.test.tsx`
- Modify: `src/app/app/dependencies/dependency-view.test.tsx`
- Modify: `src/app/app/recovery-action-review.test.tsx`
- Modify: `src/app/app/demo-reset-control.test.tsx`
- Modify: `src/app/app/impact-workflow.test.tsx`
- Modify: `src/features/project-records/operations.test.ts`
- Modify: `src/features/operations/service.test.ts`
- Modify: `supabase/tests/verify_analysis_access_policy.sql`

**Interfaces:**

- Consumes existing `WorkspaceRole` allowlists and route/server action contracts.
- Produces regression evidence for all judge-read-only operations.

- [ ] **Step 1: Add component denial tests**

For `role="viewer"`, prove:

- item creation form is absent;
- item detail editor inputs are absent or disabled;
- dependency add/remove controls are absent;
- proposal approval controls are disabled;
- undo remains visible for history context but disabled;
- reset is disabled;
- analysis fields and submit are disabled;
- no mocked fetch/server action is called after user interaction.

Add application-service tests proving a viewer's item create/update and dependency create/remove never initialize or call the project-record store, and a viewer's apply/undo/reset requests never call the operations persistence executor. Plan 1 already proves viewer analysis denial occurs before provider policy, claim persistence, or adapter construction.

- [ ] **Step 2: Add direct SQL denial cases**

In the rollback-wrapped verifier, execute each narrow RPC as the actual viewer fixture and require `42501`/the documented authorization failure for:

```text
begin_project_analysis_with_policy
mutate_project_item_create
mutate_project_item_update
mutate_project_dependency_create
mutate_project_dependency_remove
apply_project_proposal
undo_project_operation
reset_demo_project
```

After every denial, assert unchanged item, dependency, proposal, operation, generation, source, request, and recording-grant counts.

- [ ] **Step 3: Run focused and full tests**

```bash
npm run test:run -- src/app/app/items/project-items-view.test.tsx src/app/app/items/project-item-editor.test.tsx src/app/app/dependencies/dependency-view.test.tsx src/app/app/recovery-action-review.test.tsx src/app/app/demo-reset-control.test.tsx src/app/app/impact-workflow.test.tsx src/features/project-records/operations.test.ts src/features/operations/service.test.ts
npm run typecheck
```

Run the SQL verifier locally if the disposable stack exists; otherwise leave linked execution to the release plan and report it honestly.

- [ ] **Step 4: Commit the denial matrix**

```bash
git add src/app/app/items/project-items-view.test.tsx src/app/app/items/project-item-editor.test.tsx src/app/app/dependencies/dependency-view.test.tsx src/app/app/recovery-action-review.test.tsx src/app/app/demo-reset-control.test.tsx src/app/app/impact-workflow.test.tsx src/features/project-records/operations.test.ts src/features/operations/service.test.ts supabase/tests/verify_analysis_access_policy.sql
git commit -m "test: lock judge access to read only"
```

### Task 4: Judge provisioning and public documentation

**Files:**

- Create: `docs/devpost-handoff.md`
- Modify: `docs/demo-user-setup.md`
- Modify: `docs/qa-checklist.md`
- Modify: `docs/submission-copy.md`
- Modify: `README.md`
- Modify: `docs/codex-log.md`

**Interfaces:**

- Produces a credential-safe procedure; it does not create or store a password.
- Produces exact non-secret Devpost testing copy and a post-judging retirement step.

- [ ] **Step 1: Document separate operator and judge roles**

First confirm that the project owner's real Supabase Auth profile exists and has `owner` membership in the synthetic workspace; this identity is the audited grant issuer and must not be replaced by a fictional seed UUID. If it is absent, provision that owner identity through the existing controlled bootstrap before continuing. Then create two separate Supabase Auth users through the secret-safe Dashboard interface:

- operator maps to the demo workspace as `admin`;
- judge maps to the demo workspace as `viewer`.

The owner issuer remains distinct from the recording operator/target actor. The procedure verifies each `public.profiles` row exists before membership insertion. Actual UUIDs, emails, and passwords never enter a file or terminal argument.

- [ ] **Step 2: Add the private testing-instruction body**

Store this non-secret body in `docs/devpost-handoff.md`:

```text
Production URL: https://inordo.vercel.app
Login: https://inordo.vercel.app/login

This is a dedicated read-only viewer account for the fully synthetic “Regional Climate Action Summit 2026” workspace. You can open the project overview, items and item details, decisions, risks, dependencies, preserved source evidence, deterministic impact paths, recovery proposals, and operation history. You cannot analyze, create, edit, apply, undo, reset, or delete; those restrictions are enforced by server authorization and Supabase row-level security.

Recording-outcome sentence: selected during the release plan. Use the verified-result sentence only after a successful persisted GPT-5.6 capture; otherwise state truthfully that no verified paid result was recorded. Live paid OpenAI analysis is unavailable to this judge account and cannot consume the team's API budget.

Suggested path: sign in → Projects → Regional Climate Action Summit 2026 → Items → Dependencies → latest impact review and proposal → Operation history → Projects → ordinary-project informational preview.

All names and project data are synthetic.
```

`docs/devpost-handoff.md` stores both allowlisted recording-outcome variants and marks them mutually exclusive. The release plan must replace the instruction line with exactly one truthful variant before saving the final draft. The owner enters the actual judge email and password directly in Devpost's private field at release time. They are never added to this body in Git.

Success variant:

```text
The visible GPT-5.6 result is the same persisted synthetic result shown in the demo video. Live paid OpenAI analysis is unavailable to this judge account and cannot consume the team's API budget.
```

No-verified-result variant:

```text
No new paid GPT-5.6 result was verified for this release. Live paid OpenAI analysis is unavailable to this judge account and cannot consume the team's API budget; the judge can still inspect the synthetic records and non-model workflow evidence described here.
```

- [ ] **Step 3: Document retirement**

After 10 August 2026 00:00 UTC, disable the judge Auth user, remove its workspace membership, and invalidate or rotate the shared password. Preserve profile/actor references and all analysis, operation, and audit rows.

- [ ] **Step 4: Reconcile README and submission claims**

State exactly:

- available inputs are paste/manual note/meeting text;
- files/CSV/connectors are not implemented;
- ordinary project provisioning is not implemented;
- the judge experience is read-only;
- fallback is open-weight GPT-OSS through a capped Gateway, not guaranteed free forever;
- ChatGPT subscriptions cannot fund this external application's API calls.

- [ ] **Step 5: Run the repository gate and commit**

```bash
npm run lint
npm run typecheck
npm run test:run
npm run test:e2e
npm run build
git diff --check
git add docs/devpost-handoff.md docs/demo-user-setup.md docs/qa-checklist.md docs/submission-copy.md README.md docs/codex-log.md
git commit -m "docs: prepare read-only judge handoff"
```

## Plan completion gate

This plan is complete only when authenticated viewers can navigate every documented read surface, all mutation paths are denied in UI/application/SQL tests, the ordinary-project page is explicitly informational, input help has no fake affordances, provider labels come from safe configuration or persisted metadata, and no judge credential appears in Git or task output.
