# Street View System GDD

## 1. Overview

The Street View tab renders a living visualization of the player's country. Every round, the composition of buildings, props, decals, and citizens updates to reflect current budget levels and faction relations. Players can click buildings and statues for flavor descriptions. Twenty-five persistent citizens walk the streets; their full behavioural simulation (identity, happiness, employment, roles, death, and feedback into relations/treasury) now lives in [citizen-simulation.md](citizen-simulation.md). This document owns the **environment** half — assets, buildings, statues, and clickable props. The Street View has no gameplay mechanics of its own — it is a readable, darkly comedic mirror of the player's decisions.

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
Skybox Overcast, Skyline Poor, Poor Buildings 1–5 (cracked apartment, leaning apartment, rundown house, improvised market, burned graffitied building), Dead Tree ×2, Streetlight ×1, Billboard ×2, Empty Statue Pedestal ×3, Burned Decal ×8, Pothole Decal ×10, Burning Trash Can ×4.

**Infrastructure — Normal tier:**
Skybox Grey, Skyline Normal, Normal Buildings 1–5 (4-storey apartment, 2-storey residential, mixed-use, market, government office), Tree ×10, Park Bench ×6, Electric Pole ×6, Streetlight ×4, Construction Site ×2, Billboard ×2, Empty Statue Pedestal ×3.

**Infrastructure — Rich tier:**
Skybox Sunny, Skyline Rich, Rich Buildings 1–5 (luxury tower, grand hotel, corporate HQ, luxury mall, monumental government palace), Palm Tree ×10, Bush ×5, Park Bench ×1, Electric Pole ×1, Luxury Streetlight ×6, Big Fountain ×2, Luxury Garden ×2, Billboard ×2, Empty Statue Pedestal ×3.

**Security — Disorder tier:**
Graffiti Decal ×10, Barricade ×2.

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

### 3.4 Citizens

The citizen simulation — identity, happiness, employment, role assignment (content/neutral/thief/protestor/gone), death, the outfit-precedence visual mapping, body type, and the feedback into `peopleRelation`/`treasury` — is owned by **[citizen-simulation.md](citizen-simulation.md)**. Street View consumes the per-ped render data it emits (`{ outfit, bodyType, role/posture, skin, alive }`) and is responsible only for placing and animating those peds in the scene.

> The earlier cosmetic-only model (appearance-state distribution, `netWorth`, per-round outfit randomisation) has been superseded by the behavioural model in citizen-simulation.md. See its §3.2 for the outfit precedence chain and §4 for all formulas.

---

## 4. Formulas

Street View has no formulas of its own — it is a presentation layer. All citizen
math (happiness, employment, role fork, death, population, feedback) lives in
[citizen-simulation.md §4](citizen-simulation.md). Environment asset selection is
the tier-table lookups in §3.1 (no math beyond the tier boundaries listed there).

---

## 5. Edge Cases

- **All 25 citizens dead**: Street View renders empty streets — no peds to place. (Citizen death/population is owned by citizen-simulation.md; this is just the render consequence.)
- **Statue pedestals with no statues purchased**: Empty Statue Pedestal renders. Clickable; description: *"A pedestal awaits its destiny."*
- **Language switch mid-round**: Click descriptions must update immediately (use translation function in component deps — see Deals tab bug precedent).

> Citizen-state edge cases (appearance extremes, death-below-minimum) now live in [citizen-simulation.md §5](citizen-simulation.md).

---

## 6. Dependencies

- **Budget System** (`game-concept.md §5`): infrastructure, security, health expenditure values drive asset tiers and citizen appearance.
- **Relations System** (`game-concept.md §4`): military and business relations drive appearance distribution.
- **Shop System** (`game-concept.md §9`): statue purchases control which statue model occupies pedestals.
- **3D Scene** (`game-concept.md §11`): Three.js scene, clickable object mechanic (same as Meet tab), camera position for Street tab.
- **3D Asset Pipeline**: model files for all environment asset types in the CSV. (Citizen meshes/outfits are specified by citizen-simulation.md → `/asset-spec`.)
- **Round System**: environment asset tiers re-evaluate at round end. (Citizen recompute is owned by citizen-simulation.md, which runs in the same resolution step.)
- **Citizen Simulation** (`citizen-simulation.md`): emits the per-ped render data (`{ outfit, bodyType, role/posture, skin, alive }`) that Street View places and animates.

---

## 7. Tuning Knobs

| Knob | Current Value | Effect |
|------|--------------|--------|
| Infrastructure tier boundaries | 1–3 / 4–7 / 8–10 | Poor / Normal / Rich asset set cutoffs |
| Security tier boundaries | 1–3 / 4–7 / 8–10 | Disorder / Controlled / Militarised prop cutoffs |

> Citizen tuning knobs (population, death rates, role thresholds, feedback) live in [citizen-simulation.md §7](citizen-simulation.md).

---

## 8. Acceptance Criteria

- [ ] Street View tab renders assets matching the current infrastructure tier (Poor / Normal / Rich) each round
- [ ] Street View tab renders security props matching the current security tier (Disorder / Controlled / Militarised) independently of infrastructure tier
- [ ] Clicking a building opens a description panel with the correct flavor text
- [ ] Clicking a purchased statue opens the panel with the correct plaque text
- [ ] Citizens emitted by citizen-simulation.md walk in the Street View scene with the correct outfit/body/skin
- [ ] Citizens who are dead do not render for the remainder of the run
- [ ] All descriptions and panel text update immediately on language switch

> Citizen-behaviour acceptance criteria (generation, happiness, roles, death, feedback, click-inspect) live in [citizen-simulation.md §Acceptance Criteria](citizen-simulation.md).
