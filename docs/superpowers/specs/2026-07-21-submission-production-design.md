# InOrdo submission-production design

**Status:** Approved design, awaiting review of this written specification

**Date:** 21 July 2026

**Scope:** Submission-critical production hardening, judge access, honest project/input affordances, demo recording, and Devpost handoff

## 1. Outcome and scope boundary

This release makes the existing InOrdo P0 safe and understandable for Build Week judges without broadening it into a connector platform. The production deployment will support one synthetic demonstration workspace, a read-only judge journey, one tightly authorized GPT-5.6 recording attempt, and a capped open-source fallback for authorized contributors when no paid OpenAI credential is available. It will also expose an honest ordinary-project preview instead of making non-demo projects look broken or silently inaccessible.

The submission-critical work is split into five bounded workstreams:

1. analysis-provider policy and cost controls;
2. read-only judge access and preserved demonstration state;
3. ordinary-project and supported-input messaging;
4. video, voiceover, thumbnail, and public documentation;
5. Devpost draft completion and final verification.

The work does not add production multi-project provisioning, billing, user-supplied provider keys, browser-side model calls, a ChatGPT App, uploads, transcription, or external connectors. Those remain post-hackathon work. This boundary is intentional: the deadline-critical release must demonstrate the core evidence-to-approval contract with verifiable security rather than ship shallow integrations.

## 2. Decisions and considered alternatives

### 2.1 Analysis-provider strategy

**Selected:** a server-only provider policy with an exact, single-use GPT-5.6 recording grant, followed by `openai/gpt-oss-20b` through Vercel AI Gateway as the default configured fallback. The Gateway key must have a hard spend quota of **USD 1 or less**, a non-renewing period, and automatic top-up disabled. If the provider console cannot enforce all three settings, the Gateway fallback remains disabled. The app retains its own request limits and fails closed when the provider or allowance is unavailable.

This design preserves the hackathon's real GPT-5.6 demonstration while preventing a public account or copied deployment URL from spending the operator's OpenAI balance. GPT-OSS uses the same validated domain boundary and cannot mutate data directly.

Alternatives rejected for this release:

- **Browser/WebGPU inference:** avoids hosted inference charges but requires a large model download, varies by judge hardware, and is unreliable for strict structured output during a timed review.
- **Ollama/local inference:** appropriate for a developer workstation but unavailable to a public Vercel deployment.
- **Always-on shared OpenAI key:** simplest technically, but any authorized contributor could consume the operator's budget and the existing per-actor rate limit is not a hard global cost cap.

If GPT-OSS structured output is not compatible with the current two-stage contract during verification, the fallback stays disabled and surfaces the specified no-mutation message. The release must not weaken validation to make a model appear compatible.

### 2.2 Judge access

**Selected:** a separate Supabase Auth user mapped to the synthetic workspace with the existing `viewer` role. Judges can sign in, navigate records, dependencies, evidence, impacts, proposals, and operation history, and open item detail pages. They cannot create, edit, analyze, apply, undo, reset, or delete.

The successful synthetic result recorded for the video remains visible for the judge account. The judge account never qualifies for the GPT-5.6 grant, and viewer authorization blocks analysis before provider selection. Credentials are supplied only in Devpost's private testing-instructions field. No credential appears in Git, video, screenshots, logs, or public copy.

An owner/operator account remains separate and is used only to create the recording state. The operator password and judge password must be set through an approved secret interface by the project owner; automation may create non-secret account metadata and workspace membership, but must not print, store, or transmit a password.

### 2.3 Ordinary projects

**Selected:** add a project index/preview route with two honest states:

- the synthetic summit workspace is available and links into the existing application;
- an ordinary-team project preview card links to an informational destination explaining that the database and authorization model are project-scoped while ordinary project creation, invitations, switching, and workspace provisioning are unavailable in this Build Week demo. The destination is not a provisioned workspace.

Required copy:

> InOrdo's records and authorization are project-scoped. Creating and using ordinary team workspaces is not available in this Build Week demo. This informational preview is intentionally separate from the live synthetic summit workspace.

The interface must not say that ordinary projects are fully supported. It may say that the underlying data model is project-scoped and that ordinary-workspace product flows are planned.

