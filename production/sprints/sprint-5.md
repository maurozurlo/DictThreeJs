# Sprint 5 — 2026-06-14 to 2026-06-21

## Sprint Goal
Establish the Polish quality baseline and ship the first wave of content polish —
weird laws and weird deals Tier 1 — that make the game feel lived-in and absurd
before external playtesting.

## Capacity
- Total days: 7
- Buffer (20%): 1.4 days reserved for unplanned work
- Available: 5.6 days
- **Velocity note (retro A3):** Actual throughput is ~50% of story-day estimates
  across 4 sprints. Must-haves planned at 2.5d = ~1.5d actual. Should-haves
  available if throughput holds.

## Tasks

### Must Have (Critical Path)

| ID  | Task | Agent/Owner | Est. Days | Dependencies | Acceptance Criteria |
|-----|------|-------------|-----------|--------------|---------------------|
| 5-1 | Performance baseline — measure all 6 budgets against `technical-preferences.md` targets | lead-programmer | 0.5 | — | Report at `production/qa/perf-baseline-2026-06-14.md`: JS round-resolution ≤5ms measured, heap ≤150MB confirmed, 60fps stable, bundle size gzipped measured; any violations flagged with severity |
| 5-2 | Weird Laws — implement 14-law pool (10% trigger, ??? faction, 1-active cap, repeal support) | gameplay-programmer | 1.0 | `design/gdd/weird-laws.md` ✅ | Laws trigger at 10% per round; ??? faction displays correctly in Log; accept applies effect; reject has no penalty; max 1 active at a time; repeal works at normal tier cost; all 14 laws from GDD table implemented; unit-tested |
| 5-3 | Weird Deals Tier 1 — add deals 19–22 to deal pool (existing accept/reject/recurring shape) | gameplay-programmer | 0.75 | `design/gdd/weird-deals.md` Tier 1 (WIP — Tier 1 well-defined) | Deals 19–22 in pool; accept/reject/recurring effects match GDD; no regression on deals 1–18; unit-tested |
| 5-4 | Timer tuning experiment — self-playtest at 3min, decide target value | developer (manual) | 0.25 | — | Timer tested at 3min; decision recorded in `design/gdd/game-concept.md` Tuning Knobs section (keep 5min / reduce to Xmin / rationale); no code change required if decision is "keep 5min" |

**Must-have total: 2.5d** (est. ~1.5d actual given velocity compression)

---

### Should Have

| ID  | Task | Agent/Owner | Est. Days | Dependencies | Acceptance Criteria |
|-----|------|-------------|-----------|--------------|---------------------|
| 5-5 | Interaction patterns doc — create `design/ux/interaction-patterns.md` | ux-designer | 0.5 | — | File exists; documents at minimum: tab navigation pattern, action-panel dual-mode (status vs contextual), pending-dot pattern, modal/overlay priority, advance-button state machine |
| 5-6 | Doc drift cleanup — fix ADR log filenames in `technical-preferences.md`; update Godot scaffolding in `CLAUDE.md`/`VERSION.md` to reflect React/TS stack | lead-programmer | 0.25 | — | ADR entries in `technical-preferences.md` have correct file paths; `CLAUDE.md` engine section and `VERSION.md` no longer describe a Godot project |
| 5-7 | Street View deferral — update `design/gdd/systems-index.md`; audit tutorial for broken Step 8 contract | producer | 0.25 | — | `systems-index.md` Street View row updated to "Deferred — visual-update sprint"; tutorial verified to contain no reference to Street View as a functional feature; if it does, update copy |
| 3-5 | Budget Tier Consequences (Polish enhancement) — sick faction skips Meet; Low-infra tab lockout; security spend applies coup-threshold modifier | gameplay-programmer | 2.0 | Design call ✅ (classified enhancement, deferred to Polish 2026-06-14) | Sick faction skips Meet; infra lockout at Low tier; security spend modifies coup threshold; unit-tested; no regression on existing coup/meet logic |

**Should-have total: 3.0d**

---

### Nice to Have

| ID  | Task | Agent/Owner | Est. Days | Dependencies | Notes |
|-----|------|-------------|-----------|--------------|-------|
| 5-8 | External playtest — non-developer session on Medium difficulty | developer (manual) | 0.5 | — | CD gate concern: all 3 prior playtests are developer self-plays; one external session validates core fantasy. Document in `production/playtests/`. |
| 5-9 | Hard difficulty playtest reconciliation — update `design/difficulty-curve.md` Hard row with session-3 observed data | game-designer | 0.25 | — | `difficulty-curve.md` Hard row updated from "predicted, not observed" to actual session-3 findings |

**Nice-to-have total: 0.75d**

---

## Carryover from Sprint 4

| Task | Reason | New Estimate |
|------|--------|-------------|
| 3-5 Budget Tier Consequences | Formally descoped 2026-06-14 as Polish enhancement (not core mechanic); enters Polish as should-have | 2.0d (from 2.5d) |
| Performance baseline | Carried from gate-check as first Polish task per TD + PR | 0.5d |

---

## Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| `weird-deals.md` still WIP — Tier 1 may have gaps in AC or effects | Medium | Medium | Read the full GDD before implementing 5-3; if gaps exist, file a quick-design decision before coding |
| Timer experiment may reveal need for code change post-decision | Low | Low | If 3min feels right, implement in same session as 5-4 |
| `weird-laws.md` visual consequence column references Sprint 5 visual pass — out of scope for this story | Low | Low | Implement logic effects only; skip visual consequence wiring in 5-2 (explicit in GDD) |
| External playtest recruitment (5-8) | Medium | Low | Even one non-developer session satisfies this story; recruit a friend or colleague |

---

## Dependencies on External Factors
- External playtest session (5-8) requires a non-developer willing to play ~15 min on Medium
- ADR-0007 (Effect Timing) remains Proposed until Weird Deals Tier 2 enter scope (Sprint 6+)

## Definition of Done for this Sprint
- [ ] All Must Have tasks completed
- [ ] All tasks pass acceptance criteria
- [ ] QA plan exists (`production/qa/qa-plan-sprint-5-[date].md`)
- [ ] All Logic/Integration stories have passing unit/integration tests
- [ ] Smoke check passed (`/smoke-check sprint`)
- [ ] QA sign-off: APPROVED or APPROVED WITH CONDITIONS (`/team-qa sprint`)
- [ ] No S1 or S2 bugs in delivered features
- [ ] Performance baseline report exists (`production/qa/perf-baseline-2026-06-14.md`)

> ⚠️ **No QA Plan**: This sprint was started without a QA plan. Run `/qa-plan sprint`
> before the last story is implemented. The Polish → Release gate requires a QA
> sign-off report, which requires a QA plan.

> **Scope check:** 5-2 (Weird Laws) and 5-3 (Weird Deals Tier 1) extend the
> content layer beyond the original Epic 1–4 scope. Run `/scope-check` if
> content epics have formal boundaries defined.
