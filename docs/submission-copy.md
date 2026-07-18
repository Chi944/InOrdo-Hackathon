# Submission copy — working draft

## One-line description

InOrdo turns a project update into evidence-backed impacts and a human-approved, reversible recovery plan.

## Problem

When one date, decision, or constraint changes, small teams often update the obvious task and miss the dependent work. The result is hidden blockers, stale artifacts, and decisions that are difficult to explain later.

## Approach

InOrdo preserves the original update, uses GPT-5.6 to structure the changed fact and draft recovery actions, and relies on explicit project relationships to determine downstream reach. Reviewers see why each item is affected and choose which internal actions to approve. Applied actions belong to an operation history with undo where supported.

## Honest status rule

The integrated P0 code and automated/linked verification cover evidence intake, bounded structured extraction, deterministic impact traversal, eligible-but-inert proposal readiness, selective approval, audit, supported undo, and named synthetic reset. CI browser coverage uses an explicitly labeled fixture and mocked external seams. Before submission, run and record the operator-held live production smoke path in `docs/qa-checklist.md`; do not imply that CI proved hosted authentication, RLS, a funded OpenAI response, deployment security, adoption, scale, or production readiness.

## Differentiator

The model interprets and drafts; deterministic code explains reach; people authorize change.
