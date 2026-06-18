# Story 7-1: CitizenHandler P1 — Generation + Immutable Identity

> **Epic**: Citizen Simulation
> **Status**: Complete
> **Layer**: Foundation
> **Type**: Logic
> **Estimate**: 1.0 days
> **Manifest Version**: 2026-06-13
> **Last Updated**: 2026-06-18

## Context

**GDD**: `design/gdd/citizen-simulation.md`
**Requirement**: `TR-citizen-001`
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: [ADR-0010: Seeded RNG & Commit-on-Roll](docs/architecture/adr-0010-seeded-rng-commit-on-roll.md)
**ADR Decision Summary**: All random draws use the mulberry32 PRNG cursor from `Utils/Math.ts` (`rollFloat`, `rollChance`, `getRandom*`); the cursor is seeded once at game start in `buildStartState`, persisted in the save, and restored in `buildLoadedState`. `Math.random()` is forbidden in game-logic paths.

**Secondary ADR**: [ADR-0002: State Management Pattern](docs/architecture/adr-0002-state-management-pattern.md) — `buildCitizenRoster` is a pure Handler function; no store imports.

**Engine**: React 19 + TypeScript | **Risk**: LOW
**Engine Notes**: `rollFloat()` from `src/Utils/Math.ts` draws from the seeded cursor; mulberry32 is standard bit-twiddling with no post-cutoff API risk.

**Control Manifest Rules (Foundation layer)**:
- Required: All `Math.random()` calls go through named utility functions in `src/Utils/Math.ts`. Stores and components never call `Math.random()` inline.
- Required: Handler files are pure functions — plain data in, typed result out — no store imports.
- Forbidden: `Math.random()` inline in stores, Handlers, or components.
- Forbidden: Handler files importing from `../../Stores/GameState`.

---

## Acceptance Criteria

*From GDD `design/gdd/citizen-simulation.md` §3.1 and edge case 11, scoped to this story:*

- [ ] **AC-1a**: `buildCitizenRoster(seed)` returns exactly **25 citizens** with a fixed split: **11 people / 7 army / 7 business**. Count by faction; assert exact values.
- [ ] **AC-1b**: `seedRng(S)` then calling `buildCitizenRoster` yields the **identical 25 citizens** (name/skin/faction/bodySeed) for the same seed `S`. A different seed yields a different roster.
- [ ] **AC-2**: A citizen's `name`, `skin`, and `faction` are **immutable** — identical after any number of rounds, regardless of adversarial budget/relation inputs. These fields are never mutated post-generation.
- [ ] `bodySeed` per citizen is drawn from `rollFloat()` (seeded cursor), is in `[0, 1)`, and is stable across save/load reconstruction.
- [ ] **No inline `Math.random()`** in `buildCitizenRoster` — all random draws use named `Utils/Math.ts` functions.
- [ ] TypeScript: no `any` types in `Citizen` or `CitizenState` types; `tsc --noEmit` clean.
- [ ] `StateFactory.buildStartState` seeds the RNG and calls `buildCitizenRoster` before any other draw, storing citizens in the `citizens` slice.
- [ ] `StateFactory.buildLoadedState` restores citizens from the save payload; identity fields are never re-derived on load (persisted as-is).

---

## Implementation Notes

*Derived from ADR-0010 and citizen-simulation.md §3.1:*

**New types** (add to `src/types/GameState.ts` or a new `src/types/Citizen.ts`):
```typescript
export interface Citizen {
  id: number;           // stable index 0..24
  name: string;         // first + last, never changes
  skin: 0 | 1 | 2 | 3 | 4;
  faction: 'army' | 'business' | 'people';
  bodySeed: number;     // [0,1) from rollFloat() at generation — body-type input
}

export interface CitizenState {
  alive: boolean;
  employed: boolean;
  happiness: number;       // 0–10 (clamped)
  role: 'content' | 'neutral' | 'thief' | 'protestor' | 'gone';
  lastFactionRelation: number;  // carried forward for volatility
}
```

**`buildCitizenRoster(seed?: number): Citizen[]`** — pure function in `src/Stores/CitizenHandler.ts`:
- The 25 citizens are generated with the seeded cursor: `rollFloat()` for bodySeed; use a name table + `getRandom*` for name/skin draws.
- Faction split is **fixed**: citizens 0–10 → people, 11–17 → army, 18–24 → business (or equivalent fixed-order assignment — the split must be exactly 11/7/7 regardless of RNG).
- `bodySeed` is drawn from `rollFloat()` (draws from the seeded cursor — NOT `Math.random()`).

