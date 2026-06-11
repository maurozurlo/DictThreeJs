# Story 2-2: calculateRoundFinancials — Recurring Effect Summation

## Header
- **Story ID**: 2-2
- **Sprint**: 2
- **Status**: Ready
- **Type**: Logic
- **Layer**: Core
- **TR-ID**: TR-lasting-002
- **Governing ADR**: docs/architecture/adr-0006-round-timer-game-loop.md
- **Secondary ADR**: docs/architecture/adr-0002-state-management-pattern.md
- **Manifest Version**: N/A (control manifest not yet created)
- **Estimate**: 0.5 days
- **Last Updated**: 2026-06-11

## Summary

Extend `calculateRoundFinancials()` in `src/Stores/BudgetHandler.ts` to accept
`activeRecurringEffects` and return two new fields: `recurringIncome` and
`recurringExpenses`. The Budget tab and round resolution use this function — both
will automatically get the correct net once it's updated.

Four unit tests cover the four cases: zero effects, income-only, expense-only, mixed.

## Acceptance Criteria

- [ ] `calculateRoundFinancials` accepts `activeRecurringEffects: ActiveRecurringEffect[]` as a new parameter (add at end; callers without it default to `[]`)
- [ ] Returns `recurringIncome: number` = sum of all `incomeBonus` values in the array
- [ ] Returns `recurringExpenses: number` = sum of all `expenseBonus` values in the array
- [ ] `netChange` (or equivalent net field) in the return value includes recurring: `totalIncome + recurringIncome − expenses − recurringExpenses`
- [ ] Unit tests pass for all four cases: zero effects / income-only / expense-only / mixed
- [ ] Existing callers without the new parameter continue to work (backwards compatible)

## Implementation Notes

### From ADR-0006 (Round Timer & Game Loop)

Financial calculation runs inside `nextRound()` before DayEnded opens. The
Handler function `calculateRoundFinancials` must remain a pure function — no
store references, no side effects.

### From ADR-0002 (Handler Contract)

Handler functions: pure inputs → typed outputs. The new parameter follows the
same pattern as the existing `budget` parameter — plain data in, typed result out.

### Signature change

```typescript
// BEFORE
export function calculateRoundFinancials(budget: Budget): RoundFinancials

// AFTER
export function calculateRoundFinancials(
  budget: Budget,
  activeRecurringEffects: ActiveRecurringEffect[] = []
): RoundFinancials
```

### Return type extension (`RoundFinancials`)

Add to the existing return type (in `src/types/GameState.ts` or wherever
`RoundFinancials` is defined):

```typescript
recurringIncome: number;    // sum of incomeBonus across activeRecurringEffects
recurringExpenses: number;  // sum of expenseBonus across activeRecurringEffects
```

### Summation formulas

```typescript
const recurringIncome   = activeRecurringEffects.reduce((sum, e) => sum + e.incomeBonus, 0)
const recurringExpenses = activeRecurringEffects.reduce((sum, e) => sum + e.expenseBonus, 0)
```

Net change must now include both:
```
netChange = totalIncome + recurringIncome − totalExpenses − recurringExpenses
```

### Caller update

`nextRound()` in the store already calls `calculateRoundFinancials(state.budget)`.
Update this call to pass `state.gameManagement.activeRecurringEffects` as the
second argument. The Budget tab forecast calculation must also pass the active
effects (story 2-6 handles the Budget tab display — coordinate file changes if
working in parallel).

## Out of Scope

- **Story 2-1**: The `ActiveRecurringEffect` type (must be done first)
- **Story 2-3**: Writing `lastRoundRecurringIncome/Expenses` back to the store — `nextRound()` wiring
- **Story 2-6**: The Budget tab display consuming the updated net

## QA Test Cases

*Story Type: Logic — automated test specs.*

Test file: `src/Stores/BudgetHandler.recurring.test.ts`

- **AC-1**: Zero effects case
  - Given: `activeRecurringEffects = []`
  - When: `calculateRoundFinancials(budget, [])` is called
  - Then: `recurringIncome === 0`, `recurringExpenses === 0`; net unchanged from current behaviour
  - Edge cases: Omitting second param entirely gives same result

- **AC-2**: Income-only case
  - Given: `activeRecurringEffects = [{ incomeBonus: 25, expenseBonus: 0, ... }, { incomeBonus: 15, expenseBonus: 0, ... }]`
  - When: `calculateRoundFinancials(budget, effects)` is called
  - Then: `recurringIncome === 40`, `recurringExpenses === 0`; net increases by 40

- **AC-3**: Expense-only case
  - Given: `activeRecurringEffects = [{ incomeBonus: 0, expenseBonus: 15, ... }, { incomeBonus: 0, expenseBonus: 25, ... }]`
  - When: `calculateRoundFinancials(budget, effects)` is called
  - Then: `recurringIncome === 0`, `recurringExpenses === 40`; net decreases by 40

- **AC-4**: Mixed case
  - Given: `activeRecurringEffects = [{ incomeBonus: 25, expenseBonus: 0, ... }, { incomeBonus: 0, expenseBonus: 15, ... }]`
  - When: `calculateRoundFinancials(budget, effects)` is called
  - Then: `recurringIncome === 25`, `recurringExpenses === 15`; net changes by +10

## Test Evidence

**Story Type**: Logic
**Required evidence**: `src/Stores/BudgetHandler.recurring.test.ts` — must exist and all 4 test cases pass.

**Status**: [ ] Not yet created

## Dependencies

- Depends on: Story 2-1 must be DONE (ActiveRecurringEffect type required)
- Unlocks: Stories 2-3 (uses updated return), 2-6 (Budget tab forecast)
