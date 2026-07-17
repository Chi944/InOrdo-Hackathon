# InOrdo submission copy

> Draft status: This copy describes the bounded P0 product and its intended demo. Before publishing, remove every verification note and retain only claims demonstrated by the final build.

## Final links and identifiers

- Live demo: `[FINAL_LIVE_DEMO_URL]`
- Public repository: `[FINAL_PUBLIC_REPOSITORY_URL]`
- Demo video: `[FINAL_DEMO_VIDEO_URL]`
- Devpost project: `[FINAL_DEVPOST_URL]`
- Supporting documentation: `[FINAL_DOCUMENTATION_URL]`
- Codex Session ID: `[FINAL_CODEX_SESSION_ID]`

## One-line pitch

InOrdo turns new project evidence into explainable downstream impacts and human-approved recovery actions, with traceable history and undo where supported.

## 50-word summary

InOrdo helps small teams respond safely when new evidence changes a project. It preserves the source, uses GPT-5.6 to draft a structured interpretation, traces explicit dependencies with deterministic code, and presents recovery actions for selective human approval. Applied internal operations are recorded and reversible where supported, with no autonomous mutation.

## Detailed Devpost description

A project rarely changes in one place. A venue becomes unavailable, a launch date moves, or a decision is reversed. The obvious record gets updated, but dependent tasks, milestones, risks, and artifacts can remain stale. Small teams then spend hours coordinating manually, and still face hidden blockers, missed deadlines, lost context, and decisions that are difficult to trace.

InOrdo is a Work and Productivity product for managing that chain reaction. It is designed to work as a standalone project workspace for student teams, startups, software teams, agencies and campaign teams, nonprofits, and university clubs.

The P0 workflow follows one clear sequence: **evidence → impact → proposal → approval → history and undo**.

1. A team member pastes a source update. InOrdo preserves the raw evidence and its provenance.
2. GPT-5.6 runs server-side and drafts a structured candidate change. The output is validated before it enters product logic and remains subject to human review.
3. Deterministic application code traverses explicit project dependencies. Each direct and downstream impact includes an explainable path back to the changed record.
4. GPT-5.6 drafts bounded recovery actions from the reviewed change and impact context.
5. A person approves or rejects each action separately. Model output never grants permission and never directly changes project data.
6. Authorized internal changes are recorded in operation history. Reversible operations can be undone through a compensating operation that preserves the audit trail.

The Build Week scenario uses an entirely synthetic eight-person workspace: the “Inter-University Environmental Coalition — Regional Climate Action Summit 2026.” A pasted venue notice moves the summit from 12 September 2026 to 26 September 2026. The demo is intended to make the resulting dependency chain visible, propose recovery steps, apply only selected internal changes, leave a cost-sensitive travel action unapproved, and return the isolated fixture to a known baseline.

The separation of responsibilities is the point. GPT-5.6 handles language interpretation and drafts. Deterministic code determines dependency reach. People authorize changes. Server-side services enforce permissions, record operations, and support undo where the operation is reversible.

`[VERIFY BEFORE SUBMISSION: Replace this paragraph with the exact workflow demonstrated by the deployed build, and list any P0 step that remains unavailable.]`

## Problem

When one fact changes, teams often update the most visible item and rely on memory, chat messages, or meetings to find everything else affected. That process creates six recurring problems:

- downstream work remains based on an invalid assumption;
- coordination becomes manual and slow;
- source information becomes separated from the resulting decisions;
- deadlines move without every owner noticing;
- decisions and applied changes are difficult to trace; and
- blockers stay hidden until they become urgent.

Existing project tools are good at storing tasks. InOrdo focuses on the moment new evidence makes part of the plan unreliable.

## Solution

InOrdo combines native project records, explicit directed dependencies, preserved source evidence, structured model assistance, deterministic impact traversal, selective approval, and reversible operation history.

The product does not ask a model to run the project. It gives reviewers a bounded, inspectable way to answer four questions:

1. What changed, and what is the evidence?
2. Which records are affected, and through which dependency paths?
3. What recovery actions are reasonable?
4. Which actions should a person approve now, and how can a supported change be undone?

## How Codex was used

Codex supported the project as an engineering and documentation collaborator. For this product-definition session, it:

- inspected the repository guidance, current product status, and architecture boundaries;
- turned confirmed requirements into a product brief, synthetic demo fixture, prioritized backlog, and manual QA checklist;
- drafted judge-facing submission copy and a timed demo storyboard;
- checked terminology so the same evidence → impact → proposal → approval → history and undo sequence appears throughout; and
- prepared repository checks for linting, type safety, tests, production build, and whitespace errors.

Codex did not supply product authority or bypass review. The team set the scope, reviewed the output, and remains responsible for implementation choices, security, testing, and public claims.

`[VERIFY BEFORE SUBMISSION: Add the final Codex Session ID and describe only additional code or debugging contributions visible in that session.]`

## How GPT-5.6 is meaningfully integrated

GPT-5.6 has two narrow, reviewable responsibilities in the P0 design:

1. **Structured extraction:** interpret a pasted source update as a candidate change to a native project record, including the proposed field and before/after values.
2. **Recovery drafting:** propose bounded follow-up actions using the reviewed change and the deterministic impact results.

