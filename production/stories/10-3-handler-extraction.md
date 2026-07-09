# Story 10-3: Handler Extraction + set() Atomicity

> **Epic**: Simplification & Debt (Sprint 10)
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Estimate**: 1.0 days
> **Last Updated**: 2026-07-08

## Context

**Source**: [Code Audit 2026-07-08](../../docs/architecture/code-audit-2026-07-08.md) §A4, §E1
**ADR**: ADR-0002 — Handlers are pure functions; forbidden: multiple `set()` calls per logical mutation.

Inline logic to extract: `actUponLaw`'s weird-law path (~90 lines),
`periodicEvent.resolve` + `miniChallenge.resolve` (near-duplicates, ~115 lines),
`shop.buy` (~70 lines). Atomicity: `actUponLaw`/`actUponDeal` call
`handleDecision` (which `set()`s) then `set()` again for stats — a render can
observe the intermediate state.

## Acceptance Criteria

- [ ] **AC-1**: `handleWeirdLaw(state, law, hasAccepted)` pure handler returns the full patch; `actUponLaw`'s weird path becomes one `set()`.
- [ ] **AC-2**: Shared `applyEventEffect(...)` pure handler covers the common core of `periodicEvent.resolve` and `miniChallenge.resolve` (treasury/relations application, extra-income/expense counters, log event, tab unlock); the two actions keep only their genuinely distinct parts (option lookup vs. risk roll).
- [ ] **AC-3**: `handlePurchase(state, item)` pure handler returns a patch (or null for rejected purchase); `shop.buy` becomes lookup + one `set()`.
- [ ] **AC-4**: `handleDecision` refactored to RETURN a patch instead of calling `set()`; `actUponLaw` (normal path) and `actUponDeal` merge it with their stats/extras update into a single atomic `set()`. `EffectHandler`'s other consumers adapted.
- [ ] **AC-5**: All handlers importable without the store (no `Stores/GameState` import), unit-testable with plain state fixtures.

**Regression:**
- [ ] **AC-6**: `npx vitest run` 0 failures (EffectHandler/ActionHandler tests adapted to patch-return in the same story); `tsc -b` clean; build green.
- [ ] **AC-7**: Puppeteer: accept a law, accept a deal, resolve a periodic event, buy a shop item — all still work in the live game.

## Out of Scope
Changing any gameplay values or event content; `specialEnding.use` (left as-is per audit).

## Test Evidence
**Story Type**: Logic — new/extended tests under `tests/unit/` for each extracted handler.
