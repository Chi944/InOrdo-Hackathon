# InOrdo submission copy

## Submission details

- **Track:** Work & Productivity
- **Deployed application:** `https://inordo.vercel.app`
- **Reviewed/deployed application SHA:** `4f54cc1eec37d49aa6b1da6e0dafbc6f7d738d03` (direct Vercel CLI deployment; the clean-worktree record, not Vercel metadata, establishes this source identity)
- **Production deployment:** `dpl_BW4kvr2zMUNkwv46XEeMMFRJeisJ` (`READY`); immutable URL: `https://inordo-caheq8v2h-chi944s-projects.vercel.app`; health ready with analysis disabled
- **Public repository:** `https://github.com/Chi944/InOrdo`
- **Demo video:** `https://youtu.be/eDPB6wtkFrM` (public, 2:44, and verified without sign-in)
- **Devpost project:** `https://devpost.com/software/chimera-i4oz8d` (public project page; hackathon finalization remains pending)
- **Team:** Deston — Engineering, Data & AI Safety; Andres — Product Design & Experience
- **Primary Codex `/feedback` Session ID:** `019f70e9-a3ae-7e43-b97a-f62016c32629`

## One-line pitch

InOrdo turns one project update into evidence-backed impacts and recovery actions for selective human approval, with traceable history and undo contracts where supported.

## 50-word summary

InOrdo helps small teams respond safely when new evidence changes a project. Its one-use GPT-5.6 recording path can structure updates and draft recovery actions; deterministic code traces explicit dependencies. Reviewers inspect evidence and paths before selective approval. Application contracts record attributable history and compensating undo only when supported.

## Judge testing and current availability

- The judge receives a dedicated `viewer` account through Devpost's private credential fields. It is read-only: judges can navigate and inspect saved synthetic records, evidence, deterministic paths, proposals, and operation history but cannot analyze or mutate data.
- Available input is typed or pasted text: a project update, manual note, meeting minutes, or meeting summary. File upload, CSV import, URL fetching, voice, email, Slack, Teams, Google Drive, and other connectors are not implemented.
- The synthetic summit is the only provisioned project. The ordinary-project route is an informational preview; ordinary project creation, invitations, switching, and provisioning are not implemented.
- The verified recording used exactly one 14-minute grant and one successful GPT-5.6 Production run. Canonical-source and fresh-duplicate gates passed, and post-capture verification found one claimed, consistent, expiry-valid grant.
- A ChatGPT subscription cannot authenticate or fund API calls made by this external application. Live paid OpenAI analysis is unavailable to the judge account and cannot consume the team's API budget.
- Production is back in `ANALYSIS_MODE=disabled`; health is ready with analysis disabled. The older duplicate active InOrdo key and fresh recording key were revoked, zero active InOrdo keys remained, the Vercel `OPENAI_API_KEY` was removed, and local `.env.recording.local` was deleted. Migration parity is exact through applied migration `20260721100000` with no pending migration.
- The verified-result sentence from `docs/devpost-handoff.md` is selected. Judge-only credentials and instructions are saved privately in Devpost; judge QA confirmed view access and denied or disabled provider and mutation controls.
- Andres is a confirmed Devpost team member. The YouTube URL and primary Codex `/feedback` Session ID are saved in Devpost.
- The verified-success 2:44.067 review export is public on YouTube, and the 1280×720 thumbnail plus four sanitized product images are uploaded to Devpost. A no-session metadata check confirmed the reviewed title, duration, visibility, and audio formats. The edit includes a brief team introduction using the supplied photos, natural-speed human recordings, accurate burned-in captions, genuine Production/public GitHub views, and no generative media. D4 remains at its natural 12.229-second duration; non-spoken holds were tightened instead of altering a voice.

## Detailed Devpost description

A venue moves a summit by two weeks. The obvious record changes, but speaker confirmations, catering, programme deadlines, travel, and briefing materials can all become stale. Small teams usually reconstruct that chain manually, under time pressure, from scattered context.

InOrdo gives that response a reviewable sequence: **evidence → impact → proposal → approval → history and undo**. A reviewer pastes a source update into a synthetic project workspace. The application preserves the raw source, then uses a bounded server-side model route to draft one candidate change. Application code validates that draft against canonical project records and traverses explicit dependency edges to determine direct and downstream reach. The selected model receives those deterministic paths and drafts a bounded set of inert recovery actions.

The exceptional recording route is fixed to `gpt-5.6-luna` and requires an exact owner-issued, one-use actor/project/source grant. The optional automatic fallback is fixed to the open-weight `openai/gpt-oss-20b` model through a separately capped Vercel AI Gateway key. Recording never falls back, auto never consumes the OpenAI recording key, and disabled or unauthorized requests make no provider call.

