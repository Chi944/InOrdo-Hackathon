# Analysis Access and Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fail-closed, server-only analysis policy that permits one exact GPT-5.6 recording attempt and otherwise uses a capped GPT-OSS fallback without allowing public users to spend the operator's OpenAI key.

**Architecture:** A pure provider-policy module converts server environment state into a safe capability contract. A new private policy-aware claim function preserves the existing locks, validation, duplicate, rate-limit, and provenance behavior while inserting provider/grant selection before any new evidence or request write. A service-role-only wrapper exposes that transaction, and the analysis service constructs a provider adapter only after it returns the selected route.

**Tech Stack:** Node.js 22, TypeScript, Next.js App Router, OpenAI SDK Responses API, Vercel AI Gateway, Zod, Supabase/PostgreSQL, Vitest, pgTAP-style rollback SQL.

## Global Constraints

- `ANALYSIS_MODE` is exactly `recording`, `auto`, or `disabled`; absent or invalid values resolve to `disabled`.
- `recording` means GPT-5.6 with an exact one-use grant or fail closed; it never falls back.
- `auto` means `openai/gpt-oss-20b` through the explicitly capped Gateway key or disabled; it ignores `OPENAI_API_KEY`.
- `disabled` creates no evidence, analysis claim, or provider request.
- The Gateway key must enforce a hard quota of USD 1 or less, refresh period `none`, and automatic top-up disabled; otherwise fallback remains disabled.
- Model calls remain server-only, `store: false`, no tools, no automatic retries, 30-second per-call timeout, 2,048 extraction tokens, and 4,096 proposal tokens.
- Viewers and nonmembers are rejected before policy lookup, privileged persistence, adapter construction, or network access.
- Model output never directly mutates data.
- No new npm dependency is permitted for this plan.
- Never read, print, log, commit, or expose environment values or credentials.
- Before every commit in this plan, run `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build`, and `git diff --check` under Node 22 in addition to the focused tests listed in that task.

---

## File map

Create:

- `src/features/analysis/provider-policy.ts` — pure mode, route, policy, and public-availability contracts.
- `src/features/analysis/provider-policy.test.ts` — table-driven policy and availability tests.
- `supabase/migrations/20260721100000_add_analysis_access_policy.sql` — private grant table, issuance function, policy wrapper RPC, and privilege revocation.
- `supabase/tests/verify_analysis_access_policy.sql` — rollback-wrapped grant, duplicate, mismatch, role, and viewer checks.

Modify:

- `.env.example` — document the three new server-only names.
- `src/lib/env/server.ts` and `src/lib/env/server.test.ts` — parse provider capabilities without making AI mandatory for app health.
- `src/lib/env/readiness.ts` and `src/lib/env/readiness.test.ts` — return app readiness plus generic analysis availability.
- `src/app/api/health/route.ts` and `src/app/api/health/route.test.ts` — report healthy navigation with analysis enabled or disabled, without naming secrets.
- `src/features/analysis/service.ts` and `src/features/analysis/service.test.ts` — resolve policy before begin, then resolve exactly one adapter after a claimed route.
- `src/features/analysis/supabase-persistence.ts` and `src/features/analysis/supabase-persistence.test.ts` — use the policy wrapper RPC and parse its route.
- `src/features/analysis/runtime.ts` and `src/features/analysis/runtime.test.ts` — lazily create OpenAI or Gateway clients.
- `src/features/analysis/gateway-adapter.ts` and `src/features/analysis/gateway-adapter.test.ts` — construct only the explicit capped Gateway Responses client.
- `src/features/analysis/errors.ts`, `src/features/analysis/errors.test.ts`, `src/features/analysis/route-handler.test.ts` — add exact safe disabled/recording/fallback failures.
- `src/lib/security-boundaries.test.ts` — prove browser/request code cannot import either provider client or the privileged grant path.
- `supabase/tests/verify_analysis_pipeline.sql`, `supabase/tests/verify_operations.sql`, `supabase/tests/verify_prompt13_evidence_integrity.sql` — route existing fixtures through the new policy RPC.
- `docs/architecture.md`, `docs/security-review.md`, `docs/deployment-runbook.md`, `docs/rollback-plan.md`, `docs/codex-log.md` — record policy, privileges, containment, and evidence rules.

## Interfaces shared by all tasks

```ts
export type AnalysisMode = "recording" | "auto" | "disabled";
export type AnalysisProviderRoute =
  | "openai_recording"
  | "gateway_fallback";

export type AnalysisProviderPolicy = {
  mode: AnalysisMode;
  recordingReady: boolean;
  gatewayReady: boolean;
  recordingModelName: "gpt-5.6-luna";
  gatewayModelName: "openai/gpt-oss-20b";
};

export type AnalysisAvailability = {
  mode: AnalysisMode;
  status:
    | "recording_configured"
    | "recording_unavailable"
    | "fallback_configured"
    | "fallback_unavailable"
    | "disabled";
  canAnalyze: boolean;
  provider: "OpenAI" | "Vercel AI Gateway" | null;
  model: string | null;
  message: string;
};
```