### 2.4 Input methods

**Selected for submission:** preserve the implemented exact-text intake and make its coverage clearer. `pasted_update` and `manual_note` accept typed or pasted project updates; meeting minutes and meeting summaries are supported today as manual notes within the existing 12,000-character bound. The UI and documentation will name those examples explicitly.

The release will not add file, CSV, URL, voice, email, Slack, Teams, or Google Drive ingestion. A small, non-interactive help panel may distinguish:

- **Available now:** pasted update, manual note, meeting minutes, meeting summary.
- **Planned:** text/Markdown file and reviewed CSV import.
- **Future connector work:** URL, voice/transcription, email, Slack, Teams, and Google Drive.

This panel contains documentation text and links only. It has no disabled controls, fake import buttons, or affordances that imply an unavailable connector can be used.

The order after submission is text/Markdown upload first, CSV with mapping/preview/idempotency second, then one connector chosen from validated user demand. URL ingestion needs SSRF and content-limit controls; voice needs upload/transcription/privacy controls; email and collaboration connectors each need OAuth, scope, token-storage, revocation, tenant, replay, and deletion designs. They are not one-click additions.

### 2.5 ChatGPT account usage

The Vercel application will not offer “Sign in with ChatGPT” as a way to charge inference to a judge's ChatGPT Free, Plus, or Pro subscription. ChatGPT subscriptions and API billing are separate, and an external application cannot consume a user's ChatGPT message allowance through OAuth.

A future ChatGPT App could expose InOrdo inside ChatGPT through the Apps SDK and MCP, with authentication back to InOrdo's own service. That is a separate product surface and does not convert a ChatGPT subscription into API credit for this external Next.js app. A future bring-your-own-provider-key design would require encrypted server-side credential storage, deletion, rotation, tenant isolation, and billing UX; browser-side keys remain prohibited.

## 3. Analysis architecture and data flow

### 3.1 Provider-neutral boundary

The analysis service retains one domain contract for extraction and proposal drafting. Provider adapters return the same strict intermediate objects, and existing post-validation remains authoritative for identifiers, fields, versions, dates, evidence spans, impact coverage, and allowed action types.

Provider selection occurs only after authentication, membership, request validation, canonical project context loading, and role authorization. A strict server-only `ANALYSIS_MODE` allowlist controls intent:

- `recording`: GPT-5.6 with the exact one-use grant or fail closed; never fall back;
- `auto`: capped GPT-OSS fallback or fail disabled; an OpenAI key is ignored in this mode;
- `disabled`: create no new analysis claim and call no provider.

The default is `disabled` when the variable is absent or invalid. Within that policy:

1. A `viewer` or nonmember is denied before persistence, grant lookup, adapter construction, or any network call.
2. The authorized server passes the validated mode and capability flags—not credential values—into the atomic begin-analysis policy.
3. In `recording` mode, a genuinely new request selects `openai_recording` only when an OpenAI credential is ready and the exact grant is atomically claimed. Missing, mismatched, expired, revoked, or replayed grants fail closed without fallback.
4. In `auto` mode, it selects `gateway_fallback` only when the capped GPT-OSS credential/model is ready; no recording grant is read or consumed.
5. In `disabled` mode, or when the requested mode's route is unavailable, the transaction creates no evidence or analysis claim and returns a user-safe disabled response.

The transaction returns the selected route to the server, which constructs only that adapter. A duplicate returns its existing status/result and never constructs a new provider adapter.

No client component imports either adapter or any server credential. The model still has no tools, performs no graph traversal, and never writes project records.

### 3.2 Atomic new-analysis claim and single-use GPT-5.6 grant

A migration adds `private.analysis_recording_grants` and extends the narrow begin-analysis transaction so grant validation/consumption and creation of a genuinely new analysis claim happen atomically. The table contains exactly:

- `id uuid primary key`;
- `actor_id uuid not null` and `project_id uuid not null` with restrictive foreign keys;
- `normalized_content_sha256 text not null`, computed by the existing `normalizeSourceTextForHash` contract (Unicode NFC, normalized line endings, trimmed line edges, collapsed horizontal whitespace, UTF-8 SHA-256);
- `expires_at timestamptz not null`, no more than 15 minutes after `created_at`;
- `status text not null` allowlisted to `available`, `claimed`, or `revoked`;
- `created_at timestamptz not null` and `created_by uuid not null`;
- nullable `claimed_at timestamptz` and `claimed_analysis_request_id uuid`;
- nullable `revoked_at timestamptz` and `revoked_by uuid`.

