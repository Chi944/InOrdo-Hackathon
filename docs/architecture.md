# InOrdo architecture

## System shape

```text
Browser
  │ public Supabase client only
  ▼
Next.js App Router
  ├─ Server Components: reads and presentation
  ├─ Server actions/routes: validation, authorization, orchestration
  ├─ OpenAI adapter: candidate extraction and recovery drafts
  └─ Domain services: dependency traversal, approvals, operations, undo
  │
  ▼
Supabase Postgres + Auth + RLS
```

## Boundaries

### Web

Use React Server Components by default. Client Components may hold browser interaction state but must not import server secrets, call OpenAI, or make authorization decisions.

### Evidence and model output

Persist raw source text and provenance before interpretation. A server-only OpenAI adapter requests structured output from `OPENAI_MODEL`; Zod validates the response into a candidate change or recovery draft. Validation failure produces a reviewable error and no mutation.

### Deterministic impact

Store explicit directed dependency edges. Domain code traverses those edges from the reviewed changed record, records direct versus downstream depth, prevents cycles, and returns at least one ordered path for every affected item. The model does not choose graph reach.

### Approval and mutation

A recovery action is immutable proposal data until a person selects it. Before application, server code rechecks identity, project membership, permission, current record version, action validation, and idempotency. A successful mutation and its reversible before-state are recorded in one transaction.

### Undo and reset

Undo creates a compensating operation; it does not erase history. Demo reset is a server-only, secret-protected operation limited to the configured synthetic project slug. It must be deterministic and unable to target a non-demo project.

## Security invariants

- Service-role and OpenAI keys remain server-only.
- RLS applies to all user-scoped tables.
- Model output never directly mutates data.
- Public demo data is synthetic.
- Authorization and approval checks fail closed.

## Planned modules

- `src/lib/supabase/`: typed browser and server clients.
- `src/features/evidence/`: intake, validation, and provenance.
- `src/features/impact/`: dependency graph traversal and path explanations.
- `src/features/proposals/`: recovery drafts and per-action approval state.
- `src/features/operations/`: authorized application, history, undo, and reset.
- `supabase/migrations/`: schema, constraints, functions, and RLS policies.

These module paths describe intended boundaries, not completed features.
