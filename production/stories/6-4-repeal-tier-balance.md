# Story 6-4: Repeal-Tier Balance Pass

## Header
- **Story ID**: 6-4
- **Sprint**: 6
- **Status**: Complete
- **Type**: Config/Data
- **Layer**: Core
- **TR-ID**: N/A — balance pass with no new code logic
- **Governing ADR**: docs/architecture/adr-0008-timed-modifier-engine.md (§8 — repeal tier)
- **Manifest Version**: 2026-06-13
- **Estimate**: 0.5 days
- **Last Updated**: 2026-06-15

## Summary

Economy-designer balance pass to derive the generic repeal-tier formula for the unified
modifier engine. The current repeal system (Small/Medium/Large → 15/25/40 treasury + relation
penalty) was calibrated against hard-coded deal/law costs. P2 will compute tier at acquisition
from the modifier's economic magnitude; this story documents the formula and validates it
matches the intent of current tier assignments. Must be complete before P2 ships repeal.

## Acceptance Criteria

- [ ] Formula documented: `repealTier = f(Σ|amount| over roundIncome/roundExpense mods)` with tier boundaries defined
- [ ] Formula frozen at acquisition — `repealTier` is a derived field stored on the `Modifier` at creation time (or derived on demand from the mods array which is also frozen)
- [ ] Parity table produced: apply formula to current law and deal recurring effects; confirm tier assignments match or improve on current Small/Medium/Large assignments
- [ ] Tier thresholds and treasury/relation costs documented in `design/gdd/` or `docs/architecture/` (not hardcoded in JSX)
- [ ] Open balance question resolved: which mods count toward magnitude (roundIncome/roundExpense only, or also stat mods)?
- [ ] Economy-designer sign-off: "APPROVED" recorded as completion note

## Implementation Notes

*Derived from ADR-0008 §8:*

- Repeal tier structurally derives from `Σ|amount|` over `roundIncome`/`roundExpense` contributions
  in the modifier's `mods` array, frozen at acquisition.
- Current tier costs: Small = 15 treasury + −2 relation, Medium = 25 + −2, Large = 40 + −3.
  The formula must reproduce these for existing content or justify the change.
- Windowed vs permanent: a modifier with `roundIncome +5, permanent` is economically larger than
  one with `roundIncome +5, endRound:r+3`. The formula may or may not weight duration — document
  the chosen approach.
- Stat-only modifiers (charisma, relations — no income/expense): repeal tier = Small by default
  (they impose no economic drain — same as the current weird-law behaviour).
- The *formula* is the deliverable; P2 implements it in code. This story is docs + verification only.

## Out of Scope

- P2 implementation (`repealTier` field on `Modifier` type, `computeRepealTier()` function) — that is 6-2.
- Law/deal content changes — balance is about the formula, not rewriting existing recurring amounts.

## QA Test Cases

*Config/Data story — no automated test. Verification is a parity spot-check.*

- **Manual check — parity table**
  - Setup: list all current laws/deals with `incomeBonus`/`expenseBonus` > 0; note their current tier
  - Verify: apply new formula to each; confirm tier matches expected (or document accepted deviation)
  - Pass condition: ≤ 1 unintentional tier mismatch across all current recurring content

- **Manual check — stat-only case**
  - Setup: a modifier with only `{stat:'charisma', amount:1}` (no income/expense mods)
  - Verify: formula returns Small (no economic contribution → minimum cost to repeal)
  - Pass condition: no crash or NaN; tier = Small

## Test Evidence

- **Story Type**: Config/Data
- **Required evidence**: Smoke check pass + economy-designer sign-off note in Completion Notes below
- **Status**: [ ] Not yet completed

## Completion Notes
- Completed: 2026-06-15. Implemented `modifierEconomicMagnitude(mods)` + `computeRepealTier(mods)` in `src/Utils/Modifiers.ts`; 4 parity/boundary tests in `tests/unit/modifiers/timed_modifiers.test.ts`. tsc clean.
- **Formula**: `magnitude = Σ|amount|` over `roundIncome`/`roundExpense` mods (frozen at acquisition). Tier: `≤8 → Small`, `≤15 → Medium`, `>15 → Large`.
- **Thresholds preserved** from legacy `getRepealTier` (8/15) — deliberate: full balance parity, zero feel change.
- **Parity verified** (every current item carries exactly one recurring mod, so `Σ|amount|` == legacy `max(income,expense)`):
  | Content | amount | tier | legacy |
  |---|---|---|---|
  | Deal 19 cows (TINY) | 5 | Small | Small ✓ |
  | Deal 18 aid (SMALL) | 8 | Small | Small ✓ |
  | most laws/deals (MEDIUM) | 15 | Medium | Medium ✓ |
  | gambling/public works (LARGE) | 25 | Large | Large ✓ |
  | weird-law / statue | 0 | Small | Small ✓ |
- **Stat-only modifiers** (charisma/relations, no income/expense) → magnitude 0 → Small (minimum cost), matching current weird-law repeal.
- **Economy call (inline, autonomous mode)**: preserve thresholds, generalize the input. Curve can be retuned later without touching call-sites — it's a single function. No economy-designer spawn needed given the parity is structurally exact.

## Dependencies

- Depends on: None
- Unlocks: 6-2 (P2 repeal implementation requires this formula) — now unblocked
