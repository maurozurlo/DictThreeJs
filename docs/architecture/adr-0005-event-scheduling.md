# ADR-0005: Event Scheduling System

## Status

Accepted

## Date

2026-06-10

## Last Verified

2026-06-10

## Decision Makers

Development team

## Summary

Three event types (daily events, periodic events, mini challenges) are resolved at round-start via `nextRound()`. This ADR documents their selection logic, mutual exclusion rule, tab-lock behaviour, and the data contracts each event type must satisfy.

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Web Platform (browser) |
| **Domain** | Core logic |
| **Knowledge Risk** | LOW |
| **References Consulted** | None |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | None |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0004 (RNG strategy — defines how random calls are made) |
| **Enables** | Stories 1-8, 1-9 (street view state mapping depends on game state being clean) |
| **Blocks** | None |
| **Ordering Note** | None |

## Context

### Problem Statement

Three event namespaces (`dailyEvent`, `periodicEvent`, `miniChallenge`) existed in the store with no ADR documenting their scheduling rules, mutual exclusion, or tab-lock semantics. The architecture review flagged this as gap TR-events-001.

### Current State

In `GameState.ts` `nextRound()`:
- **Daily event**: `getRandomDailyEvent()` — weighted random from `assets/dailyEvents.ts`, always fires.
- **Periodic event**: `PERIODIC_EVENTS.find(e => e.round === newRound)` — fixed round-to-event mapping. If found, mini challenge is suppressed for that round.
- **Mini challenge**: 40% roll (`rollChance(0.4)`) if no periodic event; random selection via `getRandomFromList(MINI_CHALLENGES)`.

Tab lock (`tabs.tabsLocked`) is set when a periodic event or mini challenge is active and requires a decision before the player can advance.

### Constraints

- Events must be decided before advancing to the next round
- Periodic events are story-driven — fixed to specific rounds — and take priority over mini challenges
- Mini challenge pool should not repeat until exhausted (tracked via `Set`)

### Requirements

- Daily event always resolves at round start (cosmetic, no decision gate)
- Periodic event fires on its specified round; suppresses mini challenge
- Mini challenge fires with 40% probability on non-periodic rounds
- Tab lock applied for pending event decisions; released on resolution
- Event state is cleared on round advance

## Decision

Maintain the current three-tier event system with explicit mutual exclusion at the periodic/mini-challenge level. All scheduling logic lives in `nextRound()` in `GameState.ts`. Event assets are plain TypeScript arrays in `assets/`.

### Architecture

```
nextRound() in GameState.ts
│
├── 1. Resolve financials
├── 2. Check overthrow condition
├── ...
├── 9. Check periodic event (fixed-round lookup)
│       ├── found  → set periodicEvent.current, skip mini challenge
│       └── not found → step 10
│
├── 10. Roll mini challenge (40%)
│       ├── hit   → set miniChallenge.current
│       └── miss  → no event
│
└── Daily event always set (cosmetic, no gate)

Tab lock active while periodicEvent.current != null && !decided
                   OR miniChallenge.current != null && !decided
```

### Key Interfaces

```typescript
// assets/periodicEvents.ts — PeriodicEvent must have:
interface PeriodicEvent {
    id: string;
    round: number;          // which round this fires on (1-indexed, 1–10)
    options: PeriodicEventOption[];
}

// assets/miniChallenges.ts — MiniChallenge must have:
interface MiniChallenge {
    id: string;
    acceptEffect: EventEffect;
    rejectEffect: EventEffect;
    riskEffect?: EventEffect;   // optional; fires on riskTriggered
}

// EventEffect shape:
interface EventEffect {
    treasury?: number;
    relations?: Partial<Record<Power, number>>;
    charisma?: number;
}
```

### Implementation Guidelines

1. **Mutual exclusion** is enforced in `nextRound()`: the periodic event check runs first; if it fires, the mini challenge block is skipped entirely.
2. **Tab lock**: `tabs.tabsLocked = true` is set atomically with `periodicEvent.current` or `miniChallenge.current`. It is cleared when `resolve()` is called on the event.
3. **Mini challenge pool exhaustion**: when all challenges have been used (`usedMiniChallenges.size >= MINI_CHALLENGES.length`), reset the used set before drawing.
4. **No carry-forward**: event state (`current`, `decided`, `resultKey`) resets to null on every `nextRound()` call, whether or not the player resolved the previous round's event.
5. **Daily events** are cosmetic (Log display only) — they do not gate any action and do not affect tab lock.
6. All random draws use `Utils/Math.ts` functions per ADR-0004 (`rollChance`, `getRandomFromList`).

## Alternatives Considered

### Alternative 1: Priority queue / event bus

- **Description**: Central event bus with typed priorities; each event type registers as a producer.
- **Pros**: Clean separation; easier to add future event types.
- **Cons**: Over-engineered for 3 fixed event types with simple precedence.
- **Rejection Reason**: Current game scale doesn't justify the abstraction.

### Alternative 2: Per-round event manifest (precomputed)

- **Description**: At game start, generate a full 10-round event schedule and store it.
- **Pros**: Fully predictable; easy to display "upcoming events" UI.
- **Cons**: Removes dynamism from mini challenges; requires re-generation on save load.
- **Rejection Reason**: Mini challenge randomness is a design feature, not a bug.

## Consequences

### Positive

- Event logic is concentrated in one function (`nextRound`) — easy to audit.
- Periodic events are data-driven; adding a new one requires only a new entry in `periodicEvents.ts`.

### Negative

- `nextRound()` grows in complexity as event types are added.
- Tab lock is implicit state — a bug in `resolve()` could leave tabs permanently locked.

### Neutral

- Daily events are purely cosmetic; their selection has no gameplay consequence.

## Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Tab lock not released after event resolution | Low | High | Unit test for resolve() clearing tabsLocked |
| Mini challenge pool runs dry | Low | Medium | Pool reset logic when `usedMiniChallenges.size >= MINI_CHALLENGES.length` |

## Performance Implications

No meaningful impact — event selection is O(n) array scan at round boundary, not per-frame.

## Migration Plan

No migration needed — documents existing behaviour. The only code change is the `rollChance` / `getRandomFromList` substitution in `nextRound()` per ADR-0004.

## Validation Criteria

- [ ] Periodic event fires on correct round in integration test
- [ ] Mini challenge does not fire on the same round as a periodic event
- [ ] Tab lock is set when event is pending and cleared on resolution
- [ ] Event state resets to null at start of each new round

## GDD Requirements Addressed

| GDD Document | System | Requirement | How This ADR Satisfies It |
|---|---|---|---|
| `design/gdd/game-concept.md` | Events | Event scheduling: daily random, periodic fixed-round, mini 40% — TR-events-001 | Documents the three-tier scheduling system, mutual exclusion rules, and tab-lock semantics |

## Related

- ADR-0004 — RNG strategy used for random event selection
- `src/Stores/GameState.ts` — `nextRound()` is the implementation site
- `src/Stores/DailyEventHandler.ts` — daily event selection