An available grant can transition once to `claimed` or `revoked` and never transitions back. Expiration is an eligibility predicate; it does not rewrite history. A partial unique index permits at most one `available` grant for the actor/project/hash tuple, and a lookup index covers actor, project, hash, status, and expiry. Issuance revokes any prior expired available match before inserting the replacement. Grant rows are retained through 11 November 2026 UTC and are then eligible for a separately reviewed metadata purge. Raw source, source title, prompt, model response, password, token, API key, and provider secret are intentionally excluded.

The begin-analysis transaction follows this exact order while holding the existing source-key lock:

1. Check for an existing completed, failed, or in-progress claim for the normalized project/source/revision tuple. A duplicate returns the existing result and does not consume a grant or start a provider call.
2. Apply the existing new-analysis rate limit before consuming a grant.
3. In `recording` mode, require an OpenAI capability flag and validate actor, project, normalized source hash, `available` state, and expiry. If all match, update the grant to `claimed` and select `openai_recording`; otherwise return the same generic recording-unavailable error with no fallback or database change.
4. In `auto` mode, select `gateway_fallback` only when the Gateway capability flag is ready, without reading or consuming a recording grant.
5. In `disabled` mode, or if the selected mode's sole route is unavailable, return `analysis_disabled` without creating evidence or an analysis request.
6. In the same transaction as provider selection, create/reuse immutable source evidence and insert the new analysis request; for `openai_recording`, link its ID back to the claimed grant.
7. Commit all selected-route changes together. Any authorization, rate-limit, constraint, or grant-update failure rolls back both the grant and the evidence/analysis claim.

Concurrent requests cannot both claim the grant. A provider error after commit still consumes it because the request may already have incurred cost; an operator must deliberately issue a new grant for a retry. The table is not exposed through the browser-facing API. Grant issuance and the extended begin-analysis function are `SECURITY DEFINER`, owned by the migration owner, use an explicit empty/fixed `search_path` with fully qualified names, revoke all privileges from `PUBLIC`, `anon`, and `authenticated`, and grant only the required execution path to `service_role`. There is no browser-accessible grant-management route or server action.

An operator issues one grant only through an audited, transaction-wrapped Supabase owner procedure after verifying the exact actor UUID, project UUID, normalized hash, and expiry. The procedure returns only grant ID, state, and expiry; it never returns source text or a credential. Revocation uses the same privileged path and records actor and timestamp.

The existing duplicate-analysis and rate-limit controls remain defense in depth. They are not treated as the cost boundary.

### 3.3 GPT-OSS Gateway fallback

The Gateway adapter uses the existing server-only OpenAI SDK with the Gateway endpoint and the configured `openai/gpt-oss-20b` identifier. It retains bounded inputs, `store: false` where supported, no tools, no automatic retries, explicit timeouts, and output-token limits. Provider/model metadata is recorded accurately rather than labelling a fallback response as GPT-5.6.

The first release test is a synthetic compatibility check against both extraction and proposal schemas. The result must pass all existing Zod and canonical-state validation. Invalid JSON, unsupported structured-output behavior, quota rejection, timeout, or provider failure maps to a safe analysis error and leaves derived proposal writes absent. Immutable evidence handling follows the current documented transaction/claim contract.

The Vercel AI Gateway key must have a hard quota of USD 1 or less, refresh period `none`/non-renewing, and automatic top-up disabled. The fallback fails closed if any setting cannot be enforced. The repository cannot prove provider-console settings, so release evidence records only provider, quota upper bound, refresh mode, top-up state, and verification timestamp without recording the key or key identifier.

### 3.4 Runtime readiness

The release adds three documented server-only configuration names:

- `ANALYSIS_MODE`, allowlisted to `recording`, `auto`, or `disabled`;
- `AI_GATEWAY_API_KEY`, the dedicated capped Gateway credential;
- `AI_GATEWAY_MODEL`, fixed to `openai/gpt-oss-20b` for this release.

