# InOrdo product brief

## Document status

This brief defines the intended product and delivery scope for InOrdo. Unless a capability is explicitly described as verified, it is planned target behavior rather than a claim about the current build.

As of 18 July 2026, the repository verifies the application foundation and public landing shell. Authentication, persistence, GPT-5.6 extraction, dependency traversal, recovery proposals, approvals, operation history, undo, and demo reset still require implementation and end-to-end verification before they may be presented as working.

## Executive summary

InOrdo is a Work and Productivity product for small teams whose plans change as new evidence arrives. It preserves the original update, uses GPT-5.6 server-side to draft a structured interpretation, and uses deterministic application code to trace direct and downstream effects through explicit project dependencies. The team reviews evidence-backed impacts, considers proposed recovery actions, and approves only the internal changes it wants. Applied operations are recorded and can be undone where supported.

The Build Week target is a focused, standalone demonstration for one synthetic 4–12 person workspace. It covers the sequence **evidence → impact → proposal → approval → history and undo**. It does not depend on integrations and does not allow the model to mutate project data.

## Vision

Give small teams a safe, understandable way to respond when one new fact changes many parts of a project.

InOrdo should make the chain from source evidence to an approved response visible. A project lead should be able to answer five questions without reconstructing the project from memory:

1. What changed, and what is the original source?
2. Which work is affected, directly and downstream?
3. Why is each item affected?
4. What could the team do next?
5. Who approved each applied change, and can it be reversed?

## Audience

### Long-term users

- Student project teams and university clubs coordinating shared deadlines.
- Startups managing fast-moving product and operating plans.
- Software teams connecting decisions, releases, milestones, and artifacts.
- Agencies and campaign teams coordinating launches, approvals, and deliverables.
- Nonprofits planning programmes, campaigns, events, and stakeholder work.

### Supported project types

- Software development.
- Marketing and media launches.
- Event planning.
- Public-interest, advocacy, or organizational campaigns.
- General project management.

The product must remain useful as a standalone system. Integrations may be offered later as optional inputs or outputs, but they must not be required for the core workflow.

## Primary persona

The primary persona is a project lead or coordinator in a 4–12 person team. They hold the plan together across tasks, milestones, decisions, events, risks, and artifacts. They are accountable for deadlines and follow-through but do not have time to inspect every record after each change.

They need help finding consequences, not an automated replacement for their judgment. They want a clear source, an explainable impact path, a practical recovery proposal, and control over every applied action.

## Jobs to be done

When a new project fact arrives, the primary user needs to:

- Preserve the exact update and its provenance before interpretation changes the context.
- Turn an unstructured update into a reviewable candidate change.
- Find all affected project records without relying on memory or informal messages.
- Distinguish immediate effects from downstream consequences.
- Understand the dependency path that makes each impact relevant.
- Coordinate a recovery plan without rewriting every project record manually.
- Approve low-risk actions while withholding actions that need more discussion.
- Explain later what changed, what was approved, who approved it, and why.
- Reverse a supported internal change without erasing its history.
- Restore a known synthetic baseline for a reliable demonstration.

## Problem statements

### Downstream invalidation

A date, decision, constraint, or deliverable can change while dependent work still reflects the old assumption. The obvious record may be updated, but the downstream chain remains stale.

### Manual coordination

Project leads repeatedly inspect boards, documents, calendars, and chat threads to work out who needs to respond. This is slow and inconsistent, especially when dependencies are implicit.

### Lost information

The original update and the reasoning behind a response are often separated from the records they changed. Teams later see the result without the source.

### Missed deadlines

When affected milestones and tasks are not identified quickly, teams discover the conflict too late to recover cleanly.

### Untraceable decisions

Teams may not be able to show which evidence caused a decision, which action was approved, or who authorized the change.

### Hidden blockers

Risks and blocked work can remain invisible several dependency steps away from the changed item.

## Value proposition

InOrdo turns one project update into a controlled response: preserved evidence, explainable impacts, a bounded recovery proposal, selective human approval, and traceable internal operations with undo where supported.

Unlike a generic assistant that only summarizes text, InOrdo separates responsibilities:

- GPT-5.6 interprets unstructured evidence and drafts candidate recovery actions.
- Deterministic code decides dependency reach and explains each path.
- Authorized people decide which actions may be applied.
- Operation records preserve accountability and the information needed for supported undo.

## Product principles

