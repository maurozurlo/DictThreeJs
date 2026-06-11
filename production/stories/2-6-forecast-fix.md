# Story 2-6: Budget Forecast Fix — Recurring Effects in Rounds-Left Calculation

## Header
- **Story ID**: 2-6
- **Sprint**: 2
- **Status**: Ready
- **Type**: Logic
- **Layer**: Feature
- **TR-ID**: TR-lasting-006
- **Governing ADR**: docs/architecture/adr-0002-state-management-pattern.md
- **Manifest Version**: N/A (control manifest not yet created)
- **Estimate**: 0.5 days
- **Last Updated**: 2026-06-11

## Summary

The Budget tab currently shows a "rounds left" forecast based on net income
calculated without recurring effects. Once Feature 1 is active, this becomes a
correctness bug — the forecast will predict bankruptcies that won't happen
(if income laws are active) or miss bankruptcies that will (if expense laws pile up).

This story updates the Budget tab's `net` and `roundsLeft` computation to call
`calculateRoundFinancials` with `activeRecurringEffects` so the forecast is always
accurate.

## Acceptance Criteria

- [ ] The net/round display in the Budget tab includes `recurringIncome − recurringExpenses` in its calculation
- [ ] The "rounds left" figure uses the updated net (not the pre-recurring net)
- [ ] With one income law active (+25/round), rounds-left increases compared to without it
- [ ] With one expense law active (−15/round), rounds-left decreases compared to without it
- [ ] Unit test: given a known budget + two recurring effects (one income, one expense), asserts `roundsLeft` equals the expected value
- [ ] No visual change to the Budget tab layout — only the numbers change

## Implementation Notes

### Current implementation (from previous work)

In `src/components/Tabs/Budget.tsx`:
```typescript
const treasury = useGameStore(s => s.budget.treasury)
// net is currently computed from budget sliders only
const net = /* current calculation */
const roundsLeft = net < 0 ? Math.floor(treasury / Math.abs(net)) : null
```

### Required change

Add selector for `activeRecurringEffects` and pass it to `calculateRoundFinancials`:

```typescript
const activeRecurringEffects = useGameStore(s => s.gameManagement.activeRecurringEffects)

// Call the updated calculateRoundFinancials (story 2-2) for the forecast
const { recurringIncome, recurringExpenses } = calculateRoundFinancials(
  budget,
  activeRecurringEffects
)

const netWithRecurring = baseNet + recurringIncome - recurringExpenses
const roundsLeft = netWithRecurring < 0
  ? Math.floor(treasury / Math.abs(netWithRecurring))
  : null
```

Where `baseNet` is the existing net from budget sliders (tax income − slider expenses).

### Alternative approach

If `calculateRoundFinancials` already computes `netChange` including recurring,
simply use that value for `roundsLeft` instead of re-deriving it.

### Display string

The existing display `Net: −68m · ~7 rounds left` should update to reflect the
actual net including recurring. The format doesn't change.

## Out of Scope

- **Story 2-2**: The `calculateRoundFinancials` extension (must be done first)
- **Story 2-3**: Writing the recurring effects to the store (must be done first)
- Changing the Budget tab layout or adding per-law breakdown rows

## QA Test Cases

*Story Type: Logic — automated test spec.*

Test file: `src/components/Tabs/Budget.forecast.test.ts`
(or a utility test if the forecast logic is extracted to a helper function)

- **AC-1**: Rounds-left increases with active income effect
  - Given: Treasury 500, base net −68/round, one income effect +25/round
  - When: `roundsLeft` is computed with `activeRecurringEffects = [{ incomeBonus: 25 }]`
  - Then: `roundsLeft = Math.floor(500 / 43) = 11` (not `Math.floor(500 / 68) = 7`)
  - Edge cases: net becomes positive → `roundsLeft === null` (infinite)

- **AC-2**: Rounds-left decreases with active expense effect
  - Given: Treasury 500, base net −68/round, one expense effect −15/round
  - When: `roundsLeft` is computed with `activeRecurringEffects = [{ expenseBonus: 15 }]`
  - Then: `roundsLeft = Math.floor(500 / 83) = 6` (not 7)
  - Edge cases: `roundsLeft` can become 0 if net is catastrophically negative — display as 0

- **AC-3**: Mixed effects sum correctly
  - Given: Income +25, expense −15 → net contribution = +10
  - When: `roundsLeft` is computed
  - Then: Effective net = −68 + 10 = −58; `roundsLeft = Math.floor(500 / 58) = 8`

## Test Evidence

**Story Type**: Logic
**Required evidence**: `src/components/Tabs/Budget.forecast.test.ts` — 3 test cases as specified above. All must pass.

**Status**: [ ] Not yet created

## Dependencies

- Depends on: Story 2-3 must be DONE (`activeRecurringEffects` in store; `calculateRoundFinancials` updated)
- Unlocks: Story 2-10 (balance pass validates forecast accuracy)
