# Story 2-8: Repeal UI — Active Legislation Section in Log

## Header
- **Story ID**: 2-8
- **Sprint**: 2
- **Status**: Complete
- **Type**: UI
- **Layer**: Feature
- **TR-ID**: TR-lasting-008
- **Governing ADR**: docs/architecture/adr-0002-state-management-pattern.md
- **Manifest Version**: N/A (control manifest not yet created)
- **Estimate**: 1.0 day
- **Last Updated**: 2026-06-12

## Summary

Add the "Active Legislation" section to the Log tab and implement the `repeal()`
store action. Players can see all currently active recurring laws, their effect
summaries, and repeal one per round at a tiered treasury + relation cost.

The `repeal()` action is store-side logic; the UI presents it with inline
confirmation (showing both costs before committing).

## Acceptance Criteria

- [ ] Log tab shows "Active Legislation" section (hidden completely when `activeRecurringEffects` is empty)
- [ ] Each active law card shows: law label, round activated, effect summary (e.g. "+25m/round" or "−15m/round"), Repeal button
- [ ] Repeal button shows inline cost before confirming: `"Cost: 25 treasury + −2 People relation"` with Confirm / Cancel
- [ ] `repeal(sourceId)` store action: validates `repealTakenThisRound === false` AND `treasury >= cost`; if valid: deducts treasury, applies relation penalty to `sourceFaction`, removes entry from `activeRecurringEffects`, sets `repealTakenThisRound = true`; runs bankruptcy check immediately after
- [ ] All repeal buttons disabled after one repeal this round (visual feedback)
- [ ] Repeal button disabled with tooltip when treasury < tiered cost
- [ ] Repealing a Small effect costs 15 treasury + −2 relation; Medium: 25 + −2; Large: 40 + −3
- [ ] Tiering is derived from the entry's `incomeBonus` / `expenseBonus` value: |value| ≤ 8 = Small, ≤ 15 = Medium, > 15 = Large
- [ ] Non-recurring laws (no `recurringEffect`) never appear in the Active Legislation section
- [ ] EN + ES i18n strings for section title, card labels, confirm/cancel, cost display

## Implementation Notes

### From ADR-0002 (store access + Handler Contract)

`repeal()` is a store action (not a pure Handler) because it needs to orchestrate
a multi-slice update (treasury + relations + activeRecurringEffects + flag) in a
single `set()` call. Write it directly in the store action map, not in a Handler file.

```typescript
repeal: (sourceId: string) => {
  const state = get()
  const gm = state.gameManagement
  if (gm.repealTakenThisRound) return   // guard: already repealed this round
  const entry = gm.activeRecurringEffects.find(e => e.sourceId === sourceId)
  if (!entry) return
  const tier = getRepealTier(entry)     // Small | Medium | Large
  const cost = GAMESTATE.REPEAL_COST[tier].treasury
  if (state.budget.treasury < cost) return   // guard: insufficient funds
  const relationPenalty = GAMESTATE.REPEAL_COST[tier].relation
  const newRelation = handleRelations({
    power: entry.sourceFaction,
    amount: relationPenalty,
    current: state.relations.current[entry.sourceFaction]
  })
  set((s) => ({
    budget: { ...s.budget, treasury: s.budget.treasury - cost },
    relations: {
      ...s.relations,
      current: { ...s.relations.current, [entry.sourceFaction]: newRelation }
    },
    gameManagement: {
      ...s.gameManagement,
      activeRecurringEffects: s.gameManagement.activeRecurringEffects.filter(e => e.sourceId !== sourceId),
      repealTakenThisRound: true,
    }
  }))
  // Run bankruptcy check (same pattern as after nextRound)
}
```

### Constants to add

```typescript
REPEAL_COST: {
  Small:  { treasury: 15, relation: -2 },
  Medium: { treasury: 25, relation: -2 },
  Large:  { treasury: 40, relation: -3 },
}
```

### Tier derivation helper

```typescript
function getRepealTier(entry: ActiveRecurringEffect): 'Small' | 'Medium' | 'Large' {
  const amount = Math.max(entry.incomeBonus, entry.expenseBonus)
  if (amount <= 8)  return 'Small'
  if (amount <= 15) return 'Medium'
  return 'Large'
}
```

### UI structure

In `src/components/Tabs/Log.tsx` (or whichever file renders the Log tab):

```tsx
{activeRecurringEffects.length > 0 && (
  <section className={styles.activeLegislation}>
    <h3>{t('log.active_legislation')}</h3>
    {activeRecurringEffects.map(entry => (
      <RepealCard key={entry.sourceId} entry={entry} />
    ))}
  </section>
)}
```