1. **Evidence before action.** Preserve the raw source and provenance before deriving a change.
2. **Interpretation stays reviewable.** Model output is a candidate, not a fact. People can correct or reject it.
3. **Impact must be explainable.** Every affected item shows an explicit dependency path back to the reviewed change.
4. **A proposal is not permission.** No proposed action mutates data until a person approves that specific action.
5. **Application code owns control.** Authorization, graph traversal, validation, mutation, history, and undo are deterministic server responsibilities.
6. **Approval is selective.** The team can apply safe internal updates while leaving sensitive or costly actions unapproved.
7. **History is additive.** Undo creates a compensating operation; it does not erase what happened.
8. **Standalone first.** The complete core workflow works without external connectors.
9. **Fail closed.** Uncertain authorization, validation, approval, idempotency, or logging results in no mutation.
10. **Claims follow verification.** Demo and submission language describes only behavior exercised in the current build.

## Full long-term vision

InOrdo can become a shared change-response layer for varied team projects. Teams would maintain native records and explicit dependencies, preserve incoming evidence, compare alternative recovery plans, and build a durable account of why the plan changed over time.

The long-term product should support richer collaboration, reusable project templates, configurable approval roles, stronger conflict handling, portfolio views, and better operational reporting. Teams should be able to use these capabilities entirely within InOrdo.

Optional integrations could later bring selected updates into InOrdo or export approved outcomes to other tools. Those integrations should preserve provenance and never weaken the evidence, authorization, approval, or history boundaries. Native mobile clients, enterprise administration, semantic retrieval, and other larger investments remain research or later-roadmap possibilities, not assumptions behind the core product.

## Scope

### P0 — Build Week target

P0 is one end-to-end, synthetic demonstration of the core workflow:

- Native project records for tasks, milestones, decisions, events, risks, and artifacts.
- Explicit directed dependencies between records.
- A pasted source update stored as immutable raw evidence with provenance.
- Server-side GPT-5.6 extraction of a structured candidate change, validated with Zod.
- Human review of the extracted change before it drives the impact review.
- Deterministic traversal of direct and downstream dependencies, including explainable paths.
- Evidence-backed impact review that links affected records to the source and dependency path.
- GPT-5.6-drafted recovery actions, validated before presentation.
- Selective, per-action human approval.
- Authorized application of approved internal record changes only.
- Attributable operation history and undo for supported internal operations.
- A deterministic reset limited to the isolated synthetic demo workspace.
- An accessible, responsive web experience for the judge-facing flow.

The P0 demo workspace represents a synthetic team of eight people, within the required 4–12 person range. It contains no real customer or private data.

### P1 — After a successful P0

- Collaborative assignments, comments, handoffs, and in-product notifications.
- Editable proposals with conflict detection and clearer resolution states.
- Configurable approval roles for higher-risk internal operations.
- Search, filtering, saved views, and reusable project templates.
- Additional project views and more detailed dependency maintenance tools.
- Observability, retention controls, operational recovery, and broader automated test coverage.

P1 remains standalone and does not require connectors, embeddings, or autonomous mutation.

### Future possibilities

- Optional, permission-scoped connectors that import evidence or export approved outcomes while preserving provenance.
- Cross-project and portfolio impact views.
- Scenario comparison before a recovery plan is approved.
- Reporting on change patterns, recurring blockers, and recovery outcomes.
- Carefully evaluated search or retrieval approaches, selected only after privacy and usefulness testing.
- Native mobile experiences only if the responsive web product and user research justify the investment.

These are direction-setting possibilities, not committed features or Build Week claims.

## Explicit non-goals

### P0 non-goals

- Autonomous model-driven mutation of any project record.
- External connectors, sync engines, or third-party workflow automation.
- RAG, embeddings, vector search, or semantic search infrastructure.
- n8n or another external orchestration service.
- Enterprise administration or complex organization provisioning.
- Native mobile applications.
- Mutation of external calendars, ticketing systems, documents, messages, or financial commitments.
- Replacing deterministic dependency traversal with model inference.
- Broad production-readiness, scale, reliability, or security claims during Build Week.
- Real customer workspaces, private participant information, or production credentials in the demo.

### Architecture non-goals

P0 does not introduce Django, FastAPI, Firebase, Neon, Railway, Neo4j, Redis, or an alternative product stack. The agreed architecture is npm, Node 22, TypeScript, Next.js App Router, Tailwind CSS, Supabase, and the OpenAI SDK.

## User stories

The following stories describe target behavior. They are acceptance inputs, not claims that the behavior is already implemented.

### Evidence and interpretation

- As a project lead, I want to paste an update and retain the exact raw text so that reviewers can inspect the source later.
- As a reviewer, I want to see source provenance beside the candidate change so that I know what the interpretation is based on.
- As a reviewer, I want to correct or reject a model-extracted change so that an inaccurate interpretation cannot drive the workflow.
- As a team member, I want uncertain or invalid model output to fail safely so that no project record changes by accident.

