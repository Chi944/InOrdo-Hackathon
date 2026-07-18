# Prompt 7 readiness

Prompt 7 can start after this Prompt 5 branch is reviewed and its schema, graph contracts, and project-record operations are available on the branch used as Prompt 7's base. The OpenAI pipeline can be implemented and tested offline with an injected client; a live API key and browser login are verification gates, not prerequisites for writing the server-side code.

## Required decisions before persistence work

1. **Proposal action vocabulary.** Prompt 7 names `update_item_field`, `create_task`, `create_risk`, and `request_confirmation`. The current database enum names `update_item`, `create_item`, `add_dependency`, and `remove_dependency`. Decide and document a narrow mapping, or add a forward migration, before persisting proposal actions. Do not silently coerce an unknown model action.
2. **Project revision.** Prompt 7 requires idempotency from a project version plus a normalized source hash, but `projects` has no revision column. Prefer a deterministic revision derived from ordered active item IDs/versions and normalized edges, unless a reviewed migration adds a database-owned project revision maintained for every relevant change.
3. **Atomic derived-record persistence.** Authenticated users cannot directly insert change events, impact runs/items, proposals, or proposal actions. Add a narrow authenticated `SECURITY DEFINER` transaction/RPC that rechecks `auth.uid()`, rejects anonymous identities, verifies role and project/workspace scope, and accepts only validated inert data. Do not put a service-role client in the request path. If no RPC is added, define and test explicit compensating cleanup for every possible partial write.
4. **Immutable evidence and duplicate protection.** `source_documents` exists, but Prompt 7 must define the normalized source hash, uniqueness/idempotency behavior, bounded input, and small-demo rate protection before accepting analysis requests.

## Integration prerequisites

- Base Prompt 7 on the reviewed Prompt 5 commit so it uses the documented edge direction and the pure graph traversal rather than reimplementing reachability.
- Coordinate with Andres's Prompt 4/6 branches before merging because both may touch the project page. Their UI is not a backend prerequisite, but Prompt 6 should consume the final server contract and visual conflicts must be resolved deliberately.
- Create an operator-owned Supabase Auth user and configure the public Supabase environment variables locally before browser verification. Never commit or print the values.
- `OPENAI_API_KEY` is optional for mocked development. Run exactly one controlled live analysis only when the required variable names are present and the API project is funded; never print the key or raw private source text.

## Prompt 7 security invariants

- Use a server-only OpenAI Responses API adapter with `store: false`, bounded input/output, a timeout, and at most one transient retry.
- Treat source text as untrusted evidence, use strict structured output, and validate target IDs, fields, evidence spans, enums, dates, and canonical previous values after the model call.
- Do not enable model tools, web/file search, shell, arbitrary functions, embeddings, or RAG.
- Feed only validated proposed changes and deterministic graph paths into proposal drafting.
- Persist proposals as pending data only. Model output never calls a mutation operation and never changes a project item.

## Ready-to-start gate

Prompt 7 is ready to branch when Prompt 5's checks pass, the branch base is agreed, and the three persistence decisions above have explicit answers. Browser credentials and an API key may remain absent while mocked tests are built, but they are required for the corresponding manual verification claims.
