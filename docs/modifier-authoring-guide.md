# Modifier Authoring Guide

> Practical companion to [ADR-0008](architecture/adr-0008-timed-modifier-engine.md).
> If you've never read the ADR, you can still add a new timed deal in ~30 minutes
> using this guide alone. The ADR explains *why*; this explains *how*.
>
> **Reflects the engine as implemented through P2** (`src/Utils/Modifiers.ts`,
> `src/assets/modifierContent.ts`, `src/assets/ShopItems.ts`). Last verified: 2026-06-16.

The `modifiers` array (`gameManagement.modifiers`) is the **one** place persistent and
time-windowed effects live: statues, recurring law/deal income/expense, the weird-law
slot, and the decision ledger. Reads sum in-window contributions in real time; a couple
of beginning-of-round steps tick the rest. One-shot deltas (the instant treasury/relation
hit when you accept something), risk rolls, and budget-slider nudges are **not** modifiers
— they stay as immediate base mutations in the Handlers.

---

## 1. Quick reference — the 5 fields every Modifier needs at acquisition

```ts
interface Modifier {
  id: string;                  // namespaced + unique: 'deals.16', 'laws.39', 'weird.1001', 'statue.0'
  type: ModifierType;          // discriminator for cheap filter/findIndex
  state: 'active' | 'rejected';// 'active' contributes; 'rejected' is retained ledger, never summed
  acquiredRound: number;       // the round it was created (anchors every window)
  mods: ResolvedStatMod[];     // the contributions (may be empty — e.g. a weird-law slot marker)
  // optional:
  onStartTriggerRound?: number;// resolved round a one-time narrative hook fires
  onStartFired?: boolean;      // fire-once guard across save/load
}

interface ResolvedStatMod {
  stat: ModifierStat;          // what it changes
  amount: number;              // signed contribution
  window: ResolvedWindow;      // { startRound, endRound } — endRound null = permanent
}
```

**`ModifierStat`** (read-through stats only — one-shot treasury/risk/budget keys are NOT here):

| stat | effect |
|------|--------|
| `charisma` | summed on read, re-clamped ±10 |
| `military` / `business` / `people` | faction relation, summed on read, re-clamped ±10 (base still erodes) |
| `roundIncome` | added to treasury each round it's in-window |
| `roundExpense` | subtracted from treasury each round it's in-window |

**`ModifierType`** is just a label for cheap lookups (`countModifiersByType`, the weird-law
slot, the repeal list): `statue`, `structure`, `media`, `deal`, `opportunity`,
`mini-challenge`, `law-recurring`, `weird-law`, `unknown`.

The single read chokepoint is `sumModifiers(modifiers, stat, round)` — gameplay and UI
both go through it (and the effective getters `getEffectiveCharisma` /
`getEffectiveRelation`, which re-clamp). You almost never sum by hand.

---

## 2. Picking a timing — the `TIME_MODIFIERS` registry

You author timing by **id**; at acquisition `resolveWindow(timeId, acquiredRound)` turns it
into a concrete `{ startRound, endRound }`. The resolved window is what gets persisted —
never the id — so re-balancing the registry later can't retroactively change a live save.

`src/Utils/Modifiers.ts`:

```ts
export const TIME_MODIFIERS: TimeModifier[] = [
  { id: 0, delay: 0, duration: null }, // immediate + permanent  (statue, recurring income)
  { id: 1, delay: 0, duration: 1 },    // now, one round         (very common)
  { id: 2, delay: 2, duration: null }, // delayed 2, then permanent (the cattle)
  // …append-only…
];
```

| You want… | Use timing id | Resolves to (acquired at round `r`) |
|-----------|---------------|--------------------------------------|
| permanent from now (statue, recurring income/expense) | `0` | `{ startRound: r, endRound: null }` |
| a one-round bump (relation nudge that fades) | `1` | `{ startRound: r, endRound: r + 1 }` |
| a delayed permanent payoff (the cattle) | `2` | `{ startRound: r + 2, endRound: null }` |

Need a timing that doesn't exist? **Append** a new row (don't edit existing ids — that's a
silent determinism break for content authored against them). `duration: null` = permanent;
`delay: n` = starts `n` rounds after acquisition.

Activity is derived on read with an **exclusive upper bound**:
`isWindowActive(w, round)` is true for `startRound ≤ round < endRound` (permanent once
`endRound` is null). There is no stored `expired` state.

---

## 3. Worked example — the "Miniature Cattle" deal

A single deal that carries **two contributions with independent timing**: a delayed-permanent
income, plus a one-round goodwill bump with the `people` faction.

### Content asset (what you author — `src/assets/deals.ts`)

```ts
{
  id: 19,
  power: 'people',                         // proposing faction (repeal penalty target)
  text: 'deals.19.text', /* …accept/reject text… */
  acceptEffect: { treasury: 15, people: -1 },   // one-shot deltas — applied immediately, NOT modifiers
  rejectEffect: {},
  recurringEffect: { incomeBonus: 5, label: 'deals.recurring.cow_income' },
}
```