### Impact

- As a project lead, I want direct and downstream impacts separated so that I can prioritize the immediate response.
- As a reviewer, I want to see the ordered dependency path for each impact so that I can understand why it is included.
- As a team member, I want traversal to handle cycles safely so that the impact review is complete and does not loop indefinitely.

### Proposal and approval

- As a project lead, I want a recovery draft that references affected records so that I can prepare a response faster.
- As an approver, I want to approve actions one at a time so that a safe update does not authorize a sensitive one.
- As an approver, I want stale or unauthorized requests rejected so that approval cannot bypass current state or permissions.
- As a reviewer, I want unapproved actions to remain visibly inert so that proposal status is unambiguous.

### History, undo, and reset

- As a team member, I want applied changes to record the approver, time, source, before-state, and result so that the operation is attributable.
- As an authorized user, I want to undo a supported internal operation with a compensating record so that recovery remains traceable.
- As a demo operator, I want to reset only the synthetic workspace to a known baseline so that every demonstration begins consistently.

### Access and presentation

- As a project member, I want to see only workspaces I am authorized to access so that tenant data remains isolated.
- As a keyboard or screen-reader user, I want clear headings, labels, focus states, and status text so that I can complete the workflow without relying on a pointer or color alone.

## Functional requirements

All requirements below are P0 targets unless marked otherwise.

| ID | Requirement |
| --- | --- |
| FR-01 | The system shall provide native records for tasks, milestones, decisions, events, risks, and artifacts within an authorized project. |
| FR-02 | The system shall store explicit directed dependency edges between project records and reject invalid cross-project relationships. |
| FR-03 | The system shall accept a length- and shape-validated pasted source update and preserve the raw evidence and provenance before model processing. |
| FR-04 | A server-only GPT-5.6 adapter shall produce a structured candidate change; Zod validation shall succeed before the result enters domain logic. |
| FR-05 | A person shall be able to review, correct, confirm, or reject the candidate change. Rejection or validation failure shall produce no mutation. |
| FR-06 | Deterministic application code shall traverse explicit dependencies from the confirmed changed record, prevent cycles, distinguish direct from downstream impacts, and return at least one ordered path for every affected record. |
| FR-07 | The impact review shall display the preserved evidence reference, affected record, impact depth, and dependency path. |
| FR-08 | GPT-5.6 may draft structured recovery actions on the server; every draft shall be validated and remain proposal data. |
| FR-09 | A reviewer shall be able to approve or decline each proposed action independently. An unapproved action shall not mutate data. |
| FR-10 | Before an approved action is applied, server code shall recheck identity, project membership, authorization, current record version, action validity, and idempotency. |
| FR-11 | Each successful internal mutation shall create an attributable operation record containing the approved action, relevant evidence reference, affected record, before-state needed for supported undo, result, and approver. |
| FR-12 | Supported undo shall create a compensating operation and preserve the original history. Unsupported or unsafe undo shall be disabled with an explanation. |
| FR-13 | Demo reset shall be server-only, deterministic, and restricted to the configured synthetic workspace; it shall not accept an arbitrary project target. |
| FR-14 | The judge-facing workflow shall label synthetic data, model-generated content, proposed actions, approved actions, applied operations, and unfinished features clearly. |
| FR-15 | The responsive web interface shall support the complete verified demo flow with semantic structure and keyboard access. |

## Nonfunctional requirements

| ID | Area | Requirement |
| --- | --- | --- |
| NFR-01 | Security | OpenAI and Supabase service-role secrets shall remain server-only and shall never appear in client code, fixtures, logs, screenshots, or committed files. |
| NFR-02 | Authorization | Supabase RLS and server authorization shall be the source of truth. UI visibility shall never be treated as authorization. |
| NFR-03 | Privacy | Pasted updates shall be treated as untrusted input, minimized before model use where practical, and stored with clear provenance. Public demos shall use synthetic data only. |
| NFR-04 | Safety | Validation, authorization, approval, version, idempotency, or operation-logging uncertainty shall fail closed with no mutation. |
| NFR-05 | Explainability | Every impact shall be reproducible from stored dependency edges and include a human-readable path back to the reviewed change. |
| NFR-06 | Determinism | Given the same reset baseline and confirmed change, graph traversal and demo reset shall produce the same expected project state. |
| NFR-07 | Auditability | History shall be append-only in meaning: corrective and undo activity adds records instead of deleting prior operations. |
| NFR-08 | Accessibility | The implemented workflow shall use semantic headings and landmarks, keyboard-operable controls, visible focus, sufficient labels, and status indicators that do not rely on color alone. |
| NFR-09 | Responsive layout | Core pages shall be usable at approximately 375, 768, and 1440 pixels without horizontal page overflow. |
| NFR-10 | Resilience | Model timeout, malformed output, stale state, duplicate requests, and partial failure shall return a clear reviewable error and shall not create a partial mutation. |
| NFR-11 | Maintainability | Frontend and server code shall use typed contracts and respect the documented Andres/Deston ownership boundary. Cross-boundary decisions shall be recorded. |
| NFR-12 | Standalone operation | The P0 workflow shall not require an external connector, sync service, embeddings store, or third-party orchestration tool. |
| NFR-13 | Claim integrity | Public copy, screenshots, submission text, and video shall describe only behavior verified in the current deployment. |

