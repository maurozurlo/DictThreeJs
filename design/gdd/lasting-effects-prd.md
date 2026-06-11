# PRD: Lasting Effects, Law Repeal, Coup & World Consequences

**Status:** Approved (sprint scope) / Spec-level (future scope)
**Date:** 2026-06-11
**Authors:** game-designer + economy-designer agents, decisions by studio owner
**Sprint:** 2

---

## Decision Log (owner-approved)

| Decision | Value | Rationale |
|---|---|---|
| Sprint scope | Lasting effects, repeal, DayEnded breakdown, coup, visual scaffolding | Owner selection |
| Lasting effect amounts | Fixed per law/deal (no scaling) | Keep iteration 1 simple |
| Effect tiers | Small ±8, Medium ±15, Large ±25 per round | Economy-designer calibration vs −68/round baseline |
| Stack cap | **None** — pool weighting instead (max 3 lasting-income laws per run) + steeper relation costs on income laws (−2 to opposing faction) | Owner chose organic over hard cap; mitigations baked in |
| Repeal cost | **Tiered**: 15/25/40 treasury + −2/−2/−3 relation to proposing faction (S/M/L) | Repealing a big law should cost more |
| Repeal frequency | Max 1 per round, optional | Owner spec |
| Repeal scope | Recurring-effect laws only (iteration 1) | Nothing to remove on one-shot laws |
| Coup trigger | Faction relation ≥ +8 AND charisma ≤ −3 | Only punishes aggressive expropriate/eliminate play; default-charisma players safe |
| Coup grace | 50% chance first trigger round, 100% the next | Player gets a possible reprieve, never relies on it |
| Coup timing | Fires at START of round-advance (`nextRound()`), before financials | Full round to react after the red warning |
| Special ending interplay | +10 @ R9 with charisma ≥ 0 = special ending; charisma −1..−2 at +10 = dead zone (nothing fires) | Both outcomes coexist, gated by charisma |
| Advisor dialogue | Hybrid: generic templates + hand-written for ~10 key decisions | Owner choice |
| Advisor level-0 tone | **Systematically** wrong (always inverted), not randomly wrong | Funnier on repeat; inverting his advice is a discoverable skill |
| Budget tier delay | Penalties delayed 1 round; benefits immediate | Grace period for mistakes, instant gratification for investment |

---

## Feature 1: Lasting Effects System (SPRINT)

### Overview
Laws, deals, and opportunities can carry a `recurringEffect` that fires every round
while active. Distinct from existing one-time treasury deltas. Effects stack
additively and resolve during round financial calculation, before DayEnded opens.
Fixed amounts only in iteration 1.

### Player Fantasy
The player passes a gambling law and feels casino money rolling in every round —
until a recurring expense law starts bleeding them and they must choose between
the relation hit of repeal or the slow drain. The game gains memory: past
decisions shape present options.

### Detailed Rules

**Data model — new optional field on `Law` and `Deal`:**

```typescript
recurringEffect?: {
  incomeBonus?: number;   // added to treasury each round
  expenseBonus?: number;  // subtracted each round
  label: string;          // i18n key, shown in DayEnded + Active Legislation
}
```

**New store state in `gameManagement`:**

```typescript
activeRecurringEffects: Array<{
  sourceId: string;        // "law-15" / "deal-9" — unique, dedup + repeal lookup
  sourceType: 'law' | 'deal' | 'opportunity';
  sourceFaction: Power;    // for repeal relation penalty
  label: string;
  incomeBonus: number;     // 0 if n/a
  expenseBonus: number;    // 0 if n/a
  roundActivated: number;  // display only in iteration 1
}>
```

- **Activation:** on `actUponLaw(true)` / deal accept, push entry if `recurringEffect` exists. Duplicate `sourceId` = no-op.
- **Deactivation:** only via repeal (Feature 2). Otherwise persists to game end.
- **Save/load:** plain data, serialize in save payload, restore on load.
- **Reset:** cleared on `setPhase('start')`.

### Formulas

```
recurringIncome   = Σ incomeBonus over activeRecurringEffects
recurringExpenses = Σ expenseBonus over activeRecurringEffects
netChange         = totalIncome + recurringIncome − expenses − recurringExpenses
```

`calculateRoundFinancials` gains the `activeRecurringEffects` parameter and the
two new return fields. **The Budget tab forecast (net/round + rounds-left) MUST
use the updated net** — otherwise it predicts bankruptcies that won't happen
(blocking correctness requirement from balance review).

### Content — iteration 1 entries (9)