The browser may receive only `AnalysisAvailability`. It must never receive a key, grant identifier, source hash, actor identifier, or provider-console setting.

## Implementation branch preflight

Execute this plan and the judge/project plan on the existing short-lived planning branch, never directly on `main`:

```powershell
git branch --show-current
git status --short
git fetch origin
git merge-base --is-ancestor origin/main HEAD
```

Expected: branch is exactly `codex/19-submission-production`, status is empty, and the merge-base command exits 0. Stop if the branch is different, the worktree is dirty, or the branch does not contain current `origin/main`.

### Task 1: Mode-aware environment and readiness

**Files:**

- Create: `src/features/analysis/provider-policy.ts`
- Create: `src/features/analysis/provider-policy.test.ts`
- Modify: `src/lib/env/server.ts`
- Modify: `src/lib/env/server.test.ts`
- Modify: `src/lib/env/readiness.ts`
- Modify: `src/lib/env/readiness.test.ts`
- Modify: `src/app/api/health/route.ts`
- Modify: `src/app/api/health/route.test.ts`
- Modify: `.env.example`

**Interfaces:**

- Produces: `AnalysisMode`, `AnalysisProviderRoute`, `AnalysisProviderPolicy`, `AnalysisAvailability`, `buildAnalysisAvailability(policy)`.
- Produces: `getAnalysisRuntimeEnv()` returning a discriminated union with a usable credential only for its selected mode.
- Produces: `evaluateDeploymentReadiness(values)` returning app readiness independently from generic analysis capability.

- [ ] **Step 1: Write failing pure policy tests**

```ts
it.each([
  [{ mode: "recording", recordingReady: true, gatewayReady: false }, "recording_configured"],
  [{ mode: "recording", recordingReady: false, gatewayReady: false }, "recording_unavailable"],
  [{ mode: "auto", recordingReady: false, gatewayReady: true }, "fallback_configured"],
  [{ mode: "auto", recordingReady: false, gatewayReady: false }, "fallback_unavailable"],
  [{ mode: "disabled", recordingReady: false, gatewayReady: false }, "disabled"],
] as const)("maps %j to %s", (partialPolicy, expected) => {
  const policy: AnalysisProviderPolicy = {
    ...partialPolicy,
    recordingModelName: "gpt-5.6-luna",
    gatewayModelName: "openai/gpt-oss-20b",
  };
  expect(buildAnalysisAvailability(policy).status).toBe(expected);
});
```

- [ ] **Step 2: Run the focused test and confirm the missing-module failure**

Run: `npm run test:run -- src/features/analysis/provider-policy.test.ts`

Expected: FAIL because `provider-policy.ts` does not exist.

- [ ] **Step 3: Implement the pure policy contract**

```ts
export const analysisModes = ["recording", "auto", "disabled"] as const;
export type AnalysisMode = (typeof analysisModes)[number];
export const recordingModels = ["gpt-5.6-luna"] as const;

export type AnalysisProviderRoute =
  | "openai_recording"
  | "gateway_fallback";

export function buildAnalysisAvailability(
  policy: AnalysisProviderPolicy,
): AnalysisAvailability {
  if (policy.mode === "recording") {
    return policy.recordingReady
      ? {
          mode: policy.mode,
          status: "recording_configured",
          canAnalyze: true,
          provider: "OpenAI",
          model: policy.recordingModelName,
          message: "An approved GPT-5.6 recording window is configured. The exact grant is checked only when the source is submitted.",
        }
      : {
          mode: policy.mode,
          status: "recording_unavailable",
          canAnalyze: false,
          provider: null,
          model: null,
          message: "The approved GPT-5.6 recording window is unavailable. No model request will be made.",
        };
  }
  if (policy.mode === "auto") {
    return policy.gatewayReady
      ? {
          mode: policy.mode,
          status: "fallback_configured",
          canAnalyze: true,
          provider: "Vercel AI Gateway",
          model: policy.gatewayModelName,
          message: "The capped GPT-OSS fallback is available for authorized contributors.",
        }
      : {
          mode: policy.mode,
          status: "fallback_unavailable",
          canAnalyze: false,
          provider: null,
          model: null,
          message: "The capped fallback is unavailable. No model request will be made.",
        };
  }
  return {
    mode: "disabled",
    status: "disabled",
    canAnalyze: false,
    provider: null,
    model: null,
    message: "Live AI analysis is disabled. Preserved synthetic results remain available for review.",
  };
}
```

- [ ] **Step 4: Add environment tests for all three modes**

Assert these exact outcomes in `server.test.ts`:

```ts
expect(parseAnalysisRuntimeEnv({ ANALYSIS_MODE: "disabled" })).toEqual({
  mode: "disabled",
  credential: null,
  policy: {
    mode: "disabled",
    recordingReady: false,
    gatewayReady: false,
    recordingModelName: "gpt-5.6-luna",
    gatewayModelName: "openai/gpt-oss-20b",
  },
});

expect(parseAnalysisRuntimeEnv({
  ANALYSIS_MODE: "auto",
  AI_GATEWAY_API_KEY: "test-only-gateway-key",
  AI_GATEWAY_MODEL: "openai/gpt-oss-20b",
  OPENAI_API_KEY: "ignored-test-only-openai-key",
})).toMatchObject({
  mode: "auto",
  policy: { mode: "auto", recordingReady: false, gatewayReady: true },
});
```

Also assert that missing keys, whitespace-padded keys, invalid modes, and every `OPENAI_MODEL` other than exact `gpt-5.6-luna` resolve to the disabled/unavailable capability without exposing the submitted value. A valid key with `gpt-4.1`, `gpt-5.6`, or a fabricated suffix must not set `recordingReady`.

- [ ] **Step 5: Implement the server-only runtime union**

```ts
export type AnalysisRuntimeEnv =
  | {
      mode: "disabled";
      policy: AnalysisProviderPolicy;
      credential: null;
    }
  | {
      mode: "recording";
      policy: AnalysisProviderPolicy;
      credential: { apiKey: string; model: "gpt-5.6-luna" } | null;
    }
  | {
      mode: "auto";
      policy: AnalysisProviderPolicy;
      credential: {
        apiKey: string;
        model: "openai/gpt-oss-20b";
        baseURL: "https://ai-gateway.vercel.sh/v1";
      } | null;
    };
```

Use strict nonblank parsing for keys, default `OPENAI_MODEL` to and require exact `gpt-5.6-luna`, require `AI_GATEWAY_MODEL` to equal `openai/gpt-oss-20b`, ignore `OPENAI_API_KEY` in `auto`, and preserve the requested allowlisted mode with `credential: null` plus the matching `recordingReady: false` or `gatewayReady: false` policy when selected-mode configuration is incomplete. An absent or invalid mode alone resolves to `disabled`.

- [ ] **Step 6: Make health capability-aware**

The public response remains generic:

```ts
{
  status: "ready",
  checks: {
    configuration: "ready",
    analysis: availability.status,
  },
}
```

Base Supabase/demo configuration can still return `503`; absent AI credentials alone cannot. The five allowlisted analysis statuses are configuration signals only: `recording_configured` never claims an exact grant exists or that a provider request will succeed. Logs may contain only allowlisted variable names, never values.

- [ ] **Step 7: Update `.env.example` in this exact order**

```dotenv
# Server-only analysis mode: disabled, recording, or auto.
ANALYSIS_MODE=disabled

# Dedicated Vercel AI Gateway key with a non-renewing hard quota.
AI_GATEWAY_API_KEY=

# Open-weight fallback model routed through Vercel AI Gateway.
AI_GATEWAY_MODEL=openai/gpt-oss-20b
```

Keep the existing seven variables and their documentation intact.

- [ ] **Step 8: Run focused tests and commit**

Run:

```bash
npm run test:run -- src/features/analysis/provider-policy.test.ts src/lib/env/server.test.ts src/lib/env/readiness.test.ts src/app/api/health/route.test.ts
npm run typecheck
```

Expected: all focused tests PASS and TypeScript exits 0.

Commit:

```bash
git add .env.example src/features/analysis/provider-policy.ts src/features/analysis/provider-policy.test.ts src/lib/env/server.ts src/lib/env/server.test.ts src/lib/env/readiness.ts src/lib/env/readiness.test.ts src/app/api/health/route.ts src/app/api/health/route.test.ts
git commit -m "feat: add analysis provider policy"
```

### Task 2: Atomic recording grant and policy RPC

**Files:**

- Create: `supabase/migrations/20260721100000_add_analysis_access_policy.sql`
- Create: `supabase/tests/verify_analysis_access_policy.sql`

**Interfaces:**

- Consumes: `AnalysisMode`, provider model names, and the validated/locked algorithm from the existing claim functions.
- Produces RPC: `public.begin_project_analysis_with_policy(...) returns jsonb`.
- Produces private function: `private.begin_project_analysis_with_policy_internal(...) returns jsonb`.
- Produces owner-only function: `private.issue_analysis_recording_grant(...) returns jsonb`.
- Produces owner-only function: `private.revoke_analysis_recording_grant(...) returns jsonb`.
- Produces owner-only function: `private.verify_analysis_recording_grant(...) returns jsonb`.
- Revokes `service_role` execution on both the older unguarded `public.begin_project_analysis(...)` signature and `private.begin_project_analysis_internal(...)` bypass.

- [ ] **Step 1: Write the rollback-wrapped SQL assertions first**

The verifier must prove all of these named cases with `raise exception` messages:

