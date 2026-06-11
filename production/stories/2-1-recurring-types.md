# Story 2-1: Types & Data Model — Recurring Effect Fields

## Header
- **Story ID**: 2-1
- **Sprint**: 2
- **Status**: Ready
- **Type**: Logic
- **Layer**: Foundation
- **TR-ID**: TR-lasting-001
- **Governing ADR**: docs/architecture/adr-0002-state-management-pattern.md
- **Manifest Version**: N/A (control manifest not yet created)
- **Estimate**: 0.5 days
- **Last Updated**: 2026-06-11

## Summary

Add the TypeScript types that every Sprint 2 story depends on:
- `recurringEffect` optional field on `Law` and `Deal` types
- `activeRecurringEffects` array in `gameManagement` store slice
- `repealTakenThisRound` boolean in store
- `lastRoundRecurringIncome` / `lastRoundRecurringExpenses` in store

No runtime behaviour changes in this story — only type definitions and store
shape extension. All existing tests must continue to pass.

## Acceptance Criteria

- [ ] `Law` and `Deal` types accept an optional `recurringEffect?: { incomeBonus?: number; expenseBonus?: number; label: string }` field
- [ ] `gameManagement` store slice includes `activeRecurringEffects: Array<{ sourceId, sourceType, sourceFaction, label, incomeBonus, expenseBonus, roundActivated }>` initialized to `[]`
- [ ] `gameManagement` store slice includes `repealTakenThisRound: boolean` initialized to `false`
- [ ] `gameManagement` store slice includes `lastRoundRecurringIncome: number` and `lastRoundRecurringExpenses: number` initialized to `0`
- [ ] All existing 85+ tests pass after the type changes
- [ ] No import of `GameState.ts` from any new type file (types stay in `src/types/` or co-located with their domain)

## Implementation Notes

### From ADR-0002 (Handler Contract)

New state fields follow the **INITIAL_STATE** pattern — add to the
`gameManagement` slice in the store's initial state factory. Fields must be
JSON-serializable (plain numbers, booleans, arrays of plain objects — no
class instances, no `Set<>`).

### Type file locations

- `recurringEffect` field → extend existing `Law` type in `src/types/Law.ts`
  (or wherever `Law` is currently typed) and `Deal` type similarly
- New `ActiveRecurringEffect` interface → can live in `src/types/GameState.ts`
  alongside other state shape types, or in a new `src/types/Lasting.ts` —
  choose whichever keeps imports clean
- Store fields → extend the `gameManagement` section of `INITIAL_STATE` in
  `src/Stores/GameState.ts`

### ActiveRecurringEffect shape

```typescript
export interface ActiveRecurringEffect {
  sourceId: string;           // e.g. "law-15" — unique per entry; dedup key
  sourceType: 'law' | 'deal' | 'opportunity';
  sourceFaction: Power;       // for repeal relation penalty (Feature 2)
  label: string;              // i18n key shown in DayEnded + Active Legislation
  incomeBonus: number;        // 0 when n/a
  expenseBonus: number;       // 0 when n/a
  roundActivated: number;     // display-only in iteration 1
}
```

### Store additions to gameManagement initial state

```typescript
activeRecurringEffects: [] as ActiveRecurringEffect[],
repealTakenThisRound: false,
lastRoundRecurringIncome: 0,
lastRoundRecurringExpenses: 0,
```

### Reset requirement

`setPhase('start')` (new game reset) must clear these fields to their initial
values. Verify the reset path and add the fields if absent.

## Out of Scope

- **Story 2-2**: Summation logic in `calculateRoundFinancials`
- **Story 2-3**: Writing activation logic in `actUponLaw` / `actUponDeal` / `nextRound`
- **Story 2-4**: Populating actual law/deal content with `recurringEffect` values
- **Story 2-9**: `VisualConsequenceEntry` types (separate registry story)

## QA Test Cases

*Story Type: Logic — automated test specs.*

- **AC-1**: `recurringEffect` field on Law/Deal types
  - Given: TypeScript compiler with the updated type files
  - When: A Law object is created with `recurringEffect: { incomeBonus: 25, label: 'gambling_income' }`
  - Then: No TypeScript error; field is accessible with correct types
  - Edge cases: Optional field absent → no error (undefined is valid)

- **AC-2**: `activeRecurringEffects` initialized to empty array
  - Given: A freshly created store (or reset via `setPhase('start')`)
  - When: `useGameStore.getState().gameManagement.activeRecurringEffects` is read
  - Then: Returns `[]`
  - Edge cases: After reset from non-empty state → still `[]`

- **AC-3**: `repealTakenThisRound` initialized to false
  - Given: Fresh store or post-reset store
  - When: `useGameStore.getState().gameManagement.repealTakenThisRound` is read
  - Then: Returns `false`

- **AC-4**: `lastRoundRecurring*` initialized to 0
  - Given: Fresh store
  - When: `lastRoundRecurringIncome` and `lastRoundRecurringExpenses` are read
  - Then: Both return `0`

- **AC-5**: Existing tests unaffected
  - Given: The existing 85+ test suite
  - When: `npx vitest run` is executed after type changes
  - Then: All existing tests pass; no new failures

## Test Evidence

**Story Type**: Logic
**Required evidence**: Verify the above AC-1..AC-5 are covered. Test file should
check the store's initial state shape and TypeScript compilation. A lightweight
test in `src/types/lasting-effects.test.ts` or equivalent that imports the types
and asserts store initial values satisfies the requirement.

**Status**: [ ] Not yet created

## Dependencies

- Depends on: None — foundational story
- Unlocks: Stories 2-2, 2-3, 2-4, 2-9 (all depend on these types)
