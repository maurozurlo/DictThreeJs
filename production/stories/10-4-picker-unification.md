# Story 10-4: Picker Unification — swapLaw Drift Fix + pickNextDeal

> **Epic**: Simplification & Debt (Sprint 10)
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Estimate**: 0.5 days
> **Last Updated**: 2026-07-08

## Context

**Source**: [Code Audit 2026-07-08](../../docs/architecture/code-audit-2026-07-08.md) §B1, §A5

`swapLaw` (GameState.ts:227) uses an inline law-picker predating
`RoundResolver.pickNextLaw`: it lacks the sick/eliminated representative exclusion
(drift — a swap can propose a law from an eliminated faction) and the weird-law
roll (intentional to preserve: swaps have never produced weird laws).
The "reset pool when exhausted + draw unique" deal dance is duplicated in
`swapDeal` and both `nextRound` content-draw sites.

**Arbitrated behavior decision**: fix the rep-status drift (bug), keep
`allowWeird: false` on swap (preserves observed behavior).

## Acceptance Criteria

- [ ] **AC-1**: `pickNextLaw` gains an `opts?: { allowWeird?: boolean }` parameter (default true, preserving nextRound behavior); `swapLaw` calls it with `allowWeird: false` and deletes its inline closure.
- [ ] **AC-2**: Swap now excludes laws from sick/eliminated representatives (unit test: eliminate a faction rep, swap repeatedly, assert no law from that faction) and never returns a weird law (unit test with forced RNG).
- [ ] **AC-3**: `pickNextDeal(interactedWithDeals)` in `RoundResolver.ts` encapsulates pool-reset + unique draw; used by `swapDeal` and both `nextRound` draw sites (via 10-1's builders if already landed).
- [ ] **AC-4**: RNG call order within `nextRound` unchanged (ADR-0010 determinism — seeded cursor sequence must not shift for the same seed).

**Regression:**
- [ ] **AC-5**: `npx vitest run` 0 failures; `tsc -b` clean; build green.

## Test Evidence
**Story Type**: Logic — `tests/unit/laws/` + `tests/unit/deals/` additions.
