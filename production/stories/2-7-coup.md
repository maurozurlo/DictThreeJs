# Story 2-7: Coup Mechanic — Thresholds, Grace Roll, Warnings, Narratives

## Header
- **Story ID**: 2-7
- **Sprint**: 2
- **Status**: Ready
- **Type**: Logic
- **Layer**: Feature
- **TR-ID**: TR-lasting-007
- **Governing ADR**: docs/architecture/adr-0004-rng-determinism.md
- **Secondary ADRs**: docs/architecture/adr-0006-round-timer-game-loop.md, docs/architecture/adr-0002-state-management-pattern.md
- **Manifest Version**: N/A (control manifest not yet created)
- **Estimate**: 1.5 days
- **Last Updated**: 2026-06-11

## Summary

Implement the coup mechanic end-to-end: faction relation threshold checks,
two-level warning system, grace roll logic, new `EndCause` values, faction-specific
end narratives on the EndScreen, and constants in `GAMESTATE.COUP`.

The coup fires at the **start** of `nextRound()` — before financials — giving
the player one full round of warnings before death. The grace roll is the only
new RNG in this feature; tests inject the roll to maintain determinism.

## Acceptance Criteria

- [ ] `GAMESTATE.COUP` constants defined: `RELATION_THRESHOLD: 8`, `CHARISMA_THRESHOLD: -3`, `WARN_RELATION: 6`, `WARN_CHARISMA: 0`, `GRACE_CHANCE: 0.5`
- [ ] Yellow warning fires when any faction relation ≥ +6 AND charisma ≤ 0: log message + badge on that faction in Meet tab
- [ ] Red warning (armed) fires when relation ≥ +8 AND charisma ≤ −3: log message + red badge + DayEnded warning row
- [ ] Coup check runs at the START of `nextRound()`, before `calculateRoundFinancials`
- [ ] First trigger round: 50% grace roll (injected in tests); if grace = survive, armed state remains
- [ ] Second consecutive trigger round: 100% coup fires → `phase: 'lose'`, correct `EndCause`
- [ ] Coup does NOT fire at charisma −2 (below threshold)
- [ ] Multiple armed factions: highest relation coups; tiebreak military > business > people
- [ ] Three new `EndCause` values: `'military_coup' | 'business_coup' | 'people_coup'`
- [ ] EndScreen renders faction-specific narrative for each coup cause
- [ ] Special ending (relation ≥ +10 at R9, charisma ≥ 0) continues to work unaffected
- [ ] Unit tests: fires at ≥+8/≤−3 (roll injected as 0.4 = survive first, 0.6 = coup first); does not fire at charisma −2

## Implementation Notes

### GAMESTATE.COUP constants

Add to `src/Constants/GameState.ts`:
```typescript
COUP: {
  RELATION_THRESHOLD: 8,
  CHARISMA_THRESHOLD: -3,
  WARN_RELATION: 6,
  WARN_CHARISMA: 0,
  GRACE_CHANCE: 0.5,
}
```

### Grace roll — determinism (from ADR-0004)

