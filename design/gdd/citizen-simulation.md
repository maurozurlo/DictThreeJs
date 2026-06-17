# Citizen Simulation

> **Status**: Draft — full /design-review 2026-06-17 (game-designer + systems-designer + qa-lead + creative-director); all blocking items resolved
> **Author**: Mauro Zurlo + Claude (design-system)
> **Last Updated**: 2026-06-17
> **Implements Pillar**: "A darkly comedic mirror of your decisions" — the city tells the truth even when your treasury report doesn't.

## Overview

The Citizen Simulation populates the Street View with 25 persistent, named citizens whose lives visibly track the consequences of your rule. Each is born with a fixed identity — a name, a skin tone, and a faction allegiance (army, business, or people) — that never changes. Everything else is recomputed every round: whether they still hold their faction role or have been displaced into the civilian crowd; how happy they are (a function of how their faction is faring under you, your charisma, and how violently you've been swinging their fortunes); and what they consequently *do* on the street — stroll content, idle, skulk as a thief, or gather as a protestor. The simulation is mostly a mirror, but it has teeth: organized protestors erode your standing with the People, and petty thieves skim a trickle from the treasury. Its sharpest hook is the **education fork** (people-faction peds only) — the same desperate *civilian* becomes a policeable *thief* if you've kept them ignorant, or a *protestor* aimed squarely at you if you've educated them. Displaced army and business elites who fall from grace steal regardless of their education — loyalty lost expresses itself as corruption, not dissent. This makes the game's deferred "too dumb to revolt" thesis literal and watchable: you don't read that you've ruined Marco the soldier — you watch him go from uniformed and strolling to hollow and skulking, the same face four rounds later, and you know you did it.

## Player Fantasy

The budget sliders and relation bars abstract your cruelty into numbers; the street puts a face on it. The fantasy is a slow, personal indictment — you come to recognize these people, and you watch yourself unmake them. You funded the army and Marco strolls past in a crisp uniform; three rounds later you gut security to cover a deal, and there he is again — same name, same face — skulking by a shop with nothing left to lose. You didn't lose a statistic; you broke a man you knew. The square fills with protestors *only because you taught them to read* — keep them ignorant and the same misery scatters into petty theft you can quietly police away. The target emotion is complicity you can't look away from: the treasury report lets you pretend, the street never does. And at its darkest the street simply empties — the people you starved are gone, and the silence is the verdict. It is the game's core feeling ("I know this is wrong, I'm doing it anyway") rendered in pedestrians.

## Detailed Design

### Core Rules

**Identity — set once at game start, never changes:**

| Field | Values | Notes |
|-------|--------|-------|
| `name` | random first + last | identity anchor; persists |
| `skin` | 0–4 | from skin-tone table; persists |
| `type` | `man` | women/children deferred |
| `faction` | army / business / people | *born* allegiance; drives the happiness math even when displaced |

25 citizens are generated at game start with a **fixed, people-weighted split: 11 people / 7 army / 7 business**. The split is constant across runs so every faction is always represented and displacement is always legible. Dead citizens are never replaced — population only shrinks.

**Per round — recomputed during round resolution, after financials + relations + budget effects resolve and before the Street View renders:**

| Field | Values | Notes |
|-------|--------|-------|
| `alive` | true / false | one-way; only ever flips to dead |
| `employed` | true / false | does the ped hold their faction role this round? |
| `happiness` | 0–10 | see Formulas §4 |
| `role` | content / neutral / thief / protestor / gone | what they *do* on the street; see fork below |
| `lastFactionRelation` | −10…+10 | carried forward to compute next round's volatility |

**Per-ped pipeline** (each alive citizen, in order):

1. `rel` = the **effective** relation (ADR-0008) of the ped's faction this round.
2. **Employment** — does the ped hold their faction role, or get bumped into the civilian crowd?
   - army employed if `security ≥ 4 AND militaryRel ≥ 0`; else demobilized (displaced).
   - business employed if `businessRel ≥ 0 AND infrastructure ≥ 3`; else ruined (displaced).
   - **people: always employed** — they *are* the civilian baseline, so they have nowhere to fall from.
3. `displacement` = 2 if an army/business ped is unemployed this round, else 0 (the personal sting of losing your place, on top of the raw numbers).
4. `happiness = clamp(5 + factionFortune + charismaTerm − displacement − volatility, 0, 10)` — terms defined in Formulas §4.
5. **Role assignment** — band-accurate; happiness is fractional, so bands are defined by exclusion (see §4.3 for the exact `elif` chain):
   - `happiness ≥ 6` → **content** (does their job, strolls)
   - `4 ≤ happiness < 6` → **neutral** (present, idle, no trouble)
   - `happiness ≤ 1` → small chance **gone** (emigrate/die) first; survivors fall through to the unrest branch below.
   - otherwise (`1 < happiness < 4`, plus gone-roll survivors) → **unrest**:
     - **people-faction peds:** education fork — **thief** if `education ≤ 4` (disorganized desperation — policeable); **protestor** if `education ≥ 5` (organized, aimed at *you*).
     - **army/business peds:** always **thief** regardless of education. Displaced elites steal rather than organize — loyalty lost expresses itself as corruption, not dissent.
6. **Death** (permanent; ped is removed for the rest of the run, never replaced):
   - **gone** — a ped whose role resolves to `gone` leaves the board (`alive = false`).
   - **starvation** — civilian-dependent peds (people-faction + *displaced* army/business) have a health-driven death chance when the health budget is low. Employed army/business peds are protected (their institution feeds them). Rates in Formulas §4.

**Feedback (loop-closer), after all peds are processed** — makes the visible mood cost something:
- `peopleRelation −= floor(protestorCount / 3)` — every ~3 protestors costs one point of standing with the People.
- `treasury −= thiefCount × THIEF_SKIM` — petty crime as a treasury trickle (texture, not punishment).
- `lastFactionRelation` is then set to this round's `rel` for each surviving ped.

The feedback adjusts the **just-resolved** `peopleRelation` and `treasury`, so its consequences surface in the next round's Log and Street View.

### States and Transitions

| Axis | Values | Transition rule |
|------|--------|-----------------|
| Life | `alive` → `dead` | one-way; via `gone` role or starvation. Never reverts; dead peds are not replaced. |
| Employment | `employed` ↔ `displaced` | recomputed per round from budget + faction relation. People-faction peds are never displaced. |
| Role | content / neutral / thief / protestor / gone | recomputed each round from `happiness` × `education`. `gone` is terminal (→ dead). |

**Visual outfit** is derived at render time (not stored), by precedence — the first matching rule wins:

1. `role == thief` → **thief outfit** (skulking posture)
2. `role == protestor` → **protestor outfit** (new dedicated asset) + clustered with other protestors
3. `employed AND faction == army` → **army uniform**
4. `employed AND faction == business` → **business suit**
5. otherwise → **civilian** (people-faction baseline, or a displaced elite who lost their uniform/suit)

Body type (`slim` / `fit` / `fat`) is computed independently from the health budget (see Formulas §4) and applies regardless of outfit. Posture/grouping/pace per role is specified in Visual/Audio Requirements.

> **Asset note:** the protestor outfit is a *new* ped asset (`ped_special_man_protestor`) not in the current `entities.md` sheet — flag for the asset-spec pass.

### Interactions with Other Systems

| System | Direction | Interface |
|--------|-----------|-----------|
| **Budget** (`game-concept.md §5`) | in | `security`, `infrastructure`, `health`, `education` (1–10) and `peopleTax`/`businessTax` drive happiness, employment, and starvation death. |
| **Relations** (`game-concept.md §4`) | in **and out** | Each faction's **effective** relation (ADR-0008) is the largest happiness term. The sim **writes back**: `peopleRelation −= floor(protestorCount / 3)` during round resolution. |
| **Charisma** (`game-concept.md §7`) | in | Effective charisma is a global happiness floor-lifter (a charming tyrant lifts everyone's mood). This is charisma's first on-screen role. |
| **Treasury** | out | Thieves skim a small per-round trickle. |
| **Round resolution** (`RoundResolver`, ADR-0006) | host | The pipeline runs as a late step after relations/financials resolve and before render, in a single atomic `set` (ADR-0002). Feedback is a **direct same-round adjustment**, not a windowed modifier. |
| **Street View** (`street-view.md`) | out | Consumes per-ped `{ outfit, bodyType, role/posture, skin, alive }` to render. Street View owns the environment (buildings/props/statues); this GDD owns the citizens. |
| **Coup** (`CoupHandler`, ADR-0009) | indirect | The coup reads effective `peopleRelation`. Protestor feedback lowering it pushes *toward* an overthrow loss (−10). Since only people-faction peds become protestors, the causal chain is clean: civilian suffering → civilian protest → people relation falls → coup risk rises. No cross-faction attribution confusion; see Edge Cases. |
| **Modifier engine** (ADR-0008) | reads-through | Happiness/coup read effective values that already include active relation modifiers; the sim does not author modifiers itself in v1. |

**Ownership note:** this GDD supersedes the citizen sections (§3.4–3.6, §4) of `street-view.md`, which will be trimmed to a pointer. Street View retains ownership of environment assets, clickable buildings, and statues.

## Formulas

All citizen math runs once per round, per living ped, during round resolution — **after** financials/relations/budget effects resolve and **before** the Street View renders. All constants below are **proposed starting values to tune on screen**, surfaced as Tuning Knobs (§7).

**Inputs** (all read from already-resolved state this round):

| Variable | Source | Range |
|----------|--------|-------|
| `rel` | the ped's faction **effective** relation (ADR-0008) | −10 … +10 |
| `lastRel` | ped's `lastFactionRelation` (carried from last round) | −10 … +10 |
| `charisma` | effective dictator charisma | −10 … +10 |
| `security`, `infrastructure`, `health`, `education` | budget sliders | 0 … 10 |
| `peopleTax`, `businessTax` | tax rates | 0 … 100 |
| `bodySeed` | per-ped constant in [0,1), drawn from `rollFloat()` at citizen generation time (ADR-0010 seeded cursor — **not** `Math.random()`). Body type is part of citizen identity and must be stable across save/reload. | fixed |

### 4.1 Happiness

```
happiness = clamp(5 + factionFortune + charismaTerm − displacement − volatility, 0, 10)
```

| Term | Formula | Range |
|------|---------|-------|
| `factionFortune` | `(rel / 10) * 3 + budgetSignal` | army −4 … +4; business/people **−4.5 … +4** (the −0.5 tax penalty lowers the floor) |
| `charismaTerm` | `(charisma / 10) * 2` | −2 … +2 |
| `displacement` | `2` if an army/business ped is unemployed this round, else `0` | 0 / 2 |
| `volatility` | `min(2, abs(rel − lastRel) * 0.4)` | 0 … 2 |

`budgetSignal` maps each faction's relevant budget to −1…+1, with a tax penalty:

| Faction | `budgetSignal` | Tax penalty |
|---------|----------------|-------------|
| army | `(security − 5) / 5` | — |
| business | `(infrastructure − 5) / 5` | `−0.5` if `businessTax > 45` |
| people | `(health − 5) / 5` | `−0.5` if `peopleTax > 30` |

Theoretical happiness range (worst case is a taxed business/people ped): `[5 − 4.5 − 2 − 2 − 2, 5 + 4 + 2] = [−5.5, 11]` before clamping → clamps to **0…10**, so both endpoints are reachable (a fully ruined ped hits 0, a fully favoured one hits 10). Army's narrower `factionFortune` floor (−4) gives a raw min of −5; either way the clamp to 0 holds.

### 4.2 Employment

Recomputed before `displacement`:

| Faction | Holds role if… | Else |
|---------|----------------|------|
| army | `security ≥ 4` AND `rel ≥ 0` | demobilized (displaced) |
| business | `rel ≥ 0` AND `infrastructure ≥ 3` | ruined (displaced) |
| people | always | — (never displaced) |

### 4.3 Role fork (happiness × education)

```
if happiness ≥ 6:                                  role = content
elif happiness ≥ 4:                                role = neutral
elif happiness ≤ 1 AND rollChance(GONE_CHANCE):    role = gone
elif faction != people:                            role = thief   # army/business: always steal, never organize
elif education ≤ 4:                                role = thief   # people-faction, ignorant: disorganized desperation
else:                                              role = protestor  # people-faction, educated: organized dissent
```

> **Implementation note:** keep this as a single `elif` chain. The faction and education branches are reached both by peds in `1 < happiness < 4` and by peds at `happiness ≤ 1` whose `gone` roll returned false (the `AND` short-circuits, so the chain falls through). Do **not** refactor the `gone` check into a nested `if`, or the happiness-≤1 survivors would skip the faction/education fork.

- `GONE_CHANCE = 0.15` — only evaluated when `happiness ≤ 1`. Routed through `rollChance()` in `src/Utils/Math.ts`, which draws from the seeded cursor (ADR-0010), never inline.
- The education fork (`≤4` thief / `≥5` protestor) applies to **people-faction peds only**. Army and business peds in the unrest band are always assigned `thief` regardless of their education level — displaced elites steal, not organize. This ensures protest feedback cleanly maps to `peopleRelation` with no cross-faction attribution confusion.
- Education cut is checked **after** the `gone` roll and the faction gate, so a ped at happiness ≤ 1 who survives the roll still sorts by faction first, then by education if people-faction.

### 4.4 Death

Two permanent paths — **mutually exclusive per ped per round** (at most one fires):

```
// Step 6: Death — execute after role fork (§4.3)
if role == gone:
    alive = false        // gone role → departure (Edge Case 3: starvation skipped)
    continue             // ← early exit; do NOT evaluate starvation for this ped
// Starvation eligibility: key off employed flag, not the displacement value
// (so future tuning changes to the displacement penalty don't silently break this gate)
if !ped.employed OR ped.faction == people:
    starvationChance = health ≤ HEALTH_DEATH_THRESHOLD
        ? DEATH_RATE_MAX * (1 − health / HEALTH_DEATH_THRESHOLD)
        : 0
    if rollChance(starvationChance):
        alive = false
```

1. **gone** — a ped whose role resolves to `gone` (§4.3) leaves the board.
2. **starvation** — civilian-dependent peds only (people-faction always + *displaced* army/business; employed elites are fed by their institution and immune). Eligibility gates off `employed == false` (from step 2), not the numeric `displacement` value, so future tuning of the displacement penalty doesn't silently break this check:

```
starvationChance = health ≤ HEALTH_DEATH_THRESHOLD
    ? DEATH_RATE_MAX * (1 − health / HEALTH_DEATH_THRESHOLD)
    : 0
ped dies if rollChance(starvationChance)
```

- `HEALTH_DEATH_THRESHOLD = 3`, `DEATH_RATE_MAX = 0.15` — reused from the retired `street-view.md` model for continuity. At `health = 0` → 15% per eligible ped per round; at `health = 3` → 0%. Eligible count is **11 (people, always) + any displaced army/business (0–14)** = 11–25. In the typical mid-decline case (~7 elites still employed/protected) that's ~18 eligible → ~2–3 deaths/round; in a full collapse (all elites demobilized) all 25 are eligible → ~3.75/round — visible attrition, not a wipe. Note: a people-faction ped at `happiness ≤ 1` faces the `gone` roll **and** starvation, so its expected lifespan at `health = 0` compresses to ~3–4 rounds (vs ~6–7 from the `gone` roll alone).

### 4.5 Body type (render input)

Independent of outfit/role; reflects population nourishment via the health budget. Per-ped stable through `bodySeed`:

```
fatShare  = lerp(0.05, 0.40, health / 10)   // 0.05 at health 0 → 0.40 at health 10
slimShare = lerp(0.70, 0.15, health / 10)   // 0.70 at health 0 → 0.15 at health 10
fitShare  = 1 − fatShare − slimShare

bodyType = bodySeed < fatShare              ? fat
         : bodySeed < fatShare + fitShare   ? fit
         :                                    slim
```

Because `bodySeed` is fixed per ped, a citizen only changes body type when health crosses *their* threshold — identities stay visually stable while the crowd's overall build tracks health.

### 4.6 Loop-closer feedback (after all peds processed)

```
protestorCount = count(role == protestor)
thiefCount     = count(role == thief)

peopleRelation −= min(floor(protestorCount / PROTEST_DIVISOR), PROTEST_FEEDBACK_CAP)
treasury       −= thiefCount * THIEF_SKIM
```

- `PROTEST_DIVISOR = 3` — every ~3 protestors costs 1 point of standing with the People.
- `PROTEST_FEEDBACK_CAP = 5` — safety rail. Uncapped, a full square of 25 protestors would be `floor(25/3) = 8` in one round. Capping at 5 prevents a single-round wipe: the most one round can subtract is 5, so the floor is reached in `ceil((startRelation + 10) / 5)` rounds. From a healthy `peopleRelation` of **+10** that's **4 rounds**; but protests only emerge when happiness (hence relation) is already low, so in realistic play relation is often `0…+5` at spiral onset, giving **2–3 rounds** to the −10 floor (e.g. from +2: +2→−3→−8→−10, three rounds). The cap guarantees "no instant-loss," **not** a fixed 4-round runway — tune `PROTEST_FEEDBACK_CAP` with the realistic onset relation in mind.
- `THIEF_SKIM = 2` treasury per thief per round. With ~10 thieves that's ~20/round against difficulty treasuries in the hundreds — reads as texture, not punishment.
- Result is clamped: `peopleRelation` re-clamped to ±10; `treasury` floored at 0.

### 4.7 Worked examples

**Marco — faction army (the arc):**

| Round | Action | sec | rel | char | employed | factionFortune | charismaTerm | displacement | volatility | happiness | role |
|-------|--------|-----|-----|------|----------|----------------|--------------|--------------|------------|-----------|------|
| 1 | funded army | 7 | +4 | +2 | yes | `1.2 + 0.4 = 1.6` | `0.4` | 0 | 0 | `5+1.6+0.4 = 7.0` | **content** |
| 4 | gutted security | 2 | −1 | +2 | **no** | `−0.3 + (−0.6) = −0.9` | `0.4` | 2 | `min(2, 5·0.4)=2` | `5−0.9+0.4−2−2 = 0.5` | **thief** (edu ≤ 4, *assuming the gone roll fails* — happiness 0.5 ≤ 1 makes him gone-eligible first, p=0.85 to survive and become a thief) |

**Ana — faction people, educated, neglected (the protest fork):** `health = 2`, `peopleRel = −4`, `charisma = 0`, `education = 7`, stable rel (volatility 0). `budgetSignal = (2−5)/5 = −0.6`; `factionFortune = (−4/10)·3 + (−0.6) = −1.8`; people never displaced. `happiness = 5 − 1.8 + 0 − 0 − 0 = 3.2` → ≤3, education ≥ 5 → **protestor**. Had her education been ≤ 4 with identical misery, she'd be a **thief** instead — same suffering, different street.

### 4.8 Displayed population (HUD projection)

A cosmetic projection of living citizens onto a real-world scale — display-only, reads `aliveCount`, never written back to.

```
displayedPopulation = round(aliveCount / TOTAL_CITIZENS * BASE_POPULATION)
```

- `TOTAL_CITIZENS = 25`, `BASE_POPULATION = 5_924_511` (Cuba, 1950).
- Rule of three: 25 alive → 5,924,511; 0 alive → 0; linear between.
- Each citizen ≈ **236,980** people, so a single death drops the counter by ~237k — the street shows one body, the HUD shows what one body means at scale.
- Monotonic: population only shrinks (citizens are never added), so the number only ever falls.

## Edge Cases

| # | Situation | Explicit behaviour |
|---|-----------|--------------------|
| 1 | **First round — no `lastFactionRelation` yet** | At generation, each ped's `lastFactionRelation` is initialized to its faction's round-1 effective relation, so `volatility = 0` on round 1. No phantom whiplash penalty at game start. |
| 2 | **Population collapse — all (or all people-faction) peds dead** | The street renders empty/sparse — this is intended ("the silence is the verdict"). `protestorCount` and `thiefCount` fall to 0, so loop-closer feedback contributes nothing. Reaching 0 population is **not** itself a game-over; the run ends only via the coup/overthrow systems. |
| 3 | **`gone` roll and starvation both eligible same round** | The role fork (§4.3) resolves first. If the ped rolls `gone`, it is removed and the starvation roll is **skipped**. At most **one** death per ped per round. |
| 4 | **Displaced elite recovers** | `employed` is recomputed every round. An army/business ped demobilized in an earlier round is re-employed the moment `security`/`infrastructure`/`rel` cross back over the §4.2 thresholds, and the `displacement` penalty lifts that same round. |
| 5 | **Education crosses the 4/5 boundary mid-game** | Roles are recomputed each round, so raising education flips existing people-faction **thieves into protestors** (and lowering it flips them back) on the next resolution. Army/business peds remain thieves regardless of education changes (see Edge Case 12). The intended lever: the player converts policeable petty crime into organized dissent by educating the People, or suppresses dissent by keeping them ignorant. |
| 6 | **Protest spiral vs. people-coup tension** | A people-coup arms at *high* `peopleRelation`; protestors only appear at *low* happiness (which tracks low relation). The two cannot trigger together. The real risk from protest feedback is the −10 **overthrow floor**, reached in `ceil((startRelation + 10) / 5)` rounds at the cap — 4 from +10, but 2–3 from a realistic low onset relation (§4.6). Note: the cap math assumes protests are the *only* drain on `peopleRelation`. Budget spending effects (health < 3 → −2/round per `game-concept.md §5`) can combine with protest feedback, compressing the runway further. Feedback is applied during round resolution, so the lowered `peopleRelation` is visible to the **next** round's coup check (ADR-0009 reads effective relations at round start). |
| 7 | **`treasury` would go negative from skim** | `treasury` is floored at 0 after `thiefCount * THIEF_SKIM`. The skim is part of the same atomic round-resolution `set` (ADR-0002), so any downstream bankruptcy check sees the post-skim value. |
| 8 | **`peopleRelation` already at −10 when feedback fires** | The subtraction re-clamps to −10; no underflow. Whether −10 ends the run is the coup/overthrow system's decision, not the sim's. |
| 9 | **Low-education society: many thieves, no protestors** | `peopleRelation` feedback is 0 (only people-faction protestors erode it — see Edge Case 12); only the treasury skim applies. The "too dumb to revolt" society costs the dictator *standing* nothing — exactly the design thesis. A player who keeps `education ≤ 4` avoids protestors with no business income penalty (the `< 3` threshold in `game-concept.md §5` doesn't fire at 4). This is the **compliant-ignorance equilibrium**: the population is barely literate enough to keep commerce running but not organized enough to revolt. It is a designed incentive — a cynical dictator who finds it should feel clever and compromised, not cheated. |
| 10 | **Stuck at happiness ≤ 1 but `gone` never rolls** | No guaranteed removal — the ped re-rolls `GONE_CHANCE` each round (expected lifespan ~6–7 rounds) and remains a visible thief/protestor until the roll fires or starvation takes them. Misery persists on screen rather than being tidied away. |
| 11 | **Determinism / restart** | The 25 citizens are generated **once** at game start via the seeded RNG (ADR-0010); a given seed yields the same 25 names/skins/factions **and the same `bodySeed` per citizen** (drawn from `rollFloat()` at generation — not `Math.random()`), so identity including body type is stable across save/reload. The saved cursor makes per-round rolls replay-stable (anti-save-scum). Citizens are never added mid-run — population only shrinks. |
| 12 | **Army/business peds never become protestors** | Displaced army/business peds in the unrest band always resolve to `thief` regardless of education level. Only people-faction peds are subject to the education fork and can become protestors. This ensures protest feedback cleanly maps to `peopleRelation` — a protestor is always a civilian, never a displaced soldier or ruined merchant. Educated, demobilized elites channel their despair into petty corruption, not organized dissent. |

## Dependencies

**Upstream — systems this sim reads (must resolve before the pipeline runs):**

| System | What it provides | Doc |
|--------|------------------|-----|
| Budget | `security`, `infrastructure`, `health`, `education`, `peopleTax`, `businessTax` | `game-concept.md §5` |
| Relations | each faction's **effective** relation (`rel`) | `game-concept.md §4`, ADR-0008 |
| Charisma | effective `charisma` for `charismaTerm` | `game-concept.md §7` |
| Modifier engine | resolves base + windowed modifiers into the effective relation/charisma the sim reads | ADR-0008 |
| RNG / `Math.ts` | `rollChance()` for the `gone` and starvation rolls (seeded cursor; save-scum-safe) | ADR-0010 |
| Round loop | hosts the pipeline as a late step in `nextRound()` resolution | ADR-0006 |

**Downstream — systems this sim writes to or feeds:**

| System | What the sim does to it | Doc |
|--------|-------------------------|-----|
| Relations | `peopleRelation −= min(floor(protestorCount/3), 5)` during resolution | `game-concept.md §4` |
| Treasury | `treasury −= thiefCount * THIEF_SKIM` during resolution | `game-concept.md §5` |
| Street View | emits per-ped `{ outfit, bodyType, role/posture, skin, alive }` to render | `street-view.md` |
| Population HUD stat | feeds `aliveCount` → `displayedPopulation` projection (display-only) | this GDD §4.8, UI Requirements |
| Coup | indirectly — lowered `peopleRelation` feeds the next round's coup check | ADR-0009 |
| Asset sheet | requires a **new** `ped_special_man_protestor` asset | `entities.md` → `/asset-spec` |

**Back-references to add (bidirectional consistency):**

- `street-view.md` — trim its citizen sections (§3.4–3.6, §4) to a pointer here; keep environment ownership. *(Pending task.)*
- `game-concept.md §4 (Relations)` — note that the Citizen Simulation writes back to `peopleRelation` via protest feedback.
- ADR-0006 (Round loop) — note the citizen pipeline runs as a late resolution step before render.

## Tuning Knobs

| Constant | Default | Safe range | Affects |
|----------|---------|------------|---------|
| `TOTAL_CITIZENS` | 25 | 15–40 | Crowd density / perf; also the population divisor. Above ~40, draw-call budget and legibility suffer. |
| `BASE_POPULATION` | 5,924,511 | any | Pure flavour — the HUD scale (§4.8). No gameplay effect. |
| Faction split | 11 / 7 / 7 | sum = `TOTAL_CITIZENS` | Which faction's collapse is most visible. People-weighted so the civilian baseline always dominates the street. |
| `factionFortune` rel weight | ×3 | 2–4 | How hard faction relation drives mood (the dominant happiness term). |
| `charismaTerm` weight | ×2 | 1–3 | How much a charming tyrant lifts everyone's floor. Above 3, charisma papers over real misery. |
| `displacement` penalty | 2 | 1–3 | Sting of an elite losing their job. Above 3, one demotion alone can force the thief/protestor fork. |
| `volatility` coefficient / cap | 0.4 / 2 | 0.2–0.6 / 1–2 | Punishment for whiplashing a faction's relation. Higher = manic over-intervention hurts more. |
| `budgetSignal` divisor | 5 | fixed | Normalizes a 0–10 budget to −1…+1. Changing it rescales every budget's mood weight. |
| Tax penalty thresholds | 45 (biz) / 30 (people) | 30–60 / 20–40 | Where over-taxing starts denting the faction's mood. |
| Role thresholds | ≥6 / ≥4 / ≤3 / ≤1 | keep ordered | The content/neutral/unrest/gone bands. Widening the unrest band fills the street with thieves/protestors faster. |
| Education fork cut | ≤4 thief / ≥5 protestor (people-faction peds only) | 3–6 split | Where ignorance becomes organized dissent — applies to people-faction peds only; army/business always thieve in the unrest band. Note: `education == 4` is a designed sweet spot — no protestors and no business income penalty (which fires at `education < 3`). See Edge Cases 9 and 12. Tune the income penalty threshold in `game-concept.md §5` if this equilibrium needs disruption. |
| `GONE_CHANCE` | 0.15 | 0.05–0.30 | How fast the despairing leave/die. Higher empties the street quicker. |
| `HEALTH_DEATH_THRESHOLD` | 3 | 1–5 | Health level below which civilians start starving. |
| `DEATH_RATE_MAX` | 0.15 | 0.05–0.25 | Peak per-ped starvation chance at health 0. Above 0.25, low health is a fast wipe. |
| `PROTEST_DIVISOR` | 3 | 2–5 | Protestors per −1 `peopleRelation`. Lower = protests bite harder. |
| `PROTEST_FEEDBACK_CAP` | 5 | 3–8 | Max `peopleRelation` loss/round from protests. The instant-loss safety rail — at 5, a spiral takes ≥4 rounds to reach the −10 floor. |
| `THIEF_SKIM` | 2 | 1–5 | Treasury drained per thief/round. Keep small enough to read as texture, not punishment. |
| Body-type lerp endpoints | fat 0.05→0.40, slim 0.70→0.15 | — | How visibly the crowd's build tracks the health budget. |

## Visual/Audio Requirements

**Per-role visual tell** (so the player reads state without a number — from the role in §4.3):

| Role | Posture | Grouping | Pace |
|------|---------|----------|------|
| content | upright | solo, spread across the street | normal stroll |
| neutral | slack | solo | slow |
| thief | skulking, furtive | alone, hugging shopfronts | fast |
| protestor | agitated, holding a sign | **clustered with other protestors** | stationary group |
| gone | — | removed; leaves an absence | — |

**Outfit** is the precedence chain already specified in Detailed Design §3.2 (thief → protestor → army uniform → business suit → civilian). Skin tone (`skin` 0–4) and `bodyType` (slim/fit/fat, §4.5) compose with whichever outfit wins.

**Assets** (formalized in the `/asset-spec` pass against `entities.md`):
- Body builds map to the existing `ped_man_00_slim / _fit / _fat` meshes.
- Uniform/suit/civilian/thief use the existing `ped_special_man_army / _business / _thief` + base civilian skins.
- **`ped_special_man_protestor` is a new asset** (sign-carrying, agitated) — the one addition this GDD requires.

**Crowd composition over a run** (the readable arc): a well-run city is a spread of upright, well-fed strollers in faction colours; decline pulls bodies into shopfront-skulking thieves or a stationary protestor cluster in the square; collapse empties the street to silence. The transition is gradual because roles recompute per round.

**Audio** (atmospheric, light — consistent with the no-physics ambient scene):
- A base street murmur whose density tracks `aliveCount` — thins toward silence as population falls.
- A **protest chant layer** that fades in when a protestor cluster is present (gated on `protestorCount ≥ PROTEST_DIVISOR`, i.e. once a real group forms), scaling with cluster size.
- No per-ped voices, no combat/alarm SFX — the street is a mood bed, not an action soundscape.

**Performance:** the whole crowd renders within the project's `< 100 draw calls` budget — instance/share ped meshes by build+outfit; the protestor cluster shares one sign mesh.

## UI Requirements

**Citizen inspector (click-to-inspect):**
- Clicking any **alive** ped on the street opens a small inspector panel for that citizen. (`gone` citizens are removed from the board, so there is nothing to click in v1.)
- The panel displays:
  - `name` — the identity anchor (e.g. "Marco Reyes")
  - `faction` — *born* allegiance, with its icon (army / business / people) — shown even when displaced, so the gap reads ("Army — displaced")
  - `employed` — role title or displaced state ("Soldier" / "Demobilized", "Business owner" / "Ruined", "Citizen")
  - `happiness` — a 0–10 bar with a one-word mood label (this is the opt-in deep read, so the raw value is allowed here; the *street* still communicates mood without numbers)
  - `role` — content / neutral / thief / protestor
- Dismiss by clicking elsewhere or an explicit close control. Selecting another ped swaps the panel's contents.
- **Layer boundary (ADR-0003):** the 3D Scene owns the raycast/hit-test and emits a `selectedPedId`; the inspector is a plain React/CSS-module panel that reads that citizen's record from the store. The UI never imports `three`.

**Population readout (§4.8):**
- `displayedPopulation` appears in the existing stat area alongside treasury and relations, formatted with thousands separators (e.g. `5,924,511`).
- Recomputes each round; visibly ticks **down** when citizens die — the ~237k-per-death drop is the intended gut-punch.

**Feedback surfacing (no new UI):**
- Protest (`peopleRelation`) and thief (`treasury`) deltas are already emitted by round resolution and surface through the **existing Log** — no dedicated citizen-feedback widget in v1.

## Acceptance Criteria

> *Reviewed by `qa-lead` 2026-06-17 (initial); full adversarial `/design-review` 2026-06-17 (game-designer + systems-designer + qa-lead + creative-director). All blocking AC defects resolved below: AC-7a rewritten with concrete boundary values; AC-8 / AC-20 updated for faction gate; AC-10 adds employed-elite immunity assertions; AC-12 / AC-13 relabeled [L] with explicit underflow cases; AC-17 wrong expected value corrected; AC-24 health constraint added. The seeded RNG harness exists: `seedRng()` + mockable named draws in `src/Utils/Math.ts` (ADR-0010). Probabilistic ACs are pinned by `seedRng(fixed)` or by mocking `rollChance`/`rollFloat` — never by spying `Math.random`.*

**Story-type legend:** **[L]** Logic (BLOCKING automated unit test) · **[I]** Integration (BLOCKING) · **[U]** UI (ADVISORY) · **[CI]** lint/grep gate. **[rng]** = needs the seeded/mock RNG harness.

**Generation & identity**
- [ ] AC-1a **[L]**: Exactly 25 citizens exist at game start, split **11 people / 7 army / 7 business**.
- [ ] AC-1b **[L][rng]**: `seedRng(S)` then generating yields the identical 25 (name/skin/faction) for a given `S`; a different seed yields a different roster (ADR-0010).
- [ ] AC-2 **[L]**: A citizen's `name`, `skin`, and `faction` are identical in round 1 and round N (never mutate), even under adversarial budget/relation inputs.

**Happiness (§4.1)** — Logic, unit-testable against worked examples (happiness itself is RNG-free)
- [ ] AC-3 **[L]**: Given Marco R1 inputs (sec 7, rel +4, char +2, employed) `happiness == 7.0`; given Marco R4 inputs (sec 2, rel −1, char +2, displaced, prev rel +4) `happiness == 0.5`. The R4 volatility term is pinned: `min(2, |−1 − 4|·0.4) == 2`.
- [ ] AC-4 **[L]**: Inputs that drive the raw expression below 0 or above 10 clamp to exactly 0 / 10 (incl. the taxed-business floor `−5.5 → 0`).

**Employment & displacement (§4.2)**
- [ ] AC-5 **[L]**: An army ped is displaced iff `security < 4 OR rel < 0`; a business ped iff `rel < 0 OR infrastructure < 3`; a people ped is **never** displaced. Boundary values tested explicitly: army employed at `security == 4, rel == 0`; displaced at `security == 3` or `rel == −1`.
- [ ] AC-6 **[L]**: A displaced army/business ped incurs `displacement = 2`; when its thresholds recover the same ped is employed and the penalty is 0 that same round.

**Role fork (§4.3)**
- [ ] AC-7a **[L]**: Role bands resolve by happiness at exact boundaries — `h == 6.0` → content; `h == 4.0` → neutral; `h == 5.9` → neutral; `h == 3.9` → unrest branch (thief or protestor per faction/education, with `rollChance` mocked **false** for the gone check); `h == 1.0` → gone-roll branch (mock `rollChance` **false** → falls through to faction/education fork). Boundary values `h == 4` (neutral) and `h == 6` (content) are tested explicitly to catch off-by-one on `≥` vs `>`. Leave `rollChance`-true coverage to AC-7b.
- [ ] AC-7b **[L][rng]**: At `h ≤ 1`, with the gone roll forced **true** (mock `rollChance`) role is `gone`; forced **false**, role falls through to thief/protestor per education.
- [ ] AC-8 **[L]**: The education fork applies to **people-faction peds only**. At `h == 3` (clear of the gone roll): (a) people-faction, `education == 4` → **thief**; (b) people-faction, `education == 5` → **protestor**; (c) army-faction, `education == 7` → **thief** (faction gate fires before education check). Boundary `education == 4` vs `== 5` for people-faction tested explicitly.

**Death (§4.4)**
- [ ] AC-9 **[L][rng]**: With the gone roll forced **true**, a ped whose role resolves to `gone` has `alive == false` afterward and is absent for the rest of the run (never replaced).
- [ ] AC-10 **[L]**: Starvation is gated on eligibility (`!employed OR faction == people`) before the formula applies. Assert: (a) people-faction ped, `health == 0` → `starvationChance == 0.15`; (b) displaced army ped (`employed == false`), `health == 0` → `starvationChance == 0.15`; (c) **employed army ped, `health == 0` → `starvationChance == 0` (immune regardless of health)**; (d) **employed business ped, `health == 0` → `starvationChance == 0` (immune)**; (e) people-faction ped, `health == 3` → `starvationChance == 0`.
- [ ] AC-11 **[L][rng]**: No ped dies twice in one round — with the gone roll forced **true**, the starvation roll is **not** evaluated for that ped (assert via mock call count or processing order).

**Feedback (§4.6)**
- [ ] AC-12 **[L]**: `peopleRelation` decreases by `min(floor(protestorCount/3), 5)` per round and never drops below −10. Assert from `startRelation == +5`: count=3 → +4; count=6 → +3; count=15 → 0. **Underflow: starting `peopleRelation == −8`, count=15 → exactly −10 (clamps, not −13). Starting `peopleRelation == −10`, count=15 → −10 (no-op, not −15).** The floor clamp is asserted explicitly.
- [ ] AC-13 **[L]**: `treasury` decreases by `thiefCount * THIEF_SKIM` (default 2) per round and never goes below 0. Assert: `treasury == 100, thiefCount == 10` → 80; `treasury == 5, thiefCount == 4` → 0 (clamps, not −3); `treasury == 0, thiefCount == 5` → 0 (no-op). The floor clamp is asserted explicitly.

**Population (§4.8)**
- [ ] AC-14 **[L]**: `displayedPopulation == round(aliveCount / 25 * 5_924_511)`; `== 5,924,511` at 25 alive, `== 0` at 0 alive, `== 2,843,765` at 12 alive (mid-range guards against formula inversion).

**Determinism (ADR-0010)**
- [ ] AC-15 **[CI]**: No inline `Math.random()` in the citizen pipeline — verified by a CI grep (`rg 'Math\.random' src/Stores/CitizenHandler.ts` returns no matches); the `gone`/starvation rolls go through `rollChance()` (seeded cursor).

**UI**
- [ ] AC-16 **[U]**: Clicking an alive ped opens an inspector showing its `name`, `faction`, `employed`/role state, `happiness`, and `role`; `gone` peds are not clickable; the panel dismisses on click-elsewhere or an explicit close, and swaps contents when another ped is selected. (ADR-0003: the inspector is a plain React/CSS panel reading the store; it never imports `three`.)

**Coverage gaps closed (qa-lead review 2026-06-17)**
- [ ] AC-17 **[L]** (body-type lerp §4.5): At `health == 0`: `fatShare == 0.05`, `slimShare == 0.70`, `fitShare == 0.25`. At `health == 10`: `fatShare == 0.40`, `slimShare == 0.15`, `fitShare == 0.45`. `fitShare == 1 − fatShare − slimShare` at both ends. Classification: `bodySeed == 0.03` is `fat` at **both** extremes (0.03 < 0.05 at health=0; 0.03 < 0.40 at health=10). `bodySeed == 0.20` is `fit` at health=0 (0.05 ≤ 0.20 < 0.30) and `fat` at health=10 (0.20 < 0.40) — body type can change as health improves. `bodySeed == 0.90` is `slim` at both extremes (0.90 ≥ 0.30 at health=0; 0.90 ≥ 0.85 at health=10).
- [ ] AC-18 **[L]** (volatility round-1, Edge 1): On round 1 every ped's `volatility` term is 0 regardless of its faction relation (`lastFactionRelation` is seeded to round-1 effective relation — no phantom whiplash).
- [ ] AC-19 **[L]** (elite recovery arc, Edge 4): An army ped employed in R1 (`sec 7, rel +3`) → `employed == false, displacement == 2` in R2 (`sec 2`) → back to `employed == true, displacement == 0` in R3 once `sec ≥ 4, rel ≥ 0`.
- [ ] AC-20 **[L]** (education flip, Edge 5 — the core lever): A **people-faction** ped at `happiness == 3, education == 4` (thief) flips to **protestor** the round `education` is raised to 5, all else equal; lowering 5→4 flips protestor→thief next round. An **army-faction** ped at the same inputs remains **thief** regardless of whether `education` is 4 or 5 (faction gate fires before education check — Edge Case 12).
- [ ] AC-21 **[L]** (empty-street feedback, Edge 2): When `protestorCount == 0` and `thiefCount == 0` (all content/neutral, or population collapsed), `peopleRelation` and `treasury` are unchanged by the feedback step.
- [ ] AC-22 **[L][rng]** (gone+starvation ordering, Edge 3): A people ped at `happiness ≤ 1, health == 0` (both eligible): with the gone roll forced **true**, it dies via `gone`, starvation is not evaluated, and it is counted **once** in the dead population.
- [ ] AC-23 **[L]** (protest cap fires): With `protestorCount == 25, peopleRelation == +5`, the round subtracts exactly 5 (not `floor(25/3) == 8`), ending at 0 — the `min(…, PROTEST_FEEDBACK_CAP)` is exercised.
- [ ] AC-24 **[L][rng]** (population monotonicity §4.8): `displayedPopulation` at round N+1 is always `≤` round N. Two-round scenario: 25 alive peds, `health == 5` (above starvation threshold — starvation roll never fires), gone roll forced **true** for exactly one ped → round 1 `displayedPopulation == 5,924,511`, round 2 strictly less. Setting `health == 5` prevents the starvation roll from introducing non-determinism.
- [ ] AC-25 **[L]** (starvation linearity §4.4): `starvationChance == 0.10` at `health == 1` and `== 0.05` at `health == 2` — the intermediate `DEATH_RATE_MAX·(1 − health/3)` values, asserted as computed probabilities.

## Open Questions

1. **Do `gone` citizens leave a scar?** v1 simply removes them. A persistence layer (a memorial marker, an empty doorway, a name struck through in some ledger) would make absence legible rather than silent. Will flagged this as a "street-view 0.2" question — deferred.
2. **Women/children.** `type` is `man`-only in v1. Adding `woman`/`child` peds is a pure content/asset expansion that doesn't change the math — deferred to a later asset pass.
3. **Happiness number vs. pure mood.** The inspector currently shows the raw 0–10 value. Do we want the deep-read to stay numeric, or commit fully to "show, don't tell" with only a mood word even on click?
4. **Thief → treasury visual tie.** Should the `THIEF_SKIM` be physicalized (a thief visibly pocketing something), or stay an abstract Log delta?
5. **Education-flip readability.** Thief↔protestor flips the round education crosses the cut. Is the instant swap readable, or does it need a one-round transition so the player can attribute the change to their education choice?
6. **Protestor cluster → coup.** Beyond eroding `peopleRelation`, should a large protestor cluster contribute directly to a people-uprising trigger, or is the relation feedback the only channel? (Keep single-channel for v1 to avoid double-counting.)