> The current `RecurringEffect` shape only models immediate+permanent income/expense
> (timing id 0). To author a *delayed* contribution or a one-round relation bump like the
> full cattle example below, add a richer per-StatMod template to the content type and a
> matching builder in `modifierContent.ts` (see ADR-0008 §3). The runtime shape it must
> produce is shown next.

### Runtime modifier instance (what the engine stores, created on accept in round `r`)

```ts
{
  id: 'deals.19', type: 'deal', state: 'active', acquiredRound: r,
  onStartTriggerRound: r + 2,            // headline fires when the income lands
  mods: [
    { stat: 'roundIncome', amount: 5, window: { startRound: r + 2, endRound: null } }, // time id 2
    { stat: 'people',      amount: 1, window: { startRound: r,     endRound: r + 1 } }, // time id 1
  ],
}
```

Note: the label (`deals.recurring.cow_income`), the proposing faction (`people`), and any
headline key are **not** on the modifier — they live on the deal asset and are looked up by
`id`. The engine instance is content-free.

### Round-by-round (effective values, summed at each round)

| Round | `people` (effective) | `roundIncome` | onStart |
|-------|----------------------|---------------|---------|
| `r`     | base **+1** | 0 | — |
| `r+1`   | base        | 0 | — |
| `r+2`   | base        | **+5** (permanent) | fires `onStart` headline |
| `r+3`+  | base        | +5 | (already fired) |

This matches `isWindowActive` exactly: the one-round `people` window `[r, r+1)` is active
only at `r`; the income window `[r+2, null)` opens at `r+2`. Recurring income is banked at
**round resolution** (`nextRound` sums `roundIncome` at the resolving round), so the cattle's
first +5 lands when round `r+2` resolves.

---

## 4. Recipe — add a new timed deal in 6 steps

1. **Add the content** to `src/assets/deals.ts` with a unique `id`, a `power` (required if it
   carries a `recurringEffect` — it's the repeal penalty target), and a `recurringEffect`
   `{ incomeBonus | expenseBonus, label }`.
2. **Add the i18n** under `public/locales/{en,es}/deals.json` for the deal text and the
   `recurringEffect.label` key. (No emojis in locale files — presentation lives in CSS.)
3. **Nothing else for income/expense** — `buildRecurringModifier` in
   `src/assets/modifierContent.ts` already turns any `recurringEffect` into a `deals.{id}`
   modifier with permanent `roundIncome`/`roundExpense` mods on accept. For *custom timing*
   (delay/duration) or extra stat mods, extend `RecurringEffect` + `buildRecurringModifier`
   to emit the `ResolvedStatMod[]` you need via `resolveWindow(timeId, round)`.
4. **Accept path is already wired**: `EffectHandler.handleDecision` pushes the built modifier
   in a single atomic `set()` and dedups by active id. You don't write store code for a
   plain recurring deal.
5. **Display content** (label + faction) is resolved by `getModifierContent(id)` in
   `modifierContent.ts` — extend the `ns === 'deals'` branch only if you introduce a new id
   namespace.
6. **Test** in `tests/integration/modifiers/` — accept the deal, assert the modifier shape,
   and assert `calculateRoundFinancials(budget, modifiers, round).recurringIncome`.

For a **buyable structure**, follow the statue reference instead: add a row to `STATUES`
(or a new array) in `src/assets/ShopItems.ts` with a `mods` template, and `buildShopModifier`
resolves the window at purchase. Owned counts come from `countModifiersByType`.

---

## 5. Anti-patterns — what NOT to do

- **Don't put content on the modifier.** No labels, headline keys, or faction on the
  `Modifier`. They live on the content asset and are looked up by `id` (`getModifierContent`).
  The engine (`Utils/Modifiers.ts`) imports no content.
- **Don't persist the timing id.** Resolve it to a `window` at acquisition with
  `resolveWindow` and store the window. Persisting the id lets a later registry rebalance
  silently change a live save.
- **Don't edit an existing `TIME_MODIFIERS` row.** Append new ones. Existing content resolved
  against the old numbers.
- **Don't use multiple `set()` calls** for one logical mutation. Build the new `modifiers`
  array and write it in one atomic `set((s) => ({ … }))` (ADR-0002). Repeal, accept, and the
  bankruptcy check all fold into a single `set`.
- **Don't store an `expired` state.** Activity is derived from the window on read. The only
  states are `active` (contributes) and `rejected` (retained ledger, never summed).
- **Don't sum income/relations by hand.** Go through `sumModifiers` /
  `getEffectiveCharisma` / `getEffectiveRelation` so the ±10 re-clamp and window logic stay
  in one place.
- **Don't model one-shot deltas as modifiers.** The instant treasury/relation hit on accept,
  risk rolls, and budget-slider effects are base mutations in the Handlers — not modifiers.
- **Don't double-push on re-encounter.** Dedup by active id
  (`modifiers.some(m => m.id === newId && m.state === 'active')`) — re-accepting a still-active
  law/deal must no-op.