Numbers are tier-snapped baselines; tune in `assets/laws.ts` / `assets/deals.ts`, never hardcode.

| ID | Source | Name | Faction | One-time effect | Recurring |
|----|--------|------|---------|-----------------|-----------|
| L-A | Law | Legalize Gambling | Business | business +1, **people −2** | +25/round (Large) |
| L-B | Law | Free Housing Program | People | people +2, treasury −30 | −15/round (Medium) |
| L-C | Law | Military Contractor Deal | Military | military +1, treasury −20 | −15/round (Medium) |
| L-D | Law | State Media Monopoly | Military | military +1, **people −2** | +15/round (Medium) |
| L-E | Law | Export Tariff Reform | Business | business +1, **people −2** | +15/round (Medium) |
| L-F | Law | Public Works Program | People | people +1, business +1, treasury −30 | −25/round (Large) |
| D-A | Deal | Foreign Investment Contract | Business | treasury +40, business +1 | +15/round (Medium) |
| D-B | Deal | Arms Supplier Contract | Military | military +2, treasury −30 | −15/round (Medium) |
| D-C | Deal | Humanitarian Aid | People | people +2, business −1 | −8/round (Small) |

**No-cap mitigations (mandatory):**
1. Lasting-**income** laws carry −2 (GAINS.MEDIUM) to the opposing faction, not −1.
2. Law pool weighting: at most **3** lasting-income laws may appear in a single run.

### Edge Cases
- Pool reset re-offers a recurring law → one-time effect can re-apply; recurring entry deduped by `sourceId`.
- Rejection never activates a recurring effect.
- Recurring expenses can bankrupt — intentional; existing `newTreasury <= 0` check handles it.
- Effects stop mattering at terminal phase; no cleanup needed.

### Dependencies
`types/Law.ts`, `types/Deal.ts`, `types/GameState.ts`, `Stores/GameState.ts`
(actUponLaw, actUponDeal, nextRound, setPhase), `Stores/BudgetHandler.ts`,
`assets/laws.ts`, `assets/deals.ts`, `Utils/SaveLoad.ts`. Features 2 & 3 depend on this.

### Tuning Knobs
| Knob | Default | Range |
|---|---|---|
| Small/Medium/Large income | +8/+15/+25 | 5–50 |
| Small/Medium/Large expense | −8/−15/−25 | 5–40 |
| Max lasting-income laws per run | 3 | 2–6 |

### Acceptance Criteria
- [ ] Passing a recurring law adds exactly one entry; deal accept same
- [ ] `calculateRoundFinancials` returns correct recurring sums (unit tests: zero/income-only/expense-only/mixed)
- [ ] Treasury changes by correct net including recurring effects
- [ ] Empty at game start and after reset; save/load round-trips
- [ ] Same law twice (pool reset) does not double the effect
- [ ] Playtest: player can explain unprompted why income changed between rounds

---

## Feature 2: Law Repeal (SPRINT)

### Overview
Laws in `activeRecurringEffects` can be repealed from the Log tab — max 1/round,
optional, immediate effect. Costs treasury + relation with the proposing faction,
tiered by the law's effect size.

### Detailed Rules
- **Where:** Log tab, new "Active Legislation" section below log history. Card per active law: label, active-since round, effect summary, Repeal button.
- **Cost (tiered):** Small 15 treasury / −2 relation; Medium 25 / −2; Large 40 / −3. Flat over time (no scaling with rounds active).
- **Frequency:** `repealTakenThisRound: boolean` in store; reset in `nextRound()`. All repeal buttons disabled after one use.
- **Confirmation:** inline (no modal) showing both costs before commit.
- **Insufficient treasury:** button disabled with explanation.
- **`repeal(sourceId)` store action:** validate flag → deduct treasury → apply relation penalty to `sourceFaction` → remove entry → set flag → bankruptcy check (immediate). Overthrow check stays at round end (one final round to recover).

### Edge Cases
- Same-round repeal of a just-passed law: allowed (valid panic move; relation cost still applies).
- Proposing faction was Eliminated: penalty still applies to their reset relation.
- Round 10 repeal: allowed; avoids the final recurring tick.
- No active laws: section hidden.

### Tuning Knobs
| Knob | Default | Range |
|---|---|---|
| Treasury cost S/M/L | 15/25/40 | 10–80 |
| Relation penalty S/M/L | −2/−2/−3 | −1 to −3 |
| Repeals per round | 1 | 1–2 |