They are blank/documented in `.env.example`; no value is committed. Production is explicitly set to `auto` after recording only when the Gateway quota controls are verified, so the no-OpenAI-key path uses GPT-OSS. The code-level fallback for an absent or invalid mode remains `disabled` to prevent accidental spend.

Health and readiness become capability-aware:

- the application and read-only workspace may be healthy while all AI providers are disabled;
- GPT-5.6 recording readiness requires `ANALYSIS_MODE=recording`, the credential, and an eligible grant at request time;
- fallback readiness requires `ANALYSIS_MODE=auto` and Gateway configuration;
- missing AI configuration does not make navigation, records, graph views, or preserved results unavailable.

Public health output remains generic and never reveals credential values, actor identifiers, grant hashes, or detailed provider-console state.

### 3.5 User-safe messages

When analysis is disabled before a new database claim or provider request:

> Live AI analysis is disabled in this public demo to protect the operator's API budget. No OpenAI request was made and no project data changed. You can inspect the verified synthetic result and non-model project controls. To run a new analysis, deploy InOrdo with your own OpenAI API project and key.

When the free fallback is unavailable before a new database claim, the same no-change guarantee applies. If the Gateway rejects or exhausts its allowance after a new analysis transaction has preserved the submitted source, use:

> Free fallback analysis is currently unavailable because its capped inference allowance has been exhausted. No paid OpenAI request was made, and no project item or proposal changed. The submitted source remains immutable evidence with a failed analysis status. You can inspect the verified synthetic result or deploy InOrdo with your own provider credentials.

For any provider timeout, invalid output, or upstream failure after the new analysis transaction commits, the response states that no project item or proposal changed and that immutable evidence plus a failed analysis record may remain. It never claims that all project data is unchanged.

These messages must be returned only after authorization and must not disclose whether another user has a grant or key.

## 4. Judge experience and authorization

The viewer journey begins at the normal `/login` page. After sign-in, the judge sees a clearly labelled synthetic workspace and can:

- open the project overview;
- navigate items, decisions, risks, dependencies, evidence, impact paths, proposals, and operation history;
- inspect before/after state and the linked compensating undo record;
- open ordinary-project preview messaging;
- use keyboard navigation and responsive layouts.

Every mutation control is absent or disabled with an explanation, but server and database authorization remain the source of truth. Direct POSTs and server actions from the viewer must return the existing safe authorization result. The viewer must be tested against analysis, item create/update, dependency create/remove, proposal apply, undo, and reset. A nonmember and a cross-project identity remain denied.

The exact GPT-5.6 recording result is preserved after video capture. Judges see that persisted state and do not re-run it. Devpost private testing instructions identify the production URL, the dedicated judge email, the user-supplied password, the synthetic-data notice, the read-only limitation, and the pages to inspect. The instructions explicitly state that live paid AI is disabled for judges and that the visible result matches the demonstration recording.

## 5. Interface changes

Visual changes are restrained and reuse the existing Andres-owned components and tokens:

- Add a project index entry to existing navigation without redesigning the shell.
- Add the available synthetic project card and the clickable ordinary-project unavailable state.
- Update source-intake labels/help text to mention meeting minutes and summaries.
- Present planned input methods only as non-interactive help text, never as fake or disabled import controls.
- Add provider/disabled status copy near the analysis action without implying that an unavailable provider is a broken project.
- Show the actual provider/model label on a persisted analysis where metadata is available.
- Hide or explain mutation controls for viewers; do not depend on hiding them for authorization.

No new design system, animation framework, or placeholder connector UI is introduced.

## 6. Recording and API-key lifecycle

### 6.1 Production recording sequence

