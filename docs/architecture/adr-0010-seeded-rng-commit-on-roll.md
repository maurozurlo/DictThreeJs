# ADR-0010: Seeded RNG & Commit-on-Roll (Save-Scum Resistance)

## Status

Accepted

## Date

2026-06-17

## Last Verified

2026-06-17

## Decision Makers

Owner (Mauro Zurlo) + Claude

## Summary

Supersedes ADR-0004. The game replaces browser-native `Math.random()` with a
seeded, dependency-free PRNG (**mulberry32**) whose cursor is part of the saved
game state. Combined with the existing **commit-on-roll** property (every risky
roll is resolved into state inside one atomic `set` at the moment the player
commits — ADR-0002), this makes risky outcomes **reproducible** (a run replays
from its seed) and **un-save-scummable** (reload → retry yields the identical
result because the cursor resumes mid-stream). This directly enforces the game's
"live with it" pillar, which an unseeded RNG silently let players opt out of by
reloading a save.

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Web Platform (browser) |
| **Domain** | Core logic |
| **Knowledge Risk** | LOW — mulberry32 is ~6 lines of standard `Math.imul` bit-twiddling; no API risk |
| **References Consulted** | None (algorithm is public-domain, well-known) |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | None |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Supersedes** | ADR-0004 (RNG & Determinism Strategy — unseeded `Math.random` + mock-via-`vi.spyOn`) |
| **Depends On** | ADR-0002 (State Management — the atomic-`set` discipline that gives commit-on-roll) |
| **Enables** | ADR-0005 (Event Scheduling — RNG contract is now a superset of the prior one) |
| **Blocks** | None |
| **Ordering Note** | Citizen Simulation GDD (`gone`/starvation rolls) consumes this contract. |

## Context

### Problem Statement

ADR-0004 chose unseeded `Math.random()` and justified it with: *"No save/replay
system requiring reproducible sequences."* That reasoning considered only
replay/multiplayer. It missed that the game **does** ship a save/load system
(`SaveLoad.ts`) and that its core pillar — *"I know this is wrong, I'm doing it
anyway / the street never lets you pretend"* — is an **anti-save-scum** promise.
With unseeded randomness, a player can:

1. Save before committing a risky action (a coup-adjacent deal, a backlash-prone
   eliminate, an end-of-round resolution with deaths/protestors).
2. Commit, observe the bad outcome.
3. Reload and retry — the RNG re-rolls fresh, fishing for a better result.

This makes the "live with it" fantasy **opt-out with a reload**. The defect is in
the determinism strategy, not in any one mechanic.

### Current State (at time of this ADR)

- All game-logic randomness already flows through named helpers in `Utils/Math.ts`
  (`rollChance`, `rollFloat`, `getRandomFromList`, `getRandomUniqueItem`,
  `getRandomNumberInRange`) — the centralisation ADR-0004 mandated is done. Two
  raw `Math.random()` calls remained in `DailyEventHandler.ts` (ADR-0004 Migration
  Plan step 3 deferred them).
- **Commit-on-roll already holds.** An audit of every roll site confirms each risky
  roll resolves into durable state inside the same atomic `set` as the player's
  commitment, with no save opportunity in between:
  - Meet actions — backlash/dialogue rolls in `ActionHandler.handleActionOutcome`,
    written atomically by the `takeAction` `set`.
  - Law/deal accept — risk roll in `EffectHandler.handleDecision`, same `set`.
  - Round resolution — sick/weird-law/mini-challenge/risk rolls in `RoundResolver`
    + `GameState.nextRound`, all inside the single `nextRound` `set` (ADR-0002).
- `SaveLoad.buildSavePayload` snapshots the whole state tree and attaches `meta`
  as a top-level field — a pattern the RNG cursor can mirror at near-zero cost.

### Constraints

- Single-player browser game; static deployment; no server.
- Must not regress the existing test contract (439 tests) or add a runtime dependency.
- The PRNG must serialize compactly into the existing base-64 `.dict` save.

### Requirements

