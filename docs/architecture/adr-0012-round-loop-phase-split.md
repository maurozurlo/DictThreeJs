# ADR-0012: Round Loop Phase Split — Work Day vs. Street Hinge

## Status

Accepted

## Date

2026-07-08

## Last Verified

2026-07-08

## Decision Makers

Owner + sim-design-advisor review (see `ROUND_LOOP_STREET_REVEAL_0_1.md`)

## Summary

The Street View is currently reachable at any time during the timed work-day
round, which trains players to avoid it (looking costs rounds) and lets the
game's best feature die unwatched. This ADR splits each round into a **timed
work day** (Street View locked, decisions only) and an **untimed after-work
hinge** (Street View is the only reachable tab; mandatory brief reveal, then
optional unlimited dwell) triggered once at round-end via the existing
`expireTimer()` action.

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | React 19 + Zustand + react-three-fiber (web) |
| **Domain** | Core / UI |
| **Knowledge Risk** | LOW — no post-cutoff APIs |
| **References Consulted** | None |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | None |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0002 (state pattern), ADR-0006 (round timer/game loop) |
| **Enables** | Future Street View 0.2+ persistence/"scar" layer |
| **Blocks** | Sprint 9 stories 9-1, 9-2, 9-3 |
| **Ordering Note** | None |

## Context

### Problem Statement

Design notes (`ROUND_LOOP_STREET_REVEAL_0_1.md`, root of repo) identify that
under a live round timer, players learn to avoid the Street View entirely to
conserve time — the inverse of the intended "fun to watch" outcome. The fix is
not to restrict looking, but to separate *information* (cheap, always
available) from *spectacle* (a dedicated, timer-free phase).

### Current State

- `gameManagement.phase: GamePhase` = `'idle' | 'start' | 'event' | 'victory' | 'lose' | 'special_ending'` — no work/dwell sub-state exists.
- The round timer (ADR-0006) runs continuously during `phase === 'start'`; `Tabs.Street` is reachable at any point during this phase, competing with decision tabs for attention.
- Round-end (`expireTimer()`, fired by timer expiry or the confirmed manual-advance path in `RoundAdvanceController`) sets `gameManagement.dayEnded = true`, which renders the blocking `DayEnded` modal (full-viewport scrim) over whatever tab is currently active — Street is shown only by coincidence, never guaranteed.
- `nextRound()` resolves the round, resets `dayEnded = false`, and (in most branches) sets `activeTab: Tabs.Log` for the new round.
- RNG save-scum resistance is **already handled** by ADR-0010 (seeded PRNG + commit-on-roll) — the design doc's §6 "pending call" is satisfied by prior work; no action needed here.

### Constraints

- No physics/engine changes — this is pure state-machine + UI gating.
- Must not disturb the existing `tabsLocked` mechanism (used elsewhere for event/dialog blocking) — the new gate is a separate, additive concept: `dwelling`.
- Must reuse the existing Street camera/scene wiring (`setActiveTab` Street camera case) — no new camera work.

### Requirements

- Street View is unreachable during the timed work day (`phase === 'start' && !dwelling`), reachable only during the hinge (`dwelling === true`).
- Decision tabs (Meet/Laws/Deals/Budget) are unreachable during the hinge — nothing to decide until `nextRound()` fires.
- Exactly one hinge per round transition (never a duplicated "this month"/"next month" pair) — round-end and round-start briefing are the same beat.
- The hinge has a **mandatory** minimum reveal window (cannot be insta-skipped) followed by **optional, unlimited** dwell time.
- Round-end financial data (already computed by `expireTimer()`) is preserved and re-framed as "newsreel" headline content over the Street scene, not deleted.
- Debug mode retains full tab access (consistent with existing `debugEnabled` bypasses elsewhere, e.g. Secret tab).

## Decision

Add a single new boolean, `gameManagement.dwelling`, as the source of truth for
which half of the round loop is active. `expireTimer()` flips it true (and
forces `activeTab` to `Tabs.Street`) in the same atomic `set()` call that
already writes the round's financial snapshot. `nextRound()` flips it back to
false in all five resolution branches, alongside the existing `dayEnded: false`
reset. `setActiveTab` gains a `dwelling`-aware gate symmetrical to the existing
`tabsLocked` gate. The `DayEnded` component gains a two-stage render: a
blocking full scrim (mandatory reveal, placeholder newsreel headline fused
onto the existing stat breakdown) for a fixed minimum duration, then a
non-blocking corner card (optional dwell) with the round-advance button, while
the Street scene underneath remains fully interactive (ped click-to-inspect,
camera, etc.).

### Architecture

```
expireTimer()                         nextRound()
   │ dwelling: true                       │ dwelling: false
   │ activeTab: Street                    │ activeTab: Log (existing)
   ▼                                      ▼
┌─────────────────────────────────────────────────┐
│  dwelling = true            dwelling = false     │
│  ┌─────────────┐            ┌─────────────────┐ │
│  │ Street: OPEN │            │ Street: LOCKED   │ │
│  │ Meet/Laws/   │            │ Meet/Laws/Deals/ │ │
│  │ Deals/Budget:│            │ Budget: OPEN     │ │
│  │ LOCKED       │            │ (existing rules) │ │
│  └─────────────┘            └─────────────────┘ │
│   mandatory reveal → optional dwell → Continue   │
└─────────────────────────────────────────────────┘
```

### Key Interfaces

```typescript
// types/GameState.ts — gameManagement slice addition
dwelling: boolean; // true = after-work hinge active (Street open, decisions locked)

// setActiveTab gate (GameState.ts), symmetrical to the existing tabsLocked check
const decisionTabs = [Tabs.Meet, Tabs.Laws, Tabs.Deals, Tabs.Budget];
if (get().gameManagement.dwelling && decisionTabs.includes(tab) && !debugEnabled) return;
if (!get().gameManagement.dwelling && tab === Tabs.Street && get().gameManagement.phase === 'start' && !debugEnabled) return;
```

