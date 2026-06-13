# Story 3-4: Stats Screen Enhancements

## Header
- **Story ID**: 3-4
- **Sprint**: 3
- **Status**: Complete
- **Type**: Logic + UI
- **Layer**: Feature
- **TR-ID**: TR-meta-001 (partial — `recordGameEnd` wiring deferred from 3-1)
- **Governing ADR**: docs/architecture/adr-0002-state-management-pattern.md
- **Manifest Version**: N/A (control manifest not yet created)
- **Estimate**: 0.75 days
- **Last Updated**: 2026-06-13

## Summary

Add four tracking fields to `GameStats`, wire `recordGameEnd()` to the game-end
flow, and surface the new data as conditional rows on the EndScreen.

Fields added: `coupGraceFired` (bool), `totalRecurringIncomeEarned` (number),
`totalRecurringExpensesSpent` (number), `repealCount` (number).

Depends on story 3-1 (meta-progression data layer) — Complete.

## Acceptance Criteria

- [ ] `GameStats` type has `coupGraceFired: boolean` — starts `false`, becomes `true` the first round a grace coup roll fires; stays `true` for the rest of the game
- [ ] `GameStats` type has `totalRecurringIncomeEarned: number` — accumulates `financials.recurringIncome` each round
- [ ] `GameStats` type has `totalRecurringExpensesSpent: number` — accumulates `financials.recurringExpenses` each round
- [ ] `GameStats` type has `repealCount: number` — increments by 1 on each successful repeal (failed repeals do NOT increment)
- [ ] All four fields reset to `0` / `false` when a new game starts (setPhase 'start')
- [ ] All four fields persist correctly through `saveGame()` / `loadGame()` (backward-compat default: `false` / `0`)
- [ ] `recordGameEnd(tier, endingId)` called exactly once per game end (victory / lose / special_ending)
- [ ] EndScreen: coup close-call row appears ONLY when `stats.coupGraceFired === true`
- [ ] EndScreen: coup close-call row absent when no grace roll fired during the game
- [ ] EndScreen: recurring income total row shows `$0m` when no recurring effects were active
- [ ] EndScreen: recurring expenses total row shows `$0m` when no recurring effects were active
- [ ] EndScreen: repeal count row shows `0` in a game with no repeals
- [ ] All new EndScreen rows use i18n keys — no hardcoded English text in JSX

## Implementation Notes

### Four new `GameStats` fields

In `src/types/GameState.ts`, extend `GameStats`:

```typescript
export type GameStats = {
    // ... existing fields ...
    /** True from the first round a grace coup roll fires; stays true. */
    coupGraceFired: boolean;
    /** Cumulative recurring income from active laws/deals across all rounds. */
    totalRecurringIncomeEarned: number;
    /** Cumulative recurring expenses from active laws/deals across all rounds. */
    totalRecurringExpensesSpent: number;
    /** Number of successful repeals this run. */
    repealCount: number;
};
```

### Tracking logic in `src/Stores/GameState.ts`

**Initial state** (around line 419) and **new-game reset** (setPhase 'start', around line 467):
```typescript
coupGraceFired: false,
totalRecurringIncomeEarned: 0,
totalRecurringExpensesSpent: 0,
repealCount: 0,
```

**`buildStatsUpdate()`** (around line 741) — add to the returned stats:
```typescript
coupGraceFired: s.stats.coupGraceFired || coupResult.outcome === 'grace',
totalRecurringIncomeEarned: s.stats.totalRecurringIncomeEarned + financials.recurringIncome,
totalRecurringExpensesSpent: s.stats.totalRecurringExpensesSpent + financials.recurringExpenses,
```
`financials` and `coupResult` are already in scope in `nextRound()`.

**`repeal()` function** (around line 966) — inside the success `set()` call, also update stats:
```typescript
stats: {
    ...s.stats,
    repealCount: s.stats.repealCount + 1,
},
```
Place this alongside the existing `gameManagement` update.

**`loadGame()`** backward-compat (around line 1031) — add safe defaults:
```typescript
coupGraceFired: (saved.stats?.coupGraceFired as boolean) ?? false,
totalRecurringIncomeEarned: (saved.stats?.totalRecurringIncomeEarned as number) ?? 0,
totalRecurringExpensesSpent: (saved.stats?.totalRecurringExpensesSpent as number) ?? 0,
repealCount: (saved.stats?.repealCount as number) ?? 0,
```

### Wiring `recordGameEnd` — in `src/components/EndScreen/EndScreen.tsx`

`recordGameEnd` belongs in EndScreen because that component already computes the
tier via `calcTier()` and has access to all required state.

Import the needed utilities:
```typescript
import { recordGameEnd } from '../../Utils/MetaProgress'
import type { EndingId, TierRank } from '../../types/MetaProgress'
```

Read additional store slices needed for endingId computation:
```typescript
const secretRoomIndex = useGameStore(s => s.tabs.secretRoomIndex)
const specialEndingOutcome = useGameStore(s => s.specialEnding.outcome)
```

Compute endingId based on phase:
```typescript
const endingId: EndingId =
    phase === 'special_ending'
        ? (`secret_room_${secretRoomIndex}_${specialEndingOutcome}` as EndingId)
        : phase === 'victory'
        ? 'victory'
        : (endCause ?? 'military') as EndingId
```

Wire the call in a `useEffect` that fires once on mount (EndScreen only renders
when the game has ended):
```typescript
useEffect(() => {
    recordGameEnd(tier.tier as TierRank, endingId)
}, [])  // eslint-disable-line react-hooks/exhaustive-deps
```

