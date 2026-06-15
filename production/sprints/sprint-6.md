# Sprint 6 — 2026-06-22 to 2026-06-28
## "The Quantum Mega Tech Debt Update Sprint" ⚛️

## Sprint Goal
Pay down the effect-system tech debt by implementing ADR-0008 (Timed Modifier Engine) —
unifying laws, deals, weird-laws, and structures onto one data-driven engine so all effect
math is uniform and new content is trivial to add.

## Capacity
- Total days: 7
- Buffer (20%): 1.4 days reserved for unplanned work
- Available: 5.6 days
- **Velocity note (carried from Sprint 4/5 retro):** actual throughput ~50% of story-day
  estimates. Must-haves planned at 4.0d ≈ ~2.0d actual. Should-haves available if it holds.

## Tasks

### Must Have (Critical Path)

| ID  | Task | Agent/Owner | Est. Days | Dependencies | Acceptance Criteria |
|-----|------|-------------|-----------|--------------|---------------------|
| 6-1 | ADR-0008 P1 — modifier schema (`TimeModifier`, `ResolvedWindow`, `ResolvedStatMod`, extended `Modifier`), `TIME_MODIFIERS` registry, `Utils/Modifiers` (`isWindowActive`, `sumModifiers(round)`, `getEffectiveCharisma`/`getEffectiveRelation` re-clamped ±10); switch coup/overthrow/special-ending/displays to effective relations; `onStart` fire site in `nextRound()` | lead-programmer | 1.5 | ADR-0008 (Accepted) | Statue byte-identical (regression green); windowed people-bump active exactly 1 round + sum re-clamped ±10; delayed `roundIncome` contributes only after delay; `onStart` fires exactly once across save/load; coup/overthrow/special-ending read effective relations (pinned by tests); base relations still erode; full suite green |
| 6-4 | Repeal-tier balance pass — derive generic repeal-tier formula for a modifier's economic magnitude (`Σ|amount|` of `roundIncome`/`roundExpense`, frozen at acquisition) | economy-designer | 0.5 | — | Formula + tier thresholds documented; parity-checked against current law/deal repeal costs; explicitly unblocks 6-2 repeal |
| 6-2 | ADR-0008 P2 — replace `ActiveRecurringEffect`: deal/law recurring income/expense → `roundIncome`/`roundExpense` mods; `nextRound()` banks income + writes `lastRoundRecurringIncome` + accumulates `stats.totalRecurringIncomeEarned`; weird-law slot via `findIndex(type==='weird-law')`; `filterLawPool` via filter; repeal flips `state` to `'rejected'`; Active-Legislation UI renders from the array | lead-programmer | 2.0 | 6-1, 6-4 | All recurring economics run off modifiers; weird-law 1-active cap holds; law pool excludes active `law-recurring` ids; repeal works + base penalty to faction looked up by id; one-way save migration (old `activeRecurringEffects` → modifiers, `?? []`); full suite green; no regression on income/repeal |

**Must-have total: 4.0d** (est. ~2.0d actual given velocity compression)

---

### Should Have

| ID  | Task | Agent/Owner | Est. Days | Dependencies | Acceptance Criteria |
|-----|------|-------------|-----------|--------------|---------------------|
| 6-3 | ADR-0008 P3 — migrate opportunities/periodic events, mini-challenges, and buyable structures onto modifiers; Street View + Advisor read a single `getVisibleModifiers(modifiers, round)` selector | gameplay-programmer | 1.5 | 6-2 | Remaining content types create modifiers on resolution; one `getVisibleModifiers` selector feeds scene + advisor (ADR-0003 projection); no gameplay regression; tests |
| 6-5 | Author ADR-0009 — Coup Telegraphing & Fairness (≥1-round explicit warning, visible inputs, deterministic+telegraphed arming; coup-reads-effective already lands in 6-1) | technical-director | 0.5 | — | ADR-0009 written and Accepted; references ADR-0008 effective relations; added to ADR log |
| 6-6 | Modifier authoring guide — short doc: how to express a deal/law/structure as modifiers + `TIME_MODIFIERS`, with the cattle worked example | lead-programmer | 0.5 | 6-1 | Guide in `docs/` (or `design/`) with a "add a new timed deal in N lines" recipe; serves the expandability goal |

**Should-have total: 2.5d**

---

### Nice to Have

| ID  | Task | Agent/Owner | Est. Days | Dependencies | Notes |
|-----|------|-------------|-----------|--------------|-------|
| 5-8 | External playtest — non-developer session on Medium difficulty (carryover) | developer (manual) | 0.5 | — | Still the only validation gap from Sprint 5; document in `production/playtests/` |
| 5-9 | Hard difficulty playtest reconciliation (carryover) | game-designer | 0.25 | — | Update `design/difficulty-curve.md` Hard row with observed data |
| 6-7 | Coup fairness UI — telegraphing readout (coup risk faction + distance to threshold) | ui-programmer | 1.0 | 6-5 | Likely spills to Sprint 7 |

**Nice-to-have total: 1.75d**

---

## Carryover from Sprint 5

| Task | Reason | New Estimate |
|------|--------|--------------|
| 5-8 External playtest | Nice-to-have, never started in Sprint 5 | 0.5d |
| 5-9 Hard difficulty reconciliation | Nice-to-have, never started in Sprint 5 | 0.25d |

---

## Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| P2 blast radius — laws + repeal + pool + Active-Legislation UI move at once | High | High | Phase gating; 6-1 ships behaviour-preserving first; full suite gate before starting 6-2 |
| Effective relations into coup shift balance/feel | Medium | Medium | Pinned by tests in 6-1; fairness redesign handled in ADR-0009 (6-5) |
| Save migration drops/garbles recurring effects | Medium | Medium | One-way migration + `?? []` default; save/load round-trip test |
| Repeal-tier numbers (6-4) not ready → blocks 6-2 repeal | Medium | Medium | 6-4 is must-have, front-loaded before 6-2 |
| Story files for 6-x not yet authored | Medium | Low | Run `/create-stories` (or author manually) before `/dev-story` |

---

## Dependencies on External Factors
- 5-8 requires a non-developer willing to play ~15 min on Medium.
- ADR-0009 authoring (6-5) gates the coup-fairness UI (6-7), not the engine work.
- ADR-0007 scope finalisation happens alongside 6-3 (P3).

## Definition of Done for this Sprint
- [ ] All Must Have tasks (6-1, 6-2, 6-4) completed
- [ ] All tasks pass acceptance criteria
- [ ] QA plan exists (`production/qa/qa-plan-sprint-6.md`)
- [ ] All Logic/Integration stories have passing unit/integration tests; full suite green
- [ ] Smoke check passed (`/smoke-check sprint`)
- [ ] QA sign-off: APPROVED or APPROVED WITH CONDITIONS (`/team-qa sprint`)
- [ ] No S1 or S2 bugs; statue + recurring-effect behaviour preserved through migration
- [ ] ADR-0008 phases P1/P2 marked done; ADR-0009 authored

> **Producer feasibility gate (PR-SPRINT):** skipped — lean review mode.

> **Scope check:** This sprint is architectural tech-debt (ADR-0008), not new content epics.
> Run `/scope-check` only if effect-system epics have formal boundaries defined.
