# Story 3-5: Budget Tier Consequences (Polish Enhancement)

## Header
- **Story ID**: 3-5
- **Sprint**: 5
- **Status**: Complete
- **Type**: Logic + Integration
- **Layer**: Polish
- **TR-ID**: N/A
- **Governing ADR**: docs/architecture/adr-0002-state-management-pattern.md
- **Manifest Version**: 2026-06-14
- **Estimate**: 2.0 days
- **Last Updated**: 2026-06-15

## Summary

Three budget expenditure tier consequences feed back into the political simulation:

1. **Sick faction**: when Health spending is below the LOW threshold, each active
   faction has a 50% chance of becoming 'sick' each round — sick factions skip
   the Meet tab and cannot propose laws that round.
2. **Infrastructure lockout**: when Infrastructure spending drops below the LOW
   threshold, the Laws tab shows a lockout notice and laws cannot be passed.
3. **Security modifier**: HIGH security spending raises the coup armed threshold
   by +1 (harder to coup); LOW security lowers it by −1 (easier to coup).

## Acceptance Criteria

- [x] Sick faction skips Meet: sick representatives don't appear as selectable targets
- [x] Sick notice displayed in Meet tab when factions are sick
- [x] Infrastructure lockout: Laws tab shows `infra_locked` message below LOW threshold
- [x] Security spend modifies coup threshold: HIGH → +1, LOW → −1
- [x] Eliminated faction returns as new rep next round (status recalculated fresh)
- [x] selectedPower resets to null when selected faction becomes sick or eliminated
- [x] Unit tests for all three mechanics pass

## Files Modified

```
src/Stores/GameState.ts            — representativeStatuses state, nextRound computation,
                                     eliminate action, law-pool filtering by rep status,
                                     infraLocked derivation in Laws store slice
src/Stores/CoupHandler.ts          — securitySpend parameter + BUDGET_EFFECTS.SECURITY modifier
src/Constants/GameState.ts         — BUDGET_EFFECTS.{HEALTH,INFRASTRUCTURE,SECURITY}.{LOW,HIGH}
src/types/GameState.ts             — representativeStatuses field
src/components/Tabs/Meet.tsx       — sick faction notice, filter selectable reps
src/components/Tabs/Laws.tsx       — infraLocked early return with i18n message
public/locales/en/menu.json        — meet.sick_notice key
public/locales/es/menu.json        — meet.sick_notice ES key
public/locales/en/laws.json        — infra_locked, rep_indisposed keys
public/locales/es/laws.json        — same keys in Spanish
tests/unit/meet/budget_tier_consequences.test.ts  — 17 tests (new)
```

## Test Evidence

- **Test file**: `tests/unit/meet/budget_tier_consequences.test.ts` — 17 tests, all pass
- 408/408 total suite tests pass; tsc clean

## Completion Notes
- Completed: 2026-06-15
- Sick status is recalculated at the START of each round (in nextRound()) via 50% rollChance per active faction
- Eliminated factions return as a fresh rep next round (same recalculation — no persistent 'eliminated' carry across rounds)
- Law pool filters exclude laws proposed by sick/eliminated factions; falls back to full pool if none remain
- `infraLocked` is computed inline in the Laws slice from `budget.expenditures.infrastructure < BUDGET_EFFECTS.INFRASTRUCTURE.LOW`
