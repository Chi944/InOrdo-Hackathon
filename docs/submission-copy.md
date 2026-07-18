# InOrdo submission copy

## Submission details

- **Track:** Work and Productivity
- **Deployed application:** `<PRODUCTION_URL>`
- **Public repository:** `<PUBLIC_REPOSITORY_URL>`
- **Public demo video:** `<PUBLIC_YOUTUBE_VIDEO_URL>`
- **Devpost submission:** `<DEVPOST_URL>`
- **Primary Codex `/feedback` Session ID:** `<PRIMARY_FEEDBACK_SESSION_ID>`

## One-line pitch

InOrdo turns one project update into evidence-backed impacts and recovery actions for selective human approval, with traceable history and undo contracts where supported.

## 50-word summary

InOrdo helps small teams respond safely when new evidence changes a project. GPT-5.6 structures the update and drafts recovery actions; deterministic code traces explicit dependencies. Reviewers compare evidence, inspect impact paths, and evaluate actions for selective approval. Application contracts record attributable history and compensating undo when supported and state matches.

## Detailed Devpost description

A venue moves a summit by two weeks. The obvious record changes, but speaker confirmations, catering, programme deadlines, travel, and briefing materials can all become stale. Small teams usually reconstruct that chain manually, under time pressure, from scattered context.

InOrdo gives that response a reviewable sequence: **evidence → impact → proposal → approval → history and undo**. A reviewer pastes a source update into a synthetic project workspace. The application preserves the raw source, then uses server-side GPT-5.6 structured output to draft one candidate change. Application code validates that draft against canonical project records and traverses explicit dependency edges to determine direct and downstream reach. GPT-5.6 receives those deterministic paths and drafts a bounded set of inert recovery actions.

The reviewer can compare source fact with model inference, inspect a readable path for every affected record, and choose actions individually. The model has no tools and no mutation authority. Authorized server logic rechecks selected actions and current state before an all-or-nothing operation, records ordered before/after evidence, and can create a compensating undo operation for supported reversible updates.

The Build Week fixture is the fictional **Regional Climate Action Summit 2026**: eight fictional team members, 24 active project records, and 26 explicit dependencies. Its source update moves the event from 12 September to 26 September 2026 because the venue is unavailable. All fixture data is synthetic and no connector is required.

The implemented repository includes the protected workflow interface, strict analysis and operation routes, deterministic traversal, RLS-scoped storage, audit history, undo, and a named-fixture reset contract. Linked database checks and automated tests cover these boundaries. The release still has explicit gates: a fresh analysis persists a `draft` proposal while apply accepts only `ready` or `partially_approved`; a live OpenAI request and the authenticated production browser journey have not yet been verified. We will not present either as complete until those checks pass.

## Problem

New evidence can invalidate work several steps downstream. Small teams lose time manually identifying dependencies, copying context, chasing owners, and deciding what changed. Hidden blockers, missed deadlines, lost rationale, and untraceable decisions appear because the source, impact chain, and resulting edits are rarely reviewed together.

## Solution

InOrdo preserves the update first, separates source fact from model interpretation, and derives impact from explicit project relationships. GPT-5.6 drafts structured interpretation and recovery options; deterministic code owns reachability; a person owns approval. Applied internal changes are attributed and recorded, with compensating undo only when the operation is reversible and current state still matches the recorded result.

## How GPT-5.6 is meaningfully integrated

GPT-5.6 performs two bounded server-side tasks through the OpenAI Responses API:

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
- **Model boundary:** server-only OpenAI Responses adapter for GPT-5.6 Luna, strict Zod-backed structured output, bounded context, no tools, and no direct mutation.
- **Domain logic:** pure TypeScript dependency traversal plus server-side authorization, validation, approval, idempotency, operation, undo, and reset services.
- **Quality:** Vitest and Testing Library for unit/component coverage, Playwright configuration for browser checks, ESLint, TypeScript, and production builds.

## How Codex accelerated the build

Codex was used as an implementation and review partner across concrete work packages, with humans setting scope, ownership, and acceptance criteria:

- scaffolded the Next.js/TypeScript foundation and documented security boundaries;
- helped design and verify the workspace schema, RLS policies, deterministic 24-item/26-edge seed, and rollback-wrapped SQL checks;
- implemented typed authentication/data-access boundaries and project record contracts;
- built and tested deterministic dependency traversal, including cycles, fan-out, depth limits, and stable shortest paths;
- shaped the strict GPT-5.6 extraction/proposal contracts, postvalidation, idempotency, and failure handling;
- implemented and tested selective apply, ordered audit history, compensating undo, and named-fixture reset boundaries;
- built the evidence-backed impact review interface and its accessibility-focused interaction tests; and
- caught the `draft`-to-`ready` proposal-state mismatch during contract review, so the UI fails closed instead of implying approval works.

No private transcript is committed. The primary shareable evidence will be the Session ID entered above after the team runs `/feedback`.

## Challenges

- Keeping model inference useful without granting it graph, authorization, or mutation authority.
- Preserving immutable evidence even when provider work fails, while preventing partially persisted derived results.
- Making multi-hop impact readable and reproducible in the presence of cycles and duplicate edges.
- Applying selected actions atomically while retaining enough before/after state for safe, attributable undo.
- Maintaining tenant isolation across user-scoped reads and narrowly constrained privileged persistence.
- Surfacing the current proposal-state contract mismatch honestly rather than bypassing a Deston-owned backend boundary.

## Accomplishments

- A standalone synthetic workspace with six project-record types, 24 active records, 26 explicit dependencies, and no customer data.
- Strict server-only GPT-5.6 integration code that produces validated, inert review records and never performs an autonomous mutation.
- Deterministic, explainable direct and downstream paths with stable ordering and fail-closed graph bounds.
- Selective-operation, audit, compensating-undo, and history-preserving demo-reset contracts verified through linked rollback-wrapped database checks.
- A responsive impact-review interface that distinguishes source fact, GPT inference, deterministic paths, and human approval state.
- Automated coverage for authorization, validation, analysis orchestration, graph behavior, operations, and key interface interactions.

## Lessons learned

- Structured model output is a starting boundary, not a substitute for canonical-state and evidence validation.
- Explainability improves when the graph—not model prose—is authoritative for reach.
- “Human in the loop” must be enforced as a server and database state transition, not merely shown as a checkbox.
- Undo requires version and after-state checks; a history button alone is not reversibility.
- Honest demo states are part of product quality. A visible disabled action is safer than a staged success.

## Future roadmap

1. Resolve and test the explicit `draft` → review-ready proposal transition.
2. Complete a funded live GPT-5.6 request and authenticated production browser run, including incognito, responsive, accessibility, approval, history, undo, and reset checks.
3. Complete richer project-item, decision, risk, and dependency views against canonical server data.
4. Add proposal correction/rejection flows, stronger operational monitoring, and end-to-end browser coverage.
5. Explore optional integrations only after the standalone workflow is reliable; connectors, semantic retrieval, enterprise administration, and native mobile remain outside P0.

## Honest limitations

- No live OpenAI request has been verified in this worktree, so test fixtures must never be presented as live GPT-5.6 output.
- The authenticated HTTP/browser workflow and incognito production deployment have not yet been verified.
- Fresh completed analyses currently create `draft` proposals, while apply accepts `ready` or `partially_approved`; no promotion route exists, so the UI correctly disables approval.
- Responsive checks used a temporary, clearly labeled synthetic preview at 375 × 812, 768 × 1024, and 1440 × 900; they are not production-authenticated evidence.
- Undo supports only eligible reversible field-update operations and stops on stale versions or after-state mismatch.
- Demo reset is deliberately limited to the configured named synthetic project and preserves archived history.
- The system has P0 request, graph, and rate bounds; it is not presented as production-ready or as a replacement for deployment-level abuse controls.
- There are no connectors, embeddings, RAG, autonomous mutations, enterprise administration, or native mobile application in P0.

## Submission verification rule

Before publishing, replace every angle-bracket placeholder and reconcile this copy with the exact recorded build. Do not claim live analysis, authenticated approval, undo, reset, deployment, accessibility, or production readiness unless the corresponding QA check is marked verified with current evidence.
