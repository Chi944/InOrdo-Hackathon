# InOrdo product brief

## Purpose

InOrdo helps small teams respond when a new fact changes a project. It keeps the source visible, makes downstream effects explainable, drafts a bounded recovery plan, and requires people to approve each internal change.

## Primary user

A project lead in a 4–12 person team who coordinates tasks, milestones, events, risks, decisions, and artifacts but cannot safely update every dependent record from memory.

## P0 promise

Given one pasted project update, a reviewer can:

1. compare the original evidence with a structured candidate change;
2. inspect direct and downstream impacts with explicit dependency paths;
3. review GPT-5.6-drafted recovery actions;
4. approve actions selectively while leaving sensitive actions unapproved;
5. inspect applied internal operations and undo supported changes; and
6. reset the synthetic demo to a known baseline.

## Product principles

- Evidence before action.
- Model interpretation is visible and correctable.
- Dependency reach is deterministic and explainable.
- A proposal is not permission.
- Operations are attributable and reversible where supported.
- Demo states and unfinished capabilities are labeled honestly.

## Non-goals for Build Week

External connectors, embeddings, autonomous mutations, enterprise administration, native mobile applications, and claims of production readiness are out of scope.

## Current status

The repository, workspace database, RLS, authentication boundary, native project-item/dependency operations, deterministic traversal, evidence/analysis API, inert recovery proposals, approved operation application, audit history, compensating undo, and named demo-reset backend contracts are implemented and automatically/linked verified. The protected interface still has minimal real-data controls pending Andres's project, impact, and approval views. A live OpenAI request and the authenticated end-to-end browser journey remain unfinished and must not be presented as working.
