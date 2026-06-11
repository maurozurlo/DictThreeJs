# ADR-0006: Round Timer & Game Loop

## Status

Accepted

## Date

2026-06-10

## Last Verified

2026-06-10

## Decision Makers

Development team

## Summary

Each round has a real-time countdown (default 5 minutes) measured by wall-clock delta (`Date.now()`). The timer pauses when the player opens the Menu tab and resumes when they leave it. On expiry, `expireTimer()` applies penalties and triggers round resolution. This ADR documents the timer's architecture, pause semantics, and the game loop advancement sequence.

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Web Platform (browser) |
| **Domain** | Core logic / Timing |
| **Knowledge Risk** | LOW — `Date.now()` and `setInterval` are stable web APIs |
| **References Consulted** | None |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | None |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0002 (State Management — timer state lives in `gameManagement` slice) |
| **Enables** | None directly |
| **Blocks** | None |
| **Ordering Note** | None |

## Context

### Problem Statement

ADR-0001 mentions a `Date.now()` timer as an implementation consequence, but no ADR governs its design: how pause/resume works, what happens on expiry, whether the timer should accelerate in later rounds, or how UI and store stay in sync. The architecture review flagged this as gap TR-timer-001.

### Current State

`useRoundTimer.ts` — a React hook that:
1. Reads `timerStartedAt` (epoch ms) and `timerPausedAt` (epoch ms or null) from the store.
2. Runs a 1-second `setInterval` that computes `elapsed = Date.now() - timerStartedAt`.
3. Maps `elapsed / TIME_LENGTH_MS` (0→1) to a display time of 9:00 AM → 5:00 PM.
4. Calls `expireTimer()` once when `progress >= 1`.

Pause/resume lives in `setActiveTab()`:
- Switching **to** Menu: records `timerPausedAt = now`.
- Switching **away** from Menu: advances `timerStartedAt` by the paused duration, clears `timerPausedAt`.

`GAMESTATE.ROUNDS.TIME_LENGTH_MS = 5 * 60 * 1000` (5 minutes).

### Constraints

- Timer must survive React re-renders without drift — wall-clock delta approach handles this.
- Timer must not tick during pause — achieved by early-returning from the `useEffect` when `timerPausedAt !== null`.
- Browser tab backgrounding (`visibilitychange`) is not handled — acceptable for current scope.

### Requirements

- Timer measures real elapsed wall-clock time, not React render ticks
- Pause when Menu tab is active; resume on leaving Menu
- On expiry: apply unused-action penalties, advance round, reset timer state
- `TIME_LENGTH_MS` is configurable in `Constants/GameState.ts`
- Display maps timer progress (0→1) to an in-world time (9:00 AM → 5:00 PM)

## Decision

Retain the `Date.now()` wall-clock approach with epoch-adjustment pause semantics. Timer logic stays split between `useRoundTimer.ts` (display + expiry trigger) and `setActiveTab()` (pause/resume). The `expireTimer()` store action applies penalties and delegates to `nextRound()`.

### Architecture

```
useRoundTimer (React hook)
│  setInterval 1s
│  elapsed = Date.now() - timerStartedAt
│  progress = elapsed / TIME_LENGTH_MS
│  setDisplayTime(progressToDisplayTime(progress))
│  if progress >= 1 → expireTimer()
│
Store: gameManagement
├── timerStartedAt: number | null   (epoch ms when round started / last resumed)
├── timerPausedAt:  number | null   (epoch ms when paused, null = running)
├── expireTimer()   → applies penalties + calls nextRound()
└── startRound()    → sets timerStartedAt = Date.now(), timerPausedAt = null

setActiveTab() in GameState.ts
├── → Menu:  timerPausedAt = now
└── ← Menu:  timerStartedAt += (now - timerPausedAt); timerPausedAt = null
```

### Key Interfaces

```typescript
// gameManagement slice (relevant timer fields)
interface GameManagement {
    timerStartedAt: number | null;
    timerPausedAt:  number | null;
    expireTimer:    () => void;
}

// TIME_LENGTH_MS in Constants/GameState.ts
ROUNDS: {
    TIME_LENGTH_MS: number;  // default: 5 * 60 * 1000
}
```