### Acceptance Criteria
- [ ] Repeal removes entry immediately; next financial calc excludes it
- [ ] Correct tiered treasury + relation deductions
- [ ] One repeal per round enforced; flag resets next round
- [ ] Button disabled when treasury < cost
- [ ] Non-recurring laws never appear in the list
- [ ] Playtest: no player surprised by the relation hit (else strengthen confirm UX)

---

## Feature 3: DayEnded Breakdown (SPRINT)

### Overview
Extend the DayEnded modal with recurring and one-time line items. Rows with
value 0 are hidden.

### Display order
1. Tax Income (existing, green)
2. Budget Expenses (existing, red)
3. **Legislation Income** (NEW — recurring, green) — `lastRoundRecurringIncome`
4. **Legislation Costs** (NEW — recurring, red) — `lastRoundRecurringExpenses`
5. **One-time Income** (existing extras, relabeled — deals/laws/events this round)
6. **One-time Expenses** (existing extras, relabeled)
7. Net (existing, color-coded)

### Formulas
```
net = taxIncome + recurringIncome + extraIncome
    − budgetExpenses − recurringExpenses − extraExpenses
```
New `gameManagement` fields `lastRoundRecurringIncome` / `lastRoundRecurringExpenses`,
populated where `lastRoundIncome`/`lastRoundExpenses` are today.

**i18n:** recurring vs one-time labels must be distinct in every language
(`recurring_income`/`recurring_expenses` vs existing extras keys).

### Acceptance Criteria
- [ ] Recurring rows show correct sums; hidden when 0
- [ ] Net matches actual treasury change exactly
- [ ] Playtest: player locates "casino income" row within 3 seconds, unprompted

---

## Feature 4: Coup Mechanic (SPRINT)

### Overview
A faction whose relation is too high while the player's charisma is too low
seizes power → early game over. Gates the +10 special ending via charisma.

### Detailed Rules

| State | Condition | Outcome |
|---|---|---|
| Safe | relation < +6 | nothing |
| Yellow warning | relation ≥ +6 AND charisma ≤ 0 | log message + badge on faction in Meet |
| Red warning (armed) | relation ≥ +8 AND charisma ≤ −3 | log message + red badge + DayEnded warning row |
| Coup fires | armed at START of `nextRound()` | 50% first round, 100% next → `phase: 'lose'` |
| Dead zone | relation +10, charisma −1..−2 | no coup, no special ending |
| Special ending | relation ≥ +10 @ R9, charisma ≥ 0 | existing path, unchanged |

- Charisma ≤ −3 requires ~3 expropriates or 2 eliminates — only aggressive play is at risk; bribes cost no charisma.
- Multiple armed factions: highest relation coups; tiebreak military > business > people.
- Shop relation freezes do NOT prevent coups (freeze stops relation *changes*, not the check).
- New `EndCause` values: `'military_coup' | 'business_coup' | 'people_coup'` with faction-specific end narratives (military: dawn arrest; business: vote of no confidence + frozen accounts; people: the square fills and security joins the crowd).
- Constants in `GAMESTATE.COUP`: `RELATION_THRESHOLD: 8`, `CHARISMA_THRESHOLD: -3`, `WARN_RELATION: 6`, `WARN_CHARISMA: 0`, `GRACE_CHANCE: 0.5`.

### Edge Cases
- Armed at R9/R10: coup check runs before the special-ending check — reaching +10 safely *requires* charisma management first.
- Grace roll survival then charisma fixed before next advance: coup disarms.
- Determinism: grace roll is the only RNG; tests inject the roll.

### Acceptance Criteria
- [ ] Coup fires at thresholds (with grace roll injected); does NOT fire at charisma −2
- [ ] Special ending unaffected when charisma ≥ 0
- [ ] Both warning levels emit log lines + DayEnded row at red
- [ ] Faction-specific narratives render on EndScreen
- [ ] Playtest: zero couped players who "didn't see it coming" (<30% tolerance, else louder warnings)

---

## Feature 5: Visual Consequence Registry (SPRINT — scaffolding only)

### Overview
Data file mapping game state → named visual consequence slots. No assets this
sprint; the 3D team fills `assetSlot` implementations later without refactoring.

### Data shape (`src/assets/visualConsequences.ts`)

