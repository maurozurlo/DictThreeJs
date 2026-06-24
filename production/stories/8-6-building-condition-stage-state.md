# Story 8-6: Add `conditionStage` to Game State

> **Epic**: Street View — Dynamic Assets
> **Status**: Backlog
> **Layer**: Foundation
> **Type**: Logic
> **Estimate**: 0.25 days
> **Manifest Version**: 2026-06-23
> **Last Updated**: 2026-06-23

## Context

**GDD**: `design/gdd/street-view.md §3.1`

Foundation story for the progressive building degradation system. Adds a single signed integer `conditionStage` to game state — the single source of truth for building tier display across all 5 building slots.

**Design source**: systems-designer 2026-06-23 (revised spec with single counter + asymmetric recovery).

`conditionStage` range: −5 (all buildings in poor variant) to +5 (all buildings in rich variant), 0 = all normal. The formula and wiring live in Story 8-7; this story only owns the type and initial value.

Story 8-7 (Handler logic) and 8-8 (scene wiring) both depend on this landing first.

---

## Acceptance Criteria

- [ ] **AC-1**: `conditionStage: number` is added to the game state type (wherever `gameManagement` or equivalent is typed — confirm the exact field location by reading `src/types/GameState.ts`)
- [ ] **AC-2**: `StateFactory` (or equivalent initial state builder) initialises `conditionStage` to `0`
- [ ] **AC-3**: `conditionStage` is included in save/load serialisation if the project persists game state (check existing save/load path — add it alongside other `gameManagement` fields)
- [ ] **AC-4**: No other game logic reads or writes `conditionStage` in this story — the field exists but is inert until Story 8-7 wires the Handler
- [ ] **AC-5**: `tsc --noEmit` passes with no new errors
- [ ] **AC-6**: `npx vitest run` passes (all existing tests green — no test changes expected in this story)

---

## Implementation Notes

`conditionStage` lives in `gameManagement` alongside `round`, `modifiers`, and similar progression state. It is not a budget field and not a relations field.

TypeScript `number` is sufficient — no branded type needed. The formula in Story 8-7 clamps all writes to [−5, +5] so out-of-range values cannot enter state through the normal code path.

---

## Test Evidence

- **Type**: Logic — the field itself is trivial; the meaningful tests live in Story 8-7 (formula) and 8-8 (integration)
- **Gate**: ADVISORY for this story alone — no new behaviour to test. Story 8-7 is the BLOCKING gate for the system as a whole.