The grace roll uses `Math.random()` (the project's approved RNG). To make it
testable without mocking `Math.random` globally, extract the coup check into a
pure Handler function that accepts the roll value:

```typescript
// CoupHandler.ts (pure function — no store access)
export function checkCoup(
  relations: Relations,
  charisma: number,
  graceRoll: number,   // 0..1 — caller passes Math.random() in production, fixed value in tests
  graceTaken: boolean  // was the armed state already active last round?
): CoupResult

type CoupResult =
  | { outcome: 'safe' }
  | { outcome: 'yellow-warning'; faction: Power }
  | { outcome: 'red-warning'; faction: Power }
  | { outcome: 'coup'; faction: Power; cause: EndCause }
  | { outcome: 'grace'; faction: Power }  // armed but survived the 50% roll
```

In `nextRound()`:
```typescript
const coupResult = checkCoup(
  state.relations.current,
  state.charisma,
  Math.random(),          // production — non-deterministic OK for non-test runs
  state.gameManagement.coupArmedLastRound ?? false
)
```

Tests pass `graceRoll: 0.3` (< 0.5 = grace) or `graceRoll: 0.7` (≥ 0.5 = coup).

### Store additions for grace state

Add `coupArmedLastRound: boolean` to `gameManagement` initial state, reset to
`false` on `setPhase('start')`. This tracks whether the red-warning armed state
was active on the previous advance.

### Warning system

- **Yellow warning**: emit a log line (`addLogEntry`) and set a flag/badge hint
  on the faction's state. Badge rendering in Meet tab reads this flag.
- **Red warning**: emit a log line + a DayEnded special warning row. This is
  separate from the recurring rows added in story 2-5 — it's a one-off warning.

### EndCause and EndScreen narratives

New `EndCause` values in `src/types/GameState.ts` (or wherever `EndCause` is):
```typescript
type EndCause = /* existing */ | 'military_coup' | 'business_coup' | 'people_coup'
```

Narratives (add to EN + ES i18n files):
- **military_coup**: "In the early hours, armored vehicles surrounded the palace. By dawn, the General's face was on every screen."
- **business_coup**: "An emergency board vote. Frozen accounts. A press conference. The Minister of Finance read the statement with steady hands."
- **people_coup**: "The square filled at midnight. By morning, the security forces had joined the crowd. They came for your keys."

EndScreen component: render the appropriate narrative when `endCause` matches
one of the three coup values.

### Special ending interplay

The special ending check (`relation ≥ +10 at R9, charisma ≥ 0`) must run AFTER
the coup check. If the coup fires, the special ending never runs. This is the
correct ordering.

Dead zone (`relation +10, charisma −1..−2`): coup condition is NOT met (charisma
above threshold), special ending is NOT met (charisma < 0) — player simply wins
the round but gets no special outcome. No action needed.

## Out of Scope

- **Story 2-1**: The `ActiveRecurringEffect` types (independent, no dependency)
- Visual consequence registry coup-crown badge (story 2-9 — data registry only, no 3D asset this sprint)
- Economy advisor comments on the coup warning (future sprint)

## QA Test Cases

*Story Type: Logic — automated test specs.*

Test file: `src/Stores/CoupHandler.test.ts`

- **AC-1**: No coup below threshold
  - Given: Relation = +7 (below 8), charisma = −3
  - When: `checkCoup(relations, −3, 0.9, false)` is called
  - Then: `outcome === 'safe'`
  - Edge cases: Relation = +8, charisma = −2 → `outcome !== 'coup'` (charisma threshold not met)

- **AC-2**: Yellow warning
  - Given: Relation = +7, charisma = −1 (meets WARN conditions, not ARMED conditions)
  - When: `checkCoup(...)` is called
  - Then: `outcome === 'yellow-warning'`

- **AC-3**: Red warning (armed, first time)
  - Given: Relation = +8, charisma = −3, `graceTaken = false`
  - When: `checkCoup(..., graceRoll: 0.3, false)` — roll 0.3 < 0.5 → survives grace
  - Then: `outcome === 'grace'` (survives this round, armed state persists)

- **AC-4**: Coup fires (grace exhausted)
  - Given: Same conditions, `graceTaken = true` (grace already used last round)
  - When: `checkCoup(..., graceRoll: 0.3, true)` — grace no longer available
  - Then: `outcome === 'coup'`, `cause === 'military_coup'` (if military faction)

- **AC-5**: Coup fires on first roll (bad luck)
  - Given: Relation = +8, charisma = −3, `graceTaken = false`, `graceRoll = 0.7` (≥ 0.5)
  - When: `checkCoup(...)` is called
  - Then: `outcome === 'coup'`

- **AC-6**: Special ending unaffected
  - Given: Store in round 9, relation = +10, charisma = 0
  - When: `nextRound()` is called (coup check runs first — no coup since charisma ≥ 0)
  - Then: Game reaches special ending, `endCause` is the special ending cause (not coup)

- **AC-7**: Tiebreak
  - Given: Military = +8, Business = +8, charisma = −3
  - When: `checkCoup(...)` is called
  - Then: `cause === 'military_coup'` (military wins tiebreak)

## Test Evidence

**Story Type**: Logic
**Required evidence**: `src/Stores/CoupHandler.test.ts` with all 7 test cases above passing.

**Status**: [ ] Not yet created

## Dependencies

- Depends on: None — the coup mechanic is independent of the recurring effects feature
- Unlocks: Story 2-9 (visual registry uses coup relation threshold for the coup-crown badge)
