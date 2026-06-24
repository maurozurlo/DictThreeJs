# Story 8-7: `advanceConditionStage` Handler + Round Wiring

> **Epic**: Street View — Dynamic Assets
> **Status**: Backlog
> **Layer**: Feature
> **Type**: Logic
> **Estimate**: 1.0 days
> **Manifest Version**: 2026-06-23
> **Last Updated**: 2026-06-23

## Context

**GDD**: `design/gdd/street-view.md §3.1`
**Dependency**: Story 8-6 must be complete (`conditionStage` in game state).

Implements the `advanceConditionStage` pure function and wires it into `RoundResolver.ts` so the building condition counter advances correctly each round. Also creates the constants file for all degradation tuning knobs.

**Design source**: systems-designer 2026-06-23.

### Formula: `advanceConditionStage`

```
delta:
  infrastructure ≤ BUILDING_POOR_THRESHOLD                                     → −BUILDING_DEGRADE_RATE
  infrastructure ≥ BUILDING_RICH_THRESHOLD AND conditionStage < STAGE_MAX      → +BUILDING_RECOVER_RATE_RICH
  POOR_THRESHOLD < infrastructure < RICH_THRESHOLD AND conditionStage < 0      → +BUILDING_RECOVER_RATE_POOR_REPAIR
  POOR_THRESHOLD < infrastructure < RICH_THRESHOLD AND conditionStage > 0      → −BUILDING_RECOVER_RATE_RICH_DECAY
  otherwise                                                                     → 0

conditionStage_next = clamp(conditionStage + delta, BUILDING_STAGE_MIN, BUILDING_STAGE_MAX)
```

### Default tuning knob values

| Constant | Value | Meaning |
|----------|-------|---------|
| `BUILDING_POOR_THRESHOLD` | 3 | Infra ≤ 3 triggers degradation |
| `BUILDING_RICH_THRESHOLD` | 8 | Infra ≥ 8 triggers rich recovery |
| `BUILDING_DEGRADE_RATE` | 2 | Stages lost per Poor-tier round (fast neglect) |
| `BUILDING_RECOVER_RATE_RICH` | 1 | Stages gained per Rich-tier round |
| `BUILDING_RECOVER_RATE_POOR_REPAIR` | 1 | Stages gained per Normal-tier round when stage < 0 |
| `BUILDING_RECOVER_RATE_RICH_DECAY` | 1 | Stages lost per Normal-tier round when stage > 0 |
| `BUILDING_STAGE_MIN` | −5 | Floor (all buildings poor) |
| `BUILDING_STAGE_MAX` | 5 | Ceiling (all buildings rich) |

---

## Acceptance Criteria

### Constants file

- [ ] **AC-1**: `src/Constants/BuildingDegradation.ts` exists and exports all eight constants above using `SCREAMING_SNAKE_CASE`
- [ ] **AC-2**: No hardcoded numbers appear in the Handler or test files — all magic numbers reference these constants

### Pure function

- [ ] **AC-3**: `advanceConditionStage(conditionStage: number, infrastructure: number): number` exists as a named export in `src/Utils/BuildingDegradation.ts` (pure — no store imports, no side effects)
- [ ] **AC-4**: Output is always clamped to `[BUILDING_STAGE_MIN, BUILDING_STAGE_MAX]` — verified by unit tests at boundary inputs
- [ ] **AC-5**: All four conditional branches produce the correct delta — verified by unit tests (see table below)

### Unit tests (BLOCKING gate)

File: `tests/unit/street/building_degradation.test.ts`

| Test scenario | Input `conditionStage` | Input `infrastructure` | Expected output |
|---|---|---|---|
| Poor tier, mid-stage | −2 | 2 | −4 |
| Poor tier, at floor | −5 | 1 | −5 (clamped) |
| Rich tier, recovering poor | −3 | 9 | −2 |
| Rich tier, building rich | 0 | 9 | 1 |
| Rich tier, at ceiling | 5 | 10 | 5 (clamped) |
| Normal tier, negative stage (repairing) | −2 | 5 | −1 |
| Normal tier, positive stage (luxury decay) | 3 | 6 | 2 |
| Normal tier, neutral | 0 | 5 | 0 |
| Poor→Normal boundary (infra = 4) | −1 | 4 | 0 (repair) |
| Rich→Normal boundary (infra = 7) | 2 | 7 | 1 (decay) |

- [ ] **AC-6**: All 10 test cases pass

### `RoundResolution` wiring

- [ ] **AC-7**: `RoundResolution` type (wherever it is declared) gains a `newConditionStage: number` field
- [ ] **AC-8**: `resolveRound()` (or equivalent) calls `advanceConditionStage(currentConditionStage, effectiveInfrastructure)` and includes the result in its return value
- [ ] **AC-9**: `nextRound()` in `GameState.ts` sets `conditionStage` from `resolution.newConditionStage` atomically inside the existing `set((s) => ({ ... }))` call (ADR-0002 — single atomic set, no second set() call)
- [ ] **AC-10**: The `effectiveInfrastructure` value passed to `advanceConditionStage` is the same value used for all other infrastructure-dependent calculations in `resolveRound()` — not the raw slider, in case modifiers adjust it

### Round log event

- [ ] **AC-11**: When `newConditionStage` crosses below 0 for the first time in a run (i.e., `currentConditionStage === 0` and `newConditionStage === −1`), a round log entry is appended: key `"log.buildingDegradationStart"` (English: "District maintenance is lapsing.")
- [ ] **AC-12**: When `newConditionStage` reaches −3 (3 buildings in poor state), a round log entry is appended: key `"log.buildingDegradationAdvanced"` (English: "Several districts are showing serious disrepair.")
- [ ] **AC-13**: When `newConditionStage` reaches −5 (full degradation), a round log entry is appended: key `"log.buildingDegradationMax"` (English: "The city has fallen into ruin.")
- [ ] **AC-14**: The three log keys are added to `public/locales/en/menu.json` and `public/locales/es/menu.json` (Spanish copy: "El mantenimiento del distrito está fallando.", "Varios distritos muestran grave deterioro.", "La ciudad ha caído en ruinas.")
- [ ] **AC-15**: Log events only fire on crossing the threshold downward — not on every round that conditionStage is already at or below that level (use `currentConditionStage > threshold && newConditionStage <= threshold` guard)

### Build

- [ ] **AC-16**: `tsc --noEmit` passes
- [ ] **AC-17**: `npx vitest run` passes with all new tests green and no existing tests broken

---

## Implementation Notes

`advanceConditionStage` is a pure function — it takes two numbers and returns a number. It should not import from the store. Test it without mocking anything.

The `effectiveInfrastructure` passed in is whatever value `resolveRound()` already uses for infrastructure effects — check `RoundResolver.ts` for how other infrastructure-dependent computations obtain their value. Do not duplicate the effective-value computation.

The round log event system already exists (ADR-0011). Follow the same pattern used by other log-emitting code in `RoundResolver.ts`.

---

## Test Evidence

- **Type**: Logic — automated unit tests required (BLOCKING gate)
- **Location**: `tests/unit/street/building_degradation.test.ts`
