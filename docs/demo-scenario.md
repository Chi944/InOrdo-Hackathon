# Demo scenario: Regional Climate Action Summit 2026

## Fixture status and purpose

The workspace **Inter-University Environmental Coalition — Regional Climate Action Summit 2026** is a synthetic Build Week fixture. Every person, organization detail, project record, date, and source update below is fictional. It contains no customer information and does not imply an external integration.

The scenario demonstrates one bounded question: when a confirmed venue problem moves an event by two weeks, can a small team preserve the evidence, understand the downstream impact, approve safe recovery actions selectively, inspect what changed, undo a supported operation, and reset the demo?

## Workspace team

The fixture has eight fictional members. Names are included only to make ownership clear in the demo.

| Member | Fictional role | Demo responsibility |
| --- | --- | --- |
| Mina Rao | Coalition coordinator | Project lead and final approver |
| Theo Mensah | Venue and operations lead | Venue, catering, and on-site readiness |
| Jules Park | Programme lead | Speakers, agenda, and briefing |
| Amara Ndlovu | University partnerships lead | Partner coordination and promotion |
| Elena Cruz | Communications lead | Registration content and participant updates |
| Noah Williams | Participant logistics lead | Travel review and attendee support |
| Priya Sen | Accessibility and safety lead | Access review, safety checks, and risk follow-up |
| Lucas Tan | Finance and procurement lead | Cost review and supplier changes |

## Canonical seeded records

The reset baseline is the state immediately before the venue update is pasted. Dates use ISO format so the fixture is unambiguous.

| ID | Type | Record | Owner | Baseline state | Baseline date or deadline |
| --- | --- | --- | --- | --- | --- |
| `EVT-01` | Event | Regional Climate Action Summit 2026 | Mina | Scheduled | `2026-09-12` |
| `EVT-02` | Event | Online speaker briefing | Jules | Scheduled | `2026-09-09` |
| `MS-01` | Milestone | Venue and summit date confirmed | Theo | Achieved | `2026-07-10` |
| `MS-02` | Milestone | Speaker line-up locked | Jules | Planned | `2026-08-07` |
| `MS-03` | Milestone | Programme locked | Jules | Planned | `2026-08-21` |
| `MS-04` | Milestone | Summit readiness complete | Mina | Planned | `2026-09-04` |
| `DEC-01` | Decision | Use the campus convention hall | Mina | Approved | `2026-07-10` |
| `DEC-02` | Decision | Close registration on 28 August | Elena | Approved | `2026-07-15` |
| `DEC-03` | Decision | Require individual approval for travel changes | Lucas | Approved | `2026-07-15` |
| `DEC-04` | Decision | Keep a single-day summit format | Mina | Approved | `2026-07-15` |
| `TSK-01` | Task | Complete final venue walkthrough | Theo | Planned | `2026-09-05` |
| `TSK-02` | Task | Confirm all speaker availability | Jules | In progress | `2026-07-29` |
| `TSK-03` | Task | Finalize the run of show | Jules | Planned | `2026-08-14` |
| `TSK-04` | Task | Publish final registration details | Elena | Planned | `2026-07-30` |
| `TSK-05` | Task | Prepare registered-attendee notice | Elena | Planned | `2026-08-03` |
| `TSK-06` | Task | Confirm catering service date and headcount | Theo | Planned | `2026-08-05` |
| `TSK-07` | Task | Review participant travel changes | Noah | Planned | `2026-08-07` |
| `TSK-08` | Task | Build volunteer shift roster | Amara | Planned | `2026-08-12` |
| `TSK-09` | Task | Complete accessibility and safety review | Priya | Planned | `2026-09-07` |
| `TSK-10` | Task | Schedule partner promotion | Amara | Planned | `2026-08-03` |
| `RSK-01` | Risk | Speaker unavailable for summit date | Jules | Monitoring | No fixed date |
| `RSK-02` | Risk | Travel change creates extra cost | Lucas | Monitoring | No fixed date |
| `RSK-03` | Risk | Participants follow outdated date | Elena | Monitoring | No fixed date |
| `RSK-04` | Risk | Catering supplier cannot serve revised date | Theo | Monitoring | No fixed date |
| `ART-01` | Artifact | Venue confirmation letter | Theo | Final | `2026-07-10` |
| `ART-02` | Artifact | Master programme | Jules | Draft | `2026-08-21` |
| `ART-03` | Artifact | Registration page copy | Elena | Draft | `2026-07-30` |
| `ART-04` | Artifact | Participant guide | Elena | Planned | `2026-09-04` |
| `ART-05` | Artifact | Partner media kit | Amara | Planned | `2026-08-05` |