This ensures `recordGameEnd` is called exactly once per game end, regardless of
how many times the EndScreen re-renders.

### New EndScreen rows

Add these rows to the existing sections. All new rows use `t()` for labels.

**In the Treasury section** (after the existing rows):
```tsx
<StatRow label={t('endscreen.stats.recurring_income')} value={MoneyNumberFormatter(stats.totalRecurringIncomeEarned)} />
<StatRow label={t('endscreen.stats.recurring_expenses')} value={MoneyNumberFormatter(stats.totalRecurringExpensesSpent)} />
```

**In the Decisions section** (after deals_rejected):
```tsx
<StatRow label={t('endscreen.stats.repeals')} value={String(stats.repealCount)} />
{stats.coupGraceFired && (
    <StatRow label={t('endscreen.stats.coup_grace')} value={t('endscreen.stats.coup_grace_value')} positive={true} />
)}
```

### i18n keys to add

**`public/locales/en/endscreen.json`** — inside `endscreen.stats`:
```json
"recurring_income": "Recurring income",
"recurring_expenses": "Recurring expenses",
"repeals": "Laws repealed",
"coup_grace": "Close call with a coup",
"coup_grace_value": "Survived"
```

**`public/locales/es/endscreen.json`** — inside `endscreen.stats`:
```json
"recurring_income": "Ingresos recurrentes",
"recurring_expenses": "Gastos recurrentes",
"repeals": "Leyes derogadas",
"coup_grace": "Por los pelos con el golpe",
"coup_grace_value": "Sobrevivido"
```

### Important: `repeal()` success path

The existing `repeal()` code already does a `set()` call that updates
`gameManagement`. Add `stats` to that same `set()` call — do NOT add a second
separate `set()` call (two consecutive `set()` calls are not atomic).

## Out of Scope

- Designing the `applyGraceDampening` helper (sprint 4 story)
- Changes to coup threshold constants or grace probability
- Animated or tooltip display of the new EndScreen rows
- Adding recurring fields to the DayEnded panel (separate concern)
- Any i18n namespace other than `endscreen`

## Files to Create / Modify

```
src/types/GameState.ts                     — add 4 fields to GameStats type
src/Stores/GameState.ts                    — initial state, reset, buildStatsUpdate, repeal, loadGame
src/components/EndScreen/EndScreen.tsx     — recordGameEnd wiring + 4 new stat rows
public/locales/en/endscreen.json           — 5 new i18n keys
public/locales/es/endscreen.json           — 5 new i18n keys (Spanish)
tests/unit/stats/stats-enhancements.test.ts — create (new)
```

## QA Test Cases

**Story Type**: Logic + UI — automated unit tests + manual EndScreen inspection
**Test file**: `tests/unit/stats/stats-enhancements.test.ts`
**Evidence file**: `production/qa/evidence/3-4-stats-evidence.md`

### Automated unit tests (~9)

Use `useGameStore.setState()` to seed state, then call store actions and assert
the resulting state. Mock `Math.random` via `vi.spyOn(Math, 'random')` to control
coup roll outcomes (coup RELATION_THRESHOLD = 8, CHARISMA_THRESHOLD = -3,
GRACE_CHANCE = 0.5 — so `Math.random` returning 0.3 forces 'grace').

| # | Test | Expected |
|---|------|----------|
| 1 | Initial `stats.coupGraceFired` | `false` |
| 2 | Initial `stats.totalRecurringIncomeEarned` | `0` |
| 3 | Initial `stats.repealCount` | `0` |
| 4 | `nextRound()` with grace roll (`Math.random = 0.3`, relation 8, charisma -3) | `coupGraceFired = true` |
| 5 | `nextRound()` twice with grace roll — second call | `coupGraceFired` stays `true` |
| 6 | Income law +25 active, `nextRound()` × 1 | `totalRecurringIncomeEarned = 25` |
| 7 | Expense law +15 active, `nextRound()` × 1 | `totalRecurringExpensesSpent = 15` |
| 8 | Successful `repeal()` once | `repealCount = 1` |
| 9 | `repeal()` blocked by `repealTakenThisRound = true` | `repealCount` unchanged |

### Manual EndScreen verification

| # | Scenario | Verification |
|---|----------|--------------|
| 1 | Coup close-call row absent | Play game with no coup trigger — EndScreen has no coup-grace row |
| 2 | Coup close-call row present | Play game where coup danger fires (relation 8+, low charisma) — EndScreen shows "Survived" row |
| 3 | Recurring income total | Accept an income law, play 3 rounds, verify total matches rounds × income |
| 4 | Repeal count | Repeal one law — EndScreen shows repeal count = 1 |
| 5 | All new rows i18n | Switch to ES locale — no raw i18n keys visible |

## Test Evidence

**Story Type**: Logic + UI
**Required test file**: `tests/unit/stats/stats-enhancements.test.ts` — BLOCKING for close
**Manual evidence**: `production/qa/evidence/3-4-stats-evidence.md` — ADVISORY

## Dependencies

- Story 3-1 (Meta-Progression Data Layer) — **Complete** — provides `recordGameEnd()`, `TierRank`, `EndingId`

## Completion Notes
**Completed**: 2026-06-13
**Criteria**: 13/13 passing (UI rows verified via code review; manual EndScreen walkthrough deferred — advisory)
**Deviations**: None
**Test Evidence**: Logic — `tests/unit/stats/stats-enhancements.test.ts` (239/239 pass); UI evidence doc advisory — not created
**Code Review**: Complete — APPROVED WITH SUGGESTIONS (null guard on `specialEndingOutcome`, missing initial-value test for `totalRecurringExpensesSpent` — both applied)
