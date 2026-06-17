# Ped Happiness & Role Model — v0.1

> All constants below are **starting values to feel and tune**, not final numbers.
> The shape is the deliverable; the tuning is yours once it's on screen.
> Runs per round, per living ped, **after** financials/relations resolve, **before** the street renders.

---

## 1. Ped fields

### Persistent (set at creation, never change)

| Field | Values | Notes |
|-------|--------|-------|
| name | random | identity anchor |
| skin | 0–4 | identity anchor |
| type | man | (women/children later) |
| **faction** | army / business / people | their *born* allegiance — NEW |

### Per round (calculated)

| Field | Values | Notes |
|-------|--------|-------|
| state | alive / dead | can flip to dead |
| employed | true / false | do they hold their faction role this round? |
| happiness | 0–10 | see §3 |
| role | content / neutral / thief / protestor / gone | see §5 — what they *do* on the street |

Note the split your instinct nailed: **faction ≠ role.** An `army` ped can walk the street as a displaced civilian when you've gutted security — and that gap is what hurts them.

---

## 2. Inputs (all existing systems)

| Input | Source | Range |
|-------|--------|-------|
| factionRelation | military / business / people relation | −10 … +10 |
| relevantBudget | the budget that faction cares about (§4) | 0 … 10 |
| charisma | dictator charisma | −10 … +10 |
| volatility | how hard their faction relation swung vs last round | 0 … 2 |
| education | education budget | 0 … 10 |

---

## 3. Happiness formula

```
happiness = clamp(
    5
    + factionFortune        // §4   ~ −4 … +4
    + charismaTerm          //      ~ −2 … +2   (global)
    - displacementPenalty   //      0 or 2
    - volatilityPenalty,    //      0 … 2
    0, 10)
```

| Term | Formula | Range | Meaning |
|------|---------|-------|---------|
| factionFortune | `(factionRelation / 10) * 3 + budgetSignal` | −4 … +4 | is their tribe doing well under you (biggest term) |
| charismaTerm | `(charisma / 10) * 2` | −2 … +2 | a charming tyrant lifts *everyone's* floor — charisma's first on-screen role |
| displacementPenalty | `2` if displaced (§4), else `0` | 0 / 2 | the personal sting of losing your place, on top of the raw numbers |
| volatilityPenalty | `min(2, abs(factionRelation − lastFactionRelation) * 0.4)` | 0 … 2 | whiplash breeds anxiety; punishes the manic over-intervener |

---

## 4. Faction fortune & employment

`budgetSignal` maps the faction's relevant budget to −1 … +1:

| Faction | relevantBudget | budgetSignal | Tax penalty |
|---------|----------------|--------------|-------------|
| army | security | `(security − 5) / 5` | — |
| business | infrastructure | `(infrastructure − 5) / 5` | `−0.5` if businessTax > 45 |
| people | health | `(health − 5) / 5` | `−0.5` if peopleTax > 30 |

**Employment** — does the ped hold their faction role, or get bumped to civilian?

| Faction | Holds role if… | Else |
|---------|----------------|------|
| army | `security ≥ 4` AND `militaryRel ≥ 0` | demobilized → civilian (+displacement) |
| business | `businessRel ≥ 0` AND `infrastructure ≥ 3` | ruined → civilian (+displacement) |
| people | always (base populace) | never displaced |

Displacement only bites army & business peds — the `people` faction *is* the civilian baseline, so it has nowhere to fall *from*.

---

## 5. Role assignment — happiness × education (the fork)

This is the "too dumb to revolt" thesis, rendered: same misery, two different streets.

| Condition | Role |
|-----------|------|
| happiness ≥ 6 | **content** — does their job, strolls |
| happiness 4–5 | **neutral** — present, idle, no trouble |
| happiness ≤ 3 AND education ≤ 4 | **thief** — disorganized desperation |
| happiness ≤ 3 AND education ≥ 5 | **protestor** — organized, aimed at *you* |
| happiness ≤ 1 | small chance **gone** (emigrate/die); otherwise thief/protestor per education |

Keep them ignorant → unrest shows up as petty theft you can police away.
Let them learn → unrest shows up as a mob with a target.

---

## 6. The visible tell (so the player reads it without a number)

| Role | Posture | Grouping | Pace |
|------|---------|----------|------|
| content | upright | solo, spread | normal stroll |
| neutral | slack | solo | slow |
| thief | skulking | alone, near shops | fast, furtive |
| protestor | agitated, sign | **clustered with other protestors** | stationary group |
| gone | — | removed / leaves an absence | — |

---

## 7. Loop-closer (so visible mood has a cost)

```
protestorCount = count(role == protestor)
peopleRelation -= floor(protestorCount / 3)   // every ~3 protestors = −1, tune
```

Optional flavor: thieves skim a trickle of treasury (petty crime), small enough to read as texture, not punishment.

---

## 8. Per-round pseudo-logic

```
for ped in peds where state == alive:
    rel        = relationFor(ped.faction)
    budgetSig  = budgetSignalFor(ped.faction)        // §4
    fortune    = (rel / 10) * 3 + budgetSig
    charismaT  = (charisma / 10) * 2
    volatility = min(2, abs(rel - ped.lastRel) * 0.4)

    ped.employed = holdsFactionRole(ped, budgets, rel) // §4
    displacement = (ped.faction in [army, business] and not ped.employed) ? 2 : 0

    ped.happiness = clamp(5 + fortune + charismaT - displacement - volatility, 0, 10)
    ped.role      = assignRole(ped.happiness, education)  // §5
    ped.lastRel   = rel

peopleRelation -= floor(count(role == protestor) / 3)    // §7
```

---

## 9. Worked example — "Marco", faction = army

| Round | What you did | sec | milRel | char | employed? | happiness | role |
|-------|--------------|-----|--------|------|-----------|-----------|------|
| 1 | funded the army | 7 | +4 | +2 | yes | **7.0** | content — in uniform, strolling |
| 4 | gutted security to cover a deal | 2 | −1 | +2 | **no** (demobilized) | **0.5** | **thief** (education low) |

Marco didn't change. *You* did. Same name, same face the player's seen for four rounds — content soldier to desperate thief — and they watched themselves cause it. That arc is the entire payoff, and it costs you nothing extra to generate.

---

## Out of my lane
The final weights, the displacement/volatility magnitudes, and how hard `protestor → peopleRelation` bites are **systems-designer** calls — I've given sensible defaults to start. Whether `gone` peds get a memorial/absence in the street (the persistence/scar layer) is a **street-view 0.2** question.