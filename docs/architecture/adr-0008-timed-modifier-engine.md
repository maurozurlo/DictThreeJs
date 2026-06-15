# ADR-0008: Timed Modifier Engine (Unified Effect System)

## Status

Accepted — 2026-06-15. Design and key decisions confirmed by the owner.
**Full unification**: this engine replaces `ActiveRecurringEffect` and becomes the single
record of accepted/rejected recurring & windowed effects across laws, weird-laws, deals,
opportunities, mini-challenges, and buyable structures. Implemented in phases (P1–P3).
P1 may begin immediately. Supersedes the stat-effect portion of ADR-0007 (see ADR Dependencies).

## Date

2026-06-15

## Last Verified

2026-06-15

## Decision Makers

Mauro Zurlo (owner)

## Summary

Generalises the shipped read-through `Modifier` system into a single **timed modifier engine**
that is the one mechanism for persistent and time-windowed contributions to derived stats
(charisma, the three relations, per-round income/expense). Every effect-bearing content item —
laws, weird-laws, deals, opportunities, mini-challenges, structures — records its outcome as a
`Modifier` in one `modifiers` array, which also serves as the **decision ledger** (replacing the
old per-system tracking and `ActiveRecurringEffect`). Each contribution carries its own timing,
resolved to concrete rounds **at acquisition**; nothing is recomputed later. Reads sum
in-window contributions in real time; a small set of beginning-of-round steps tick the rest.

One-shot, immediate deltas (the treasury/relation hit you see the instant you accept/reject),
probability/risk rolls, and budget-slider nudges remain **base mutations applied at decision
time** — they are not modeled as modifiers.

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Web Platform (browser) |
| **Domain** | Core logic / State management |
| **Knowledge Risk** | LOW — no engine-specific APIs |
| **References Consulted** | None |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | None |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0002 (Handler pattern / single atomic `set`), ADR-0004 (RNG determinism), ADR-0006 (round timer / game loop) |
| **Enables** | Delayed/windowed consequences; uniform Street View + Advisor data source (ADR-0003); simpler content authoring; the decision ledger |
| **Supersedes** | The **stat-based** delayed-effect portion of ADR-0007. ADR-0007's queue narrows to *non-stat* one-shot delayed consequences (delayed base relation/treasury hits, cosmetic triggers). ADR-0007 must be updated. |
| **Related (new)** | **ADR-0009 (planned): Coup Telegraphing & Fairness** — coup reads *effective* relations from this engine; fairness redesign tracked there, not here. |
| **Ordering Note** | P1 has no blockers. P2 replaces `ActiveRecurringEffect` (save-format change). Repeal-tier *numbers* are an open balance item owned by economy-designer (does not block P1). |

## Context

### Problem Statement

Effects in the codebase fall into three structurally distinct classes:

- **A — Instantaneous deltas**: `{ business:+1, treasury:-50 }` applied once to base, then forgotten.
- **B — Per-round economics**: `ActiveRecurringEffect` (income/expense each `nextRound()`).
- **C — Read-through derived-stat bonuses**: the statue (+1 charisma summed on read, never eroded).

The recently shipped `Modifier` system is class C. This ADR extends it with **timing** (covering B
and windowed/delayed C) and unifies all effect-bearing systems onto it, so all per-round and
windowed math is computed uniformly: **read-through during a round**, **resolved once at acquisition**,
and **ticked at beginning-of-round** for the few steps that must (banking income, firing `onStart`).
Class A stays as immediate base mutations in the Handlers.

### Constraints

- Statue behaviour must be byte-identical after P1.
- Base relations keep eroding; modifier contributions are additive on top and **re-clamped to ±10**.
- Determinism (ADR-0004): window activity is pure round arithmetic — no RNG.
- Single atomic `set` per logical mutation (ADR-0002); Scene stays a pure projection (ADR-0003).
- Save/load: persist **resolved windows**, never timing ids; rehydrate with `?? []`.

### Requirements

- One content item may carry **multiple contributions with independent timing** (the cattle example).
- Contributions: immediate+permanent, immediate+windowed, delayed+permanent, delayed+windowed.
- A modifier can fire a one-time narrative hook (newspaper headline) when its payoff lands.
- The `modifiers` array is the decision ledger (what was accepted/rejected/repealed) — no separate `laws[]`/`deals[]` history.
- Cheap filtering by `type` for: the "one weird-law active" slot, law-pool exclusion, and the repeal list.
- Street View and Advisor read the active-modifier list.

