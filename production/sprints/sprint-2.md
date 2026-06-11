# Sprint 2 — 2026-06-11 to 2026-06-25

## Sprint Goal
Ship the lasting-effects decision layer: laws and deals leave recurring marks on
the economy, players can repeal them at a cost, the coup mechanic makes maxed
factions dangerous, and the round summary makes every treasury change legible.

**PRD:** `design/gdd/lasting-effects-prd.md` (all decisions logged there)

## Capacity
- Total days: ~10 (solo)
- Buffer (20%): 2 days
- Available: 8 days

## Tasks

### Must Have (Critical Path)
| ID | Task | Owner | Est. Days | Dependencies | Acceptance Criteria |
|----|------|-------|-----------|--------------|---------------------|
| 2-1 | Types & data model: `recurringEffect`, `activeRecurringEffects`, `repealTakenThisRound`, `lastRoundRecurring*` | gameplay-programmer | 0.5 | — | Types compile; existing tests pass |
| 2-2 | `calculateRoundFinancials` sums recurring effects | gameplay-programmer | 0.5 | 2-1 | Unit tests: zero / income-only / expense-only / mixed |
| 2-3 | Store wiring: activate on law/deal accept, reset, save/load | gameplay-programmer | 1.0 | 2-2 | Integration test: pass law → advance → treasury correct incl. recurring |
| 2-4 | Content: 9 lasting-effect laws/deals + i18n EN/ES | writer + gameplay-programmer | 1.0 | 2-1 | All entries selectable in-game; pool weighting max 3 income laws/run |
| 2-5 | DayEnded breakdown: legislation income/costs + one-time rows | ui-programmer | 0.5 | 2-3 | Rows show correct sums, hidden when 0; net matches treasury delta |
| 2-6 | Budget tab forecast includes recurring effects | ui-programmer | 0.5 | 2-3 | rounds-left correct with active effects (correctness bug otherwise) |
| 2-7 | Coup mechanic: thresholds, grace roll, warnings, narratives, EndScreen | gameplay-programmer | 1.5 | — | Unit tests: fires at ≥+8/≤−3 (roll injected); not at −2; special ending intact |
| 2-8 | Repeal UI: Active Legislation section in Log + `repeal()` action | ui-programmer | 1.0 | 2-3, 2-4 | Tiered costs applied; 1/round enforced; disabled when broke |

### Should Have
| ID | Task | Owner | Est. Days | Dependencies | Acceptance Criteria |
|----|------|-------|-----------|--------------|---------------------|
| 2-9 | Visual consequence registry + `getActiveVisualConsequences()` | gameplay-programmer | 0.5 | 2-1 | Evaluator unit tests; 5 starter entries; no street view regression |

### Nice to Have
| ID | Task | Owner | Est. Days | Dependencies | Acceptance Criteria |
|----|------|-------|-----------|--------------|---------------------|
| 2-10 | Balance pass: full playthrough with lasting effects active | economy-designer review | 0.5 | 2-1..2-8 | No re-trivialized treasury; coup reachable but avoidable |

## Carryover from Previous Sprint
| Task | Reason | New Estimate |
|------|--------|--------------|
| 1-7 Log.tsx commit | Still uncommitted (modified in working tree) | 0.25 |
| 1-9 Street waypoint movement | Not started; deprioritized vs lasting effects | 1.0 |
| 1-10 UX review hud.md | Not started | 0.5 |
| 1-11 ADR street scene | Not started | 0.5 |
| 1-12 stage.txt sync | Not started | 0.25 |
| 1-13 End-game stats design | Not started | 0.5 |

**Note:** Sprint 1 story 1-8 (street state→visual mapping) is **superseded by 2-9**
(visual consequence registry) — same goal, better data model. Dropped from backlog.

## Risks
| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Lasting income re-trivializes treasury (no stack cap) | Medium | High | Pool weighting (max 3 income laws/run) + −2 opposing relation on income laws; 2-10 balance pass validates |
| Budget forecast shows wrong rounds-left with active effects | Certain if skipped | High | 2-6 is must-have, not polish |
| Coup feels unfair in playtests | Medium | Medium | Two-tier warning + grace roll; acceptance criterion: <30% "didn't see it coming" |
| Save compatibility breaks (new store fields) | Low | Medium | New fields default to empty/0 on load of old saves |

## Definition of Done for this Sprint
- [ ] All Must Have tasks completed
- [ ] All tasks pass acceptance criteria
- [ ] Logic stories have passing unit tests (2-2, 2-3, 2-7, 2-9)
- [ ] No S1 or S2 bugs in delivered features
- [ ] PRD updated for any deviations
- [ ] i18n complete in EN and ES for all new strings