`RepealCard` handles the inline confirm/cancel pattern. Keep it as a co-located
sub-component in the same file unless it grows large.

### Inline confirm pattern

No modal — inline expand/collapse on the card:
1. Initial state: Repeal button visible
2. Click Repeal: card expands to show cost summary + Confirm + Cancel buttons
3. Click Confirm: `repeal(entry.sourceId)` called, card disappears
4. Click Cancel: card collapses back to initial state

If `repealTakenThisRound === true`: all Repeal buttons render as disabled with
`title="Already repealed a law this round"`.

### Effect direction in display

Show the sign explicitly: `"+25m/round"` for income, `"−15m/round"` for expense.
Use the `label` i18n key for the law name.

## Out of Scope

- **Story 2-3**: The `repealTakenThisRound` flag and `activeRecurringEffects` in the store
- **Story 2-4**: Actual law content (needed to test with real entries)
- Repeal of one-shot laws (iteration 1 only targets recurring laws)
- Repeal history log (not in this sprint)

## QA Test Cases

*Story Type: UI — manual verification steps. Also includes one logic test for `repeal()` action.*

Evidence document: `production/qa/evidence/2-8-repeal-ui-evidence.md`

- **AC-1**: Active Legislation section appears
  - Setup: Accept Legalize Gambling; navigate to Log tab
  - Verify: "Active Legislation" section visible above or below the log history; card shows "+25m/round" and a Repeal button
  - Pass condition: Section present, card shows correct law name and effect

- **AC-2**: Inline confirm flow
  - Setup: Have an active law; click Repeal
  - Verify: Card expands showing cost (e.g. "Cost: 40 treasury + −3 People relation"); Confirm and Cancel buttons appear
  - Pass condition: Expand works; Cancel collapses without any effect; Confirm removes the card

- **AC-3**: 1-per-round enforcement
  - Setup: Two active laws; repeal one
  - Verify: Second law's Repeal button is disabled; advance round; button re-enables
  - Pass condition: Disabled state correct; re-enables after `nextRound()`

- **AC-4**: Disabled when broke
  - Setup: Treasury below the tier cost of an active law
  - Verify: Repeal button is disabled (or shows a "Insufficient funds" tooltip)
  - Pass condition: Cannot trigger repeal when broke

- **AC-5**: Treasury and relation correctly updated
  - Setup: Active law (e.g. Medium, People faction); note treasury and People relation
  - When: Repeal confirmed
  - Then: Treasury decreased by 25; People relation decreased by 2; law card disappears; effect no longer appears in next DayEnded
  - Pass condition: All three values correct

Logic test for `repeal()` action: `src/Stores/repeal.test.ts`
- Given: Store with `activeRecurringEffects = [Medium law]`, treasury = 100, People relation = +3
- When: `repeal('law-id')` is called
- Then: treasury = 75, People relation = +1, `activeRecurringEffects = []`, `repealTakenThisRound = true`
- Edge cases: Call `repeal()` again same round → no-op (guarded by flag)

## Test Evidence

**Story Type**: UI (primary) + Logic (repeal() action)
**Required evidence**:
- `production/qa/evidence/2-8-repeal-ui-evidence.md` — manual walkthrough for AC-1 through AC-5
- `src/Stores/repeal.test.ts` — repeal() logic unit test (1 test, edge case)

**Status**: [x] Logic test passing — 14/14 (2026-06-12); manual walkthrough doc created, user sign-off PENDING

## Dependencies

- Depends on: Story 2-3 must be DONE (store has `activeRecurringEffects`, `repealTakenThisRound`); Story 2-4 must be DONE (real law entries needed for end-to-end test)
- Unlocks: Story 2-10 (balance pass tests repeal cost vs income gain)

## Completion Notes

**Completed**: 2026-06-12 (implemented autonomously via ui-programmer agent while owner away)
**Criteria**: 10/10 implemented; AC-1..AC-5 manual walkthrough DEFERRED to user sign-off (evidence doc at `production/qa/evidence/2-8-repeal-ui-evidence.md` with pending checkbox list)
**Deviations**: ADVISORY — bankruptcy check folded into the same atomic `set()` as the repeal mutation (story sketch implied a follow-up check; single set is ADR-0002-cleaner and prevents a mid-update zero-treasury render without the lose phase).
**Test Evidence**: Logic — `src/Stores/repeal.test.ts` (14/14 passing); UI — walkthrough doc pending user sign-off
**Code Review**: Complete — APPROVED after fixes (agent's test fixtures mislabeled tier Medium at incomeBonus 25 = Large, corrected; agent's drive-by emoji removals in Log.tsx reverted; bankruptcy set() made atomic)
