# Weird Laws

**Status**: Design approved — pending implementation
**Target sprint**: 5
**Source**: User design session 2026-06-13

---

## 1. Overview

A small pool of absurd laws that occasionally replace the normal round law proposal. Proposed by faction `???` (unknown), they carry low gameplay stakes but high flavour value. Each round has a 10% chance of a weird law appearing, provided no weird law is currently active. Accepting applies a one-time gameplay effect; rejecting costs nothing.

---

## 2. Player Fantasy

The player feels like governing is unpredictable and occasionally surreal. A weird law interrupts the serious cadence of the game with dry humour — a moment of levity before the next budget crisis. The player might accept just to see what happens, or reject knowing it has no diplomatic cost.

---

## 3. Detailed Rules

- **Trigger**: each round, after the normal law offer is resolved, roll P=0.10. On success, and if no weird law is currently active, replace the next law offer with a random weird law from the pool.
- **Proposer**: faction `unknown`, displayed as `???` in the UI.
- **Accept**: apply the one-time gameplay effect listed in the law table. Store the law's `WeirdLawId` in `activeWeirdLawEffects: WeirdLawId[]` in the game store (for visual consequence wiring, Sprint 5 visual pass).
- **Reject**: no consequence. `???` is not a real faction; no relation penalty.
- **Log tab**: appears as `Law Proposal by ???` — identical display to normal laws.
- **Repeal**: can be repealed at normal tier cost. Repeal frees the active-weird-law slot for future rounds.
- **Active cap**: at most one weird law active per run. While one is active, no new weird law can appear.
- **Pool**: pick randomly from the full 14-law table. No weighting in v1.

### Law Table

| ID | Law Name | Gameplay Effect | Visual Consequence (Sprint 5) |
|----|----------|-----------------|-------------------------------|
| `weird_cemeteries` | 24/7 Cemeteries Act | +10 Treasury, +1 Business | Zombies wander streets |
| `weird_pigeon_hats` | Mandatory Pigeon Hats | +1 People, −10 Treasury | All pigeons wear tiny hats |
| `weird_night_sun` | Night Sun Initiative | +1 Business, −1 People | A second sun appears |
| `weird_reverse_funeral` | Reverse Funeral Program | +1 People, +1 Charisma | None |
| `weird_skeletons` | Skeleton Employment Act | +20 Treasury, +1 Business | Skeletons appear on plaza |
| `weird_extra_tuesdays` | Ministry of Additional Tuesdays | +1 Business, −1 People | +10s per round timer |
| `weird_giraffes` | National Giraffe Appreciation Act | +1 People | Random giraffes appear |
| `weird_idling` | Public Idling Initiative | +1 Military | Citizens stop moving |
| `weird_building_height` | Building Height Equality Act | +1 People, −1 Business | All buildings same height |
| `weird_water_coolers` | Department of Water Coolers | +10 Treasury | Meet room full of water coolers |
| `weird_backwards_walking` | Mandatory Backwards Walking Friday | +1 People, −1 Business | Some pedestrians walk backwards |
| `weird_statues` | Ministry of Excessive Statues | +1 Charisma | Plaza holds 10 mini statues |
| `weird_left_traffic` | National Left-Handed Traffic Trial | +1 Military, −1 People | Vehicles drive on left side |
| `weird_ghosts` | Legal Recognition of Ghosts | +1 People, +1 Business | Transparent citizens appear |

---

## 4. Formulas

```
P(weird law offered this round) = 0.10,  IF activeWeirdLaw === null
P(at least one in a 10-round run)       = 1 − 0.90^10 ≈ 65%
Expected weird laws per run (no repeals) ≈ 1.0
```

Repeal cost uses the standard tier ladder (story 2-8):
- Largest single effect ≤ 15 treasury-equivalent → SMALL tier (10 treasury)
- Largest single effect 16–25 → MEDIUM tier (20 treasury)
- Largest single effect ≥ 26 → LARGE tier (50 treasury)

For weird laws with mixed effects, use the single largest effect for tier classification.

---

## 5. Edge Cases

- **Weird law repealed mid-run**: slot is freed; a new weird law may appear in a subsequent round (same 10% trigger).
- **Run ends with weird law active**: `activeWeirdLawEffects` persists in save state for Sprint 5 visual wiring. No gameplay consequence at run end.
- **Normal law pool exhausted**: weird law trigger is independent of the normal law pool — a weird law can still appear even if all normal laws have been accepted.
- **Normal law pool exhausted AND no weird law pending**: no law offer that round. Weird law trigger does not fire if there is no law slot to fill.
- **Multiple-effect weird law**: each effect is applied independently. If one part cannot be applied (e.g. stat already at cap), the remaining effects still apply.

---

## 6. Dependencies

- **Law system** (`src/assets/laws.ts`, `src/Stores/GameState.ts` law pool logic) — weird laws share the offer slot and Log display.
- **Repeal system** (story 2-8, `src/Stores/RecurringHandler.ts`) — weird laws are repealable at standard tier cost.
- **Visual consequence registry** (`src/assets/visualConsequences.ts`, story 2-9) — Sprint 5 visual pass reads `activeWeirdLawEffects`.
- **i18n** (`public/locales/{en,es}/laws.json`) — all law names, descriptions, accept/reject text in the `laws` namespace.
- **Weird laws asset file** (`src/assets/weirdLaws.ts`) — new file, isolated from normal laws.

---

## 7. Tuning Knobs

| Knob | Default | Safe Range | Affects |
|------|---------|-----------|---------|
| Trigger probability | 10% | 5%–25% | Frequency of weird law appearances |
| Active cap per run | 1 | 1–3 | How many can stack simultaneously |
| Pool size | 14 | 5–20 | Variety; affects repeat rate per run |

---

## 8. Acceptance Criteria

- [ ] Weird law appears with ~10% frequency per round when no weird law is active (verifiable via deterministic seed test)
- [ ] At most one weird law active at a time — second trigger skipped while one is active
- [ ] Reject carries no relation penalty and no other consequence
- [ ] Weird law is repealable at standard tier cost based on largest effect size
- [ ] Repeal frees the active-weird-law slot for future rounds
- [ ] `activeWeirdLawEffects` array updated on accept; law ID added correctly
- [ ] All law names, descriptions, and accept/reject strings i18n'd (EN + ES)
- [ ] Weird laws appear in Log tab as `Law Proposal by ???`
- [ ] Sprint 5 visual consequences are stubbed in the registry — no 3D work in Sprint 5 gameplay pass
