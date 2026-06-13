besides the whole sprint thing, I think a few things could be interesting.

enhance secret room logic:
currently the way the logic works is that we enable the secret room if we started round 9 with any factionn with 10 respect. that makes it incredibly hard to achieve. I think this needs to be extended.
The new logic is:
If a player has by round 9, >= 5 of respect with one or more factions we enable the secret room.
The higher the respect by the faction is, the less chance we have to get a bad ending (there are always two endings for each secret room), charisma can weigh in a little in favor of a good ending.
Also, we need to do some i18n to the strings (currently harcoded english).
Finally, we'll need the description of the room and the action button to appear in the action panel. Similar to how we have the Accept/Reject law in the Law view. or the 4 interaction options in the Meet view.

// weird laws — BACKLOG (target: Sprint 5, visual sprint)
// STATUS: design captured, clarifications resolved 2026-06-12

## Weird Laws

A small set of absurd laws that occasionally replace the normal law proposal.
Intended to punctuate the serious tone with dry humour; low gameplay stakes,
high visual payoff (visual effects deferred to sprint 5).

### Trigger mechanics
- Each round, **~10% chance** the law slot is replaced by a weird law from `???`
- Pool is the full table below; pick randomly (no weighting needed for v1)
- At most one weird law per run in the pool at a time (if active, no new weird
  law can appear until this one is repealed or the run ends — prevents stacking)
- Expected frequency: ~65% of runs see at least one; satisfies "at least once
  per 2 runs" target without guaranteeing every run

### Accept / Reject behaviour
- **Accept**: apply the one-time gameplay effect listed; store the law ID in
  `activeWeirdLawEffects: WeirdLawId[]` in the game store (for visual
  consequence wiring in sprint 5)
- **Reject**: no consequence — `???` is not a real faction; no relation penalty
- Appears in the Log tab like a normal law (`Law Proposal by ???`)
- Can be repealed at normal cost (tier based on effect size) — no special rules

### Data structure
Lives in its own asset file `src/assets/weirdLaws.ts`. Follows the same `Law`
shape as normal laws but with `faction: 'unknown'` and a `visualConsequenceId`
field (string, unused until sprint 5). i18n keys in `laws` namespace.

### Law table

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

### Sprint split
- **Sprint 5 (gameplay only)**: trigger logic, law pool, accept/reject, store
  flag, i18n, Log tab display — NO 3D work
- **Sprint 5 (visual pass)**: wire `activeWeirdLawEffects` → visual consequence
  registry → 3D scene changes


// balancing idea — CAPTURED → design/gdd/early-game-grace-period.md (target: Sprint 4)
// negative relation deltas dampened ×0.25 in round 1, ×0.50 in round 2, normal from round 3
// positive deltas always full strength. timer 180s/150s/120s. starting relations unchanged at 0.
// implemented via applyGraceDampening() helper at handleRelations() call site.