## Success criteria

### Build Week product acceptance

P0 is successful only when the current build can be verified to do all of the following:

- Start from the documented synthetic reset baseline.
- Preserve the exact pasted venue update and show its provenance.
- Produce a schema-valid candidate event-date change through the server-only GPT-5.6 path.
- Allow a person to review the candidate before continuing.
- Reproduce the documented direct and downstream impact set using deterministic dependency traversal.
- Show at least one ordered evidence-to-impact path for every affected item.
- Present schema-valid recovery actions as proposals, not applied changes.
- Apply only the actions selected by an authorized reviewer while leaving the documented sensitive action unapproved and unchanged.
- Record each applied operation with enough context to attribute it and support the documented undo behavior.
- Demonstrate one supported undo as a traceable compensating operation.
- Reset only the synthetic workspace to the exact documented baseline.
- Complete the judge-facing flow accessibly on supported desktop and mobile-width layouts.
- Pass the required lint, typecheck, unit test, production build, and diff checks in the current worktree.
- Keep submission and video claims aligned with the deployed behavior actually exercised.

### Product outcome hypotheses

Longer-term success would mean teams can identify downstream effects sooner, reduce manual reconciliation, preserve the reasons behind project changes, and recover from plan changes with fewer hidden blockers. These are hypotheses to validate through user research and product usage; no adoption, speed, or error-reduction result is claimed in this brief.

## Ethical and privacy considerations

### Human agency

GPT-5.6 output must be labeled as a draft. The product should communicate uncertainty and allow correction or rejection. The model cannot approve or apply a change.

### Data minimization and provenance

Only information needed for the requested interpretation should be sent to the model. The raw source, origin label, actor, and time should remain distinguishable from derived content. Synthetic data must be used in public demos.

### Access and isolation

Project membership, RLS, and server authorization must prevent cross-workspace access. Demo reset must be incapable of targeting a real project. No secret or private user data belongs in public logs, screenshots, fixtures, or model prompts used for demonstrations.

### Accuracy and contestability

Structured extraction can be wrong or incomplete. Users need the original evidence, a visible candidate, validation errors, and a way to correct or reject the interpretation before it influences an applied operation.

### Accountability without surveillance

Operation history should record what is needed to explain an authorized project change, not collect unrelated activity. Retention and access controls require further product and legal review before any production claim.

### Reversibility limits

Undo applies only to supported internal operations. It cannot guarantee reversal of a real-world consequence or an external action such as a payment, booking, sent message, or contract. The interface must not imply otherwise.

## Known constraints

- The Build Week workflow uses one isolated synthetic workspace, not a general production deployment.
- The judge-facing scenario represents an eight-person team and does not establish performance or usability for larger organizations.
- P0 accepts pasted updates only; no connector automatically supplies or synchronizes evidence.
- Dependency traversal can explain only relationships recorded in the graph. Missing or incorrect edges can produce incomplete impact reviews.
- GPT-5.6 interpretation and recovery drafting can be inaccurate, incomplete, delayed, or unavailable. Schema validation limits shape errors but does not prove factual correctness.
- Human review remains necessary for the extracted change, impact meaning, recovery proposal, and every applied action.
- P0 mutates only supported internal records. It does not change external systems or complete real-world recovery work.
- Undo is limited to operations with a safe, recorded inverse and may be unavailable after conflicting later changes.
- The exact authorization model, retention policy, operational limits, and production controls require implementation and security review before real-team use.
- Responsive web is the delivery surface for P0; native mobile applications are out of scope.
- The core product must work without integrations. Future connectors, if built, are optional and must preserve the same evidence, approval, and audit boundaries.
- Current implementation status must be rechecked before the demo, video recording, or submission copy is finalized.