The reviewer can compare source fact with model inference, inspect a readable path for every affected record, and choose actions individually. The model has no tools and no mutation authority. Authorized server logic rechecks selected actions and current state before an all-or-nothing operation, records ordered before/after evidence, and can create a compensating undo operation for supported reversible updates.

The Build Week fixture is the fictional **Regional Climate Action Summit 2026**: eight fictional team members, 24 active project records, and 26 explicit dependencies. Its source update moves the event from 12 September to 26 September 2026 because the venue is unavailable. All fixture data is synthetic and no connector is required.

The implemented repository includes the protected workflow interface, strict analysis and operation routes, deterministic traversal, RLS-scoped storage, audit history, undo, and a named-fixture reset contract. Successful analysis finalization promotes only an eligible, fully linked proposal from `draft` to `ready`; its actions remain inert until explicit selection. One verified GPT-5.6 Production run preserved genuine source evidence, showed direct and indirect deterministic impact, and produced a recovery proposal. The operator selected one internal date action with an explicit human response; apply and compensating undo succeeded, and linked history remains. New paid analysis is disabled.

## Problem

New evidence can invalidate work several steps downstream. Small teams lose time manually identifying dependencies, copying context, chasing owners, and deciding what changed. Hidden blockers, missed deadlines, lost rationale, and untraceable decisions appear because the source, impact chain, and resulting edits are rarely reviewed together.

## Solution

InOrdo preserves the update first, separates source fact from model interpretation, and derives impact from explicit project relationships. In the verified recording, GPT-5.6 drafted structured interpretation and recovery options; deterministic code owned reachability; a person owned approval. The selected internal date change was attributed and recorded, then reversed through a linked compensating operation after the server rechecked eligibility.

## How GPT-5.6 is meaningfully integrated

When the one-use recording route is authorized, GPT-5.6 performs two bounded server-side tasks through the OpenAI Responses API:

1. extract at most one candidate field change from untrusted evidence using strict structured output; and
2. draft one to eight recovery actions after deterministic application code supplies the validated change, affected records, and dependency paths.

Zod-backed schemas and application postvalidation check IDs, fields, values, dates, evidence spans, confidence, impact coverage, and allowlisted action types. The requests use no tools, provider storage is disabled, and model output cannot directly write project data. A `null` extraction is valid; uncertainty remains visible for human review rather than being guessed away.

## What remains deterministic

Application and database logic—not GPT-5.6—own authentication, authorization, canonical state, duplicate and rate controls, dependency traversal, direct/indirect depth, shortest paths, project revisions, validation, proposal state, approval, mutation, idempotency, audit records, undo checks, and demo reset. The same graph yields the same bounded, stably ordered paths.

## Human approval and undo safety

A proposal is not permission. Each proposed action remains inert until an authorized owner or admin selects it and supplies any required human input. The server rechecks proposal ownership, action state, expected item versions, payload allowlists, and idempotency before applying selected actions in one transaction. Undo never erases history: when supported, it creates a linked compensating operation after rechecking the recorded after-state. Created items, stale state, and unsupported changes are not silently reversed.

## Technical architecture

- **Web:** Next.js 16 App Router, React 19, TypeScript, React Server Components, and Tailwind CSS.
- **Data and identity:** Supabase Postgres, Auth, row-level security, generated database types, immutable evidence, and append-only operation history.
- **Model boundary:** server-only, mode-aware adapters for exact GPT-5.6 recording or capped Gateway GPT-OSS fallback, strict Zod-backed structured output, bounded context, no tools, and no direct mutation.
- **Domain logic:** pure TypeScript dependency traversal plus server-side authorization, validation, approval, idempotency, operation, undo, and reset services.
- **Quality:** Vitest and Testing Library for unit/component coverage, two guarded Playwright Chromium journeys, ESLint, TypeScript, and production builds.

## How Codex accelerated the build

Codex was used as an implementation and review partner across concrete work packages, with humans setting scope, ownership, and acceptance criteria:

- scaffolded the Next.js/TypeScript foundation and documented security boundaries;
- helped design and verify the workspace schema, RLS policies, deterministic 24-item/26-edge seed, and rollback-wrapped SQL checks;
- implemented typed authentication/data-access boundaries and project record contracts;
- built and tested deterministic dependency traversal, including cycles, fan-out, depth limits, and stable shortest paths;
- shaped the strict GPT-5.6 extraction/proposal contracts, postvalidation, idempotency, and failure handling;
- implemented and tested selective apply, ordered audit history, compensating undo, and named-fixture reset boundaries;
- built the evidence-backed impact review interface and its accessibility-focused interaction tests; and
- caught the `draft`-to-`ready` proposal-state mismatch during contract review, then verified the narrow server-owned readiness transition while the UI continues to fail closed for ineligible states.