```typescript
type VisualTriggerCondition = {     // AND logic across fields
  activeRecurringEffectId?: string;
  faction?: Power;
  factionRelation?: { gte?: number; lte?: number };
  budgetSlider?: { key: Expenditures; gte?: number; lte?: number };
  round?: { gte?: number; lte?: number };
};

type VisualLayerHint = 'street-prop-foreground' | 'street-prop-background'
  | 'street-overlay' | 'meet-character-badge' | 'plaza-prop';

type VisualConsequenceEntry = {
  id: string;
  label: string;          // human-readable, for 3D team
  condition: VisualTriggerCondition;
  assetSlot: string;      // e.g. "casino_sign"
  layer: VisualLayerHint;
  position?: { x: number; y: number; z: number };
  exclusive?: string[];   // entries this replaces when active
};
```

Pure evaluator: `getActiveVisualConsequences(state: GameState): VisualConsequenceEntry[]`.

### Starter entries (5)
casino-sign (gambling law), military-checkpoint (security ≥ 8),
dilapidated-buildings (infrastructure ≤ 2), faction-coup-crown (relation ≥ 6 —
doubles as the coup warning badge), public-housing-blocks (housing law).

### Acceptance Criteria
- [ ] Evaluator returns correct subset; empty when nothing matches; AND logic verified
- [ ] No regression to existing street view
- [ ] Debug toggle of gambling law activates/deactivates the casino slot (log output is fine this sprint)

---

## Feature 6: Budget Tier Consequences (FUTURE SPRINT — spec level)

Three tiers per category: LOW (1–2), NORMAL (3–7), HIGH (8–10).
**Penalties apply one round after the change; benefits apply immediately** (owner default).
Existing education effects (dialogue break ≤ 2, text garble) stay immediate — do not regress.
Implementation: track `previousBudget` snapshot at round end; tier logic reads the snapshot.

| Category | LOW (1–2) | NORMAL (3–7) | HIGH (8–10) |
|---|---|---|---|
| **Education** | dialogue breaks (existing), text garbled (existing) | occasional cosmetic typo (~20%/render) | dialogue +0.05 success, perfect text |
| **Security** | military relation −1/round extra; thief peds; 15%/round street explosion prop | occasional army peds/jeeps (visual) | military +1/round; army everywhere; cannons; **coup slightly easier if military ≥ +6** (charisma threshold +1) |
| **Health** | sick chance 35%/faction/round; slim peds | sick 8% @ 5 (see table); mixed peds; occasional ambulance | sick ~1%; fit peds; many ambulances |
| **Infrastructure** | derelict buildings; 50% car density; 20%/round blackout (locks 1 random tab); charisma −1 on transition down | normal buildings; 5% cosmetic flicker | high-end buildings; charisma +1 and people/business +1 on transition up |

**Sick day rules:** sick faction skips Meet (−1 relation that round); if they were
the day's law proposer, no law that day. Sick chance by health slider:

| Health | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Sick % | 35 | 25 | 18 | 13 | 8 | 6 | 4 | 3 | 2 | 1 |

Balance note: at health 1, expect ~10.5 missed meetings per game — relations
tighten hard but treasury is roughly neutral (missed laws cut both ways).
Winnable but punishing; cutting health to save money is NOT a free lunch.

---

## Feature 7: Economy Advisor (FUTURE SPRINT — spec level)

SimCity 3000 energy. One advisor included, terrible; upgradeable 3× via Shop.
(i) button on Laws / Deals / Budget / DayEnded opens a ≤2-line modal.

| Level | Cost | Accuracy | Voice |
|---|---|---|---|
| 0 (default) | — | **Systematically inverted** — always says the opposite; bullish on treasury, dismissive of relations | Confidently wrong |
| 1 | 100 | ~40% | Acknowledges uncertainty ("This might help... or not.") |
| 2 | 150 | ~70% | Hedged but honest |
| 3 | 200 | ~90% | Correct, specific, slightly pompous |

**Hybrid dialogue:** generic templates keyed to (decision category × verdict ×
level) as the base; hand-written lines for the ~10 highest-impact decisions
(the 9 lasting-effect entries + the coup warning), 4 variants each. Level-0
hand-written lines must be wrong; level-3 must cite real numbers.

State: `advisorLevel: 0|1|2|3` in shop slice, persists across rounds and save/load.

---

## Cross-Feature Dependencies

```
F1 Lasting Effects ──→ F2 Repeal (operates on activeRecurringEffects)
                  ──→ F3 DayEnded rows (reads recurring sums)
                  ──→ Budget forecast fix (correctness requirement)
                  ──→ F5 Registry (activeRecurringEffectId conditions)
F4 Coup ──→ F5 Registry (coup-crown badge condition)
F6, F7: future sprint, depend on F1 + F5 foundations
```
