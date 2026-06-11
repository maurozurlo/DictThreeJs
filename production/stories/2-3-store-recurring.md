# Story 2-3: Store Wiring — Activate, Reset, Save, and Advance Recurring Effects

## Header
- **Story ID**: 2-3
- **Sprint**: 2
- **Status**: Complete
- **Type**: Integration
- **Layer**: Core
- **TR-ID**: TR-lasting-003
- **Governing ADR**: docs/architecture/adr-0002-state-management-pattern.md
- **Secondary ADR**: docs/architecture/adr-0006-round-timer-game-loop.md
- **Manifest Version**: N/A (control manifest not yet created)
- **Estimate**: 1.0 day
- **Last Updated**: 2026-06-11

## Summary

Wire the recurring effect lifecycle into the store:
1. `actUponLaw(true)` pushes an `ActiveRecurringEffect` entry when the accepted law has `recurringEffect`
2. `actUponDeal(true)` does the same for deals
3. `nextRound()` calls `calculateRoundFinancials` with `activeRecurringEffects`, stores the recurring sums back (`lastRoundRecurringIncome`, `lastRoundRecurringExpenses`), and resets `repealTakenThisRound`
4. `setPhase('start')` clears `activeRecurringEffects`, `repealTakenThisRound`, and the `lastRound*` fields
5. Save/load serializes and restores `activeRecurringEffects` correctly

Integration test: pass a law → advance round → verify treasury delta includes the recurring amount.

## Acceptance Criteria

- [ ] Accepting a law with `recurringEffect` adds exactly one `ActiveRecurringEffect` entry (dedup: same `sourceId` twice = still one entry)
- [ ] Accepting a deal with `recurringEffect` does the same
- [ ] Rejecting a law/deal never adds an entry
- [ ] `nextRound()` uses `activeRecurringEffects` in `calculateRoundFinancials`, stores returned `recurringIncome`/`recurringExpenses` into `lastRoundRecurringIncome`/`lastRoundRecurringExpenses`, and sets `repealTakenThisRound = false`
- [ ] Treasury changes by the correct net including recurring effects after `nextRound()`
- [ ] `setPhase('start')` resets all four new fields to initial values
- [ ] JSON save includes `activeRecurringEffects`; loading restores it correctly
- [ ] All existing tests continue to pass

## Implementation Notes

### From ADR-0002 (Handler Contract)

All mutation happens inside a single `set()` call per action. The new fields are
added to the `set()` spread — do not call `set()` twice in the same action.

### actUponLaw / actUponDeal changes

In the store action that handles law/deal acceptance, after computing the existing
effects (relations, treasury), add:

```typescript
const existingEffects = get().gameManagement.activeRecurringEffects
const alreadyActive = existingEffects.some(e => e.sourceId === law.id)
const newEffects = alreadyActive ? existingEffects : [
  ...existingEffects,
  {
    sourceId: law.id,
    sourceType: 'law' as const,
    sourceFaction: law.faction,       // the faction who proposed it — used for repeal penalty
    label: law.recurringEffect.label,
    incomeBonus: law.recurringEffect.incomeBonus ?? 0,
    expenseBonus: law.recurringEffect.expenseBonus ?? 0,
    roundActivated: get().gameManagement.round,
  }
]
```

Gate this block on `hasAccepted && law.recurringEffect != null`.

### nextRound() changes

```typescript
const activeEffects = state.gameManagement.activeRecurringEffects
const financials = calculateRoundFinancials(state.budget, activeEffects)
// financials now contains recurringIncome, recurringExpenses
set((s) => ({
  ...existingRoundUpdates,
  gameManagement: {
    ...s.gameManagement,
    lastRoundRecurringIncome: financials.recurringIncome,
    lastRoundRecurringExpenses: financials.recurringExpenses,
    repealTakenThisRound: false,
  }
}))
```

### setPhase('start') reset

