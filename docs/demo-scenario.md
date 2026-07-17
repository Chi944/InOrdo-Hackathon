# Demo scenario: summit venue date change

## Fixture status

All names, records, dates, and updates in this scenario are synthetic. The demo does not represent a customer account or external integration.

## Baseline

A fictional eight-person team is planning the Regional Climate Action Summit 2026 for **12 September 2026**. The project contains tasks, milestones, decisions, an event, risks, artifacts, and explicit directed dependencies.

## Source update

> Venue update — 20 July 2026: The campus convention hall is unavailable on 12 September 2026. The venue team has offered 26 September 2026 instead. All other venue terms remain unchanged.

## Expected candidate change

- Record: `EVT-01 — Regional Climate Action Summit 2026`
- Field: `event_date`
- Previous value: `2026-09-12`
- Proposed value: `2026-09-26`
- State: `Needs human confirmation`

## Expected demonstration

1. Show the preserved evidence and candidate change side by side.
2. Confirm the extraction before computing impact.
3. Show direct impacts such as speaker confirmation and catering.
4. Show a multi-hop path from event date to speaker confirmation to programme lock to briefing pack.
5. Review recovery actions individually.
6. Leave travel rebooking unapproved because it has cost and participant consequences.
7. Apply only approved internal fixture actions, inspect operation history, and demonstrate undo only when verified.
8. Reset the isolated fixture to the exact baseline.

## Reset baseline

Reset restores the original event date, seeded records and edges, no source update, no candidate change, no proposals, no approvals, and no operation history.
