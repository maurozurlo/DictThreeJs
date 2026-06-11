# Story 2-5: DayEnded Breakdown — Recurring + One-Time Rows

## Header
- **Story ID**: 2-5
- **Sprint**: 2
- **Status**: Ready
- **Type**: UI
- **Layer**: Feature
- **TR-ID**: TR-lasting-005
- **Governing ADR**: docs/architecture/adr-0002-state-management-pattern.md
- **Manifest Version**: N/A (control manifest not yet created)
- **Estimate**: 0.5 days
- **Last Updated**: 2026-06-11

## Summary

Extend the DayEnded modal with two new rows: **Legislation Income** (green) and
**Legislation Costs** (red), reading from `lastRoundRecurringIncome` and
`lastRoundRecurringExpenses` in the store. Rows are hidden when their value is 0.
The net row must equal the actual treasury change for the round.

Display order defined in PRD Feature 3:
1. Tax Income (existing, green)
2. Budget Expenses (existing, red)
3. **Legislation Income** (NEW — green, hidden when 0)
4. **Legislation Costs** (NEW — red, hidden when 0)
5. One-time Income (existing extras, relabeled if needed)
6. One-time Expenses (existing extras, relabeled if needed)
7. Net (existing, color-coded)

## Acceptance Criteria

- [ ] "Legislation Income" row appears when `lastRoundRecurringIncome > 0`, shows the correct amount in green
- [ ] "Legislation Costs" row appears when `lastRoundRecurringExpenses > 0`, shows the correct amount in red
- [ ] Both rows are completely absent from the DOM (not just hidden with `display:none`) when value is 0
- [ ] Net row matches the actual treasury change for the round exactly
- [ ] i18n keys `recurring_income` and `recurring_expenses` exist in EN and ES locale files
- [ ] Rows appear between Budget Expenses and One-time Income in the display order

## Implementation Notes

### From ADR-0002 (store access pattern)

Read the two fields directly from the store using selectors:
```typescript
const recurringIncome   = useGameStore(s => s.gameManagement.lastRoundRecurringIncome)
const recurringExpenses = useGameStore(s => s.gameManagement.lastRoundRecurringExpenses)
```

Do not pass these as props — read from store directly in the DayEnded component.

### Conditional rendering

Use `{recurringIncome > 0 && <Row ... />}` — not `display: none` on a rendered
element — to satisfy the "absent from the DOM" acceptance criterion.

### Net row correctness

The net row should already display the treasury delta correctly if `nextRound()`
stores the correct values. Verify the net displayed equals:
```
taxIncome + recurringIncome + extraIncome - budgetExpenses - recurringExpenses - extraExpenses
```
If DayEnded computes net independently rather than reading it from the store,
ensure this computation is updated to include recurring terms.

### i18n keys to add

```json
// en
"recurring_income": "Legislation Income",
"recurring_expenses": "Legislation Costs"

// es
"recurring_income": "Ingresos Legislativos",
"recurring_expenses": "Costos Legislativos"
```

Add to whichever namespace DayEnded currently uses for its labels.

### Styling

Follow existing row styling: green text for income, red text for expenses.
Match the font size and spacing of the existing Tax Income / Budget Expenses rows.
No new CSS classes needed if the existing ones apply.

## Out of Scope

- **Story 2-3**: Writing `lastRoundRecurring*` to the store (must be done first)
- **Story 2-8**: The Active Legislation / repeal section (separate story)
- Individual law breakdown per row — iteration 1 shows totals only

## QA Test Cases

*Story Type: UI — manual verification steps.*

Evidence document: `production/qa/evidence/2-5-dayended-breakdown-evidence.md`

- **AC-1**: Legislation Income row appears
  - Setup: Accept Legalize Gambling (incomeBonus: 25); advance a round
  - Verify: DayEnded modal shows a green "Legislation Income" row with value +25
  - Pass condition: Row is visible, value matches, color is green

- **AC-2**: Legislation Costs row appears
  - Setup: Accept Free Housing Program (expenseBonus: 15); advance a round
  - Verify: DayEnded modal shows a red "Legislation Costs" row with value 15
  - Pass condition: Row is visible, value matches, color is red

- **AC-3**: Rows hidden at zero
  - Setup: No recurring effects active
  - Verify: Inspect DOM — neither "Legislation Income" nor "Legislation Costs" elements exist
  - Pass condition: Row elements not present in DOM (use browser inspector)

- **AC-4**: Net accuracy
  - Setup: Know the treasury before and after `nextRound()`
  - Verify: Net row in DayEnded equals (treasury_after − treasury_before)
  - Pass condition: Values match exactly

- **AC-5**: Display order
  - Setup: Have both recurring income and expense active
  - Verify: Row order is Tax Income → Budget Expenses → Legislation Income → Legislation Costs → ... → Net
  - Pass condition: Order matches spec

## Test Evidence

**Story Type**: UI
**Required evidence**: `production/qa/evidence/2-5-dayended-breakdown-evidence.md` documenting manual walkthrough results for AC-1 through AC-5.

**Status**: [ ] Not yet created

## Dependencies

- Depends on: Story 2-3 must be DONE (`lastRoundRecurringIncome` / `lastRoundRecurringExpenses` written by `nextRound()`)
- Unlocks: Story 2-10 (balance pass includes DayEnded legibility check)
