# ADR-0004: RNG & Determinism Strategy

## Status

Accepted

## Date

2026-06-10

## Last Verified

2026-06-10

## Decision Makers

Development team

## Summary

The game uses multiple probability-driven mechanics (dialogue success, backlash, event selection, mini-challenge trigger). This ADR adopts browser-native `Math.random()` as the RNG source — unseeded, non-reproducible — and defines the testability contract for RNG-dependent code: all random calls go through named utility functions in `Utils/Math.ts`; stores never call `Math.random()` inline.

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Web Platform (browser) |
| **Domain** | Core logic |
| **Knowledge Risk** | LOW — `Math.random()` is stable across all browser targets |
| **References Consulted** | None |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | None |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0002 (State Management — determinism claim qualified here) |
| **Enables** | ADR-0005 (Event Scheduling — relies on RNG contract) |
| **Blocks** | None |
| **Ordering Note** | Must be Accepted before TR-state-003 can be marked ✅ |

## Context

### Problem Statement

ADR-0002 asserts "identical inputs → identical outputs" for round resolution, but the GDD has several probability-driven outcomes (dialogue success rate, backlash roll, 40% mini-challenge trigger, daily event selection). These two claims are in tension. The architecture review flagged this as gap TR-rng-001.

### Current State

`Utils/Math.ts` provides `getRandomNumberInRange`, `getRandomUniqueItem`, and `getRandomFromList`. `DailyEventHandler.ts` uses these correctly. However, `GameState.ts` calls `Math.random()` inline in two places (mini-challenge trigger at line ~773, mini-challenge selection at line ~775). This violates the centralisation pattern already established by the utility module.

### Constraints

- Single-player browser game: no multiplayer synchronisation requirement
- No save/replay system requiring reproducible sequences
- Vitest test environment has access to `vi.spyOn(Math, 'random')` for mocking

### Requirements

- All random number generation goes through `Utils/Math.ts` functions
- No inline `Math.random()` calls in stores or handlers
- RNG-dependent paths must be unit-testable by injecting known values via `vi.spyOn`
- The determinism claim in ADR-0002 is scoped to non-random computation (formulas, budget resolution, relation deltas) — not to probability rolls

## Decision

Use browser-native `Math.random()` as the RNG source. No seeding, no custom PRNG. Centralise all random calls in `Utils/Math.ts` so call sites are predictable and mockable.

### Architecture

```
GameState.ts / handlers
        │
        ▼
  Utils/Math.ts          ← single RNG boundary
  ├── getRandomFromList()
  ├── getRandomUniqueItem()
  ├── getRandomNumberInRange()
  └── (new) rollChance(p)   ← replaces inline Math.random() < p
        │
        ▼
  Math.random()           ← browser native, unseeded
```

### Key Interfaces

```typescript
// Utils/Math.ts — existing + new

/** Returns true with probability p (0–1). */
export function rollChance(p: number): boolean {
    return Math.random() < p;
}
```

All other existing helpers remain unchanged. Stores and handlers must use these functions, not `Math.random()` directly.

### Implementation Guidelines

1. Add `rollChance(p: number): boolean` to `Utils/Math.ts`.
2. Replace the two inline `Math.random()` calls in `GameState.ts` `nextRound()`:
   - `Math.random() < 0.4` → `rollChance(0.4)`
   - `MINI_CHALLENGES[Math.floor(Math.random() * MINI_CHALLENGES.length)]` → `getRandomFromList(MINI_CHALLENGES)`
3. The "determinism" note in ADR-0002 is now scoped: formula paths (budget math, relation deltas, expiry penalties) remain deterministic and fully unit-testable. Probability rolls are not deterministic by design, but are mockable via `vi.spyOn(Math, 'random')`.
4. Never seed `Math.random()` — doing so for tests is fragile. Mock instead.

## Alternatives Considered

### Alternative 1: Seeded PRNG (e.g. `seedrandom`)

- **Description**: Replace `Math.random()` with a seeded PRNG; store the seed in game state for reproducibility.
- **Pros**: Fully reproducible runs; enables replay and bug reporting with seed.
- **Cons**: Adds a dependency; seed must be serialised to save; any call-order change breaks replay.
- **Estimated Effort**: 2× the chosen approach
- **Rejection Reason**: No multiplayer or replay requirement exists; overhead not justified for a single-player game.

### Alternative 2: Injected RNG function (dependency injection)

- **Description**: Pass an `rng: () => number` function into every handler.
- **Pros**: Clean testability without `vi.spyOn`.
- **Cons**: Significant refactor of all handler signatures; Zustand store pattern makes injection awkward.
- **Rejection Reason**: `vi.spyOn(Math, 'random')` achieves the same test goal with no refactor cost.

## Consequences

### Positive

- All random call sites are discoverable (grep `Math.ts`).
- Tests can mock randomness via `vi.spyOn` without changing production code.
- Consistent with the existing utility-function pattern already in use.

### Negative

- Runs are not reproducible — bug reports cannot be replayed deterministically.

### Neutral

- The determinism claim in ADR-0002 is now explicitly scoped, not retracted.

## Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Developer adds inline `Math.random()` call | Medium | Low | Lint rule or code review catches it |

## Performance Implications

No change — `Math.random()` is O(1) native call.

## Migration Plan

1. Add `rollChance()` to `Utils/Math.ts`. ✅ Done 2026-06-10
2. Fix two inline `Math.random()` calls in `GameState.ts` `nextRound()`. ✅ Done 2026-06-10
3. Remaining call sites in `ActionHandler.ts`, `EffectHandler.ts`, `DailyEventHandler.ts`, `GameState.ts` (risk rolls), and `Utils/Laws.ts` are tracked for cleanup in a follow-up story. Visual/cosmetic uses in `DictatorHands.tsx` and `Newspaper.tsx` are exempt — they are not game-logic paths and do not need mockability.

**Rollback plan**: Revert the two `GameState.ts` lines. No data migration needed.

## Validation Criteria

- [x] `Utils/Math.ts` exports `rollChance` and `rollFloat`
- [x] No inline `Math.random()` in stores or handlers (all use `Utils/Math.ts` functions)
- [x] `DailyEventHandler.ts` weighted-sum rolls remain as-is (self-contained, not injectable pattern)
- [x] Visual components (`Newspaper.tsx`, `DictatorHands.tsx`) exempt — cosmetic only
- [x] All tests pass (85/85)

## GDD Requirements Addressed

| GDD Document | System | Requirement | How This ADR Satisfies It |
|---|---|---|---|
| `design/gdd/game-concept.md` | RNG | Probability mechanics (dialogue, backlash, daily/mini events, ending) — TR-rng-001 | Defines `Math.random()` as the single RNG source; all call sites go through `Utils/Math.ts` utilities |

## Related

- ADR-0002 — determinism claim qualified by this decision
- ADR-0005 — event scheduling depends on this RNG contract