This baseline contains 29 records across all six P0 record types: task, milestone, decision, event, risk, and artifact.

## Explicit dependency registry

For every row, `A → B` means **B depends on A**. Impact traversal begins at the human-confirmed candidate's target record and follows arrows downstream. The relation label explains why the edge exists; GPT-5.6 does not create or choose the traversal path during the demo.

| From | To | Relation |
| --- | --- | --- |
| `ART-01` | `DEC-01` | provides evidence for venue selection |
| `DEC-01` | `MS-01` | decision is required to confirm venue and date |
| `MS-01` | `EVT-01` | confirmation is the scheduling basis |
| `EVT-01` | `EVT-02` | briefing is scheduled relative to summit date |
| `EVT-01` | `TSK-01` | walkthrough is scheduled relative to summit date |
| `EVT-01` | `TSK-02` | availability must match summit date |
| `EVT-01` | `DEC-02` | registration deadline is derived from summit date |
| `EVT-01` | `TSK-06` | catering requires the service date |
| `EVT-01` | `TSK-07` | travel review requires the travel date |
| `EVT-01` | `TSK-08` | volunteer shifts require the event date |
| `EVT-01` | `TSK-10` | promotion schedule is tied to summit date |
| `TSK-02` | `MS-02` | line-up cannot lock before availability is confirmed |
| `TSK-02` | `RSK-01` | availability result informs speaker risk |
| `MS-02` | `TSK-03` | run of show requires a locked line-up |
| `DEC-04` | `TSK-03` | format decision constrains the run of show |
| `TSK-03` | `MS-03` | programme locks after the run of show is final |
| `MS-03` | `ART-02` | locked programme is the artifact source |
| `ART-02` | `EVT-02` | briefing uses the programme agenda |
| `ART-02` | `ART-04` | participant guide uses programme content |
| `DEC-02` | `TSK-04` | publication must show the registration deadline |
| `TSK-04` | `ART-03` | publication task produces registration copy |
| `ART-03` | `TSK-05` | attendee notice uses confirmed registration details |
| `ART-03` | `ART-04` | participant guide uses registration details |
| `TSK-05` | `RSK-03` | notice readiness informs outdated-date risk |
| `TSK-06` | `RSK-04` | supplier response informs catering risk |
| `DEC-03` | `TSK-07` | travel policy constrains the review |
| `TSK-07` | `RSK-02` | travel review informs cost exposure |
| `TSK-01` | `TSK-09` | access and safety review follows the walkthrough |
| `TSK-09` | `MS-04` | readiness requires completed access review |
| `TSK-08` | `MS-04` | readiness requires a volunteer roster |
| `TSK-06` | `MS-04` | readiness requires catering confirmation |
| `ART-04` | `MS-04` | readiness requires a participant guide |
| `EVT-02` | `MS-04` | readiness requires the speaker briefing |
| `TSK-10` | `ART-05` | promotion task produces the partner media kit |

## Exact pasted source update

The presenter pastes this text exactly, including the heading and punctuation:

> Venue update — 20 July 2026: The campus convention hall is unavailable on 12 September 2026. The venue team has offered 26 September 2026 instead. All other venue terms remain unchanged.

InOrdo must preserve that raw text as the evidence record. It is untrusted input, not an instruction to mutate the project.

## Expected structured extraction

The expected validated candidate is:

| Field | Expected value |
| --- | --- |
| Source type | Pasted update |
| Affected record | `EVT-01 — Regional Climate Action Summit 2026` |
| Change type | Event rescheduled |
| Field | `event_date` |
| Previous value | `2026-09-12` |
| Proposed value | `2026-09-26` |
| Reason | Campus convention hall unavailable on the previous date |
| Unchanged fact | All other venue terms remain unchanged |
| Review state | Needs human confirmation |

