# Story 5-2: Weird Laws — 14-Law Pool Implementation

## Header
- **Story ID**: 5-2
- **Sprint**: 5
- **Status**: Complete
- **Type**: Logic + Integration
- **Layer**: Feature
- **TR-ID**: N/A
- **Governing ADR**: docs/architecture/adr-0002-state-management-pattern.md
- **Manifest Version**: 2026-06-14
- **Estimate**: 1.0 days
- **Last Updated**: 2026-06-15

## Summary

Implement the weird law system: a 14-law pool proposed by faction `???` that
triggers at 10% probability per round when no weird law is currently active.
Accepting applies a one-time effect; rejecting costs nothing. Weird laws are
repealable at standard tier cost (always Small, since incomeBonus = 0).

## Acceptance Criteria

- [x] Weird law appears with ~10% frequency per round when no weird law is active (seeded test)
- [x] At most one weird law active at a time — second trigger skipped while one is active
- [x] Reject carries no relation penalty and no other consequence
- [x] Weird law is repealable at standard tier cost (Small = 15 treasury)
- [x] Repeal frees the active-weird-law slot for future rounds
- [x] `activeRecurringEffects` array updated on accept; sourceType = 'weird-law'
- [x] All 14 law names, descriptions, accept/reject strings i18n'd (EN + ES)
- [x] Weird laws appear in Log tab as `Law Proposal by ???`
- [x] Visual consequence stubs (≥12 entries) registered in `visualConsequences.ts`
- [x] charismaEffect applied on accept for laws 1004 and 1012
- [x] weird-law entries excluded from `sumRecurringEffects` (no recurring income/expense)
- [x] repeal of weird-law skips relation penalty (??? is not a real faction)

## Files Created / Modified

```
src/assets/weirdLaws.ts              — 14-law WEIRD_LAWS array (new)
src/types/Law.ts                     — type?: 'normal' | 'weird'; charismaEffect?
src/types/GameState.ts               — sourceType: 'weird-law' in ActiveRecurringEffect
src/Stores/GameState.ts              — trigger logic (10%, slot check), actUponLaw weird path
src/Stores/BudgetHandler.ts          — sumRecurringEffects excludes 'weird-law' sourceType
src/assets/visualConsequences.ts     — 14 weird-law visual stubs added
public/locales/en/laws.json          — laws.weird.{id}.{label,description,accept,reject}
public/locales/es/laws.json          — same keys in Spanish
tests/unit/laws/weird_laws.test.ts   — 18 tests (new)
```

## Test Evidence

- **Test file**: `tests/unit/laws/weird_laws.test.ts` — 18 tests, all pass
- 408/408 total suite tests pass; tsc clean

## Completion Notes
- Completed: 2026-06-15
- Weird law IDs use 1001–1014 to avoid collisions with normal law IDs (0–44)
- `power: 'people'` is a placeholder on all weird laws — never used for repeal penalty (??? faction has no relation)
- Repeal tier is always Small because `incomeBonus = 0` and `expenseBonus = 0` (no recurring effect)
