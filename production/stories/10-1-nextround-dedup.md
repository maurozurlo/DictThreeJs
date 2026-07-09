# Story 10-1: `nextRound()` De-duplication — buildGameOverPatch / buildRoundStartPatch

> **Epic**: Simplification & Debt (Sprint 10)
> **Status**: Complete
> **Layer**: Core
> **Type**: Logic
> **Estimate**: 1.5 days
> **Last Updated**: 2026-07-08

## Completion Notes

Implemented as scoped. `RoundResolver.ts` gains `buildResolvedCore`/`buildResolvedGm`
(shared internals), `buildGameOverPatch`, `prepareRoundStart` (frozen-faction restore +
special-ending unlock + RNG draws, order preserved per ADR-0010), and
`buildRoundStartPatch`. Store `nextRound()` reduced from ~275 to ~50 lines: resolve →
coup / three game-over branches / survive, one `set()` each.

**Behavior fix shipped with the unification** (audit-predicted bug class): the normal
branch previously failed to zero `currentRoundBribeCost`/`currentRoundExpropriateGain`/
`currentRoundShopCost` (periodic + game-over branches did), so DayEnded's recap
accumulated across consecutive normal rounds. All five counters now zero on every
branch — pinned red-then-green by `test_nextround_normal_zeroes_all_five_round_counters`.

Test-first: 9 pinning tests in `tests/unit/roundloop/next_round_branches.test.ts`
written and run BEFORE the refactor (8 passed pre-refactor, 1 red = the counter bug).
Suite 713/713, `tsc -b` clean, build green. Puppeteer walkthrough (live dev server,
UI-only driving): New Game → intro dwell → work day → hinge → Month 2 → debug-drained
treasury → bankruptcy Game Over screen. 5/5 checks passed, screenshots reviewed.

## Context

**Source**: [Code Audit 2026-07-08](../../docs/architecture/code-audit-2026-07-08.md) §A1
**ADR Governing Implementation**: [ADR-0002](../../docs/architecture/adr-0002-state-management-pattern.md) — thin store, pure Handlers, one atomic `set()` per action.
**Must not regress**: [ADR-0012](../../docs/architecture/adr-0012-round-loop-phase-split.md) — every branch resets `dwelling: false` and `dayEnded: false`.

`nextRound()` (GameState.ts:798–1074) has six terminal branches. Bankruptcy /
overthrown / victory repeat a ~30-line `gameManagement` patch differing only in
`phase`/`endReason`/`endCause`. Periodic-event / normal repeat ~60 lines differing
only in the `periodicEvent`/`miniChallenge` slices and tab lock. Sprint 9's
`dwelling` flag had to be hand-copied into all six — the bug trap this story removes.

## Acceptance Criteria

- [ ] **AC-1**: Pure `buildGameOverPatch(state, resolution, end)` in `RoundResolver.ts` produces the full store patch for bankruptcy/overthrown/victory; the three store branches each become one `set()` of its result.
- [ ] **AC-2**: Pure `buildRoundStartPatch(state, resolution, drawn)` in `RoundResolver.ts` produces the full store patch for the surviving-round branches; periodic vs normal differences (event slices, tab lock, mini-challenge) passed as parameters, not duplicated.
- [ ] **AC-3**: `nextRound()` in the store is reduced to: `resolveRound` → coup early-return → draw content → pick builder → single `set()` per branch. Target ≤ ~80 lines.
- [ ] **AC-4**: Behavior identical per branch — field-for-field. Coup branch unchanged in behavior. Every branch still resets `dwelling`, `dayEnded`, per-round counters, coup arming, and (game-over branches) preserves the ADR-0012 invariants.
- [ ] **AC-5**: New unit tests pin per-branch field expectations (esp. `dwelling/dayEnded` reset, counter zeroing, `pendingLog` clearing on survive vs. retention semantics on game-over) BEFORE the refactor lands (test-first).

**Regression:**
- [ ] **AC-6**: `npx vitest run` — 0 failures. `tsc -b` exits 0. `npm run build` green.
- [ ] **AC-7**: Puppeteer walkthrough — full round loop + one game-over path.

## Out of Scope
`expireTimer` (10-2), law/deal picker internals (10-4), handler extraction for decisions (10-3).

## Test Evidence
**Story Type**: Logic — automated tests in `tests/unit/roundloop/` (extend existing) + new `tests/unit/roundloop/next_round_branches.test.ts`.