The presenter confirms or corrects this candidate before impact review. A model confidence score, if shown, must not replace that review. Invalid or ambiguous extraction must fail closed and must not change `EVT-01`.

## Expected deterministic impact

### Direct impacts: depth 1

These are the eight records with an explicit edge directly from `EVT-01`.

| Record | Why it is affected |
| --- | --- |
| `EVT-02` | The speaker briefing is positioned three days before the summit. |
| `TSK-01` | The final walkthrough is positioned one week before the summit. |
| `TSK-02` | Speakers confirmed against 12 September must be checked for 26 September. |
| `DEC-02` | The registration close date was chosen relative to the summit date. |
| `TSK-06` | The catering service date is currently 12 September. |
| `TSK-07` | Participant travel was reviewed against the original date. |
| `TSK-08` | Volunteer shifts were planned for the original date. |
| `TSK-10` | Partner promotion timing points to the original summit date. |

### Indirect impacts: depth 2 or greater

Each impact is derived from the dependency registry. The interface may show more than one valid path when a record has multiple prerequisites.

| Record | One expected explainable path | Invalidated assumption |
| --- | --- | --- |
| `MS-02` | `EVT-01 → TSK-02 → MS-02` | Speaker line-up cannot remain locked without rechecking availability. |
| `RSK-01` | `EVT-01 → TSK-02 → RSK-01` | Speaker-risk assessment used the previous date. |
| `TSK-03` | `EVT-01 → TSK-02 → MS-02 → TSK-03` | Run of show assumes the same speakers remain available. |
| `MS-03` | `EVT-01 → TSK-02 → MS-02 → TSK-03 → MS-03` | Programme lock rests on the old availability check. |
| `ART-02` | `EVT-01 → TSK-02 → MS-02 → TSK-03 → MS-03 → ART-02` | Programme content and date need review. |
| `TSK-04` | `EVT-01 → DEC-02 → TSK-04` | Registration details use the former closing schedule. |
| `ART-03` | `EVT-01 → DEC-02 → TSK-04 → ART-03` | Registration copy contains the old date or deadline. |
| `TSK-05` | `EVT-01 → DEC-02 → TSK-04 → ART-03 → TSK-05` | Attendee notice cannot be prepared from stale details. |
| `RSK-03` | `EVT-01 → DEC-02 → TSK-04 → ART-03 → TSK-05 → RSK-03` | Communication risk must be reassessed. |
| `RSK-04` | `EVT-01 → TSK-06 → RSK-04` | Supplier availability for 26 September is unknown. |
| `RSK-02` | `EVT-01 → TSK-07 → RSK-02` | Travel cost exposure is based on 12 September. |
| `TSK-09` | `EVT-01 → TSK-01 → TSK-09` | Review timing follows the old walkthrough date. |
| `ART-05` | `EVT-01 → TSK-10 → ART-05` | Partner copy and publishing schedule use the old date. |
| `ART-04` | `EVT-01 → DEC-02 → TSK-04 → ART-03 → ART-04` | Participant guide uses stale registration details. |
| `MS-04` | `EVT-01 → TSK-01 → TSK-09 → MS-04` | Readiness cannot be confirmed until shifted work is complete. |

`ART-01`, `DEC-01`, `MS-01`, `DEC-03`, and `DEC-04` remain visible context but are not downstream impacts. The new evidence supersedes the scheduled date; it does not erase the prior venue evidence or invalidate the travel-approval and single-day-format policies.

## Expected recovery proposal

Every proposal is inert until an authorized person approves that specific action. P0 changes only native InOrdo records; it does not send messages, change an external registration site, contact a supplier, or purchase travel.

