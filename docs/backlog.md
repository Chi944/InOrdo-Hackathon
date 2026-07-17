# InOrdo backlog

## How to read this backlog

- Priority runs from top to bottom within each phase.
- Owners are limited to **Deston**, **Andres**, and **Shared**, following the repository ownership boundary.
- A checked item means its acceptance criteria are present in the repository and have been verified. It does not imply that a dependent product workflow is complete.
- P0 contains only the agreed Build Week product: native records, explicit dependencies, pasted evidence, GPT-5.6 structured drafting, deterministic impact traversal, evidence-backed review, selective approval, operation history, undo, reset, and the accessible synthetic demo.

## P0 — Build Week

| Status | ID | Work package | Owner | Dependency | Acceptance criteria |
| --- | --- | --- | --- | --- | --- |
| [x] | P0-01 | Application foundation and guardrails | Shared | None | Repository uses npm, Node 22, TypeScript, Next.js App Router under `src/`, Tailwind CSS, Vitest, and Supabase configuration; environment and secret boundaries are documented; the public landing shell labels unfinished demo behavior honestly. |
| [x] | P0-02 | Product, demo, QA, and submission specification | Shared | P0-01 | Product brief, architecture, demo scenario, implementation backlog, QA checklist, submission draft, video script, and Codex log agree on terminology, scope, non-goals, synthetic data, and the evidence-to-undo sequence; no document claims unverified behavior works. |
| [ ] | P0-03 | Project schema, RLS, and deterministic seed | Deston | P0-01, P0-02 | Supabase migrations define project membership plus task, milestone, decision, event, risk, artifact, dependency, evidence, proposal, approval, and operation data needed by P0; constraints reject invalid cross-project references; RLS isolates projects; one synthetic eight-person demo workspace resets to the documented records and edges. |
| [ ] | P0-04 | Authentication, tenancy, and typed Supabase boundary | Deston | P0-03 | Authorized users can enter only their project context; unauthenticated and cross-project access fails closed; typed browser and server clients expose only agreed contracts; no service-role secret reaches browser code. |
| [ ] | P0-05 | Native project record views | Andres | P0-03, P0-04 | Authorized users can view the seeded tasks, milestones, decisions, event, risks, and artifacts with stable IDs, status text, ownership, dates where relevant, and clear synthetic-data labeling; empty, loading, and error states are accessible and responsive. |
| [ ] | P0-06 | Explicit dependency maintenance and contract | Shared | P0-03, P0-05 | Users can inspect the seeded directed dependencies; server validation rejects self-links, invalid records, and cross-project edges; the frontend consumes Deston's typed edge contract without duplicating authorization logic. |
| [ ] | P0-07 | Pasted evidence intake and immutable provenance | Shared | P0-03, P0-04 | The exact documented venue update can be pasted; length and shape are validated; raw text and provenance are stored before interpretation; the evidence remains visible and unchanged; failed intake produces no partial record. |
| [ ] | P0-08 | GPT-5.6 structured change extraction | Deston | P0-07 | A server-only OpenAI adapter uses GPT-5.6 to return a structured candidate change; Zod validates the response; the expected event-date change can be reviewed, corrected, confirmed, or rejected; malformed output, timeout, or rejection causes no mutation. |
| [ ] | P0-09 | Deterministic impact traversal | Deston | P0-06, P0-08 | Application code—not the model—traverses explicit directed edges from the confirmed change; cycles are safe; direct and downstream depth are distinguished; every affected item includes at least one ordered dependency path; the documented fixture produces the expected impact set. |
| [ ] | P0-10 | Evidence-backed impact review | Andres | P0-07, P0-08, P0-09 | Reviewers can compare raw evidence, confirmed change, direct impacts, downstream impacts, and the ordered path for each item; model content and deterministic results are labeled distinctly; the view works by keyboard and at approximately 375, 768, and 1440 pixels. |
| [ ] | P0-11 | GPT-5.6 recovery proposal drafting | Deston | P0-08, P0-09 | The server-only model adapter drafts structured recovery actions tied to affected records; Zod validates every action; invalid actions are rejected; all valid outputs remain immutable proposals with no mutation authority. |
| [ ] | P0-12 | Selective approval and proposal review | Shared | P0-10, P0-11 | Reviewers can inspect and approve or decline each proposed action independently; approval state is explicit and accessible; the documented `RA-08` internal travel-options task update can remain unapproved while other internal actions proceed; proposal state alone never mutates data or books travel. |
| [ ] | P0-13 | Authorized operations and idempotency | Deston | P0-04, P0-12 | Before applying an approved action, server code rechecks identity, project membership, permission, record version, validation, and idempotency; unauthorized, stale, invalid, duplicate, or partially logged requests cause no mutation; success records the approved internal change and reversible before-state in one transaction. |
| [ ] | P0-14 | Operation history and supported undo | Shared | P0-13 | History identifies evidence, proposal action, affected record, approver, time, before-state, and result; the interface distinguishes proposed, approved, applied, and undone states; one supported internal change can be undone through an authorized compensating operation without deleting original history. |
| [ ] | P0-15 | Isolated deterministic demo reset | Deston | P0-03, P0-14 | A server-only, secret-protected reset targets only the configured synthetic project slug; arbitrary or non-demo targets fail; repeated reset restores the documented records, edges, dates, and empty evidence/proposal/operation state. |
| [ ] | P0-16 | End-to-end demo, accessibility, and release verification | Shared | P0-05 through P0-15 | A judge can complete the verified evidence → impact → proposal → approval → history and undo flow and return to baseline; synthetic and unfinished states are labeled; keyboard, focus, screen-reader labels, status text, and responsive layouts pass manual review; required lint, typecheck, unit test, build, diff, and available browser tests pass; submission and video copy match the deployed build. |