```sql
-- expected cases
-- disabled_no_evidence
-- auto_claim_uses_gateway_model
-- recording_exact_grant_claimed_once
-- recording_unapproved_model_rejected_without_claim
-- recording_hash_mismatch_rolls_back_evidence
-- recording_expired_rolls_back_evidence
-- recording_replay_rejected
-- duplicate_does_not_consume_second_grant
-- disabled_duplicate_no_new_capture
-- recording_unavailable_duplicate_no_new_capture
-- fallback_unavailable_duplicate_no_new_capture
-- rate_limit_does_not_consume_grant
-- direct_legacy_begin_denied_to_service_role
-- direct_legacy_internal_denied_to_service_role
-- direct_policy_internal_denied_to_service_role
-- authenticated_and_anon_policy_rpc_denied
-- viewer_analysis_denied
-- cross_project_grant_denied
-- grant_identity_and_terminal_state_are_immutable
-- owner_only_issue_revoke_and_verify
-- verify_returns_metadata_only
```

Wrap fixtures in `begin; ... rollback;` and compare source/request/grant counts before and after mismatch paths.

- [ ] **Step 2: Add the exact grant table and constraints**

```sql
create table private.analysis_recording_grants (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete restrict,
  normalized_content_sha256 text not null check (
    normalized_content_sha256 ~ '^[0-9a-f]{64}$'
  ),
  expires_at timestamptz not null,
  status text not null default 'available' check (
    status in ('available', 'claimed', 'revoked')
  ),
  created_at timestamptz not null default statement_timestamp(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  claimed_at timestamptz,
  claimed_analysis_request_id uuid references public.analysis_requests(id) on delete restrict,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete restrict,
  constraint analysis_recording_grant_window check (
    expires_at > created_at
    and expires_at <= created_at + interval '15 minutes'
  ),
  constraint analysis_recording_grant_state check (
    (status = 'available' and claimed_at is null and claimed_analysis_request_id is null and revoked_at is null and revoked_by is null)
    or (status = 'claimed' and claimed_at is not null and claimed_analysis_request_id is not null and revoked_at is null and revoked_by is null)
    or (status = 'revoked' and claimed_at is null and claimed_analysis_request_id is null and revoked_at is not null and revoked_by is not null)
  )
);

create unique index analysis_recording_grants_one_available_idx
  on private.analysis_recording_grants (
    actor_id, project_id, normalized_content_sha256
  ) where status = 'available';

create index analysis_recording_grants_claim_lookup_idx
  on private.analysis_recording_grants (
    actor_id, project_id, normalized_content_sha256, status, expires_at
  );

create unique index analysis_recording_grants_claimed_request_idx
  on private.analysis_recording_grants (claimed_analysis_request_id)
  where claimed_analysis_request_id is not null;
```

Add a `before update` trigger that makes actor, project, hash, creator, creation time, and expiry immutable; permits only `available → claimed` or `available → revoked`; and rejects every update to a terminal row. Revoke all table privileges from `PUBLIC`, `anon`, `authenticated`, and `service_role`.

- [ ] **Step 3: Add the owner-only grant issuance function**

The function must:

1. require valid actor/project/creator users;
2. require the creator to be an owner of the target project workspace;
3. require the target actor to be a contributor in that workspace;
4. validate the supplied `p_normalized_content_sha256` as exactly 64 lowercase hexadecimal characters;
5. require `p_expires_at` within 15 minutes;
6. acquire one tuple advisory lock;
7. revoke an expired matching `available` row;
8. insert one available grant;
9. return only `grant_id`, `status`, and `expires_at`.

Use this exact signature with `SECURITY DEFINER`, `set search_path = ''`, and fully qualified names:

```sql
revoke all on function private.issue_analysis_recording_grant(
  uuid, uuid, text, timestamptz, uuid
) from public, anon, authenticated, service_role;
```

Do not grant it to any application role; the Supabase migration owner retains execution.

The five issuance arguments are actor ID, project ID, normalized-content SHA-256, expiry, and creator ID in that order. Add `private.revoke_analysis_recording_grant(p_grant_id uuid, p_revoked_by uuid) returns jsonb` with the same owner check. It may transition only an `available` grant to `revoked`, returns only grant ID/state/expiry, and has no grant to an application role:

```sql
revoke all on function private.revoke_analysis_recording_grant(
  uuid, uuid
) from public, anon, authenticated, service_role;
```

The issuance and revocation functions use `SECURITY DEFINER`, an empty search path, fully qualified names, tuple locks, and indistinguishable authorization/not-found errors. Document that grant metadata is retained through 11 November 2026 UTC and requires a separately reviewed purge after that date.

Add `private.verify_analysis_recording_grant(p_grant_id uuid, p_verified_by uuid) returns jsonb`. It uses `SECURITY DEFINER`, an empty search path, and fully qualified names. It requires `p_verified_by` to be a real owner of the grant's project workspace and returns only `grant_id`, `status`, `expires_at`, and `claim_consistent`. `claim_consistent` is true only when a claimed row's linked request matches its actor, project, normalized hash, and `gpt-5.6-luna` model; it never returns the actor, project, hash, raw source, or request ID. Revoke all execution from every application role:

```sql
revoke all on function private.verify_analysis_recording_grant(
  uuid, uuid
) from public, anon, authenticated, service_role;
```

The migration owner may invoke this verifier through the audited Supabase SQL procedure; there is no browser route or server action.

- [ ] **Step 4: Add the service-role-only policy wrapper**

Signature:

```sql
public.begin_project_analysis_with_policy(
  p_actor_id uuid,
  p_project_id uuid,
  p_expected_project_revision text,
  p_title text,
  p_source_kind text,
  p_source_author text,
  p_raw_text text,
  p_normalized_content_sha256 text,
  p_occurred_at timestamptz,
  p_source_url text,
  p_analysis_mode text,
  p_recording_ready boolean,
  p_gateway_ready boolean,
  p_recording_model_name text,
  p_gateway_model_name text
) returns jsonb
```

Create `private.begin_project_analysis_with_policy_internal(...)` by porting the existing private claim algorithm rather than calling the legacy begin function. Preserve its membership checks, input/hash validation, source-key then actor advisory-lock order, current-revision check, duplicate lookup, and five-per-ten-minute rate limit. Validate the two server-supplied model names: Gateway must equal `openai/gpt-oss-20b`, and recording must equal exact `gpt-5.6-luna`.

Inside the same locked transaction, follow this exact order:

1. return `duplicate` before reading a grant, preserving existing terminal/in-progress fields;
2. return `rate_limited` before reading a grant;
3. for `disabled` or invalid mode, return `analysis_disabled` with null IDs/route/model;
4. for `recording` without capability, return `recording_unavailable` with null IDs/route/model;
5. for ready `recording`, select the exact actor/project/hash `available`, unexpired grant `FOR UPDATE`; return the same `recording_unavailable` result if none exists, otherwise select route/model in memory without changing the row yet;
6. for `auto` without capability, return `fallback_unavailable` with null IDs/route/model;
7. for ready `auto`, select `gateway_fallback` and the fixed model in memory without reading a grant;
8. only after route selection, create/reuse immutable source evidence and insert the new analysis request with the selected model;
9. for recording, update the locked grant to `claimed`, set `claimed_at`, and link the exact new request ID; require exactly one updated row or raise an invariant error that rolls the whole statement back;
10. return `claimed` with request/source IDs, `provider_route`, and `model_name`.

The new public wrapper sets the existing authenticated actor claims, invokes only the new private function as migration owner, and reconciles an expired in-progress duplicate. Port the current distinct-capture provenance bridge only when the requested mode is configuration-ready and allowlisted (`recording` plus `p_recording_ready`, or `auto` plus `p_gateway_ready`). A duplicate in `disabled`, recording-unavailable, fallback-unavailable, or invalid configuration returns the existing request/result without creating a source capture or provenance link. A ready-mode duplicate may preserve a distinct immutable capture, but it consumes no grant and causes no provider call. Rate-limited and every unavailable result create no evidence, request, provenance link, or grant change. The persisted `analysis_requests.model_name` remains the source of truth.

- [ ] **Step 5: Remove the bypass path**

```sql
revoke all on function public.begin_project_analysis(
  uuid, uuid, text, text, text, text, text, text, timestamptz, text, text
) from service_role;

revoke all on function private.begin_project_analysis_internal(
  uuid, text, text, text, text, text, text, timestamptz, text, text
) from service_role;

revoke all on function private.begin_project_analysis_with_policy_internal(
  uuid, text, text, text, text, text, text, timestamptz, text, text, boolean, boolean, text, text
) from public, anon, authenticated, service_role;

revoke all on function public.begin_project_analysis_with_policy(
  uuid, uuid, text, text, text, text, text, text, timestamptz, text, text, boolean, boolean, text, text
) from public, anon, authenticated;

grant execute on function public.begin_project_analysis_with_policy(
  uuid, uuid, text, text, text, text, text, text, timestamptz, text, text, boolean, boolean, text, text
) to service_role;
```

The wrapper itself checks `auth.role() = 'service_role'`, is `SECURITY DEFINER`, has a fixed empty search path, and invokes the new private function as its migration owner. Verify no `PUBLIC`, `anon`, `authenticated`, or `service_role` execution path remains on either legacy function or the new private function; only the new public wrapper is callable by `service_role`.

- [ ] **Step 6: Run SQL lint/local verification and commit**

Before running the suites, replace every direct test call to the old begin signature in `verify_analysis_pipeline.sql`, `verify_operations.sql`, and `verify_prompt13_evidence_integrity.sql` with `begin_project_analysis_with_policy`, using `p_analysis_mode := 'auto'`, `p_recording_ready := false`, `p_gateway_ready := true`, `p_recording_model_name := 'gpt-5.6-luna'`, and `p_gateway_model_name := 'openai/gpt-oss-20b'`. Keep each suite's existing model assertions consistent with that fixed fixture model.

Run without touching the hosted project:

```bash
npx --no-install supabase db lint --local
```