## Decision

### 1. Single `modifiers: Modifier[]` array — full unification & decision ledger

`gameManagement.modifiers` replaces `ActiveRecurringEffect[]` and the per-system "what's been decided"
tracking. Laws are **in** (reversing the earlier incremental scoping): every effect-bearing decision
records a `Modifier`. `filter`/`findIndex` over this array is cheap at our scale (≤ ~hundreds of entries
across a ≤100-round run).

### 2. `TIME_MODIFIERS` registry (authoring), resolved windows (persisted), precompute at add-time

Timing is authored by id into a small shared registry (DRY — "immediate, one round" recurs constantly).
**At acquisition, every contribution's window AND any `onStart` trigger round are resolved to concrete
rounds and stored on the instance. Nothing is recomputed afterward.** A later registry rebalance therefore
cannot alter an in-flight save (consistent with content already being id-keyed in saves).

### 3. Per-`StatMod` timing

Timing lives on each `StatMod`, not the `Modifier`, so one deal can carry delayed-permanent income AND a
one-round relation bump together (the cattle example).

### 4. Schema

```ts
// --- Authoring-time registry. Resolved at acquisition; NEVER persisted by id. ---
interface TimeModifier {
  id: number;
  delay: number;            // rounds before contribution starts (0 = immediate)
  duration: number | null;  // rounds active once started; null = permanent
}
const TIME_MODIFIERS: TimeModifier[] = [
  { id: 0, delay: 0, duration: null }, // immediate + permanent (statue, recurring income)
  { id: 1, delay: 0, duration: 1 },    // now, one round (very common)
  { id: 2, delay: 2, duration: null }, // delayed 2, then permanent (the cows)
  // …append-only…
];

// READ-THROUGH stats only. One-shot treasury/risk/budget keys are NOT here.
type ModifierStat =
  | 'charisma'
  | 'military' | 'business' | 'people' // relations — windowed read-through; base still erodes; sum re-clamped ±10
  | 'roundIncome' | 'roundExpense';    // per-round economics (replaces ActiveRecurringEffect)

// Discriminator for cheap filter/findIndex. Drives the weird-law slot + law-pool exclusion + repeal list.
type ModifierType =
  | 'statue' | 'structure'
  | 'deal' | 'opportunity' | 'mini-challenge'
  | 'law-recurring' | 'weird-law';

interface ResolvedWindow { startRound: number; endRound: number | null; } // endRound null = permanent

interface ResolvedStatMod {
  stat: ModifierStat;
  amount: number;
  window: ResolvedWindow; // resolved from a TimeModifier at acquisition
}

interface Modifier {
  id: string;                 // namespaced, e.g. 'deals.1', 'laws.5', 'weird.1001' — dedup key + content lookup key
  type: ModifierType;
  state: 'active' | 'rejected'; // lifecycle/decision ledger. NO 'expired' (timing is derived from windows)
  acquiredRound: number;
  onStartTriggerRound?: number; // resolved at acquisition — the round the content-defined headline fires
  onStartFired?: boolean;     // fire-once guard across save/load
  mods: ResolvedStatMod[];
}
// No content/display fields. The label and headline key live on the content asset
// (Deal/Law/structure) and are looked up by `id` when rendering or firing.
```