Both calls run in server-only code. The application minimizes the context sent to the model, validates structured output with Zod, and treats validation failures as errors rather than permission to continue. The raw source remains visible so a reviewer can compare evidence with the interpretation.

GPT-5.6 does not choose the affected dependency subgraph, authorize a user, approve an action, mutate a record, or perform undo. Those responsibilities remain with deterministic application and server logic.

`[VERIFY BEFORE SUBMISSION: Confirm the deployed build uses GPT-5.6 for both responsibilities and capture one successful validation path plus one safe failure path.]`

## Technical architecture

- **Web application:** Next.js App Router under `src/`, TypeScript, React Server Components by default, and Tailwind CSS.
- **Data and identity:** Supabase Postgres, Supabase Auth, and row-level security as the intended source of truth for tenant data access.
- **Evidence boundary:** immutable raw source text and provenance are stored before model interpretation.
- **Model boundary:** the OpenAI SDK is called only from server-only modules or routes; GPT-5.6 output is Zod-validated.
- **Impact engine:** deterministic traversal follows explicit directed dependency edges, distinguishes direct from downstream impact, prevents cycles, and returns explainable paths.
- **Approval boundary:** each proposed action remains inert until an authorized person approves that specific action and the server rechecks identity, project membership, permission, current state, action validity, and idempotency.
- **Operation history:** a successful internal mutation and its reversible before-state are recorded transactionally; undo creates a compensating operation rather than deleting history.
- **Demo safety:** reset is restricted to one synthetic workspace and restores a deterministic baseline.

`[VERIFY BEFORE SUBMISSION: Update this list to match the final deployed modules and remove any component that is not implemented.]`

## Challenges

- Separating useful model interpretation from deterministic control.
- Explaining multi-hop impact without hiding the dependency path behind a confidence score.
- Making selective approval understandable while keeping a proposal visibly inert.
- Designing undo so recovery preserves history instead of silently rewriting it.
- Keeping a polished demonstration honest while core P0 services are still being implemented.
- Building a rich scenario with synthetic data and a reset that cannot affect another workspace.

## Accomplishments

- Defined a focused P0 around one end-to-end change-recovery workflow rather than a broad project-management suite.
- Established explicit boundaries between GPT-5.6 drafting, deterministic impact logic, human approval, and authorized mutation.
- Created a detailed synthetic summit fixture with cross-record dependencies and an unambiguous reset baseline.
- Produced an accessible, responsive product direction and a judge-facing verification plan.
- Documented non-goals that prevent scope drift into autonomous mutation, connectors, RAG, embeddings, enterprise administration, or native mobile.

`[VERIFY BEFORE SUBMISSION: Add only implementation accomplishments demonstrated in the final build and backed by the final test results.]`

## Lessons learned

- Preserving evidence is as important as interpreting it; reviewers need to see what the proposal came from.
- A model is most useful when its role is bounded and its output can be inspected, corrected, or rejected.
- Dependency traversal should be deterministic because reviewers need repeatable reach and concrete paths.
- Selective approval is safer than treating a recovery plan as one all-or-nothing action.
- Reversibility requires operation design from the start, not a last-minute “undo” button.
- A reliable synthetic reset is part of demo quality, not merely a testing convenience.

## Future roadmap

### P1

- improve editing and comparison for candidate changes;
- add richer dependency visualization and filtering;
- strengthen collaboration around evidence, proposals, and operations;
- expand reversible internal action types; and
- add broader test coverage, observability, and recovery guidance.

### Later

- support more project templates for software delivery, campaigns, launches, events, and general project management;
- add optional integrations only after the standalone workflow is reliable;
- introduce organization controls and deeper reporting when user needs justify them; and
- explore mobile access after the responsive web experience and core safety model are mature.

Connectors, semantic retrieval, embeddings, and autonomous project mutation are not assumed roadmap requirements.

## Honest limitations

- The repository currently establishes the product foundation and public interface; the final submission must identify exactly which end-to-end P0 steps are implemented and verified.
- The Build Week workspace is synthetic and represents one small 4–12 person team, not production use at scale.
- Pasted updates are the only P0 evidence intake; there are no external connectors or sync engines.
- P0 uses explicit dependencies and does not use RAG, embeddings, or semantic search.
- GPT-5.6 can draft an incorrect or incomplete interpretation, so its output requires validation and human review.
- Only supported internal operations can be undone; external real-world actions cannot be reversed by the product.
- Native mobile applications, enterprise administration, and production-readiness claims are out of scope.
- No performance, reliability, adoption, or customer-impact claims should be added without measured evidence.

## Final publication checklist

- [ ] Replace every URL and Session ID placeholder.
- [ ] Remove or resolve every `VERIFY BEFORE SUBMISSION` note.
- [ ] Confirm the 50-word summary still contains exactly 50 words.
- [ ] Match the architecture section to the deployed build.
- [ ] List the exact checks run against the final commit.
- [ ] Confirm all screenshots and video footage use only synthetic data.
- [ ] Remove any claim that is not visible in the product or supported by repository evidence.
