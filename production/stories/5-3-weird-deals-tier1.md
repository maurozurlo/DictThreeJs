# Story 5-3: Weird Deals Tier 1 — Deals 19–22

## Header
- **Story ID**: 5-3
- **Sprint**: 5
- **Status**: Complete
- **Type**: Logic + Integration
- **Layer**: Feature
- **TR-ID**: N/A
- **Governing ADR**: docs/architecture/adr-0002-state-management-pattern.md
- **Manifest Version**: 2026-06-14
- **Estimate**: 0.75 days
- **Last Updated**: 2026-06-15

## Summary

Add four Tier 1 weird deals (19–22) to the deal pool. These fit the existing
accept/reject/recurring deal shape. Deal 19 adds a RECURRING.TINY (+5/round)
constant. Deal 20 introduces `charismaEffect` on the Deal type for prestige
projects with no faction sponsor. Tier 2 deals (23–28) are blocked on ADR-0007.

## Acceptance Criteria

- [x] Deal 19 (Cows): accept +15 treasury, −1 people, recurring +5/round; reject has no effect
- [x] Deal 20 (Mouse): accept −50 treasury, +2 charisma; no recurring; not repealable (no power)
- [x] Deal 21 (Pigeons): accept +1 military, −1 people; reject no effect
- [x] Deal 22 (Swiss): accept −1 military, +1 people; refuse +1 military, −20 treasury
- [x] All four deals i18n'd EN + ES with `.text`, `.acceptText`, `.rejectText`
- [x] `RECURRING.TINY = 5` constant in `Constants/Costs.ts`
- [x] `charismaEffect?` field on Deal type
- [x] Visual consequence stubs for deals 19, 20, 21 in `visualConsequences.ts`
- [x] No regression on deals 1–18

## Files Created / Modified

```
src/assets/deals.ts                         — deals 19–22 added
src/types/Deal.ts                           — charismaEffect?: number
src/Constants/Costs.ts                      — RECURRING.TINY = 5
src/assets/visualConsequences.ts            — 3 deal stubs added
public/locales/en/deals.json                — deals 19–22 + recurring.cow_income
public/locales/es/deals.json                — same keys in Spanish
tests/unit/deals/weird_deals_tier1.test.ts  — 26 tests (new)
```

## Test Evidence

- **Test file**: `tests/unit/deals/weird_deals_tier1.test.ts` — 26 tests, all pass
- 408/408 total suite tests pass; tsc clean

## Completion Notes
- Completed: 2026-06-15
- Deal 20 intentionally has no `power` field — repeal is moot (no recurring effect, one-time deal)
- `charismaEffect` is read in `EffectHandler.ts` for both laws and deals via duck-typed cast
- Tier 2 deals (23–28) blocked on ADR-0007 (Effect Timing) — target Sprint 6
