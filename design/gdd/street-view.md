# Street View System GDD

## 1. Overview

The Street View tab renders a living visualization of the player's country. Every round, the composition of buildings, props, decals, and citizens updates to reflect current budget levels and faction relations. Players can click buildings and statues for flavor descriptions. Twenty-five randomly generated citizens walk the streets, their outfits and body types computed each round from health, security, infrastructure, and military relation values. The Street View has no gameplay mechanics — it is a readable, darkly comedic mirror of the player's decisions.

---

## 2. Player Fantasy

You look out at your city and see what you've built. After gutting the health budget, the streets are thin, hollow-eyed people. After maxing security and the military, there's not a civilian in sight — just soldiers as far as the eye can see. After buying three statues of yourself, they loom over a crumbling neighbourhood with potholes and burning trash cans. The city tells the truth even when your treasury report doesn't.

---

## 3. Detailed Rules

### 3.1 Asset Tiers

Assets are divided by two independent axes. Each axis has three tiers based on the corresponding expenditure value (1–10 scale).

**Infrastructure axis** (drives skybox, skyline, buildings, vegetation, street furniture):

| Tier | Expenditure | Label |
|------|-------------|-------|
| Low | 1–3 | Poor |
| Medium | 4–7 | Normal |
| High | 8–10 | Rich |

**Security axis** (drives disorder props and military props):

| Tier | Expenditure | Label |
|------|-------------|-------|
| Low | 1–3 | Disorder |
| Medium | 4–7 | Controlled |
| High | 8–10 | Militarised |

Both axes are evaluated independently each round. A city can have Rich buildings and Disorder streets simultaneously.

### 3.2 Asset Manifest

Full model list and counts from `STREET VIEW 0.1 REQUIREMENTS - Sheet2.csv`.

**Infrastructure — Poor tier:**
Skybox Overcast, Skyline Poor, Poor Buildings 1–5 (cracked apartment, leaning apartment, rundown house, improvised market, burned graffitied building), Dead Tree ×2, Streetlight ×1, Billboard ×2, Empty Statue Pedestal ×3, Burned Decal ×8, Pothole Decal ×10.

**Infrastructure — Normal tier:**
Skybox Grey, Skyline Normal, Normal Buildings 1–5 (4-storey apartment, 2-storey residential, mixed-use, market, government office), Tree ×10, Park Bench ×6, Electric Pole ×6, Streetlight ×4, Construction Site ×2, Billboard ×2, Empty Statue Pedestal ×3.

**Infrastructure — Rich tier:**
Skybox Sunny, Skyline Rich, Rich Buildings 1–5 (luxury tower, grand hotel, corporate HQ, luxury mall, monumental government palace), Palm Tree ×10, Bush ×5, Park Bench ×1, Electric Pole ×1, Luxury Streetlight ×6, Big Fountain ×2, Luxury Garden ×2, Billboard ×2, Empty Statue Pedestal ×3.

**Security — Disorder tier:**
Graffiti Decal ×10, Barricade ×2, Burning Trash Can ×4.

**Security — Controlled tier:**
Guard Post ×2, Security Camera Pole ×4.

**Security — Militarised tier:**
Tank ×2, Cannon ×4, Machine Gun Nest ×2, Searchlight ×2.

**Buyable (Shop — replaces Empty Statue Pedestals):**

| Shop Tier | Model | Plaque |
|-----------|-------|--------|
| Statue 1 | Bronze Dictator Statue (standing) | HE WAS PRESENT |
| Statue 2 | Silver Dictator Horse Statue (equestrian) | HE WAS PRESENT TWICE |
| Statue 3 | Golden Dictator Triumph Statue (horse, woman, crushed bureaucrats) | HISTORY BEGAN ON HIS BIRTHDAY |

### 3.3 Clickable Objects

Clicking a building, statue, or notable prop in the Street View opens a description panel (same mechanic as clicking faction representatives in the Meet tab).

Example descriptions:
- Apartment Building: *"Many people live here, happily."*
- Poor Building: *"Many people live here."*
- Government Office: *"Important paperwork happens here."*
- Statue (Bronze): *"There's a plaque on this statue. It reads: HE WAS PRESENT."*
- Statue (Silver): *"There's a plaque on this statue. It reads: HE WAS PRESENT TWICE."*
- Statue (Gold): *"The plaque reads: HISTORY BEGAN ON HIS BIRTHDAY."*
- Tank: *"Old Rusty, the troops call him. Very good boy."*
- Burning Trash Can: *"Hot."*