1. Verify the exact Production deployment, migration parity, viewer denials, operator identity, source hash, synthetic reset state, and absence of a terminal duplicate at the current project revision. If a prior failed claim exists for that exact revision/source, run the scoped demo reset before issuing the grant; never consume a second provider attempt to bypass a terminal duplicate.
2. Configure the purpose-specific OpenAI key in Vercel Production through hidden input and set the non-secret `ANALYSIS_MODE=recording`. Do not put the key in a shell argument, file output, screenshot, log, or repository.
3. Create one exact grant for the operator, demo project, canonical source hash, and a maximum 15-minute expiry.
4. Redeploy if required by the environment change and verify generic readiness.
5. Record one 1920×1080 Production journey: evidence, validated GPT-5.6 extraction, deterministic graph paths, proposal review, selective approval, history, and compensating undo.
6. Verify the raw capture is playable and the successful persisted result remains visible.
7. Immediately tell the owner: **“The recording is secured; revoke the OpenAI key now.”**
8. Revoke/delete the purpose-specific key in the OpenAI project, remove `OPENAI_API_KEY` from Vercel Production, set `ANALYSIS_MODE=auto` only if the capped Gateway fallback is verified (otherwise `disabled`), redeploy, and verify that the judge account cannot invoke paid analysis.

Revoking the key is required even after removing it from the current Vercel configuration because older immutable deployments may still contain the previous environment snapshot.

### 6.2 Video production

The final public YouTube video is 2:40–2:50, 16:9, 1920×1080, under the three-minute limit, and uses only Production behavior and real persisted evidence. The guarded `__e2e__` fixture route never appears as live evidence.

Capture and assembly use Playwright for repeatable cursor/navigation choreography, Xbox Game Bar for the real browser capture, Clipchamp for editorial timing/captions, and FFmpeg for final validation/export. Target export is H.264 High profile, `yuv420p`, CRF 16–18, AAC 48 kHz at 256 kbps. Voiceover targets approximately −14 LUFS integrated and −1 dBTP.

The requested recordings are:

- `Andres.wav`: mono, 48 kHz, 24-bit WAV, containing the five Andres sections in the final script;
- `Deston.wav`: mono, 48 kHz, 24-bit WAV, containing the four Deston sections;
- five seconds of room tone from each recording environment if practical.

The repository stores scripts and checklists only. Raw captures, voice files, edit projects, private browser profiles, and exports live under `C:\Users\User\Videos\InOrdo-Build-Week`, outside Git. Private browser profiles are deleted after capture.

### 6.3 Thumbnail

The YouTube/Devpost thumbnail is 1280×720 and uses a genuine production impact-review screen, not generated product UI. Layout:

- large title: **InOrdo**;
- subtitle: **Evidence → Impact → Human Approval**;
- small badge: **GPT‑5.6 + deterministic dependency graph**;
- a visible **Synthetic demo** label;
- strong contrast, generous spacing, and no password, email, source secret, browser chrome, or unverified claim.

No Higgsfield generation is needed. A real product frame with restrained typography is more credible and avoids premium-credit spend. If a later edit reveals a specific missing hero insert, its exact duration, placement, and credit cost must be approved before any Higgsfield prompt or paid call.

## 7. Final voiceover script

### Andres

**A1 — Problem and hook**

“One changed fact can invalidate work several steps away. A venue date moves, and suddenly speaker confirmation, catering, programme deadlines, travel, and briefing materials may all be stale. Small teams usually reconstruct that chain by hand.”

**A2 — Product promise**

“InOrdo makes the response reviewable. It preserves the evidence, separates source fact from inference, explains downstream impact, and keeps every proposed change inert until a person approves it.”

**A3 — Synthetic source**

“This workspace and every name in it are synthetic. I insert one venue update: the hall is unavailable on September twelfth and offers September twenty-sixth instead. InOrdo preserves the exact source and warns us never to paste secrets or customer data.”

**A4 — Human approval**

“Recovery actions are proposals, not permission. I can review them individually, leave anything requiring human confirmation pending, and approve only the safe internal deadline change. The confirmation names exactly what will be applied.”

**A5 — Close**

“InOrdo’s promise is simple: when evidence changes a project, every consequence stays visible, attributable, and safely under human control.”

### Deston

**D1 — Bounded GPT-5.6 use**

“On the server, GPT-5.6 has two bounded jobs: extract one structured candidate change, then draft recovery actions. Strict schemas and canonical-state checks validate identifiers, values, dates, and the exact evidence span. The model has no tools and cannot write a project record.”

**D2 — Deterministic graph**

