# ADR-0007: End-of-Round Effect Timing

## Status

Proposed — Intentionally deferred to Sprint 5 planning.
The problem and requirements are fully documented. The decision (which approach among
Options A/B/C) will be made before Sprint 6 begins, when Tier 2 weird deals are scoped.
Stories referencing Tier 2 weird deals are blocked on this ADR reaching Accepted.
No current sprint stories depend on this ADR.

> **Scope narrowed by [ADR-0008](adr-0008-timed-modifier-engine.md) (Accepted 2026-06-15).**
> Delayed/windowed effects expressible as *stat contributions* (charisma, relations,
> per-round income/expense) are now handled by the Timed Modifier Engine. This ADR is
> therefore reduced to **non-stat one-shot delayed consequences only** — e.g. delayed
> one-shot base relation/treasury hits and cosmetic triggers (education dumbify text,
> infrastructure textures). Revisit and finalise its scope alongside ADR-0008 Phase 3.

## Date

2026-06-13

## Last Verified

2026-06-13

## Decision Makers

Mauro Zurlo (owner)

## Summary

Game effects (budget changes, deal consequences, law outcomes) currently apply immediately on player action, causing jarring synchronous state jumps (e.g. education slider → text dumbifies instantly). This ADR decides to queue all gameplay effects and resolve them at the start of `nextRound()`, enabling both better visual pacing and the delayed-consequence mechanic required by Tier 2 weird deals and future infrastructure cosmetic changes.

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Web Platform (browser) |
| **Domain** | Core logic / State management |
| **Knowledge Risk** | LOW — no engine-specific APIs involved |
| **References Consulted** | None |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | None |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0002 (state management pattern), ADR-0006 (round timer / game loop) |
| **Enables** | Tier 2 weird deals (`design/gdd/weird-deals.md`), infrastructure cosmetic changes (Sprint 5+) |
| **Blocks** | Sprint 6 Tier 2 weird deal stories; any story requiring delayed consequences |
| **Ordering Note** | Must be Accepted before Sprint 6 planning begins |

## Context

### Problem Statement

Effects from player actions currently apply synchronously at the moment of the action. This creates two problems:

1. **Visual jarring**: cosmetic changes (text dumbification from education budget, future city texture changes from infrastructure slider) fire instantly rather than at a natural narrative beat.
2. **No delayed consequences**: the Tier 2 weird deals (Console Computing, Emu Export, Seawater Agriculture, Iceberg Import, Friendship Tunnel, Bees) require effects that fire N rounds after the player's acceptance decision. The current synchronous model cannot express this.

### Current State

All `handleDecision`, `applyBudgetEffects`, and similar functions write directly to the Zustand store at call time. There is no queue or scheduling concept — effects are either immediate or recur every round via `activeRecurringEffects`.

### Constraints

- Must not break the existing recurring effect system (already end-of-round via `nextRound`)
- Must preserve the existing immediate feedback for relation and treasury changes (players need to see the cost of their action right away)
- Timer-expiry path (`expireTimer`) and manual next-round path must both drain the queue

### Requirements