Full description copy TBD — tone should match the game's earnest absurdism.

### 3.4 Citizens System

#### Data model

Each citizen stores exactly three persistent fields:

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | Randomly generated at game start; never changes |
| `skinColor` | index | Chosen from a predefined skin-color list at generation; persists across all state changes |
| `alive` | boolean | Set to false on death; never set back to true |

All other visual properties are computed each round from game state and are not stored.

#### Per-round computed values

| Property | Source |
|----------|--------|
| `happiness` | Derived from People relations score |
| `netWorth` | Derived from Business relations + treasury level |
| `bodyType` | Derived from health budget (see §3.5) |
| `appearanceState` | Derived from budget/relations (see §3.6) |
| `pantsColor` | Randomly selected each round from predefined list (civilian state only) |
| `torsoColor` | Randomly selected each round from predefined list (civilian state only) |

#### Population

25 citizens are generated at playthrough start. Dead citizens are never replaced — population shrinks over a brutal run.

#### Per-round death check

Citizens in the `civilian` appearance state with low health budget have a chance to die permanently. See formula in §4.

### 3.5 Body Type Rules

Body type is computed for all 25 citizens from the current health expenditure value:

| Health expenditure | Body type distribution |
|--------------------|----------------------|
| Low (1–3) | All citizens render as **slim** |
| Normal (4–7) | Random distribution: slim / fit / fat |
| High (8–10) | All citizens render as **fit** |

Three mesh variants exist: `slim`, `fit`, `fat`. Body type applies regardless of appearance state.

### 3.6 Appearance State Distribution

Each round the system computes target share values for the alive citizen population, then assigns each citizen an appearance state drawn from that distribution. `skinColor` is preserved across reassignments.

**States and their conditions:**

| State | Outfit | Conditions |
|-------|--------|-----------|
| `army` | Army uniform; skinColor only | Security high AND military relations positive |
| `thief` | Thief outfit; skinColor only | Security low AND military relations negative |
| `businessman` | Business suit; skinColor only | Infrastructure high AND business relations positive |
| `civilian` | 3-texture model; pants + torso randomised each round | Default — remainder |

**Priority rule for edge cases:** `army` > `thief` > `businessman` > `civilian`. If army conditions are met, army share takes precedence even if thief conditions are also met.

**Extremes:**
- Security expenditure 8–10 AND military relations = +10 → 100% army (no civilians visible)
- Security expenditure 1–3 AND military relations ≤ −5 → 0% army, high thief share

---

## 4. Formulas

### 4.1 Citizen Appearance Distribution

Let:
- `S` = security expenditure (1–10)
- `Mr` = military relations (−10 to +10)
- `I` = infrastructure expenditure (1–10)
- `Br` = business relations (−10 to +10)

Normalise each to [0, 1]:
```
S_norm  = (S − 1) / 9
I_norm  = (I − 1) / 9
Mr_norm = (Mr + 10) / 20       // 0 at −10, 1 at +10
Br_norm = (Br + 10) / 20
Mr_neg  = max(0, −Mr) / 10     // 0 when Mr ≥ 0, scales to 1 at Mr = −10
```

Shares (evaluated in priority order; each subsequent share is capped by remaining pool):
```
army_share        = clamp(S_norm × Mr_norm, 0, 1)
remaining_1       = 1 − army_share

thief_raw         = clamp((1 − S_norm) × Mr_neg, 0, 1)
thief_share       = min(thief_raw, remaining_1)
remaining_2       = remaining_1 − thief_share

businessman_raw   = clamp(max(0, I_norm − 0.4) / 0.6 × Br_norm, 0, 1)
businessman_share = min(businessman_raw, remaining_2)

civilian_share    = 1 − army_share − thief_share − businessman_share
```

Citizen count per state = `floor(share × alive_count)`. Remainder assigned to `civilian`.

**Example — security 8, military +8, infrastructure 5, business +3:**
```
S_norm = 0.78, Mr_norm = 0.90, army_share = 0.70 → 70% army (17–18 of 25)
thief: S is high → thief_share ≈ 0
businessman_raw = max(0, 0.44−0.4)/0.6 × 0.65 = 0.07 × 0.65 = 0.04
civilian_share ≈ 0.26
```

### 4.2 Citizen Death Chance