- **`id`** is namespaced (`'deals.1'` vs `'laws.1'`) to avoid cross-pool clashes and is the **dedup key** — re-encountering the same content no-ops (preserving today's unique-pool behaviour).
- **`state`**: `'active'` = contributing; `'rejected'` = declined/repealed, retained as ledger history, **not summed**. There is no `'expired'`: a contribution stops counting automatically when `round` leaves its window.
- **No content in the engine.** Labels, headline keys, and any display text live on the content asset (Deal/Law/structure). The engine stores only runtime instance state; the active-effects list, advisor, street-view, and headline firing look content up from the asset by `id`.

### 5. Derived activity & summation (single chokepoint)

```ts
function isWindowActive(w: ResolvedWindow, round: number): boolean {
  if (round < w.startRound) return false;
  return w.endRound === null || round < w.endRound;   // exclusive upper bound
}

function sumModifiers(modifiers: Modifier[], stat: ModifierStat, round: number): number {
  let total = 0;
  for (const m of modifiers) {
    if (m.state !== 'active') continue;
    for (const sm of m.mods)
      if (sm.stat === stat && isWindowActive(sm.window, round)) total += sm.amount;
  }
  return total;
}
// getEffectiveCharisma / getEffectiveRelation / round-income all go through this, then Clamp(±bounds).
```

### 6. Relations: effective reads + re-clamp; which sites switch

Effective relation = `Clamp(base + sumModifiers(...,relationStat,round), RELATIONS.MIN, RELATIONS.MAX)` —
**re-clamped to ±10**, exactly mirroring `getEffectiveCharisma`. Base still erodes via gameplay.

Read-site decision (post-P1):

| Site | Reads | Note |
|------|-------|------|
| Coup armed/warn check (`CoupHandler` caller) | **effective** | a deal that placates a faction genuinely lowers coup risk |
| Overthrow check (`<= MIN`) | **effective** | consistent with coup |
| Special-ending threshold | **effective** | consistent |
| DayEnded coup re-check | **effective** | mirrors coup |
| Displays (ActionPanel/DayEnded/EndScreen) | **effective** | what the player "has" |
| Repeal relation-penalty (`handleRelations`) | **base** | penalty mutates base, not effective |
| Timer-skip penalty target selection | **base** | selecting whom to punish operates on base standing |

Coup's interaction with windowed relation modifiers is part of **ADR-0009 (coup fairness)**; this ADR only
fixes that coup reads *effective* and that the sum is re-clamped.

### 7. `onStart` narrative hook — explicit trigger round, single fire site

The **headline key is content** — it lives on the asset (e.g. the Deal definition), not the modifier. The
engine stores only `onStartTriggerRound` (resolved at acquisition from the content's designated payoff
contribution) and the `onStartFired` guard. The hook is evaluated at **one place**: in `nextRound()` after
the round increment, in the same atomic `set` — for each modifier where `!onStartFired && newRound >=
onStartTriggerRound`, look up the headline key from the asset by `id`, fire it, and set `onStartFired =
true`. For purely-immediate hooks (`onStartTriggerRound <= acquiredRound`) set `onStartFired = true` at
acquisition so the `nextRound()` pass skips them. If a run ends before the trigger round the hook simply
never fires (acceptable — the array clears on new game). A modifier whose content defines no headline has
no `onStartTriggerRound`.

### Worked example — "Miniature Cattle" deal

```ts
// CONTENT — lives in assets/deals.ts (labels, headline, mod template are all content):
// deals[19] = {
//   power: 'people',
//   label: 'deals.19.label',
//   onStart: { headline: 'news.cattle_built', keysOff: 'roundIncome' }, // headline + which mod's start it tracks
//   mods: [ { stat:'roundIncome', amount:5, time:2 },   // delayed 2, then permanent
//           { stat:'people',      amount:1, time:1 } ], // immediate, one round
// }

// RUNTIME modifier instance created on accept in round r (no content fields, windows resolved):
{ id:'deals.19', type:'deal', state:'active', acquiredRound:r, onStartTriggerRound:r+2,
  mods: [ { stat:'roundIncome', amount:5, window:{start:r+2, end:null} },
          { stat:'people',      amount:1, window:{start:r,   end:r+1} } ] }
```
The faction (`people`), label, and headline key all stay in the asset and are looked up by `id`.

| Round | people (effective) | roundIncome | onStart |
|-------|--------------------|-------------|---------|
| `r`   | base **+1**        | 0           | — |
| `r+1` | base               | 0           | — |
| `r+2` | base               | **+5** (permanent) | fires `news.cattle_built` |
| `r+3`+| base               | +5          | (already fired) |

### 8. Law machinery homes (consequence of full unification)

- **Weird-law "one active" slot:** `modifiers.findIndex(m => m.type === 'weird-law' && m.state === 'active') !== -1` before drawing a law.
- **Law-pool exclusion (`filterLawPool`):** filter laws whose recurring counterpart is active: `modifiers.some(m => m.type === 'law-recurring' && m.id === \`laws.${law.id}\` && m.state === 'active')`.
- **Repeal:** flips the modifier's `state` to `'rejected'` (kept as ledger); the relation penalty targets the **proposing faction's base** relation, looked up from the content pool via the modifier's `id` (e.g. `'laws.5'` → `LAWS[5].power`). No faction is stored on the modifier — the pool is the source of truth.
- **Repeal tier (cost):** **open balance item — owned by economy-designer.** Structurally, tier derives from the economic magnitude of the modifier's mods (e.g. `Σ|amount|` over `roundIncome`/`roundExpense`), frozen at acquisition; the *numbers/curve* need a balance pass before P2 ships repeal.
- **Active-Legislation / repeal UI:** renders from `modifiers.filter(state==='active' && repealable)` — one source for laws + deals + structures.

## Alternatives Considered

- **Persist the timing id, re-resolve on load** — rejected: a registry rebalance would retroactively change live saves (silent determinism break). We persist resolved windows.
- **Per-`Modifier` timing (one window)** — rejected: cannot express the cattle deal (delayed income + one-round relation bump) without fragmenting one decision into two modifiers, breaking the one-decision→one-repeal→one-ledger-entry mapping.
- **Stored `state:'expired'` / per-round expiry pass** — rejected: activity is derived from resolved windows on read; a stored expiry flag is a second source of truth to reconcile each round.
- **Incremental scope (laws stay on `ActiveRecurringEffect`)** — considered and initially recommended, but rejected by the owner in favour of full unification: two parallel persistent-effect systems are messier than one, and uniform math eases Street View / Advisor and content authoring. The cost (re-homing law repeal-tier / pool / slot machinery) is accepted and specified above.
- **ADR-0007 queue for stat effects** — superseded for stat contributions; ADR-0007 retained only for non-stat one-shot delayed consequences.

## Consequences

### Positive

- One declarative engine + one array (also the decision ledger) for all recurring/windowed effects.
- New timed content is pure data — zero handler changes.
- Street View + Advisor read one `getVisibleModifiers(modifiers, round)` list (ADR-0003 projection).
- Cheap `type`-keyed lookups replace bespoke slot/pool tracking.
- Delayed payoff headlines are first-class.

### Negative

- Largest blast radius of the options: laws, repeal, pool, weird-law slot, recurring economics, and the Active-Legislation UI all move at once (phased to contain risk).
- Save-format change (replacing `ActiveRecurringEffect`); needs a one-way migration.
- Repeal-tier balance must be re-derived for the generic model before P2 repeal ships.

### Neutral

- Relations gain a base/effective split mirroring charisma; base erosion unchanged.
- One-shot deltas, risk rolls, budget-slider effects remain base mutations in the Handlers.

## Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Effective relations into coup change balance/feel | High | Med | Deliberate (see §6); pin with tests; fairness handled in ADR-0009 |
| Effective relation sum exceeds ±10 invariant | Med | Med | Re-clamp after summation (§5/§6), mirroring charisma |
| Persisting timing id alters live saves | Med | High | Persist resolved windows only (§2) |
| Window off-by-one | Med | Med | Single `isWindowActive` (`round < endRound`) + boundary tests |
| `onStart` double-fire across save/load | Med | Low | `onStartFired` guard + single fire site in `nextRound()` (§7) |
| Repeal-tier numbers wrong for generic model | Med | Med | Owned by economy-designer; blocks only P2 repeal, not P1 |
| Modifier `id` not resolvable to a pool entry (faction lookup) | Low | Med | `id` namespace maps 1:1 to a content pool; repeal looks up faction by id; covered by a parse/lookup test |
| Dedup vs stacking regression | Low | Med | Namespaced `id` is the dedup key; re-encounter no-ops |

## Performance Implications

| Metric | Before | Expected After | Budget |
|--------|--------|---------------|--------|
| `sumModifiers` per read | n/a | O(mods) over a small array, ×read sites | ≤5ms round-resolution — negligible |
| Registry lookup | n/a | acquisition-time only | Negligible |
| Memory | Baseline | +<a few KB (resolved windows + ledger) | Negligible |

## Migration Plan

- **P1 — Schema + charisma/relations windowing (low risk; statue byte-identical).**
  1. Add `TimeModifier`/`TIME_MODIFIERS`, `ResolvedWindow`, `ResolvedStatMod`; extend `Modifier` (`type`, `state`, `sourceFaction?`, `onStartTriggerRound?`).
  2. `sumModifiers`/effective getters take `round` + skip non-`active`; add `isWindowActive`.
  3. Statue → `{delay:0,duration:null}`, `state:'active'` — identical behaviour.
  4. Add `getEffectiveRelation` (re-clamped) and switch the §6 sites to effective; add tests for coup/overthrow/special-ending.
  5. `onStart` fire site in `nextRound()` (single atomic `set`).
  6. Save/load: rehydrate `?? []`, default missing windows to permanent.
- **P2 — Replace `ActiveRecurringEffect`.** Migrate deal/law recurring income/expense to `roundIncome`/`roundExpense` modifiers; `nextRound()` computes `roundIncome = sumModifiers(mods,'roundIncome',resolvingRound)`, banks it into treasury, writes `lastRoundRecurringIncome`, accumulates `stats.totalRecurringIncomeEarned` (replacing `sumRecurringEffects`); weird-law slot via `findIndex`; `filterLawPool` via filter; repeal flips `state` (tier numbers from economy-designer); Active-Legislation UI from the array.
- **P3 — Consumers + remaining content.** Opportunities/mini-challenges/structures onto modifiers; Street View + Advisor read `getVisibleModifiers`; finalise coup-reads-effective with ADR-0009; update ADR-0007 to non-stat-only.

**Rollback:** P1 is additive; revert by removing timing fields (statue → permanent). Windowed saves degrade gracefully.

> **P1 implemented 2026-06-15** (`src/Utils/Modifiers.ts`, `src/types/GameState.ts`, `src/Stores/GameState.ts`).
> Engine: `TIME_MODIFIERS` + `resolveWindow`, `isWindowActive`, round-aware `sumModifiers`,
> `getEffectiveCharisma`/`getEffectiveRelation` (re-clamped ±10), `fireOnStartModifiers`, `normalizeModifier`.
> Coup/overthrow/special-ending switched to effective relations; statue byte-identical (regression green;
> 429/429 suite, tsc clean). **Two deliberate P1 deferrals (provably no-ops until content/relation modifiers exist):**
> (1) **Relation displays** (ActionPanel/DayEnded/EndScreen) still read base relations — charisma already reads
> effective everywhere; relation effective-display lands in P2/P3 when the first relation modifier ships (until
> then effective == base). (2) **`onStart` headline firing** — the fire-once *guard* is wired in `nextRound()`,
> but the headline-key lookup by content id is deferred to P2/P3 (no content carries an `onStart` key yet, so
> `fired` is always empty in P1). `Power` is typed as `string` (const array not `as const`), so
> `getEffectiveRelation` accepts `Power` and casts to `ModifierStat` internally.

## Validation Criteria

- [ ] Statue behaviour identical after P1 (`statue_charisma.test.ts` passes).
- [ ] `{stat:'people',amount:1,time:1}` raises effective people for exactly one round; effective sum re-clamped at ±10.
- [ ] `{stat:'roundIncome',amount:5,time:2}` contributes 0 for two rounds, then +5/round.
- [ ] `onStart` fires exactly once at `onStartTriggerRound`, surviving a mid-window save/load; never fires if the run ends first.
- [ ] Editing `TIME_MODIFIERS` does not change a loaded save's behaviour.
- [ ] Coup/overthrow/special-ending read effective relations (pinned by tests); repeal penalty + timer-skip target read base.
- [ ] Weird-law slot enforced via `findIndex` on `type==='weird-law'`; `filterLawPool` excludes active `law-recurring` ids.
- [ ] Repeal flips `state` to `'rejected'` (entry retained) and applies the base penalty to the proposing faction looked up by `id`.
- [ ] One-shot treasury/relation deltas, risk rolls, and budget-slider effects unchanged.

## GDD Requirements Addressed

| GDD Document | System | Requirement | How This ADR Satisfies It |
|-------------|--------|-------------|--------------------------|
| `design/gdd/weird-deals.md` | Deals (delayed) | Consequences N rounds after acceptance | `time` id with `delay>0` → resolved delayed window |
| `design/gdd/weird-deals.md` | Recurring deals/laws | Per-round income/expense | `roundIncome`/`roundExpense` modifiers (replaces `ActiveRecurringEffect`) |
| Visual update (Street View) | Scene projection | Show what's active in the city | `getVisibleModifiers(modifiers, round)` single source (ADR-0003) |
| Advisor | Reactions | React to active effects | Advisor reads the same active-modifier list |

## Related

- ADR-0002 — Handler pattern / single atomic `set`
- ADR-0003 — React / Three.js integration (Street View projection)
- ADR-0004 — RNG determinism (window activity is pure round math)
- ADR-0006 — round timer / game loop (`nextRound()` ticks windows + fires `onStart`)
- ADR-0007 — end-of-round effect timing (now scoped to non-stat delayed consequences; must be updated)
- ADR-0009 (planned) — Coup Telegraphing & Fairness (coup reads effective relations from this engine)
- `src/Utils/Modifiers.ts`, `src/types/GameState.ts` — current class-C implementation this extends