- Randomness is reproducible from a stored seed.
- The PRNG cursor is part of the save; loading resumes the **exact** stream.
- Risky outcomes commit into state at the instant of player commitment (preserve
  the existing commit-on-roll property; do not introduce any pending-roll gap a
  save could slip into).
- Existing call sites stay unchanged; tests stay deterministic.

## Decision

Adopt **mulberry32** as the single RNG source, with the running 32-bit cursor as
the source of truth, persisted in the save and restored on load. Keep — and now
**formally rely on** — commit-on-roll for save-scum resistance.

### Architecture

```
new-game (StateFactory.buildStartState)
   │  seedRng(freshEntropy)               ← one seed per run, stored as gameManagement.rngSeed
   ▼
GameState / handlers
   │  rollChance() / rollFloat() / getRandomFromList() / …   (call sites UNCHANGED)
   ▼
Utils/Math.ts  ── module-level cursor `_rngState` ── mulberry32 `next()`
   ▲                                   │
   │ setRngState(saved)                │ getRngState()
   │                                   ▼
load (StateFactory.buildLoadedState)   save (SaveLoad.buildSavePayload)
   restores cursor from data.rngState     attaches live cursor as top-level `rngState`
```

The two halves of the guarantee:

- **Seed + persisted cursor** → reproducibility. A reloaded run resumes the stream
  from the saved cursor, so retrying the same action draws the same value.
- **Commit-on-roll (ADR-0002 atomic `set`)** → state diverges the instant a roll is
  consumed, defeating the reorder attack (save → do B then A, hoping A lands
  differently). Once committed, the outcome is a fact and the timeline has forked.

Neither alone is sufficient; together they are airtight.

### Key Interfaces

```typescript
// Utils/Math.ts
let _rngState = 0;                                 // mulberry32 cursor (source of truth)
export function seedRng(seed: number): void        // new-game + restore; coerces to uint32
export function getRngState(): number              // serialize into the save
export function setRngState(state: number): void   // restore a saved cursor
// next() (private) advances the cursor; rollChance/rollFloat/getRandom* draw from it
```

```typescript
// SaveLoad.buildSavePayload — mirrors the `meta` pattern
serializable.rngState = getRngState();

// StateFactory.buildLoadedState — pre-RNG saves omit rngState; cursor left intact
if (typeof data.rngState === 'number') setRngState(data.rngState);

// StateFactory.buildStartState — seed once, BEFORE the first draw
const rngSeed = (Date.now() ^ Math.floor(Math.random() * 0x100000000)) >>> 0;
seedRng(rngSeed);   // gameManagement.rngSeed stores it (informational / shareable)
```

### Implementation Guidelines

1. mulberry32 lives entirely in `Utils/Math.ts`; all five draw helpers consume the
   private `next()`. No call site changes — signatures are identical to ADR-0004's.
2. Seed in `buildStartState` **before** it draws the first law/deal/event, so the
   whole run (including generation) is one seeded stream.
3. `Math.random()` is still permitted as the **entropy source for the seed itself**
   (outside the deterministic stream) and for **cosmetic, non-logic** paths
   (`Utils/String.ts` text garbler, `DictatorHands.tsx`, `Newspaper.tsx`).
4. **Tests** control randomness by mocking the named `Utils/Math` functions
   (`vi.mock` / `vi.mocked(...).mockImplementation`) or by `seedRng(fixed)` — never
   by spying `Math.random()`, which the draw helpers no longer call. Threshold tests
   mock `rollChance` with `(p) => ROLLED < p` to keep probability-shaping coverage.

## Alternatives Considered

### Alternative 1: Keep ADR-0004 (unseeded `Math.random` + mock)

- **Rejection Reason**: Leaves the save-scum hole open; the "live with it" pillar
  stays opt-out by reload. The only thing it bought — test mockability — is preserved
  here anyway (mock the named util fns / seed a fixed value).

### Alternative 2: Seeded PRNG via the `seedrandom` npm package

- **Rejection Reason**: Adds a runtime dependency for ~6 lines of logic. mulberry32
  is public-domain, dependency-free, and serializes to a single 32-bit integer.

