# Demo and judge user setup

The deterministic seed creates fictional attribution profiles, workspace membership, and project data, but deliberately creates no Supabase Auth account or password. Release access uses three distinct, real Supabase Auth identities. This procedure documents how an authorized human operator provisions them in the Supabase Dashboard; it does not create an account or store a credential.

## Required identity separation

| Identity | Workspace role | Purpose |
| --- | --- | --- |
| Real project owner | `owner` | Audited issuer of an exact, one-use recording grant. |
| Recording operator | `admin` | Runs the approved synthetic recording flow and is the grant's target actor. |
| Judge | `viewer` | Navigates the saved synthetic workspace without analysis or mutation authority. |

All three Auth users must be different people/accounts. The real owner/grant issuer must remain distinct from the recording operator/target actor. A fictional seed profile or UUID must never stand in for the real owner, and the judge must never receive a recording grant.

## Credential and identifier rules

- Work only in the intended InOrdo project in the Supabase Dashboard.
- Create passwords with a password manager and keep them outside Git, terminal commands, SQL files, issues, screenshots, recordings, and shared logs.
- Keep actual Auth UUIDs inside the private Dashboard. Enter only the judge email and password in Devpost's private credential fields; do not put any real identifier or credential in a repository file or terminal argument.
- Do not read, print, or copy environment values while provisioning users.
- Verify each `public.profiles` row exists **before** adding its `public.workspace_members` row.
- Do not delete or repurpose the seeded fictional attribution profiles.

## 1. Confirm or bootstrap the real owner

1. In **Authentication > Users**, identify the real team-controlled owner account. If it does not exist, use **Add user** to create it in the Dashboard and apply the team's email-confirmation policy.
2. In **Table Editor > public.profiles**, confirm the Auth user's matching profile row exists. If the trigger did not create it, stop and repair or rerun the existing controlled Dashboard bootstrap; do not invent a profile ID or substitute a fictional seed identity.
3. In **Table Editor > public.workspace_members**, confirm that this same real profile has role `owner` in the synthetic Civic Futures Lab workspace.
4. If the membership is absent, use the controlled Dashboard bootstrap to add that real profile as `owner`. This one-time bootstrap may leave `invited_by` empty; it must not replace, demote, or impersonate the seeded owner record.
5. Reopen both rows and verify that the Auth identity, profile, workspace, and `owner` role align before issuing any grant or provisioning the other accounts.

The verified real owner is the only identity used as the release's recording-grant issuer. Grant issuance, revocation, and metadata-only verification follow the owner-only database boundary in the deployment runbook; no grant identifier belongs in this document.

## 2. Confirm or create the recording operator

1. In **Authentication > Users**, confirm the existing operator account or create a distinct team-controlled account with **Add user**.
2. In **Table Editor > public.profiles**, verify the operator's matching profile row exists. Do not proceed to membership until it does.
3. In **Table Editor > public.workspace_members**, add or update the operator's membership in the synthetic workspace to `admin` and attribute `invited_by` to the verified real owner profile.
4. Reopen the row and confirm the role is exactly `admin`, not `owner` or `viewer`.

This operator is the target actor for the one approved recording grant and the only account that may perform the recording flow. It does not issue its own grant.

## 3. Create the dedicated judge viewer

1. In **Authentication > Users**, use **Add user** to create a dedicated judge account. Use a unique password that is not shared with the owner or operator account.
2. In **Table Editor > public.profiles**, verify the judge's matching profile row exists before continuing.
3. In **Table Editor > public.workspace_members**, add the judge to the synthetic workspace with role `viewer` and attribute `invited_by` to the verified real owner profile.
4. Reopen the row and confirm the role is exactly `viewer`.
5. Enter the judge email and password only in Devpost's private testing fields at release time. Do not add either value to the non-secret testing-instruction body, Git, a terminal command, or a recording.

The judge may open the overview, records and record details, decisions, risks, dependencies, preserved source evidence, deterministic impact paths, recovery proposals, and operation history. The judge may not analyze, create, edit, apply, undo, reset, remove, or delete. UI restrictions are defense in depth; server authorization and Supabase RLS are authoritative.

## 4. Verify the three identities

Perform these checks in a private browser without recording credentials, cookies, authorization headers, Auth UUIDs, or private response bodies:

1. Sign in as the real owner and confirm the synthetic workspace resolves with role `owner`. Do not run the recording flow from this account.
2. Sign out, sign in as the operator, and confirm role `admin` plus the documented owner/admin controls. Do not issue a grant from this account.
3. Sign out, sign in as the judge, and follow the complete read-only path in `docs/devpost-handoff.md`.
4. As the judge, confirm analysis, item/dependency mutation, proposal apply, undo, and reset controls are unavailable or disabled and that direct attempts fail without changing data.
5. Sign out and confirm the protected route no longer returns project data. Try an invalid password and confirm the page shows a useful error without exposing credentials or Supabase internals.

## Local application configuration

Copy `.env.example` to ignored `.env.local` and supply only the configuration needed for the authorized local task. Ordinary login and project reads use the browser-safe Supabase values and RLS; they must not use the service-role key. Server-only credentials remain restricted to their reviewed boundaries, and no environment value belongs in a command, screenshot, or document.

## Judge-account retirement

After **10 August 2026 00:00 UTC**:

1. Disable the judge Auth user in the Supabase Dashboard.
2. Remove only the judge's synthetic-workspace membership.
3. Invalidate or rotate the shared judge password wherever the private credential was stored.
4. Confirm the judge can no longer create a session or read the workspace.
5. Preserve the durable `public.profiles` row and every profile/actor reference, analysis row, operation row, and audit row. Do not delete or rewrite evidence to remove attribution.

The operator and real owner accounts follow the team's separate post-submission access policy. Judge retirement is an access-control action, not an audit-history deletion.