### Implementation Guidelines

1. `dwelling` lives in `gameManagement`, not `tabs` — it is round-loop state, not navigation state (mirrors where `dayEnded` already lives).
2. The mandatory-reveal minimum timer is **local component state** in `DayEnded` (a `setTimeout` + `useState`, following the same pattern as `RoundAdvanceController`'s local `showConfirm`) — not store state. Handlers stay pure (ADR-0002); UI-only timing does not belong in Zustand.
3. Do not touch `tabsLocked` — it is an orthogonal lock used elsewhere (event/dialog blocking). `dwelling` is additive.
4. Newsreel headline text is a small pure function fed by the same financials `expireTimer()` already computes — no new store fields for headline text itself, only the boolean.
5. Debug mode (`debug.enabled`) bypasses both new gates, consistent with existing Secret-tab precedent.

## Alternatives Considered

### Alternative 1: New `GamePhase` value (`'dwell'`) instead of a boolean

- **Description**: Add `'dwell'` to the `GamePhase` union alongside `'start'`.
- **Pros**: Single source of truth for "what mode is the game in."
- **Cons**: `GamePhase` is checked in many places (`EndScreen`, `Navbar`, `DayEnded`) as a meta-state (idle/lose/victory/etc.); overloading it with a round-internal sub-state risks breaking those checks (e.g. `phase !== 'start'` guards would need updating everywhere `dwelling` should also count as "in game").
- **Rejection Reason**: A separate boolean is strictly additive and lower-risk; `phase` stays `'start'` throughout the whole round (work + hinge), which is also conceptually correct — the hinge is still part of the same round, not a new top-level phase.

### Alternative 2: Route the hinge through a dedicated new tab/route rather than forcing `Tabs.Street`

- **Description**: Introduce a `Tabs.Hinge` tab distinct from `Tabs.Street`.
- **Pros**: Cleaner separation of "forced reveal" vs. "player-chosen Street visit."
- **Cons**: Duplicates the entire Street scene/camera wiring for no behavioral difference; the design doc explicitly wants the hinge *to be* the Street View, not a copy of it.
- **Rejection Reason**: Reuse `Tabs.Street`; gate it instead of forking it.

## Consequences

### Positive

- Minimal-diff: one new boolean, symmetrical gate logic, no new components required for the phase split itself.
- Reuses 100% of existing Street camera/scene/ped-click wiring — zero 3D risk.
- Preserves all existing round-end financial data; nothing deleted, only re-framed.

### Negative

- `DayEnded` component takes on two responsibilities (blocking reveal + non-blocking dwell banner) — acceptable for the MVP validation pass per the design doc's own "build the dumb version" instruction (§8); may warrant a split into two components after playtesting confirms the direction.

### Neutral

- Round 1's "inherited city" opening state and the scripted-crisis docket consistency check (design doc §3 engineering note, §5) are scoped as separate Should-Have stories (9-4, 9-5) — not blocking for the core validation loop.

## Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Player gets stuck unable to reach decision tabs if `dwelling` fails to reset | Low | High | `nextRound()` resets `dwelling: false` in all 5 existing resolution branches (coup/lose/victory/special-ending/normal) — same branches that already reset `dayEnded` |
| Debug/free-cam workflows broken by the new Street gate | Low | Low | Explicit `debugEnabled` bypass on both gates |

## Performance Implications

None — boolean check, no new render loops.

## Migration Plan

1. Add `dwelling: boolean` to `gameManagement` initial state + `types/GameState.ts` (default `false`).
2. Wire `expireTimer()` and all 5 `nextRound()` branches.
3. Add gate to `setActiveTab`.
4. Update `Navbar.tsx` tab disabled logic.
5. Update `DayEnded.tsx` for two-stage render + newsreel headline.

**Rollback plan**: Revert the 4 touched files; `dwelling` defaults to `false` so removing the gate checks restores current behavior exactly.

## Validation Criteria

- [ ] Street tab is disabled/unreachable during the timed work day
- [ ] Street tab is the only reachable tab (besides Menu) during the hinge; Meet/Laws/Deals/Budget disabled
- [ ] Round-end always force-navigates to Street
- [ ] "Begin Next Month" cannot fire before the mandatory reveal window elapses
- [ ] Player can freely dwell (camera, ped-click-to-inspect) in Street after the reveal window, with no time limit
- [ ] `nextRound()` correctly resets `dwelling` in all 5 branches (manual playtest: trigger coup/lose/victory/special-ending/normal paths)
- [ ] 3-4 month playtest per design doc §8: does the player linger or mash through?

## GDD Requirements Addressed

| GDD Document | System | Requirement | How This ADR Satisfies It |
|---|---|---|---|
| `ROUND_LOOP_STREET_REVEAL_0_1.md` | Round Loop | "Street off during work day, on during after-work hinge; exactly one hinge per round; mandatory reveal + optional dwell" | `dwelling` boolean gate + two-stage `DayEnded` render, wired through the existing `expireTimer()`/`nextRound()` round-end path |

## Related

- ADR-0002 — state management pattern (Handler purity, atomic `set()`)
- ADR-0006 — round timer / game loop (`expireTimer()`, `nextRound()`)
- ADR-0010 — seeded RNG & commit-on-roll (already satisfies design doc §6; no action needed)
- `ROUND_LOOP_STREET_REVEAL_0_1.md` — source design decisions
- Code once implemented: `src/Stores/GameState.ts`, `src/components/Navbar/Navbar.tsx`, `src/components/DayEnded/DayEnded.tsx`