“GPT never decides reach. Deterministic TypeScript follows explicit dependency edges, terminates cycles, keeps a stable shortest path, and labels depth one as direct and later steps as indirect. Every affected record is therefore explainable, not merely plausible.”

**D3 — Apply and undo**

“Before applying anything, the server rechecks role, proposal state, selected action IDs, required human input, item versions, and idempotency. History records the actor and ordered before-and-after state. Undo never erases history; it creates a linked compensating operation only when current state still matches.”

**D4 — Codex contribution**

“Codex accelerated our schema and RLS review, graph and model contracts, operation and undo tests, and release hardening—while preserving the rule that model output never mutates data directly.”

## 8. Devpost handoff

The connected Devpost project is `InOrdo` and remains a draft until the live evidence exists. The authoritative Build Week submission requirements require a working project, category, project description, a public YouTube video under three minutes with audio covering the project, Codex, and GPT-5.6, a repository URL, and a primary `/feedback` Codex Session ID.

The published submission deadline is **22 July 2026 at 00:00 UTC**, which is **22 July 2026 at 08:00 Singapore time**. Repository, deployment, video, team, and Devpost edits freeze before that instant.

After implementation and recording, automation may fill and save:

- project story based on verified behavior, written in the team's voice and reviewed by the owner;
- built-with tags;
- production and public repository links;
- public YouTube URL;
- Work & Productivity category;
- team/role text where supported;
- private testing instructions excluding the password until the owner enters it securely;
- the owner-provided primary `/feedback` Session ID.

Thumbnail upload and teammate invitation may require the Devpost web interface. Andres must be invited and accept before the deadline. Final “Submit” is a consequential external action and requires a separate action-time confirmation after a signed-out link and completeness check.

## 9. Workspace cleanup

The Hackathons directory will contain only the InOrdo repository after a recoverable cleanup:

- move `.playwright-mcp`, `inordo-desktop.png`, and `inordo-mobile.png` to `C:\Users\User\Documents\Archives\InOrdo\workspace-cleanup-2026-07-21`;
- remove the exact empty `Hackathons\.agents` and `Hackathons\.git` directories;
- remove only the exact zero-byte dangling `Hackathons\Program` reparse point without following its target;
- verify every resolved source and destination remains within the named Hackathons or Archives directories before moving or deleting;
- list the final Hackathons directory and report what is recoverable.

The stale screenshots are not used in the submission because they show the earlier foundation shell rather than the implemented product.

## 10. Error handling and rollback

- Authorization failure: deny before provider selection and return the established user-safe authorization result.
- Missing provider before the begin-analysis transaction: show the paid-disabled or fallback-unavailable message; make no provider request or database change.
- Grant mismatch/expiry/replay: fail closed without revealing which predicate failed.
- Terminal duplicate at the current project revision: reuse its status without consuming the grant or calling a provider; require the documented synthetic reset/new canonical revision before a deliberate recording retry.
- Provider timeout/quota/invalid output after the atomic begin-analysis transaction: map to a stable analysis error, preserve immutable evidence and the failed analysis claim, and create no proposal or item mutation.
- Stale canonical state: retain current conflict behavior and require a fresh analysis.
- Viewer mutation attempt: server and RLS both deny; UI state is not trusted.
- Judge account problem: keep the public app available and provide local setup instructions, but do not replace read-only access with an owner credential.
- Video capture failure: do not spend another GPT-5.6 grant if the successful persisted result and browser state can be re-recorded without re-analysis. Issue another grant only when a provider result itself is absent or invalid and the owner explicitly authorizes the retry.
- Gateway quota exhaustion: no automatic paid failover to OpenAI.

Database rollback is forward-only. The migration is additive, so the previous application can tolerate the new private table and function, but an earlier deployment must never be aliased to Production while any OpenAI key remains valid because it lacks the new grant policy.

Containment uses this exact sequence:

1. Revoke/delete the purpose-specific OpenAI key and remove `OPENAI_API_KEY` from Vercel.
2. Remove/disable `AI_GATEWAY_API_KEY` if the fallback is implicated.
3. Deploy the default-disabled provider configuration and verify the canonical health and analysis-disabled response.
4. Apply a forward containment migration that revokes `service_role` execution on grant issuance/claim functions and transitions every `available` grant to `revoked`, preserving claimed/revoked rows and all evidence, analysis, operation, and audit history.
5. Run migration parity, the grant SQL verifier, viewer-denial tests, and a canonical Production smoke test.
6. Only then consider aliasing a compatible previous deployment, still with all provider credentials revoked.

