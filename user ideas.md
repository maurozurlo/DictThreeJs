# Ideas Inbox

Raw captures — transfer to a GDD or sprint backlog before acting on.

---

## Bugs / Small fixes (backlog)

### Coup warning — needs advance notice
The coup currently only appears in the DayEnded dialog. Player has no chance to react. `coupWarningFaction` and `coupArmedLastRound` state already exists but isn't surfaced prominently.
- Add a visible warning in the log at round end when coup conditions are approaching
- OR: persistent HUD indicator while `coupWarningFaction` is set
- Rule: player must have at least one full round to adjust before a coup fires

### Remove daily events (random round-start relation adjustments)
Random relation deltas at the start of each round reduce player agency without adding decisions. The game has enough complexity from periodic events, budget effects, laws, deals, and meet actions. Candidate for removal.

### Difficulty selection UI
Three difficulty buttons on New Game use identical styling to all other buttons. Needs visual differentiation — options: smaller buttons, modal/dialog, same-row layout, styled group with separator. See `src/components/Modal/Modal.tsx` (already exists, may be usable).

---

## Feature ideas (backlog)

### Player name input
Optional text input on the difficulty/new-game screen. Defaults to "The Leader" (EN) / "Él Líder" (ES) if left blank. Referenced later: end-game screen, statue plaques, laws, deals.

### Advance round button tooltip
Animated tooltip or visual indicator on the `>` button when all required round actions are complete (law + deal decided + meet action taken). Helps first-time players know they can advance.

### Sell back shop items
Emergency sell-back for purchased items (statues, media coverage) at reduced price. Inspired by the treasury-deficit-from-periodic-events emergent gameplay. Player can liquidate statues when in crisis.

### Treasury deficit from periodic events (keep as feature, do not fix)
Agreeing to a costly periodic event when treasury is insufficient results in negative balance. Player must recover before advancing. Discovered to be fun emergent gameplay — do not add a blocking guard.

---

## Visual Sprint (Sprint 5 candidate)

### Street View Asset System
Full asset spec in `STREET VIEW 0.1 REQUIREMENTS - Sheet2.csv`.

Assets are driven by two independent axes:
- **Infrastructure budget (0/5/10)**: skybox, skyline, buildings (poor/normal/rich), trees, benches, streetlights, construction sites, billboards, decals (burn marks, potholes)
- **Security budget (0/5/10)**: disorder props (graffiti, barricades, burning trash cans) at low end; surveillance and military props (cameras, guard posts, tanks, cannon, machine gun nests, searchlights) at high end
- **Buyable (shop)**: Bronze / Silver / Gold dictator statues — placed by player via shop

Building variety planning (how many of each tier appear, street layout) to be balanced during sprint.

### Building + Statue Descriptions
Clicking a building or statue in Street view shows a description in the action panel (same click-on-3D-object mechanic as Meet tab):
- Apartment Building example: "Many people live here, happily."
- Statue level 1 (Bronze): plaque reads "HE WAS PRESENT"
- Statue level 2 (Silver equestrian): plaque reads "HE WAS PRESENT TWICE"
- Statue level 3 (Gold triumph): plaque reads "HISTORY BEGAN ON HIS BIRTHDAY"

---

### Citizens Simulation
Eye candy only — no gameplay decisions are made based on individual citizens.

**Starting state**: 25 random citizens generated at playthrough start.

**Per-citizen persistent data** (stored — only 3 fields):
- `name`: string (randomly generated)
- `skinColor`: color index — only persistent appearance data; survives all state changes
- `alive`: boolean

**Per-round computed values** (derived from game state, not stored):
- `happiness`: derived from people relation score
- `netWorth`: derived from business relation + treasury level
- `bodyType`: derived from health budget — low → all slim, normal → random mix of slim/fit/fat, high → all fit
- `appearanceState`: computed from budget/relation conditions (see below)

**Appearance state (computed each round)**:
Each round a target distribution of the 25 citizens is computed from current game state, then each citizen is assigned a state from that pool (skinColor preserved across reassignments).

Distribution rules (applied as a gradient, not binary):
- `army` share: scales with security budget × military relations. At security max + military relations +10 → 100% army (no civilians at all). At security low + military relations bad → 0% army.
- `thief` share: scales with security budget low AND military relations bad. Inverse of army.
- `businessman` share: scales with infrastructure good AND business relations good.
- `civilian` (default): remainder after the above shares are allocated.

Priority for edge cases (e.g. max military + low security): army wins over thief — a militarised state doesn't show thieves on the street even if security spending is low.

Outfit per state: all states use skinColor from stored value; `civilian` additionally randomizes pants + torso colors from predefined lists each round. Body type applied on top of all states.

**Per-round progression**:
- Low health budget → each alive citizen has a chance to die permanently (never spawns again this run)
- Citizens walk randomly in Street view; clicking opens a stat panel showing computed values

### Eliminate: Representative Disappears
- When a faction representative is eliminated, stop rendering their character for the rest of that round
- Next round: they reappear normally (simple visibility toggle, no death scene)
- Future (deferred): comedic exit animation — trapdoor fall, toy crane lift, etc.

### Representative Names
- Each faction representative gets a unique name
- On elimination, the name (and possibly texture) changes to suggest a new representative
- Scoping details for visual sprint planning

---

## Sound/Music Sprint (Sprint 6 candidate)

### Sound Effects
Actions that warrant specific sounds (full list TBD — spawn `/sound-designer` agent to generate asset spec):
- Accept/reject law: stamp-on-paper thud
- Eliminate: gunshot + Wilhelm scream
- Other game actions TBD

### Music
| Track | Purpose |
|-------|---------|
| Jazz ambient × 5 | Background — gameplay rounds, randomly selected |
| Tense variant × 1 | Triggers when any relation is critically low |
| Good ending theme × 1 | Victory / good ending screen |
| Bad ending theme × 1 | Loss / bad ending screen |
| Menu theme × 1 | Main menu |

**Total: ~9 tracks** — must stay feasible for a solo dev team.
Source strategy TBD: royalty-free / AI-generated / commissioned.
