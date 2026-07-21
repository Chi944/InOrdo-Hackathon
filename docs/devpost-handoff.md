# Devpost judge handoff

This document contains the non-secret judge testing body and the credential-safe release procedure. It intentionally contains no email, password, Auth UUID, session, token, project reference, or environment value.

## Current handoff status

- Andres is a confirmed Devpost team member.
- Judge-only credentials and the verified-result testing instructions are saved privately in Devpost. The public 2:44.067 verified-success video is uploaded at `https://youtu.be/eDPB6wtkFrM`, the 1280×720 thumbnail and four sanitized gallery images are uploaded, and primary Codex `/feedback` Session ID `019f70e9-a3ae-7e43-b97a-f62016c32629` is recorded without a transcript. A no-session metadata check confirmed public visibility, the reviewed title, duration, and audio formats.

## Provisioning prerequisites

Release verification confirmed exactly three distinct real identities:

- a real owner with `owner` membership who is the audited recording-grant issuer;
- a recording operator with `admin` membership who is the grant's target actor; and
- a dedicated judge with `viewer` membership.

Exactly one owner, one admin recording operator, and one viewer judge passed the role/profile checks. The owner issued the grant, the admin performed the recording, and the viewer received no grant. No actual identifier or credential is recorded in Git or a terminal argument.

## Private Devpost testing-instruction body

The following non-secret body and the separate judge-only credential were saved privately in Devpost. The verified-result sentence is selected; no credential value is reproduced here.

```text
Production URL: https://inordo.vercel.app
Login: https://inordo.vercel.app/login

This is a dedicated read-only viewer account for the fully synthetic “Regional Climate Action Summit 2026” workspace. You can open the project overview, items and item details, decisions, risks, dependencies, preserved source evidence, deterministic impact paths, recovery proposals, and operation history. You cannot analyze, create, edit, apply, undo, reset, or delete; those restrictions are enforced by server authorization and Supabase row-level security.

The visible GPT-5.6 result is the verified persisted synthetic result captured for the final demo video. Live paid OpenAI analysis is disabled for this judge account and cannot consume the team's API budget.

Suggested path: sign in → Projects → Regional Climate Action Summit 2026 → Items → Dependencies → latest impact review and proposal → Operation history → Projects → ordinary-project informational preview.

All names and project data are synthetic.
```

## Mutually exclusive recording-outcome variants

These sentences remain mutually exclusive. The verified-result variant is selected for this release; the no-verified-result variant is retained only as an unused contingency.

### Verified-result variant

Selected after the release plan proved one successful, persisted GPT-5.6 Production capture:

```text
The visible GPT-5.6 result is the verified persisted synthetic result captured for the final demo video. Live paid OpenAI analysis is disabled for this judge account and cannot consume the team's API budget.
```

### No-verified-result variant

Unused contingency for a release in which no successful paid recording was persisted and verified:

```text
No new paid GPT-5.6 result was verified for this release. Live paid OpenAI analysis is unavailable to this judge account and cannot consume the team's API budget; the judge can still inspect the synthetic records and non-model workflow evidence described here.
```

The verified-result selection is supported by the single successful Production run and genuine persisted state. Test fixtures, intercepted browser seams, provider readiness, or the earlier failed request are not its evidence.

## Private credential entry

The owner saved the actual judge credential only in Devpost's private field. It was not appended to the body above, stored in a repository file, pasted into a terminal command, or included in screenshots, video, logs, issues, or public submission fields.

## Judge access contract

Production QA confirmed that the judge experience is read-only:

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