The release runbook records `supabase db push --dry-run`, the exact approved migration tail, `scripts/verify-migration-parity.mjs`, the grant SQL verifier, the canonical `/api/health` result, and a no-provider-call denial check. Containment never drops the grant table, evidence, proposals, operations, or audit history.

## 11. Verification contract

### Automated

- Unit tests for provider selection, exact grant predicates, expiry, replay, duplicate-without-consumption, concurrency result mapping, disabled states, and safe messages.
- Adapter contract tests proving both stages either satisfy the current schemas or fail closed.
- Route/service tests proving viewer and nonmember denial occurs before persistence and provider construction.
- Readiness/health tests for app-ready, paid-recording-ready, fallback-ready, and AI-disabled states.
- Component tests for viewer controls, ordinary-project preview, source examples, and provider labels.
- SQL verification for new-claim/grant atomicity, duplicate-without-consumption, mismatch rollback with no evidence, one-use enforcement, role restrictions, and cross-project denial.
- Existing full quality gate: lint, typecheck, unit tests, build, diff check, audit, and Playwright where available.

### Manual Production

- Verify migration parity and exact deployed commit.
- Verify one funded GPT-5.6 synthetic result, selective apply, history, undo, and preserved result.
- Verify the recording grant cannot be reused.
- After revocation, verify paid analysis is unavailable on the canonical Production URL and from an older deployment URL where access remains possible.
- Verify judge login in a fresh incognito session and all viewer denial cases.
- Verify desktop, tablet, and mobile widths, keyboard order, focus, labels, announcements, and no horizontal overflow.
- Verify public repository, Production, YouTube, and Devpost links signed out.
- Verify the video is under three minutes, audible, 1920×1080, and matches actual Product behavior.

### Post-judging access retirement

After judging closes at 10 August 2026 00:00 UTC, the owner disables the dedicated judge Auth user, removes its workspace membership, and invalidates or rotates the shared judge password. This retirement does not delete the user's actor references or any preserved analysis, operation, or audit history. The owner records only retirement status and timestamp in private release notes.

## 12. Definition of done

This release is complete only when:

- the committed code and hosted schema pass all required checks;
- Production exposes the project preview and clear input/provider states;
- one real GPT-5.6 result has been recorded and preserved, or submission copy remains explicit that it was not achieved;
- the purpose-specific OpenAI key has been revoked and removed after capture;
- Gateway fallback is protected by a verified hard quota of USD 1 or less, refresh period `none`, and automatic top-up disabled, or it remains disabled with the specified message;
- the judge viewer account works without mutation or paid-analysis access;
- Andres and Deston voice files have been mixed into a verified sub-three-minute public video;
- Devpost contains accurate non-secret fields, private testing instructions, repository, video, and `/feedback` Session ID;
- Andres has accepted the Devpost team invitation;
- all public links work signed out; and
- the owner separately confirms the final Devpost submission action.

## 13. Authoritative external references

- OpenAI API projects, budgets, and key permissions: <https://help.openai.com/en/articles/9186755-managing-projects-in-the-api-platform>
- OpenAI API key safety: <https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety>
- ChatGPT subscription and API billing separation: <https://help.openai.com/en/articles/8156019-is-api-usage-included-in-chatgpt-subscriptions-even-if-i-have-a-paid-chatgpt-account>
- OpenAI Apps SDK authentication: <https://developers.openai.com/apps-sdk/build/auth>
- Vercel AI Gateway overview and pricing: <https://vercel.com/docs/ai-gateway> and <https://vercel.com/docs/ai-gateway/pricing>
- Vercel AI Gateway API-key budgets: <https://vercel.com/changelog/budgets-for-api-keys-on-ai-gateway>
- Vercel GPT-OSS support: <https://vercel.com/changelog/gpt-oss-20b-and-gpt-oss-120b-are-now-supported-in-vercel-ai-gateway>
- OpenAI Build Week submission requirements: <https://openai.devpost.com/rules>
