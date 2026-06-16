# Story 6-2: ADR-0008 P2 — Replace ActiveRecurringEffect with Modifiers

## Header
- **Story ID**: 6-2
- **Sprint**: 6
- **Status**: Complete
- **Type**: Integration
- **Layer**: Foundation
- **TR-ID**: TR-mod-001, TR-mod-005, TR-mod-006, TR-deals-002
- **Governing ADR**: docs/architecture/adr-0008-timed-modifier-engine.md
- **Manifest Version**: 2026-06-13
- **Estimate**: 2.0 days
- **Last Updated**: 2026-06-16
- **Completed**: 2026-06-16

## Summary

Replace the `ActiveRecurringEffect[]` array with `modifiers` as the single source of truth
for recurring income/expense, the weird-law active slot, and the law pool filter. All deal and
law recurring effects migrate to `roundIncome`/`roundExpense` `ResolvedStatMod` entries.
`nextRound()` banks income by reading `sumModifiers('roundIncome', round)` instead of
`sumRecurringEffects`. Repeal flips `state` to `'rejected'`. One-way save migration included.
The Active-Legislation UI renders from the modifiers array.

## Acceptance Criteria

- [x] `ActiveRecurringEffect` type removed (or deprecated + unused); `activeRecurringEffects` field removed from `gameManagement` store slice
- [x] All deal/law recurring income/expense create `Modifier` entries with `roundIncome`/`roundExpense` `ResolvedStatMod`s at acceptance
- [x] `nextRound()` computes `roundIncome = sumModifiers(mods,'roundIncome',resolvingRound)`, banks into treasury, writes `lastRoundRecurringIncome`, accumulates `stats.totalRecurringIncomeEarned` — **parity** with pre-migration totals
- [x] Weird-law "one active" slot enforced via `modifiers.findIndex(m => m.type === 'weird-law' && m.state === 'active') !== -1`
- [x] `filterLawPool` excludes laws whose `law-recurring` modifier id is active: `modifiers.some(m => m.type === 'law-recurring' && m.id === \`laws.${law.id}\` && m.state === 'active')`
- [x] Repeal flips `state` to `'rejected'` (entry retained as ledger); relation penalty applies to the **proposing faction's base** relation, looked up from the content pool via `modifier.id`
- [x] Repeal tier computed from formula defined in 6-4
- [x] Active-Legislation UI renders from `modifiers.filter(m => m.state === 'active' && isRepealable(m))`
- [x] Save migration: a save with `activeRecurringEffects` is loaded and converted to modifiers; missing `modifiers` field defaults to `?? []`; round-trip save/load preserves all modifier state
- [x] Dedup: re-encountering the same law/deal id while its modifier is `active` no-ops (does not push a second entry)
- [x] Full test suite green; tsc clean; no regression on income/repeal behaviour

## Implementation Notes

*Derived from ADR-0008 §1, §5, §8, Migration Plan P2:*

- **One-way migration** in `loadGame`: if `activeRecurringEffects` is present and `modifiers` is absent/empty, convert
  each `ActiveRecurringEffect` into a `Modifier` with `roundIncome`/`roundExpense` mods using `TIME_MODIFIERS[0]`
  (immediate + permanent = `{startRound: 1, endRound: null}`). Log the migration to the console.
- **`nextRound()` accounting**: `sumModifiers(mods,'roundIncome',round)` replaces `sumRecurringEffects(activeRecurringEffects)`.
  Use the current round (post-increment) as the `round` arg so windows evaluate against the resolving round.
- **Law-pool filter**: `filterLawPool` receives the `modifiers` array; it filters by `m.type === 'law-recurring'` and
  the namespaced id `'laws.N'`.
- **Repeal faction lookup**: `modifier.id` is e.g. `'laws.5'`. Parse the pool index, look up `LAWS[5].power` — that
  is the faction. Never store the faction on the modifier (see ADR-0008 §4 — no content in the engine).
- **Repeal tier**: call `computeRepealTier(modifier.mods)` using the formula from 6-4.
- **Weird-law slot**: after full unification, the sentinel `activeRecurringEffects.find(e => e.sourceType === 'weird-law')`
  is replaced by `modifiers.findIndex(m => m.type === 'weird-law' && m.state === 'active')`.
- **Atomic set**: every mutation (accept → push modifier; repeal → flip state + apply penalty) is a single `set((s) => ({...}))`.

## Out of Scope

- **6-3**: Migrating opportunities, mini-challenges, structures — that is P3.
- **6-1**: Schema/types — must already be DONE before this story starts.
- **6-4**: Repeal formula — must already be DONE before repeal ships in this story.

## QA Test Cases

*Embedded from `production/qa/qa-plan-sprint-6-2026-06-15.md`. Test file: `tests/integration/modifiers/recurring_migration_test.ts`.*

- **AC — Income parity**
  - Given: a migrated deal with `roundIncome +5, permanent` modifier
  - When: `nextRound()` is called
  - Then: `lastRoundRecurringIncome` = 5, `stats.totalRecurringIncomeEarned` += 5, treasury += 5 — identical to pre-migration behaviour

- **AC — Weird-law slot cap**
  - Given: one weird-law modifier with `state:'active'`
  - When: a second weird-law draw triggers
  - Then: draw is skipped (`findIndex !== -1`); no second modifier pushed

- **AC — Law-pool filter**
  - Given: `modifiers` contains `{id:'laws.5', type:'law-recurring', state:'active'}`
  - When: `filterLawPool` runs
  - Then: law with id 5 is excluded from the offered pool

- **AC — Repeal flips state**
  - Given: active `law-recurring` modifier `{id:'laws.3', state:'active'}`
  - When: repeal is triggered
  - Then: `state` → `'rejected'`; entry retained in `modifiers` array (ledger intact); base relation of `LAWS[3].power` faction reduced by tier penalty

- **AC — Save migration round-trip**
  - Given: a save with `activeRecurringEffects: [{incomeBonus:5, sourceType:'normal', ...}]` and no `modifiers`
  - When: `loadGame` is called
  - Then: `activeRecurringEffects` is converted to a `roundIncome +5, permanent` modifier; `modifiers` round-trips through a subsequent save/load with all fields intact

- **AC — Dedup**
  - Given: `modifiers` contains `{id:'deals.1', state:'active'}`
  - When: deal 1 is encountered again
  - Then: no second modifier pushed; existing entry unchanged

- **AC — roundExpense reduces income**
  - Given: `roundIncome +5` and `roundExpense +3` active modifiers
  - When: `nextRound()` banks income
  - Then: net contribution = 2 (income banked = `sumModifiers(income) - sumModifiers(expense)` — or however the accounting is defined; must be consistent with pre-migration behaviour)

## Test Evidence

- **Story Type**: Integration
- **Required evidence**: `tests/integration/modifiers/recurring_migration.test.ts` — exists and passes (7 cases: income parity, roundExpense netting, weird-law slot, law-pool filter, repeal flips state, dedup, legacy migration round-trip); no regression on `tests/unit/laws/weird_laws.test.ts` or income-accounting tests
- **Status**: [x] Created and passing — renamed to `.test.ts` (the repo/vitest glob convention; `_test.ts` is not collected)

## Dependencies

- Depends on: 6-1 (must be DONE — P1 schema required), 6-4 (must be DONE — repeal tier formula required)
- Unlocks: 6-3 (P3 remaining content migration)