If the local Supabase stack is available, run the reset plus `verify_analysis_access_policy.sql`. If it is unavailable, record that linked verification is deferred to the release plan; do not claim it passed.

Commit:

```bash
git add supabase/migrations/20260721100000_add_analysis_access_policy.sql supabase/tests/verify_analysis_access_policy.sql supabase/tests/verify_analysis_pipeline.sql supabase/tests/verify_operations.sql supabase/tests/verify_prompt13_evidence_integrity.sql
git commit -m "feat: add atomic analysis recording grants"
```

### Task 3: Typed persistence route selection

**Files:**

- Modify: `src/features/analysis/service.ts`
- Modify: `src/features/analysis/service.test.ts`
- Modify: `src/features/analysis/supabase-persistence.ts`
- Modify: `src/features/analysis/supabase-persistence.test.ts`
- Modify: `src/features/analysis/errors.ts`
- Modify: `src/features/analysis/errors.test.ts`
- Regenerate from local schema: `src/types/database.ts`

**Interfaces:**

- Consumes: `AnalysisProviderPolicy`.
- Produces: claimed `BeginAnalysisResult` with `providerRoute` and `modelName`.
- Produces: `AnalysisPersistence.begin({ ..., providerPolicy })`.

- [ ] **Step 1: Write failing persistence and access-error tests**

Assert the wrapper receives:

```ts
expect(execute).toHaveBeenCalledWith(
  "begin_project_analysis_with_policy",
  expect.objectContaining({
    p_analysis_mode: "recording",
    p_recording_ready: true,
    p_gateway_ready: false,
    p_recording_model_name: "gpt-5.6-luna",
    p_gateway_model_name: "openai/gpt-oss-20b",
  }),
);
```

Add cases for a claimed Gateway route, returned statuses `analysis_disabled`, `recording_unavailable`, and `fallback_unavailable`, duplicate without a route requirement, and rate-limit mapping.

In `errors.test.ts`, require `analysis_disabled`, `recording_unavailable`, `fallback_unavailable`, and `fallback_quota_exhausted` to be typed safe codes with HTTP 503 and no database error detail in their response bodies.

- [ ] **Step 2: Extend the typed result and input**

```ts
export type BeginAnalysisResult =
  | {
      kind: "claimed";
      requestId: string;
      sourceDocumentId: string;
      providerRoute: AnalysisProviderRoute;
      modelName: string;
    }
  | DuplicateAnalysisResult;

begin(input: {
  actorId: string;
  projectId: string;
  projectRevision: string;
  source: AnalysisSource;
  providerPolicy: AnalysisProviderPolicy;
}): Promise<BeginAnalysisResult>;
```

Update `beginResultSchema` to require route/model for `claimed`, allow null route/model for duplicate/rate responses, and accept only the three exact pre-claim unavailable statuses with every ID/route/model null. Map those statuses to matching safe `AnalysisError` codes without preserving database details.

Extend `AnalysisErrorCode`, `safeMessages`, and `errorStatuses` in `errors.ts` before persistence imports the new codes. In `databaseFailureCode()` keep the database allowlist closed by mapping `fallback_quota_exhausted` to stored `model_unavailable`; the other three are pre-claim failures and must never reach `persistence.fail()`.

- [ ] **Step 3: Regenerate public database types from the disposable local schema**

After the local reset from Task 2 succeeds, run the public-schema generator and replace only the generated type file as a bulk mechanical rewrite:

```powershell
$typesPath = (Resolve-Path 'src/types/database.ts').Path
$generatedTypes = (& npx --no-install supabase gen types typescript --local --schema public | Out-String)
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($generatedTypes)) {
  throw 'Local Supabase type generation failed.'
}
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText($typesPath, $generatedTypes, $utf8NoBom)
rg -n "begin_project_analysis_with_policy" src/types/database.ts
git diff -- src/types/database.ts
```

Expected: the generated public function map contains the 15-argument policy RPC with both readiness booleans. Stop if unrelated public schema entries disappear.

- [ ] **Step 4: Run focused tests and commit**

Run:

```bash
npm run test:run -- src/features/analysis/supabase-persistence.test.ts src/features/analysis/service.test.ts src/features/analysis/errors.test.ts
npm run typecheck
```

Commit:

```bash
git add src/features/analysis/service.ts src/features/analysis/service.test.ts src/features/analysis/supabase-persistence.ts src/features/analysis/supabase-persistence.test.ts src/features/analysis/errors.ts src/features/analysis/errors.test.ts src/types/database.ts
git commit -m "feat: return claimed analysis provider routes"
```

### Task 4: Lazy OpenAI and GPT-OSS runtime adapters

**Files:**

- Modify: `src/features/analysis/openai-adapter.ts`
- Modify: `src/features/analysis/openai-adapter.test.ts`
- Create: `src/features/analysis/gateway-adapter.ts`
- Create: `src/features/analysis/gateway-adapter.test.ts`
- Modify: `src/features/analysis/runtime.ts`
- Modify: `src/features/analysis/runtime.test.ts`
- Modify: `src/features/analysis/service.ts`
- Modify: `src/features/analysis/service.test.ts`