- Gameplay effects can be scheduled for resolution N rounds in the future (N ≥ 1)
- Cosmetic/visual effects (dumbify text, infrastructure textures) resolve at end of round, not on slider change
- Scheduled effects survive save/load
- At most one "pending consequence" per deal (no stacking of the same deal's delayed event)

## Decision

**Not yet made.** This ADR is Proposed — the problem and requirements are documented but the architectural approach has not been decided. Promote to Accepted during Sprint 5 or Sprint 6 planning by working through the alternatives below and writing the Decision, Key Interfaces, and Implementation Guidelines sections.

### Known Approaches to Evaluate

**Option A — Effect queue in game state**
Add a `pendingEffects: ScheduledEffect[]` array to `GameState`. Each entry has a `fireAtRound: number` and the effect payload. `nextRound()` step 0 processes all entries where `fireAtRound === currentRound`, applies them, and removes them from the array. Persisted in save file.

**Option B — Separate effect scheduler store**
A dedicated Zustand slice (`useEffectScheduler`) owns the queue independently of `GameState`. Decoupled but requires a second store to be drained in `nextRound`.

**Option C — Keep immediate effects; add overlay for cosmetics**
Immediate effects stay as-is. Cosmetic changes use a separate "pending cosmetic" flag read at round end. Delayed deal consequences are a special case handled per-deal rather than via a general queue.

*Option A is the likely choice (aligns with existing state structure and save/load pattern) but this must be confirmed before the ADR is accepted.*

## Alternatives Considered

*To be filled in when the ADR is promoted to Accepted.*

## Consequences

### Positive

- Enables Tier 2 weird deals (6 deals currently blocked)
- Cosmetic changes (dumbify text, future infrastructure textures, city model swaps) feel earned — they reinforce the round boundary as a natural narrative beat
- Centralises effect resolution in `nextRound()`, reducing scattered mutation sites

### Negative

- Adds complexity to the save/load system (`pendingEffects` must be persisted and migrated)
- Delayed feedback may feel unresponsive for some effects that players expect to be immediate
- Requires careful ordering: queued effects must fire before or after coup check (decision needed)

### Neutral

- Recurring effects already resolve in `nextRound()` — this extends that existing pattern rather than introducing a new one

## Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Save migration complexity for `pendingEffects` | Medium | Medium | Use the existing `loadGame` whitelist pattern; default to empty array on old saves |
| Player confusion when deal consequence fires "out of nowhere" | Medium | Low | Log entry at consequence fire time (same round it resolves) with deal name |
| Queue grows unbounded if many Tier 2 deals accepted | Low | Low | Cap at one pending consequence per deal ID |

## Performance Implications

| Metric | Before | Expected After | Budget |
|--------|--------|---------------|--------|
| CPU (nextRound processing) | Baseline | +<1ms (array scan of ≤10 entries) | Negligible |
| Memory | Baseline | +<1KB (scheduled effect queue) | Negligible |

## Migration Plan

*To be defined when ADR is promoted to Accepted. Expected steps:*

1. Add `pendingEffects: ScheduledEffect[]` to `GameState` initial state (defaults to `[]`)
2. Add `ScheduledEffect` type to `src/types/GameState.ts`
3. Add queue drain to `nextRound()` step 0 (before coup check, after recurring effects)
4. Update `loadGame` whitelist to include `pendingEffects`
5. Update `buildSavePayload` to include `pendingEffects`
6. Migrate cosmetic triggers (education dumbify, future infrastructure) to use queue
7. Implement Tier 2 weird deals using the queue

**Rollback plan**: revert to immediate effect application by removing the queue drain and applying effects at decision time. Save files with non-empty `pendingEffects` would silently drop queued consequences (acceptable — cosmetic/gameplay parity restored immediately).

## Validation Criteria

- [ ] A deal with `delayedEffect: { fireAtRound: currentRound + 3, ... }` fires exactly at that round
- [ ] Pending effects survive a save/load cycle
- [ ] Pending effects for a run that ends early are not applied to the end screen
- [ ] Education dumbify text changes at round end, not on slider change
- [ ] Existing immediate effects (relation delta, treasury on deal accept) still apply immediately

## GDD Requirements Addressed

| GDD Document | System | Requirement | How This ADR Satisfies It |
|-------------|--------|-------------|--------------------------|
| `design/gdd/weird-deals.md` | Weird Deals (Tier 2) | Deals 23–28 require delayed consequences firing N rounds after acceptance | Scheduled effect queue provides the mechanism |
| `design/gdd/weird-deals.md` | Deal 24 (Emu Export) | Consequence fires at round+3 after acceptance | `fireAtRound = acceptedRound + 3` entry in queue |

## Related

- ADR-0002 — state management pattern (Zustand store structure this ADR extends)
- ADR-0006 — round timer and game loop (`nextRound()` is the drain point)
- `design/gdd/weird-deals.md` — Tier 2 deals that require this system
