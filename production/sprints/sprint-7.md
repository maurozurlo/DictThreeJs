# Sprint 7 — 2026-06-17 to 2026-06-24

## "The Street Puts a Face on It"

## Sprint Goal
Implement the Citizen Simulation from the approved GDD: 25 persistent named
citizens whose employment, happiness, and visible behaviour track every ruling
decision, with protest/thief feedback looping back into relations and treasury.

## Capacity
- Total days: 7
- Buffer (20%): 1.4 days reserved for unplanned work
- Available: 5.6 days
- Velocity note: Sprint 6 completed all Must Have + Should Have + one Nice to Have
  (6-7) ahead of the planned end date. Velocity appears stronger than the ~50%
  compression estimated from Sprint 5. Planning at 65% confidence.

## Tasks

### Must Have (Critical Path)

| ID  | Task | Agent/Owner | Est. Days | Dependencies | TR-ID |
|-----|------|-------------|-----------|--------------|-------|
| 7-1 | **CitizenHandler P1 — Generation + Identity.** `buildCitizenRoster(seed)` seeded via ADR-0010. 25 citizens with fixed `name / skin / faction / bodySeed`. StateFactory: generate at game start; restore on load. Types: `Citizen` (immutable identity), `CitizenState` (mutable per-round). | lead-programmer | 1.0 | ADR-0010 (shipped) | TR-citizen-001 |
| 7-2 | **CitizenHandler P2 — Employment + Happiness + Body-Type.** Pure functions: `computeEmployment`, `computeHappiness` (factionFortune + charismaTerm − displacement − volatility, clamped 0–10), `computeBodyType` (lerp by health). All RNG-free. | lead-programmer | 1.5 | 7-1, getEffectiveRelation (6-1) | TR-citizen-002 |
| 7-3 | **CitizenHandler P3 — Role Fork + Death + Feedback + nextRound() wiring.** `computeRole` (gone/starvation rolls via `rollChance`; education fork; faction gate). `computeFeedback` (protest skim → peopleRelation; thief skim → treasury). `displayedPopulation`. Wire as final resolution step in `nextRound()`. CI grep gate (AC-15). | gameplay-programmer | 2.0 | 7-2, ADR-0010, ADR-0002 atomic set | TR-citizen-003 |

**Must Have total: 4.5d** (est. ~2.9d actual based on Sprint 6 velocity)

---

### Should Have

| ID  | Task | Agent/Owner | Est. Days | Dependencies | Notes |
|-----|------|-------------|-----------|--------------|-------|
| 7-4 | **Street View — citizen rendering.** StreetView.tsx reads citizen states from store. Maps `role` → posture, `faction` → outfit (existing ped meshes). Protestor cluster grouping. Uses `ped_special_man_thief` as placeholder for the missing `ped_special_man_protestor` asset. | gameplay-programmer | 0.5 | 7-3, existing ped assets | Visual/Feel — ADVISORY evidence |
| 7-5 | **Citizen Inspector UI** (AC-16). Click-to-inspect: name, faction (with icon), employed/role state, happiness 0–10 bar, dismiss-on-click-elsewhere. ADR-0003: 3D Scene owns raycast → `selectedPedId` in store → plain React panel reads store. | ui-programmer | 0.5 | 7-3 | UI — ADVISORY evidence |

**Should Have total: 1.0d**

---

### Nice to Have

| ID  | Task | Agent/Owner | Est. Days | Dependencies | Notes |
|-----|------|-------------|-----------|--------------|-------|
| 7-6 | **Population HUD readout.** Wire `displayedPopulation` (computed in 7-3) to the existing stat area. Thousands-separator formatting. | ui-programmer | 0.25 | 7-3 | Small UI wiring |
| 5-8 | External playtest — non-developer Medium difficulty session (carryover × 2) | developer (manual) | 0.5 | — | Playtest doc in `production/playtests/` |
| 5-9 | Hard difficulty playtest reconciliation (carryover × 2) | game-designer | 0.25 | — | Update `design/difficulty-curve.md` Hard row |

**Nice to Have total: 1.0d**

---

## Carryover from Sprint 6

| Task | Reason | New Estimate |
|------|--------|--------------|
| 5-8 External playtest | Nice-to-have; never started in S5 or S6 | 0.5d |
| 5-9 Hard difficulty reconciliation | Nice-to-have; never started in S5 or S6 | 0.25d |

---

## Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| `ped_special_man_protestor` asset not created → 7-4 blocked on final visual | High | Low | Use `ped_special_man_thief` as placeholder in 7-4; real asset in a later sprint |
| nextRound() integration blast radius — citizen pipeline added as final step | Medium | Medium | Citizen state in its own `citizens` slice; atomic set (ADR-0002) |
| 25 ACs across Logic/Integration stories → underestimated test effort | Medium | Medium | ACs are extremely detailed in the GDD — test code essentially writes itself from them |
| `gone`/starvation RNG mocking complexity | Low | Low | ADR-0010 seam exists: mock pattern established in EffectHandler.test and ActionHandler.test |

---

## Dependencies on External Factors
- `ped_special_man_protestor` 3D asset not yet specced or created — 7-4 uses a placeholder.
- Citizen simulation reads effective relations from the modifier engine (6-1) — already shipped.
- Seeded RNG harness (ADR-0010) — already shipped; mock pattern established.

---

## Definition of Done for this Sprint
- [ ] All Must Have tasks (7-1, 7-2, 7-3) completed
- [ ] All Logic/Integration stories have passing unit/integration tests (BLOCKING)
- [ ] No inline `Math.random()` in CitizenHandler (CI grep gate — AC-15)
- [ ] Full suite green after 7-3 integration
- [ ] QA plan exists (`production/qa/qa-plan-sprint-7.md`)
- [ ] Smoke check passed (`/smoke-check sprint`)
- [ ] QA sign-off: APPROVED or APPROVED WITH CONDITIONS (`/team-qa sprint`)
- [ ] No S1 or S2 bugs; existing behaviour (relations, treasury, round resolution) preserved

> **PR-SPRINT gate skipped — lean review mode.**

> **Scope check:** Citizen Simulation is a net-new system added as a `citizens` slice of
> GameState. No existing epics define its scope boundary. The only cross-system write is
> the `nextRound()` integration point — contained to `RoundResolver.ts`.
