# Devpost judge handoff

This document contains the non-secret judge testing body and the credential-safe release procedure. It intentionally contains no email, password, Auth UUID, session, token, project reference, or environment value.

## Provisioning prerequisites

Before entering anything in Devpost, complete `docs/demo-user-setup.md` and privately verify three distinct real identities:

- a real owner with `owner` membership who is the audited recording-grant issuer;
- a recording operator with `admin` membership who is the grant's target actor; and
- a dedicated judge with `viewer` membership.

Verify the real owner's Auth profile and owner membership first. For each new Dashboard user, verify `public.profiles` before inserting `public.workspace_members`. Never use a fictional seed UUID as the grant issuer, never issue a grant to the judge, and never place an actual identifier or credential in Git or a terminal argument.

## Private Devpost testing-instruction body

Copy the following non-secret body into Devpost's private testing-instructions area. Before saving the final draft, replace the recording-outcome instruction line with exactly one allowlisted sentence from the next section.

```text
Production URL: https://inordo.vercel.app
Login: https://inordo.vercel.app/login

This is a dedicated read-only viewer account for the fully synthetic “Regional Climate Action Summit 2026” workspace. You can open the project overview, items and item details, decisions, risks, dependencies, preserved source evidence, deterministic impact paths, recovery proposals, and operation history. You cannot analyze, create, edit, apply, undo, reset, or delete; those restrictions are enforced by server authorization and Supabase row-level security.

Recording-outcome sentence: selected during the release plan. Use the verified-result sentence only after a successful persisted GPT-5.6 capture; otherwise state truthfully that no verified paid result was recorded. Live paid OpenAI analysis is unavailable to this judge account and cannot consume the team's API budget.

Suggested path: sign in → Projects → Regional Climate Action Summit 2026 → Items → Dependencies → latest impact review and proposal → Operation history → Projects → ordinary-project informational preview.

All names and project data are synthetic.
```

## Mutually exclusive recording-outcome variants

Choose **exactly one**. These sentences are mutually exclusive and must never both appear in the saved Devpost draft.

### Verified-result variant

Use only after the release plan proves a successful, persisted GPT-5.6 capture and the demo video shows that same result:

```text
The visible GPT-5.6 result is the same persisted synthetic result shown in the demo video. Live paid OpenAI analysis is unavailable to this judge account and cannot consume the team's API budget.
```

### No-verified-result variant

Use when no successful paid recording was persisted and verified:

```text
No new paid GPT-5.6 result was verified for this release. Live paid OpenAI analysis is unavailable to this judge account and cannot consume the team's API budget; the judge can still inspect the synthetic records and non-model workflow evidence described here.
```

The source-controlled release currently must not be changed to the verified-result variant without the release plan's recorded success evidence. Test fixtures, intercepted browser seams, provider readiness, or a failed provider request are not sufficient.

## Private credential entry

The owner enters the actual judge email and password directly into Devpost's private credential fields at release time. Do not append credentials to the body above, store them in a repository file, paste them into a terminal command, or include them in screenshots, video, logs, issues, or public submission fields. Verify the private credential works in a fresh signed-out browser before submission.

## Judge access contract

The judge experience is read-only:

- allowed: sign in, navigate, filter, inspect project records and record details, read evidence, view deterministic paths, view proposals, and inspect operation history;
- denied: analyze, create, edit, add/remove dependencies, apply, undo, reset, remove, and delete; and
- isolated: only the fully synthetic summit workspace is available. The ordinary-project route is an informational preview; ordinary project provisioning is not implemented.

Available evidence input in this release is typed or pasted text: a project update, manual note, meeting minutes, or meeting summary. File upload, CSV import, URL fetching, voice, email, Slack, Teams, Google Drive, and other connectors are not implemented and have no judge-facing control.

The optional fallback is the open-weight GPT-OSS model through a separately capped Vercel AI Gateway. It is not guaranteed to remain free forever. A ChatGPT subscription cannot fund or authenticate API calls made by this external application. Regardless of provider configuration, the judge account cannot start analysis.

## Retirement after judging

After **10 August 2026 00:00 UTC**, the owner/operator must:

1. disable the judge Auth user;
2. remove the judge's synthetic-workspace membership;
3. invalidate or rotate the shared judge password;
4. verify that the judge can no longer authenticate or read the workspace; and
5. preserve the durable profile/actor references and all analysis, operation, and audit rows.

Do not delete the profile or rewrite history to retire access. Record completion without including an email, UUID, password, token, or private audit payload.