```
death_chance = max(0, (HEALTH_DEATH_THRESHOLD − H) / HEALTH_DEATH_THRESHOLD) × DEATH_RATE_MAX
```

Where:
- `H` = health expenditure (1–10)
- `HEALTH_DEATH_THRESHOLD` = 3 (tuning knob — death risk only when health ≤ 3)
- `DEATH_RATE_MAX` = 0.15 (tuning knob — up to 15% of civilians die per round at health = 1)

Applied only to citizens in `civilian` state. `army`, `businessman`, and `thief` citizens are assumed to have access to food or are otherwise protected.

**Example — health = 1:**
```
death_chance = (3 − 1) / 3 × 0.15 = 0.10 → each civilian has 10% chance to die
```

### 4.3 Stat Panel Values

```
happiness = clamp(50 + (people_relations × 5), 0, 100)   // 0–100%
net_worth = clamp(base_nw + (business_relations × 500) + (treasury / 50), 0, ∞)
```

Where `base_nw` = 1000. Values are display-only flavor.

---

## 5. Edge Cases

- **All 25 citizens dead**: Street View renders empty streets. No citizens walk. Stat panel shows "The streets are empty."
- **Security HIGH + military relations VERY NEGATIVE**: army_share = 0 (Mr_norm is near 0), thief_share is also 0 (S_norm is high). Most citizens are businessmen or civilians. A well-funded but diplomatically failed military state looks deceptively normal on the street.
- **All three positive conditions simultaneously** (security high, infrastructure high, business high, military high): army wins priority. A fully militarised prosperous state shows army men — no businessmen visible despite conditions.
- **Death below minimum population**: Population never goes below 0. Death rolls are skipped if `alive_count = 0`.
- **Statue pedestals with no statues purchased**: Empty Statue Pedestal renders. Clickable; description: *"A pedestal awaits its destiny."*
- **Language switch mid-round**: Click descriptions must update immediately (use translation function in component deps — see Deals tab bug precedent).

---

## 6. Dependencies

- **Budget System** (`game-concept.md §5`): infrastructure, security, health expenditure values drive asset tiers and citizen appearance.
- **Relations System** (`game-concept.md §4`): military and business relations drive appearance distribution.
- **Shop System** (`game-concept.md §9`): statue purchases control which statue model occupies pedestals.
- **3D Scene** (`game-concept.md §11`): Three.js scene, clickable object mechanic (same as Meet tab), camera position for Street tab.
- **3D Asset Pipeline**: model files for all 49 asset types in the CSV, 3 body types × 4 outfit states × skin color variants for citizens.
- **Round System**: citizen death check and appearance redistribution run at round end (same timing as budget effects).

---

## 7. Tuning Knobs

| Knob | Current Value | Effect |
|------|--------------|--------|
| `CITIZEN_COUNT` | 25 | Starting population |
| `HEALTH_DEATH_THRESHOLD` | 3 | Health expenditure below which citizens can die |
| `DEATH_RATE_MAX` | 0.15 | Maximum per-round death probability per civilian at health = 1 |
| `BUSINESSMAN_INFRA_FLOOR` | 0.4 (normalized ≈ infra 4.6) | Minimum infrastructure before businessmen appear |
| `ARMY_FULL_THRESHOLD` | Mr = +10, S = 10 | Conditions for 100% army population |
| Stat panel `base_nw` | 1000 | Baseline net worth before relation modifiers |

---

## 8. Acceptance Criteria

- [ ] Street View tab renders assets matching the current infrastructure tier (Poor / Normal / Rich) each round
- [ ] Street View tab renders security props matching the current security tier (Disorder / Controlled / Militarised) independently of infrastructure tier
- [ ] Clicking a building opens a description panel with the correct flavor text
- [ ] Clicking a purchased statue opens the panel with the correct plaque text
- [ ] 25 citizens are generated at playthrough start with unique names and skin colors
- [ ] Citizens walk in the Street View scene
- [ ] Clicking a citizen opens a stat panel showing name, happiness, net worth
- [ ] Body type distribution changes visibly based on health budget tier (slim-dominant at low, fit-dominant at high)
- [ ] At security 8–10 AND military relations +10, the majority of citizens render as army men
- [ ] At security 1–3 AND military relations ≤ −5, thief outfits appear in significant proportion
- [ ] Citizens who die (alive = false) do not render or respawn for the remainder of the run
- [ ] Population count visible in stat panel reflects alive citizens only
- [ ] All descriptions and stat panel text update immediately on language switch