### Implementation Guidelines

1. **Never read `Date.now()` in a render path** — only inside `useEffect` / `setInterval` callbacks and store actions.
2. **Pause semantics**: the hook's `useEffect` returns early when `timerPausedAt !== null`, killing the interval. Resume is triggered by the `timerPausedAt` dependency changing to null.
3. **Expiry guard**: `expiredRef.current` in `useRoundTimer` prevents `expireTimer()` firing twice if the interval fires again before cleanup.
4. **Tab-backgrounding**: browser tab backgrounding (`document.hidden`) is out of scope. If added later, use `visibilitychange` to pause/resume the same way the Menu tab does.
5. **Round acceleration** (planned, not yet implemented): to accelerate in later rounds, vary `TIME_LENGTH_MS` based on `currentRound` before passing to the hook. Do not modify the hook's internals — inject a per-round duration instead.
6. **Display time** is cosmetic only (`progressToDisplayTime` in the hook). The store never stores display time.

## Alternatives Considered

### Alternative 1: `performance.now()` instead of `Date.now()`

- **Description**: Use the monotonic high-resolution timer.
- **Pros**: Immune to system clock adjustments.
- **Cons**: `performance.now()` returns ms since page load — cannot be persisted across page reloads. `Date.now()` survives save/load (timestamps are absolute epoch).
- **Rejection Reason**: Save/load compatibility requires epoch timestamps.

### Alternative 2: Frame-based timer (requestAnimationFrame)

- **Description**: Accumulate delta time each frame.
- **Pros**: Pauses automatically when tab is hidden.
- **Cons**: Ties timer precision to frame rate; adds Three.js frame loop dependency for non-3D timing.
- **Rejection Reason**: The timer is a game-logic concern, not a render concern.

## Consequences

### Positive

- Wall-clock approach is drift-free across React re-renders.
- Pause semantics are pure store state — no side effects outside the hook.
- Timer survives save/load (epoch ms can be serialised).

### Negative

- Browser tab backgrounding throttles `setInterval` to ~1s, making expiry detection imprecise by up to 1 second after the tab is refocused.
- Pause is only triggered by Menu tab navigation — external pauses (modal, event dialog) require manual wiring.

### Neutral

- Display time (9 AM–5 PM) is a presentation layer detail; the store has no concept of "game time".

## Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| `expireTimer()` fires twice (double penalty) | Low | High | `expiredRef` guard in `useRoundTimer` |
| System clock adjustment mid-round | Very Low | Low | Acceptable for a casual browser game |
| Tab backgrounding delays expiry | Medium | Low | No mitigation — acceptable precision |

## Performance Implications

1-second `setInterval` — negligible. No per-frame cost.

## Migration Plan

No migration needed — documents existing behaviour. Future round-acceleration feature: pass computed `durationMs` to the hook rather than reading `GAMESTATE.ROUNDS.TIME_LENGTH_MS` directly.

## Validation Criteria

- [ ] Timer starts at 9:00 AM and reaches 5:00 PM in exactly `TIME_LENGTH_MS` ms
- [ ] Pausing (open Menu) freezes the display time; resuming (close Menu) continues from the same point
- [ ] `expireTimer()` fires exactly once per round expiry, even if the interval fires again before cleanup
- [ ] `TIME_LENGTH_MS` change in constants propagates correctly to the hook without code changes

## GDD Requirements Addressed

| GDD Document | System | Requirement | How This ADR Satisfies It |
|---|---|---|---|
| `design/gdd/game-concept.md` | Timer | Real-time per-round countdown + expiry penalties — TR-timer-001 | Documents wall-clock timer, pause/resume semantics, expiry handling, and display mapping |

## Related

- ADR-0002 — `gameManagement` slice owns timer state
- `src/Hooks/useRoundTimer.ts` — timer hook implementation
- `src/Stores/GameState.ts` — `setActiveTab()` pause/resume, `expireTimer()`, `nextRound()`