## P1 — Standalone product depth

| Status | ID | Work package | Owner | Dependency | Acceptance criteria |
| --- | --- | --- | --- | --- | --- |
| [ ] | P1-01 | Collaborative ownership and handoffs | Shared | P0-16 | Members can assign records, request review, comment on an impact or proposal, and record a handoff; events respect project permissions and remain attributable. |
| [ ] | P1-02 | In-product notifications | Shared | P1-01 | Members receive configurable in-product notices for assignment, review, approval, conflict, and undo events; notifications link to the relevant evidence or record and do not expose another project. |
| [ ] | P1-03 | Proposal editing and conflict resolution | Shared | P0-14 | Authorized reviewers can edit a draft action without altering the original model output; changes are attributable; stale-state conflicts show the difference and require a fresh decision before application. |
| [ ] | P1-04 | Configurable approval roles | Deston | P0-13, P1-03 | Projects can require defined roles or multiple approvals for selected internal action types; server enforcement and RLS match the UI; missing approval fails closed. |
| [ ] | P1-05 | Search, filters, and saved views | Andres | P0-05, P0-14 | Users can find native records and change-response history using scoped text search and filters; saved views preserve accessible filter state; results never cross authorized project boundaries. |
| [ ] | P1-06 | Reusable project templates | Shared | P0-03, P0-06 | Users can create a new standalone project from a reviewed template containing record types and dependency patterns; template application is deterministic and does not copy private project content. |
| [ ] | P1-07 | Dependency editing and validation UX | Shared | P0-06, P0-09 | Users can add, remove, and inspect edges with clear direction labels; cycle and broken-reference warnings are understandable; a preview explains how an edit would change reach before it is saved. |
| [ ] | P1-08 | Operational hardening | Deston | P0-16 | Retention rules, audit access, error monitoring, rate limits, backup and restore procedures, model-failure handling, and security tests are documented and verified for the intended deployment stage; no production-readiness claim precedes review. |

## Post-hackathon — Evaluated expansion

Post-hackathon items are possibilities to validate, not committed Build Week functionality. The standalone workflow remains the product foundation.

| Status | ID | Work package | Owner | Dependency | Acceptance criteria |
| --- | --- | --- | --- | --- | --- |
| [ ] | PH-01 | Cross-project and portfolio impact views | Shared | P1-04, P1-08 | Authorized users can review relationships across selected projects with explicit path explanations; tenant boundaries and project-specific approvals remain enforced. |
| [ ] | PH-02 | Scenario comparison | Shared | P1-03, P1-07 | Users can compare at least two inert recovery scenarios, including affected records and trade-offs, without applying either; approval is still required per action after a scenario is chosen. |
| [ ] | PH-03 | Optional evidence import connector pilot | Shared | P1-08 | A single permission-scoped, read-only pilot preserves external provenance and consent, handles revocation and duplicates, and can be disabled without reducing the standalone product; it never applies external or internal mutations automatically. |
| [ ] | PH-04 | Approved-outcome export pilot | Shared | PH-03 | An authorized user can explicitly export a selected approved outcome; preview, destination, permission, idempotency, result, and failure are recorded; no background sync or autonomous write is introduced. |
| [ ] | PH-05 | Change-pattern reporting | Andres | P1-08, PH-01 | Teams can review attributable trends in sources, affected record types, blockers, approvals, and recovery outcomes; reports avoid unsupported causal claims and respect retention and project access rules. |
| [ ] | PH-06 | Retrieval and search research | Shared | P1-05, P1-08 | User research establishes a real need before any RAG, embedding, or semantic-search design is chosen; a privacy, cost, deletion, access-control, and explainability review is completed; the outcome may be to retain deterministic or lexical approaches. |
| [ ] | PH-07 | Native mobile evaluation | Andres | P0-16, P1-01 | Usage research shows a task the responsive web experience cannot serve well; security, accessibility, offline behavior, and maintenance cost are assessed before any native implementation is approved. |

## Permanently guarded boundaries

These are not backlog shortcuts:

- The model does not mutate project data or approve its own proposal.
- Deterministic code owns graph reach, authorization, application, operation history, and undo.
- Optional connectors do not become a requirement for core InOrdo use.
- External side effects are never represented as safely undoable internal operations.
- n8n, connector sprawl, embeddings, enterprise administration, and native mobile are not P0 work.