| Action | Proposed internal operation | Demo decision |
| --- | --- | --- |
| `RA-01` | Change `EVT-01.event_date` from `2026-09-12` to `2026-09-26`. | Approve |
| `RA-02` | Move `EVT-02` from `2026-09-09` to `2026-09-23`. | Approve |
| `RA-03` | Move `TSK-01` from `2026-09-05` to `2026-09-19`. | Approve |
| `RA-04` | Reopen date confirmation in `TSK-02` and set its review deadline to `2026-07-27`. | Approve |
| `RA-05` | Change `DEC-02` so registration closes on `2026-09-11`, subject to human review. | Approve |
| `RA-06` | Mark `ART-03` as needing revision for the new event date and deadline. | Approve |
| `RA-07` | Change the service date referenced by `TSK-06` to `2026-09-26`; leave supplier confirmation open. | Approve |
| `RA-08` | Change only the internal `TSK-07` record from “Review participant travel changes” to “Prepare participant travel rebooking options for individual approval” and set its deadline to `2026-07-31`; this does not book travel. | **Leave unapproved** |
| `RA-09` | Shift the volunteer roster in `TSK-08` to cover `2026-09-26`. | Approve |
| `RA-10` | Move `TSK-09` to `2026-09-21`, after the revised walkthrough. | Approve |
| `RA-11` | Mark `ART-05` as needing revision and point `TSK-10` to the new summit date. | Approve |
| `RA-12` | Set `TSK-05` to prepare a corrected notice after registration copy is reviewed; do not send anything externally. | Approve |

`RA-08` remains unapproved because proceeding toward travel changes can create costs and requires participant consent. The demo must show it as pending, leave the internal `TSK-07` record exactly at its baseline state, and create no applied-operation record for it. InOrdo does not book, cancel, or rebook travel.

## Operation history and undo expectation

After approved actions are applied, history should show only operations that actually succeeded, with the actor, time, proposal action, affected record, before-state, and after-state. Applying one action must not imply approval of another.

For the undo demonstration, use `RA-03`: undo the walkthrough move so `TSK-01` returns from `2026-09-19` to `2026-09-05`. Undo must append a compensating operation rather than remove the original history entry. Demonstrate this only after the behavior passes the QA checklist in the current build.

## Deterministic reset baseline

The fixture key is `demo-iuec-summit-2026`; the canonical snapshot is `summit-baseline-v1`. A successful reset must:

- restore all 29 records, owners, states, and dates exactly as listed above;
- restore all 34 dependency edges exactly as listed above;
- restore `EVT-01.event_date` to `2026-09-12`;
- start the active demo run with zero pasted source updates, candidate changes, impact reviews, recovery proposals, approvals, applied operations, and undo operations;
- use the same stable fixture IDs on every reset;
- affect only this synthetic workspace and fail closed for any other project; and
- produce the same active baseline after repeated resets.

No external message, booking, or supplier change is part of the baseline or reset.

## Judge-facing walkthrough

1. **Set context.** Open the workspace, point out the synthetic-data label, the eight-person team, `EVT-01` on 12 September, and two or three dependent records.
2. **Preserve evidence.** Paste the exact venue update and show the unedited source beside its provenance. Explain that pasted text is evidence, not permission.
3. **Review interpretation.** Show the structured candidate date change. Confirm it manually; if extraction is not verified in the build, label this step as planned and do not imply it ran.
4. **Trace impact.** Show the eight direct impacts, then open at least one multi-hop path such as `EVT-01 → TSK-02 → MS-02 → TSK-03 → MS-03 → ART-02`. Explain that application code follows stored edges deterministically.
5. **Review recovery.** Show each proposed internal action with its evidence and affected record. Emphasize that the proposal itself has changed nothing.
6. **Approve selectively.** Approve safe fixture actions, but leave `RA-08` pending because it carries cost and consent consequences. Confirm that no external action is performed.
7. **Inspect and undo.** If verified, apply the selected actions, inspect their operation records, and undo `RA-03` to show a compensating history entry. Otherwise, describe this as unfinished rather than simulating success.
8. **Reset.** Reset only the synthetic fixture and confirm `EVT-01` is back on 12 September, `TSK-01` is back on 5 September, the source/proposal state is empty, and the same records and edges are present.

Before recording or presenting, every step described as working must pass `docs/qa-checklist.md`. Any failed or unavailable step must be called out plainly as a limitation.
