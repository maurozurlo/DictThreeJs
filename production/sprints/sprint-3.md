# Sprint 3 — 2026-06-13 to 2026-06-27

## Sprint Goal
Close the ending loop: meta-progression Records panel, secret room rework into a
real alternate win condition, and stats screen enhancements — making the game feel
complete and replayable for the first time.

## Capacity
- Total days: 14
- Buffer (20%): 2.8 days reserved for unplanned work
- Available: 11.2 days

## Tasks

### Must Have (Critical Path)

| ID   | Task | Agent/Owner | Est. Days | Dependencies | Acceptance Criteria |
|------|------|-------------|-----------|--------------|---------------------|
| 3-1  | Meta-progression data layer — `MetaProgress` type (`highestTier`, `endingsUnlocked[]`), localStorage r/w, included as `meta` field in `.dict` save export; import merges best-of | gameplay-programmer | 0.5 | — | localStorage persists across sessions; save export includes `meta`; import merges without downgrading tier or removing endings |
| 3-2  | Records panel on Menu tab — best tier badge (S/A/B/C/D/F) + endings grid (all 14 slots, locked/unlocked) | ui-programmer | 1.0 | 3-1 | Panel visible on Menu tab; correct tier badge; locked slots show as `?`; unlocked slots show ending name; i18n |
| 3-3  | Secret room rework — trigger threshold (relation ≥ 5 by round 9, any faction), two endings per room (good/bad), charisma-weighted probability, i18n all hardcoded strings, action panel UI (description + button like Law view) | gameplay-programmer + ui-programmer | 2.0 | — | Secret tab accessible when ≥ 1 faction at relation ≥ 5 by round 9; both outcomes reachable; charisma affects probability; action panel renders; all strings i18n'd; `endingsUnlocked` updated on outcome |
| 3-4  | Stats screen enhancements — add coup close-call to `GameStats` (did grace roll fire?), recurring effects active at end summary, repeal count; wire meta-progression update on game end | gameplay-programmer | 0.75 | 3-1 | EndScreen shows coup close-call row if grace fired; recurring income/expense totals shown; repeal count shown; `MetaProgress` written to localStorage on every game end |

**Must-have total: 4.25 days**

### Should Have

| ID   | Task | Agent/Owner | Est. Days | Dependencies | Acceptance Criteria |
|------|------|-------------|-----------|--------------|---------------------|
| 3-5  | F6 Budget Tier Consequences — Low/Normal/High tiers per budget category; sick-day mechanic (faction skips Meet, −1 relation); infrastructure tab lockout (20%/round at Low); security coup modifier; charisma swings on infra tier change | gameplay-programmer | 2.5 | Visual registry wiring (F5 partial) | Sick faction skips Meet with correct probability per health slider; tab lockout fires at infra Low; security High adjusts coup charisma threshold; all effects unit-tested |

### Nice to Have (Sprint 1 carry-overs)

| ID   | Task | Agent/Owner | Est. Days | Dependencies | Acceptance Criteria |
|------|------|-------------|-----------|--------------|---------------------|
| 1-9  | Street View waypoint movement (A→B→A) | gameplay-programmer | 1.0 | — | Camera moves between 2 waypoints in Street tab |
| 1-10 | UX Review: hud.md | ux-designer | 0.5 | — | Review doc + findings written |
| 1-11 | ADR: Street Scene Architecture | technical-director | 0.5 | — | ADR written and merged |
| 1-12 | Sync production/stage.txt to Technical Setup | producer | 0.25 | — | stage.txt matches current project phase |

> **Note**: Story 1-13 (End-game stats screen: design only) is superseded by 3-4
> (full implementation). No separate carry-over needed.

## Carryover from Sprint 2

| Task | Reason | New Estimate |
|------|--------|-------------|
| 1-9 Street View waypoint | Nice-to-have, deprioritised | 1.0d |
| 1-10 UX Review hud.md | Nice-to-have, deprioritised | 0.5d |
| 1-11 ADR Street Scene | Nice-to-have, deprioritised | 0.5d |
| 1-12 Sync stage.txt | Nice-to-have, deprioritised | 0.25d |

## Ending ID Reference (for 3-1 and 3-2)

The 14 ending slots for the Records panel:

| Slot | ID | Description |
|------|----|-------------|
| 1 | `military` | Overthrown by Military |
| 2 | `business` | Overthrown by Business |
| 3 | `people` | Overthrown by People |
| 4 | `bankruptcy` | Ran out of money |
| 5 | `military_coup` | Coup — Military faction |
| 6 | `business_coup` | Coup — Business faction |
| 7 | `people_coup` | Coup — People faction |
| 8 | `victory` | Survived all 10 rounds |
| 9 | `secret_room_0_good` | Secret Room 0 — Good ending |
| 10 | `secret_room_0_bad` | Secret Room 0 — Bad ending |
| 11 | `secret_room_1_good` | Secret Room 1 — Good ending |
| 12 | `secret_room_1_bad` | Secret Room 1 — Bad ending |
| 13 | `secret_room_2_good` | Secret Room 2 — Good ending |
| 14 | `secret_room_2_bad` | Secret Room 2 — Bad ending |

## Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Secret room rework scope creep — two endings × 3 rooms = 6 narrative variants to write | Medium | Medium | Lock content to placeholder/template text first; polish writing after mechanics are wired |
| F6 Budget Tier Consequences harder than 2.5d if visual registry wiring unblocked — infra/health visual feedback may pull in 3D work | Medium | Medium | Implement mechanical effects only; defer 3D visual feedback to Sprint 4 |
| 14 slot endings grid on Menu tab — defining all 14 ending IDs requires agreeing on secret room outcome naming before 3-1 and 3-2 can be fully built | Low | Low | Ending ID enum defined in 3-1 as the authoritative list; 3-2 reads from it |

## Dependencies on External Factors
- Secret room good/bad endings require narrative content — placeholder text acceptable for v1; polish in a later sprint

## Definition of Done for this Sprint
- [ ] All Must Have tasks completed
- [ ] All tasks pass acceptance criteria
- [ ] QA plan exists (`production/qa/qa-plan-sprint-3.md`)
- [ ] All Logic/Integration stories have passing unit/integration tests
- [ ] Smoke check passed (`/smoke-check sprint`)
- [ ] QA sign-off report: APPROVED or APPROVED WITH CONDITIONS (`/team-qa sprint`)
- [ ] No S1 or S2 bugs in delivered features
- [ ] Design documents updated for any deviations
- [ ] Code reviewed and merged