**Interfaces:**

- Rename the generic interface to `AnalysisModelAdapter`; update service/runtime imports and injected option types in the same task while retaining `createOpenAIAnalysisAdapter` as the validated Responses-protocol implementation.
- Produces: `resolveProviderPolicy()` and `resolveModel(route)` closures injected into the service.

- [ ] **Step 1: Write failing lazy-construction tests**

Test these invariants:

```ts
expect(OpenAI).not.toHaveBeenCalled(); // immediately after runtime creation
await expect(viewerDeniedAnalyze()).rejects.toMatchObject({ code: "forbidden" });
expect(OpenAI).not.toHaveBeenCalled();
```

For `gateway_fallback`, assert constructor options include:

```ts
{
  apiKey: "test-only-gateway-key",
  baseURL: "https://ai-gateway.vercel.sh/v1",
  maxRetries: 0,
}
```

For `openai_recording`, assert there is no Gateway `baseURL`. Assert only the selected client is constructed and both model calls use the model returned by the begin claim.

- [ ] **Step 2: Implement route-based lazy model construction**

Keep Gateway construction in `gateway-adapter.ts` so runtime selection and transport configuration remain separate:

```ts
export function createGatewayAnalysisAdapter(
  apiKey: string,
  model: "openai/gpt-oss-20b",
): AnalysisModelAdapter {
  const client = new OpenAI({
    apiKey,
    baseURL: "https://ai-gateway.vercel.sh/v1",
    maxRetries: 0,
  });
  return createOpenAIAnalysisAdapter(client.responses, { model });
}
```

```ts
resolveProviderPolicy: () => getAnalysisRuntimeEnv().policy,
resolveModel: (route) => {
  const environment = getAnalysisRuntimeEnv();
  if (
    route === "openai_recording" &&
    environment.mode === "recording" &&
    environment.credential
  ) {
    return createOpenAIAnalysisAdapter(
      new OpenAI({
        apiKey: environment.credential.apiKey,
        maxRetries: 0,
      }).responses,
      { model: environment.credential.model },
    );
  }
  if (
    route === "gateway_fallback" &&
    environment.mode === "auto" &&
    environment.credential
  ) {
    return createGatewayAnalysisAdapter(
      environment.credential.apiKey,
      environment.credential.model,
    );
  }
  throw new AnalysisError("analysis_disabled");
},
```

Start `gateway-adapter.ts` with `import "server-only";`, as in the existing OpenAI adapter. Do not enable Vercel OIDC fallback. The explicitly capped `AI_GATEWAY_API_KEY` is required.

- [ ] **Step 3: Keep the existing bounded Responses contract**

Run the existing adapter suite and confirm request bodies still contain `store: false`, no tools, low reasoning, strict Zod text formats, fixed timeouts, zero retries, and the existing output limits. Add a 402 response test that normalizes to `quota_exhausted`; the service maps that code to the fallback-specific safe error only when the claimed route is `gateway_fallback`.

- [ ] **Step 4: Commit the runtime boundary**

```bash
npm run test:run -- src/features/analysis/openai-adapter.test.ts src/features/analysis/gateway-adapter.test.ts src/features/analysis/runtime.test.ts src/features/analysis/service.test.ts
npm run typecheck
git add src/features/analysis/openai-adapter.ts src/features/analysis/openai-adapter.test.ts src/features/analysis/gateway-adapter.ts src/features/analysis/gateway-adapter.test.ts src/features/analysis/runtime.ts src/features/analysis/runtime.test.ts src/features/analysis/service.ts src/features/analysis/service.test.ts
git commit -m "feat: add capped GPT-OSS analysis fallback"
```

### Task 5: Service ordering and safe failures

**Files:**

- Modify: `src/features/analysis/service.ts`
- Modify: `src/features/analysis/service.test.ts`
- Modify: `src/features/analysis/errors.ts`
- Modify: `src/features/analysis/errors.test.ts`
- Modify: `src/features/analysis/route-handler.test.ts`
- Modify: `src/lib/security-boundaries.test.ts`

**Interfaces:**

- Service options consume `resolveProviderPolicy()` and `resolveModel(route)`.
- Produces safe codes: `analysis_disabled`, `recording_unavailable`, `fallback_unavailable`, `fallback_quota_exhausted`.

- [ ] **Step 1: Write failing order and zero-call tests**

Cover:

- viewer denial before `resolveProviderPolicy`, `persistence.begin`, or `resolveModel`;
- nonmember/not-found denial before `resolveProviderPolicy`, `persistence.begin`, `resolveModel`, or any provider client construction;
- disabled policy calls `begin` but never `resolveModel` and leaves no provider call;
- recording mismatch maps to the generic recording message and never resolves a model;
- claimed route resolves exactly one adapter after begin;
- pre-claim missing Gateway capability returns `fallback_unavailable` with no evidence/request/provider call;
- Gateway quota exhaustion after claim records a failed claim, then returns `fallback_quota_exhausted` copy;
- other provider failures after claim preserve immutable evidence and a failed analysis while creating no proposal/item mutation;
- two simultaneous same-source service calls, modeled as one claimed result and one duplicate after the database lock, construct exactly one adapter and make one pair of model calls;
- duplicate returns without adapter construction;
- GPT-5.6 failure never falls back.

- [ ] **Step 2: Implement the new service sequence**

```ts
const { user, scope } = await authorize(client, projectId);
const context = await loadContext(client, scope);
const providerPolicy = await resolveProviderPolicy();
const beginning = await persistence.begin({
  actorId: user.id,
  projectId,
  projectRevision: context.revision,
  source: parsed.data.source,
  providerPolicy,
});
if (beginning.kind === "duplicate") return beginning;
const model = await resolveModel(beginning.providerRoute);
```

Use `beginning.modelName` for completion and require returned metadata model names to match it through the existing database validation.

- [ ] **Step 3: Add exact safe messages**

```ts
analysis_disabled:
  "Live AI analysis is disabled in this public demo to protect the operator's API budget. No OpenAI request was made and no project data changed. You can inspect the verified synthetic result and non-model project controls. To run a new analysis, deploy InOrdo with your own OpenAI API project and key.",
recording_unavailable:
  "The approved GPT-5.6 recording window is unavailable. No model request was made and no project data changed.",
fallback_unavailable:
  "Free fallback analysis is not configured for this deployment. No paid OpenAI request was made and no project data changed. You can inspect the verified synthetic result or deploy InOrdo with your own provider credentials.",
fallback_quota_exhausted:
  "Free fallback analysis is unavailable because its capped allowance has been exhausted. No paid OpenAI request was made, and no project item or proposal changed. The submitted source remains immutable evidence with a failed analysis status.",
```

All four return `503`, are non-retry-promoting, and expose no key/grant predicate. Existing timeout, invalid-output, and upstream-failure mappings must also say that immutable evidence and a failed analysis may remain after claim, while no project item or proposal changed.

Keep the database failure allowlist unchanged by mapping `fallback_quota_exhausted` to the persisted `model_unavailable` failure code; the richer public error remains an application-layer result and never expands stored arbitrary text.

- [ ] **Step 4: Run focused tests and commit**

```bash
npm run test:run -- src/features/analysis/service.test.ts src/features/analysis/errors.test.ts src/features/analysis/route-handler.test.ts src/lib/security-boundaries.test.ts
npm run typecheck
git add src/features/analysis/service.ts src/features/analysis/service.test.ts src/features/analysis/errors.ts src/features/analysis/errors.test.ts src/features/analysis/route-handler.test.ts src/lib/security-boundaries.test.ts
git commit -m "feat: enforce fail-closed analysis access"
```

### Task 6: Security documentation, containment, and plan-level verification

**Files:**

- Modify: `docs/architecture.md`
- Modify: `docs/security-review.md`
- Modify: `docs/deployment-runbook.md`
- Modify: `docs/rollback-plan.md`
- Modify: `docs/codex-log.md`

**Interfaces:**

- Consumes the completed environment, RPC, service, and runtime contracts.
- Produces the reviewed forward-containment sequence and non-secret release evidence requirements.

- [ ] **Step 1: Document exact provider selection and atomicity**

Include the three modes, wrapper/legacy RPC privilege boundary, grant tuple, duplicate behavior, mismatch rollback, provider-call ordering, Gateway no-OIDC rule, and truthful failed-analysis persistence message.

- [ ] **Step 2: Document exact containment**

The runbook order is:

1. revoke the OpenAI recording key;
2. remove `OPENAI_API_KEY` from Vercel;
3. remove `AI_GATEWAY_API_KEY` if fallback is implicated;
4. set `ANALYSIS_MODE=disabled` and deploy;
5. apply a forward containment migration revoking wrapper execution and marking `available` grants `revoked`;
6. run migration parity, SQL verifier, health, and viewer-denial checks;
7. never alias an old deployment while any provider credential remains valid.

- [ ] **Step 3: Run the complete repository gate under Node 22**

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
git diff --check
```

Run `npm run test:e2e` because analysis UI behavior changes in the next plan. Record exact counts and do not claim linked SQL until it runs.

- [ ] **Step 4: Commit documentation**

```bash
git add docs/architecture.md docs/security-review.md docs/deployment-runbook.md docs/rollback-plan.md docs/codex-log.md
git commit -m "docs: document analysis access containment"
```

## Plan completion gate

This plan is complete only when all TypeScript tests pass, the migration and verifier are committed, direct legacy RPC execution is revoked, viewer denial produces zero provider construction, recording mode cannot fall back, auto mode cannot use the OpenAI key, and the linked SQL verification is either recorded truthfully or explicitly remains a release-plan gate.