**StateFactory integration** (`src/Factories/StateFactory.ts`):
- In `buildStartState`: call `buildCitizenRoster()` after `seedRng(freshEntropy)` so citizens are part of the seeded stream. Store in `gameManagement.citizens` (or a top-level `citizens` slice — pick whichever keeps GameState.ts under 1500 lines).
- `lastFactionRelation` for each citizen is initialized to the round-1 effective relation of their faction (so volatility is 0 on round 1 — edge case 11).
- In `buildLoadedState`: restore `citizens` and `citizenStates` from the save payload; add `?? []` guard for pre-citizen saves.
- In `SaveLoad.buildSavePayload`: include `citizens` and `citizenStates` in the serialized output.

**GameState slice**: Add `citizens: Citizen[]` and `citizenStates: CitizenState[]` parallel arrays. All citizen state must be JSON-serializable (no class instances).

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 7-2: Employment, happiness, body-type computation per round
- Story 7-3: Role fork, death, feedback, `nextRound()` wiring
- Rendering or UI — citizens are data only in this story

---

## QA Test Cases

*Imported from `production/qa/qa-plan-sprint-7-2026-06-17.md`. Implement against these — do not invent new cases.*

- **AC-1a**: 25 citizens with exact 11/7/7 split
  - Given: a fresh game start
  - When: `buildCitizenRoster(seed)` is called
  - Then: `citizens.length === 25`; `filter(c => c.faction === 'people').length === 11`; army = 7; business = 7
  - Edge cases: assert all three counts exactly, not just total

- **AC-1b**: Seed determinism
  - Given: `seedRng(1)` called before generation
  - When: `buildCitizenRoster()` is called twice with the same cursor position
  - Then: all 25 name/skin/faction/bodySeed entries are byte-identical
  - Edge cases: `seedRng(2)` produces a different roster (probabilistically); use two known-diverging seeds

- **AC-2**: Immutable identity under adversarial input
  - Given: a roster of 25 citizens
  - When: `computeHappiness` / round-resolution is called with `security=0, rel=-10, charisma=-10, education=0` for N rounds
  - Then: every citizen's `name`, `skin`, and `faction` are identical to their initial values
  - Edge cases: assert all 25 citizens, not a sample

- **bodySeed range and source**:
  - Given: `buildCitizenRoster()` is called
  - When: each citizen's `bodySeed` is inspected
  - Then: all 25 `bodySeed` values are in `[0, 1)` — i.e., `>= 0` and `< 1`
  - Edge cases: verify `rollFloat` from `Utils/Math.ts` is called (not `Math.random()`)

- **Save/load determinism** (Edge Case 11):
  - Given: `seedRng(S)`, generate roster, save cursor via `getRngState()`
  - When: `setRngState(saved)` is called and generation is repeated
  - Then: identical roster — `bodySeed` draws don't exhaust extra entropy
  - Edge cases: seeds 0 and `Number.MAX_SAFE_INTEGER` both produce valid 25-citizen rosters

**Estimated test count**: ~8 unit tests

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/citizens/citizen_generation.test.ts` — must exist and all tests must pass
**Status**: [x] `tests/unit/citizens/citizen_generation.test.ts` — 10/10 passing

---

## Dependencies

- Depends on: ADR-0010 (Accepted and shipped — `rollFloat`, `seedRng`, `getRngState`, `setRngState` available in `src/Utils/Math.ts`)
- Unlocks: Story 7-2 (employment/happiness reads from citizen identity)

---

## Completion Notes
**Completed**: 2026-06-18
**Criteria**: 7/8 passing (AC-2 identity-immutability deferred to Story 7-2 — computeHappiness not yet implemented)
**Deviations** (advisory):
- `Citizen.faction` uses `Power` (`'military'`) instead of spec's `'army'` — approved to align with existing codebase type, avoids translation seam in stories 7-2/7-3
- `buildCitizenRoster` signature: `(initialRelations): { citizens, citizenStates }` instead of spec's `(seed?): Citizen[]` — returns both arrays together to co-locate CitizenState initialization; approved during dev
- `SaveLoad.buildSavePayload` not modified — `stripFunctions(state)` auto-serializes plain-object citizen arrays; change was not needed
**Test Evidence**: `tests/unit/citizens/citizen_generation.test.ts` — 10/10 passing
**Code Review**: Complete — APPROVED WITH SUGGESTIONS (spy ordering + FIRST_NAMES comment fixed before close)