### Alternative 3: Dependency-injected `rng: () => number` threaded through handlers

- **Rejection Reason**: ADR-0004 already rejected this as a large refactor awkward
  with the Zustand store; a module-level cursor + save-payload mirror achieves
  persistence with zero call-site churn.

## Consequences

### Positive

- Risky outcomes are un-save-scummable; the "live with it" pillar is enforced, not
  just promised.
- Runs are reproducible — bug reports can carry a seed; a future "shareable seed" /
  "daily challenge" feature is now cheap.
- Test fixtures gain a clean deterministic seam (`seedRng`) on top of mocking.

### Negative

- Save format gains a `rngState` field. Backward-compatible: pre-RNG saves omit it
  and load fine (cursor left untouched).
- A developer who adds a new risky roll **after** a save point (breaking commit-on-roll)
  would reopen the exploit. Guarded by the rule below and code review.

### Neutral

- mulberry32's statistical quality is more than adequate for gameplay probability;
  it is not cryptographic and is not used for anything security-sensitive.

## Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| New roll introduced after a save point (pending-roll gap) | Low | High | Commit-on-roll is now an ADR-enforced invariant; code review + the atomic-`set` rule (ADR-0002) |
| Developer spies `Math.random()` in a new test and it silently no-ops | Medium | Low | Documented contract; the draw helpers don't call `Math.random` |
| Inline `Math.random()` creeps into a logic path | Medium | Medium | Forbidden-pattern lint/grep (carried over from ADR-0004) |

## Performance Implications

mulberry32 `next()` is a handful of `Math.imul`/shift ops — O(1), comparable to
`Math.random()`. Round-resolution bench remains well under the 5 ms JS budget
(median ~0.26 ms post-change).

## Migration Plan

1. mulberry32 + `seedRng`/`getRngState`/`setRngState` in `Utils/Math.ts`. ✅ Done 2026-06-17
2. Route the two deferred `DailyEventHandler.ts` rolls through `rollFloat()`. ✅ Done 2026-06-17
3. Seed in `buildStartState`; store `gameManagement.rngSeed`. ✅ Done 2026-06-17
4. Attach `rngState` in `buildSavePayload`; restore in `buildLoadedState`. ✅ Done 2026-06-17
5. Migrate the 3 `Math.random`-spy test files to the named-fn / seed seam. ✅ Done 2026-06-17

**Rollback plan**: Revert `Utils/Math.ts` to bare `Math.random()` and drop the
`rngState`/`rngSeed` wiring. Saves with `rngState` ignore the field on an
unseeded build. No data migration required.

## Validation Criteria

- [x] `Utils/Math.ts` exports `seedRng`, `getRngState`, `setRngState`; all draws use the cursor
- [x] No `Math.random()` in game-logic paths (cosmetic/seed-entropy uses exempt)
- [x] `buildSavePayload` serializes `rngState`; `buildLoadedState` restores it (guarded for old saves)
- [x] New-game seeds before its first draw
- [x] Full suite green (439/439) and `tsc -b` + `vite build` clean
- [ ] (Follow-up) A round-trip test asserting reload→retry reproduces an identical roll outcome

## GDD Requirements Addressed

| GDD Document | System | Requirement | How This ADR Satisfies It |
|---|---|---|---|
| `design/gdd/game-concept.md` | RNG | Probability mechanics — TR-rng-001 | Re-bases TR-rng-001 on a seeded, persisted cursor; supersedes ADR-0004's unseeded source |
| `design/gdd/citizen-simulation.md` | Citizen sim | `gone` + starvation rolls (ADR-0004 reference) | Provides the seeded, mockable RNG the sim's rolls route through |

## Related

- ADR-0004 — superseded by this ADR
- ADR-0002 — atomic-`set` discipline is the load-bearing half of commit-on-roll
- ADR-0005 — event scheduling RNG contract (superset-compatible)
- `design/gdd/citizen-simulation.md` — first consumer of the seeded `gone`/starvation rolls
