# Story 8-1: Budget Projection Breakdown

> **Epic**: Budget UX
> **Status**: Not Started
> **Layer**: Feature
> **Type**: UI
> **Estimate**: 0.5 days
> **Manifest Version**: 2026-06-13
> **Last Updated**: 2026-06-22

## Context

**GDD**: `design/gdd/game-concept.md`
**Requirement**: `TR-budget-002`
*(Requirement text lives in `docs/architecture/tr-registry.yaml`)*

**ADR Governing Implementation**: [ADR-0008: Timed Modifier Engine](docs/architecture/adr-0008-timed-modifier-engine.md)
**ADR Decision Summary**: Treasury-stat modifiers (time:1) are deferred to `nextRound()` and are not reflected in the current budget display. This story makes them visible by extending `calculateRoundFinancials` to return law/deal treasury deltas and including them in the Budget tab's itemised projection.

**Secondary ADR**: [ADR-0002](docs/architecture/adr-0002-state-management-pattern.md) — UI reads store state; no mutations in this story.

**Engine**: React 19 + TypeScript | **Risk**: LOW — read-only UI change; touches `BudgetHandler` return type and `Budget.tsx`.
**Engine Notes**: `calculateRoundFinancials` is called by `Budget.tsx` and possibly by other sites (grep before changing its return type). Existing callers that destructure only the fields they use will be unaffected by adding new fields.

**Control Manifest Rules (Feature layer)**:
- Required: Subscribe to minimum required Zustand slice via `useGameStore(selector)`.
- Required: All player-facing text goes through `i18next`.
- Forbidden: Gameplay logic in React components — computation belongs in `BudgetHandler`.

---

## Acceptance Criteria

**`calculateRoundFinancials` extension:**
- [ ] **AC-1**: `RoundFinancials` type includes two new fields: `lawTreasuryDelta: number` and `dealTreasuryDelta: number` — the summed treasury-stat modifier contributions from `law-recurring` and `deal` type modifiers respectively, at the current round.
- [ ] **AC-2**: `calculateRoundFinancials` computes `lawTreasuryDelta = sumModifiers(modifiers.filter(law-recurring), 'treasury', round)` and `dealTreasuryDelta = sumModifiers(modifiers.filter(deal), 'treasury', round)`.
- [ ] **AC-3**: `netChange` in `RoundFinancials` includes `lawTreasuryDelta + dealTreasuryDelta` so it reflects the true projected treasury change for the next round.

**Budget tab display:**
- [ ] **AC-4**: The Budget tab side panel replaces the current `in / out / net` summary with the following itemised list (rows hidden when value is 0):
  - **Taxes** — `totalIncome` (positive, green)
  - **Expenses** — `expenses` (negative, red)
  - **Recurring Income** — `recurringIncome` (positive, green; hidden when 0)
  - **Recurring Expense** — `recurringExpenses` (negative, red; hidden when 0)
  - **Law Effects Next Round** — `lawTreasuryDelta` (signed, coloured by sign; hidden when 0)
  - **Deal Effects Next Round** — `dealTreasuryDelta` (signed, coloured by sign; hidden when 0)
  - **Total** — `netChange` (bold, signed, coloured by sign; always shown)
- [ ] **AC-5**: `rounds_left` warning beneath Total uses the updated `netChange` (already the case if AC-3 is implemented).
- [ ] **AC-6**: All row labels are i18n keys in the `menu` namespace (EN + ES).

**Regression:**
- [ ] **AC-7**: `npx vitest run` — 0 new failures. Existing `BudgetHandler` tests that assert on `netChange` must be updated if their fixture modifiers include treasury specs.
- [ ] **AC-8**: `tsc -b` exits 0.

---

## Implementation Notes

### Separating treasury mods by type

`sumModifiers` operates on the full modifier array. To get per-type deltas, filter first:

```ts
const lawMods  = modifiers.filter(m => m.type === 'law-recurring' && m.state === 'active');
const dealMods = modifiers.filter(m => m.type === 'deal'          && m.state === 'active');
const lawTreasuryDelta  = sumModifiers(lawMods,  'treasury', round);
const dealTreasuryDelta = sumModifiers(dealMods, 'treasury', round);
```

Keep this logic inside `calculateRoundFinancials` (not the component) so the computation is testable and the UI stays a thin display layer.

### Row ordering and hiding

Show rows in the order listed in AC-4. Hide a row entirely (do not render it at all) when its value is 0 — avoids clutter when the player has no active law/deal effects. The Total row is always shown.

### i18n keys to add

```json
// public/locales/en/menu.json
"budget.taxes":               "Taxes",
"budget.expenses":            "Expenses",
"budget.recurring_income":    "Recurring Income",
"budget.recurring_expense":   "Recurring Expense",
"budget.law_effects":         "Law Effects (next round)",
"budget.deal_effects":        "Deal Effects (next round)",
"budget.total":               "Total"
```

---

## Out of Scope

- Showing individual law/deal names in the breakdown (just the summed delta per type)
- Changing the main body of the Budget tab (expenditure sliders, tax sliders)
- Advisor budget verdict/trigger changes
- `computeRoundsLeft` signature changes

---

## QA Test Cases

- **AC-3**: Accept a law with `acceptMods: [{ stat:'treasury', amount:-50, time:1 }]` → `calculateRoundFinancials` returns `lawTreasuryDelta: -50` and `netChange` is 50 lower than without the law.
- **AC-4 visual**: Budget tab shows "Law Effects (next round): -50" row after accepting such a law; row absent before any law with treasury spec.
- **AC-5**: `rounds_left` warning updates immediately after law accept.
- **AC-7**: Run `npx vitest run` — confirm 0 failures.

---

## Test Evidence

**Story Type**: UI
**Required evidence**: Manual walkthrough doc at `production/qa/evidence/8-1-budget-projection-evidence.md`
- Accept a law with a treasury hit; open Budget tab; confirm "Law Effects (next round)" row appears with correct value.
- Advance round; confirm row disappears (window expired).
- Verify Total matches hand-calculated net.

---

## Dependencies

- Depends on: Story 7-8 DONE (treasury mods exist in the modifier engine) ✓
- Unlocks: Story 8-2 (the pre-commit confirmation can reference the projected net)