No private transcript is committed. The primary shareable evidence is the exact Session ID entered above; it identifies the task without publishing its transcript.

## Challenges

- Keeping model inference useful without granting it graph, authorization, or mutation authority.
- Preserving immutable evidence even when provider work fails, while preventing partially persisted derived results.
- Making multi-hop impact readable and reproducible in the presence of cycles and duplicate edges.
- Applying selected actions atomically while retaining enough before/after state for safe, attributable undo.
- Maintaining tenant isolation across user-scoped reads and narrowly constrained privileged persistence.
- Resolving the proposal-state contract mismatch through a narrow, invariant-checked backend transition rather than bypassing it in client state.

## Accomplishments

- A standalone synthetic workspace with six project-record types, 24 active records, 26 explicit dependencies, and no customer data.
- Strict server-only provider integration code for one-use GPT-5.6 recording and capped GPT-OSS fallback that produces validated, inert review records and never performs an autonomous mutation.
- Deterministic, explainable direct and downstream paths with stable ordering and fail-closed graph bounds.
- Selective-operation, audit, compensating-undo, and history-preserving demo-reset contracts verified through linked rollback-wrapped database checks.
- A responsive impact-review interface that distinguishes source fact, GPT inference, deterministic paths, and human approval state.
- Automated coverage for authorization, validation, analysis orchestration, graph behavior, operations, and key interface interactions.
- One verified Production journey from genuine saved evidence through direct/indirect impact and recovery proposal to explicit approval, successful apply, linked history, and compensating undo.

## Lessons learned

- Structured model output is a starting boundary, not a substitute for canonical-state and evidence validation.
- Explainability improves when the graph—not model prose—is authoritative for reach.
- “Human in the loop” must be enforced as a server and database state transition, not merely shown as a checkbox.
- Undo requires version and after-state checks; a history button alone is not reversibility.
- Honest demo states are part of product quality. A visible disabled action is safer than a staged success.

## Future roadmap

1. Preserve the verified public YouTube upload and feedback references, complete the final signed-out link check, and submit the reviewed Devpost entry before the deadline.
2. Deepen the existing project-item, decision, risk, and dependency views against canonical server data.
3. Add proposal correction/rejection flows, stronger operational monitoring, and authenticated end-to-end browser coverage.
4. Explore optional integrations only after the standalone workflow is reliable; connectors, semantic retrieval, enterprise administration, and native mobile remain outside P0.

## Honest limitations

- Exactly one purpose-specific GPT-5.6 Production run succeeded and its saved synthetic result remains viewable. New paid analysis is disabled; test fixtures must never be presented as that live output.
- The optional open-weight GPT-OSS fallback runs through a dedicated capped Vercel AI Gateway. Its quota can be exhausted, and it is not guaranteed to remain free forever.
- A ChatGPT subscription cannot be used to pay for or authenticate this external application's API calls.
- The judge account is read-only and cannot start analysis or mutate the workspace.
- Available evidence input is typed/pasted updates, manual notes, meeting minutes, and meeting summaries. Files, CSV, URLs, voice, email, and connectors are unavailable.
- Ordinary project provisioning is unavailable; the ordinary-project page is explicitly informational.
- The authenticated bounded analysis-to-proposal, one-action apply, linked-history, compensating-undo, judge-viewer denial, deployed responsive/accessibility journeys, and public YouTube visibility are verified. The final signed-out public-asset and submission checks remain.
- The guarded Chromium demo journey intercepts provider/database seams; it validates the real UI and public request contracts but is not live authentication, RLS, Supabase RPC, or OpenAI evidence.
- Authenticated local responsive checks passed at 375 × 812, 768 × 1024, and 1440 × 1000 without horizontal overflow; they are not deployed accessibility evidence.
- Undo supports only eligible reversible field-update operations and stops on stale versions or after-state mismatch.
- Demo reset is deliberately limited to the configured named synthetic project and preserves archived history.
- The system has P0 request, graph, and rate bounds; it is not presented as production-ready or as a replacement for deployment-level abuse controls.
- There are no connectors, embeddings, RAG, autonomous mutations, enterprise administration, or native mobile application in P0.

## Submission verification rule

Before publishing, replace every angle-bracket placeholder and reconcile this copy with the exact recorded build. Do not claim live analysis, authenticated approval, undo, reset, deployment, accessibility, or production readiness unless the corresponding QA check is marked verified with current evidence.
