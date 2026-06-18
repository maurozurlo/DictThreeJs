# Story 6-7: Coup Fairness UI — Telegraphing Readout

## Header
- **Story ID**: 6-7
- **Sprint**: 6
- **Status**: In Progress
- **Type**: UI
- **Layer**: Presentation
- **TR-ID**: TR-coup-002
- **Governing ADR**: docs/architecture/adr-0009-coup-telegraphing-fairness.md (Planned — blocked on 6-5)
- **Manifest Version**: 2026-06-13
- **Estimate**: 1.0 days
- **Last Updated**: 2026-06-17

## Summary

Implement the player-facing coup risk readout as specified by ADR-0009 (which must be Accepted
before this story starts). Shows the player which faction is closest to a coup threshold, how
far from the threshold they are, and what round a warning was issued. Coup already reads
**effective** relations post-6-1. This story adds the UI layer on top of that data.

**Note**: ADR-0009 is Planned. This story's acceptance criteria will be updated once ADR-0009
is Accepted and its UI design contract is known. The criteria below are provisional placeholders.

## Acceptance Criteria

*(Provisional — update from ADR-0009 when Accepted)*

- [ ] ADR-0009 is Accepted before implementation begins
- [ ] Risk readout component shows: the faction name, the effective relation value, the distance to the coup threshold
- [ ] Risk readout is only shown when at least one faction is within the ADR-0009-defined warning range
- [ ] No readout when no faction is within warning range
- [ ] Readout uses **effective** relations (post-6-1 data source) — does not re-read base
- [ ] Warning issued at `round - 1` (or per ADR-0009 minimum warning period) before a coup can fire
- [ ] Readout does not expose coup arming internals that ADR-0009 deems hidden
- [ ] Selection logic unit-tested: correct faction and distance computed from a given modifiers + base state
- [ ] tsc clean; no ADR-0003 violation (UI component does not import from Three.js)

## Implementation Notes

*This section will be filled in after ADR-0009 is Accepted — implementation details depend on the ADR decision.*

Provisional notes:
- Read effective relations via `getEffectiveRelation(base, modifiers, stat, round)` (from 6-1).
- Compute distance to threshold: `threshold - effectiveRelation`. Show the faction with the smallest positive distance.
- Component receives data as props or via store selectors; no gameplay logic inline.

## Out of Scope

- Changing coup probability or grace period — balance is not in scope here
- ADR-0009 authoring — that is 6-5
- The effective-relation data source — that landed in 6-1

## QA Test Cases

*Embedded from `production/qa/qa-plan-sprint-6-2026-06-15.md`. Test file: `tests/unit/coup/coup_risk_readout_test.ts`.*

- **AC — Correct faction selected**
  - Given: military effective = 3 (threshold = 2), business effective = 5 (threshold = 2), people effective = 7 (threshold = 2)
  - When: risk readout selection logic runs
  - Then: military selected (closest to threshold: distance = 1); business and people not shown (above threshold)
  - Edge cases: two factions equally close → deterministic tie-break (alphabetical or fixed priority)

- **AC — No readout when safe**
  - Given: all three factions have effective relation ≥ (warning range above threshold)
  - When: risk readout logic runs
  - Then: no readout rendered (component returns null or hidden state)

- **Manual check — UI displays correctly**
  - Setup: set one faction's base relation to warning range; accept a modifier that raises it above warning range
  - Verify: readout disappears when effective relation exits warning range; reappears when modifier expires
  - Pass condition: readout state matches effective (not base) relation at every transition

## Test Evidence

- **Story Type**: UI
- **Required evidence**: `tests/unit/coup/coup_risk_readout_test.ts` — selection logic tests must pass; manual walkthrough doc at `production/qa/evidence/6-7-coup-ui-evidence.md`
- **Status**: [ ] Not yet created

## Completion Notes

**2026-06-16 — ADR-0009 ratified; deterministic-grace LOGIC slice shipped (UI readout still pending).**

ADR-0009 was ratified by the owner. The balance-critical **logic** half of this story's ADR is
now implemented and tested, ahead of the UI readout:

- `src/Stores/CoupHandler.ts` — retired the 50% grace roll; `checkCoup` is now RNG-free.
  First armed round always returns `grace`; coup fires only when armed persists into the next
  round (`graceTaken`). Defuse paths (relation drop / charisma rise) verified.
- `src/Constants/GameState.ts` — `GRACE_CHANCE` removed from the `Coup` interface and `GAMESTATE.COUP`.
- `src/Stores/RoundResolver.ts` — dropped the `rollFloat()` argument from the coup call (and the now-unused import).
- Tests updated: `src/Stores/CoupHandler.test.ts` (deterministic grace + defuse cases),
  `tests/unit/meet/budget_tier_consequences.test.ts`, `tests/unit/stats/stats-enhancements.test.ts`. Suite 439/439.

**Remaining scope for this story = the player-facing readout UI only** (the telegraphing panel:
threatening faction, effective relation, distance to threshold). Update the provisional ACs above
from ADR-0009 §1/§4 before implementing the UI.

## Dependencies

- Depends on: 6-5 (ADR-0009 must be Accepted before implementation; effective relations land in 6-1 which is independent)
- Unlocks: None