Find the reset logic (often a `set({ ...INITIAL_STATE })` or explicit field
assignments) and ensure the four new fields are included:
```typescript
activeRecurringEffects: [],
repealTakenThisRound: false,
lastRoundRecurringIncome: 0,
lastRoundRecurringExpenses: 0,
```

### Save/Load

In `src/Utils/SaveLoad.ts`, the serialization should already capture
`activeRecurringEffects` if the save uses the full store snapshot. Verify:
- Save: `activeRecurringEffects` appears in the exported JSON (not stripped)
- Load: `activeRecurringEffects` is restored from the JSON and is correctly typed

If the load path uses a whitelist or reconstructs state field-by-field, add
`activeRecurringEffects` to the whitelist explicitly.

## Out of Scope

- **Story 2-2**: The `calculateRoundFinancials` extension (must be done first)
- **Story 2-4**: Actual law/deal content with `recurringEffect` values
- **Story 2-5**: DayEnded UI displaying the recurring rows
- **Story 2-8**: The `repeal()` store action (separate story)

## QA Test Cases

*Story Type: Integration — integration test or documented playtest.*

Integration test file: `src/Stores/StoreWiring.recurring.test.ts`
(or extend an existing integration test if one covers `actUponLaw` + `nextRound`)

- **AC-1**: Accept law → entry added
  - Given: A law object with `recurringEffect: { incomeBonus: 25, label: 'test_label' }` and `id: 'law-test'`
  - When: `actUponLaw(true, law)` is called on the store
  - Then: `store.gameManagement.activeRecurringEffects` has exactly 1 entry with `sourceId === 'law-test'` and `incomeBonus === 25`
  - Edge cases: Calling `actUponLaw(true, law)` a second time (pool reset simulation) → still 1 entry (dedup)

- **AC-2**: Reject law → no entry added
  - Given: Same law with `recurringEffect`
  - When: `actUponLaw(false, law)` is called
  - Then: `activeRecurringEffects` remains `[]`

- **AC-3**: nextRound treasury includes recurring
  - Given: Store with `activeRecurringEffects = [{ incomeBonus: 25, expenseBonus: 0, ... }]` and known `budget` state
  - When: `nextRound()` is called
  - Then: `treasury` decreases/increases by `netChange + 25` compared to a round without the effect
  - Edge cases: Mixed income+expense effects cancel correctly

- **AC-4**: lastRoundRecurring* populated after nextRound
  - Given: `activeRecurringEffects = [{ incomeBonus: 25, ... }, { expenseBonus: 15, ... }]`
  - When: `nextRound()` is called
  - Then: `lastRoundRecurringIncome === 25`, `lastRoundRecurringExpenses === 15`

- **AC-5**: repealTakenThisRound reset on nextRound
  - Given: `repealTakenThisRound = true` (simulate a repeal in the previous round)
  - When: `nextRound()` is called
  - Then: `repealTakenThisRound === false`

- **AC-6**: setPhase('start') clears all fields
  - Given: Store with non-empty `activeRecurringEffects`, `lastRoundRecurringIncome = 25`
  - When: `setPhase('start')` is called
  - Then: All four new fields are back to initial values

- **AC-7**: Save/load round-trip
  - Given: Store with `activeRecurringEffects = [{ sourceId: 'law-test', ... }]`
  - When: State is exported to JSON and re-imported
  - Then: `activeRecurringEffects` contains the same entry after load

## Test Evidence

**Story Type**: Integration
**Required evidence**: Integration test at `src/Stores/StoreWiring.recurring.test.ts` OR a documented playtest record at `production/qa/evidence/2-3-store-wiring-playtest.md` covering all 7 ACs.

**Status**: [ ] Not yet created

## Dependencies

- Depends on: Story 2-2 must be DONE (`calculateRoundFinancials` with `activeRecurringEffects` parameter)
- Unlocks: Stories 2-5, 2-6, 2-8 (all read `activeRecurringEffects` or `lastRound*` from store)
