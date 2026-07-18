# Prompt 7 readiness and decisions

Prompt 7 is based on the completed Prompt 5 project-record and deterministic-graph contracts. The server pipeline can be implemented and tested with an injected model adapter; a funded OpenAI project and browser credentials are verification gates, not prerequisites for offline development.

## Prompt 5 handoff (historical)

Prompt 5 identified four decisions that had to be explicit before model-derived persistence:

1. Reconcile Prompt 7's action vocabulary with the existing database enum.
2. Define a deterministic project revision for idempotency and stale-context rejection.
3. Provide atomic derived-record persistence behind a narrowly reviewed server-only capability.
4. Define immutable evidence hashing, duplicate behavior, and small-demo rate protection.

Those were readiness gaps at the Prompt 5 handoff. Prompt 7 resolves them as follows.

## Resolved Prompt 7 decisions

### Action vocabulary

The model may emit only `update_item_field`, `create_task`, `create_risk`, or `request_confirmation`.

- `update_item_field` persists as `update_item` with an allowlisted field, canonical previous value, proposed value, and expected item version.
- `create_task` persists as `create_item` with `item_type: task`.
- `create_risk` persists as `create_item` with `item_type: risk`.
- `request_confirmation` persists as the dedicated `request_confirmation` inert action type.

Unknown actions and unsafe fields are rejected. The mapping is explicit in application validation and revalidated by the database finalization RPC; there is no silent coercion.

### Project revision

The revision is SHA-256 over a stable `impact-graph-v1` representation of active item IDs/versions and normalized dependency endpoint pairs. Items and edges are ordered deterministically, self-edges/inactive endpoints are ignored, and duplicate endpoint pairs collapse exactly as they do for traversal. Relationship labels are not revision inputs because reachability uses endpoint pairs.

The application computes the revision from its bounded one-project context. Both claim creation and finalization recompute it in the database. A change to relevant item versions or graph reachability between those phases produces a safe stale-project conflict before derived records are written.

### Two-phase persistence

The request-scoped client verifies the non-anonymous contributor and loads the bounded project context before any privileged capability or model client is initialized. `begin_project_analysis` is a `SECURITY INVOKER` public wrapper executable only by `service_role`; it passes the verified actor to a private implementation that rechecks contributor membership, project/workspace scope, source hash, bounds, and revision, then stores the immutable raw source and a unique `processing` claim before model work.

`complete_project_analysis` accepts only the application's fully postvalidated inert result. It locks the claim, reauthorizes the actor, rechecks revision/current item state, independently recomputes deterministic paths, validates every change/impact/action, and creates the pending change event, impact run/items, proposal/actions, and succeeded claim state atomically. Any invalid element aborts the transaction; no partially persisted derived analysis is allowed. A separate terminal failure transition stores only an allowlisted stage/code and optional bounded provider request ID, never raw provider output or source text.

Login, application authorization, bounded context reads, and ordinary project operations continue to use the user's Supabase session and RLS. Prompt 7 persistence lazily initializes the nominally distinct service-role client only after authorization/context loading and narrows it to three allowlisted RPCs. Authenticated and anonymous roles have no execution grant. The private implementations use an empty `search_path`, fully qualified relations, exact grants, and actor membership/ownership checks.

### Evidence, duplicate, and rate semantics

Raw evidence remains unchanged. Duplicate identity uses SHA-256 of NFC-normalized source text after line-ending normalization, per-line edge trimming, horizontal whitespace collapse, and outer trimming.

The unique key is project/workspace + project revision + normalized source hash. A duplicate `processing` key returns the existing claim with the remaining portion of its immutable three-minute lease. The browser instructs the user to resubmit the exact update after that delay; the first exact replay after expiry atomically terminalizes the same request as failed without another model call. A success transition at or after expiry is rejected and its derived inserts roll back. A duplicate success returns its existing derived IDs, and a duplicate failure returns a safe conflict. Transaction advisory locks serialize the shared source key and actor rate check. The small-demo policy allows at most five new claims per actor and project in a rolling ten-minute window.

## Implemented model boundary

- Only the server calls the OpenAI Responses API.
- `OPENAI_MODEL` defaults to `gpt-5.6-luna`.
- Both logical calls use strict structured outputs, `store: false`, low reasoning effort, no tools, bounded context/output, a 30-second timeout per call, and at most one SDK retry per call for transient failures. A successful analysis therefore has two logical calls and at most four provider attempts.
- Source text is explicitly untrusted. Embedded instructions cannot expand tools, fields, item IDs, or action vocabulary.
- Application code postvalidates IDs, fields, evidence substrings/offsets, enums, dates, owners, current values, item versions, confidence, and deterministic impact coverage.
- GPT extracts one candidate change and drafts inert recovery actions. Pure TypeScript, never GPT, determines downstream impact paths.
- Every valid change is marked for human review. Low confidence, a previous-value mismatch, warnings, ambiguities, or unresolved references add explicit review reasons.
- Model output never invokes a mutation operation and never changes a project item.

## Remaining verification and integration gates

- Preserve the recorded Node 22 lint, typecheck, 177-test, production-build, and final staged-diff evidence when reviewing the branch.
- Preserve the recorded linked migration, regenerated types, rollback-wrapped SQL verification, clean schema lint, and clean security-advisor evidence when reviewing the final diff.
- Coordinate the final API contract with Andres's Prompt 6 UI before merging; Prompt 7 does not redesign or claim an analysis form.
- Create/use an operator-owned Supabase Auth account and untracked public Supabase environment configuration before browser verification.
- Run exactly one controlled live analysis only when `OPENAI_API_KEY` and the required Supabase environment names are present and the OpenAI project is funded. Record safe model/request/usage metadata only; never record the key or raw private source.
- Review the Prompt 7 threat controls and forward-only incident procedure in `docs/security-review.md` and `docs/rollback-plan.md` before enabling analysis traffic.

At this documentation pass, no live OpenAI call or browser manual verification occurred because the required environment variable names were absent from the process environment. No credential or environment file was read. Automated and linked-database outcomes must be taken from the final command output and [qa-checklist.md](qa-checklist.md), not inferred from this readiness record.
