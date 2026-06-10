---
status: reverse-documented
source: src/
date: 2026-06-10
verified-by: Mauro Zurlo
---

# Dictator Simulator — Game Concept

> **Reverse-Documentation Notice**: This document was written after the initial
> implementation. It captures the game's design intent as clarified by the creator,
> not a pre-planned specification.

---

## 1. Overview

**Dictator Simulator** is a browser-based political survival strategy game. You play
as a newly installed dictator who must hold onto power for 10 rounds by managing three
factions (Military, Business, People), a national treasury, and your personal charisma.
Every round you make decisions — pass laws, accept or reject deals, meet with power
brokers — that ripple into faction loyalty and economic health.

Survive all 10 rounds without going bankrupt or being overthrown. Simple. Crushing.

---

## 2. Player Fantasy

You are not the hero. You are the dictator — calculating, occasionally despicable,
perpetually paranoid. The game channels the *Papers Please* energy: every decision
carries bureaucratic weight, but the scenarios are darkly absurd. You pass laws that
hurt your own people to keep the military happy. You bribe generals. You expropriate
businesses and watch your relations crater. You build statues of yourself.

The tension isn't in grand strategy — it's in the mundane horror of staying in power
one more round. Players should feel the cognitive dissonance of making obviously
terrible decisions because they have no better option.

**Core feeling**: "I know this is wrong. I'm doing it anyway. Maybe I can survive
one more round."

---

## 3. Core Loop

```
Round Start → Read Log (what happened last round)
           → Manage Budget (taxes + expenditures)
           → Decide a Deal (accept / reject)
           → Pass or Reject a Law
           → Take ONE Meet Action (Bribe / Dialogue / Expropriate / Eliminate)
           → End Round → Financials resolve → Events fire → Next round
```

Each round has a **real-time countdown**. Failing to take a Meet action before
the timer expires punishes the two weakest factions. The player can also
intentionally skip (accepting the penalty as a trade-off). Timer duration
should be short enough to create mild pressure without overstaying its welcome —
current 5-minute default is being evaluated for reduction.

---

## 4. Factions & Relations

Three factions whose loyalty you must manage:

| Faction | Represents | Key Sensitivities |
|---------|-----------|-------------------|
| **Military** | Security apparatus, coup risk | Security budget, expropriation, elimination |
| **Business** | Economic elite, financial base | Business taxes, infrastructure, education |
| **People** | General population, revolt risk | People taxes, health budget, high security |

**Relations range: –10 to +10.**
Any faction hitting –10 triggers a game over (overthrow).
Treasury hitting 0 triggers a game over (economic collapse).

Relations history is tracked per round for the end-game stats screen.

---

## 5. Budget System

Each round you collect income and pay expenses:

**Income**:
- People income = `200 × (peopleTaxes / 100)`
- Business income = `180 × (businessTaxes / 100)`
  - ×0.70 penalty if infrastructure < 3
  - ×1.10 bonus if infrastructure > 7
  - ×0.85 penalty if education < 3

**Expenses**:
- `(health + infrastructure + security + education) × 10`

**Spending effects on relations** (end of round):
- Security < 3 → Military −2 | Security > 7 → Military +1
- Health < 3 → People −2 | Health > 7 → People +1
- Infrastructure < 3 → Business −1, People −1 | Infrastructure > 7 → Business +1, People +1

**Tax penalties** (above threshold → faction loses 1 relation + player loses 1 charisma):
- People tax > 30
- Business tax > 45

**Education (planned)**: Currently reduces business income when neglected.
Planned expansion: low education also reduces the likelihood that the People
faction reaches overthrow threshold ("too uninformed to organize"). This
mechanic is deferred until the faction AI is mature enough to model it properly.

---

## 6. Meet Actions

Once per round the player may take one action against one faction:

| Action | Effect | Cost | Charisma |
|--------|--------|------|----------|
| **Dialogue** | +1 or −1 relations (chance-based, charisma-modified) | Free | None |
| **Bribe** | +3 relations | 40–80 treasury (by faction) | None |
| **Expropriate** | +30–120 treasury | −3 relations | −1 |
| **Eliminate** | Reset faction to 0 relations | Free (30% backlash to another faction) | −2 |

The 3D scene is functional here: clicking a faction's representative in the
Meet tab camera view initiates the interaction. Camera positions are tab-linked.

---

## 7. Charisma System

Charisma (–10 to +10) is a meta-resource representing your political capital:

- **Increases**: Making the "better" law decision (per faction net score),
  high health spending, buying statues (Shop)
- **Decreases**: Timer expiry without action (−1), high tax penalties (−1 each),
  Expropriation (−1), Elimination (−2)

**Charisma effects**:
- Dialogue success rate: base + `charisma × 0.03` (max ±0.25)
- Eliminate backlash: 30% base → 15% at high charisma (≥5), 45% at low (≤−5)
- Special ending outcome: `50% + (charisma / 10) × 25%` chance of good ending

---

## 8. Events

**Daily Events**: Random small per-round modifiers to one faction's relations.
One draws each round automatically.

**Periodic Events** (scripted, fixed rounds):
- Round 3: International Summit (3 options, treasury/relations trade-offs)
- Round 6: Economic Crisis (3 options)
- Round 9: Natural Disaster (3 options)

Periodic events lock the tabs until resolved.

**Mini-Challenges** (40% chance per non-periodic round): Accept/reject with
risk mechanics — rejection can trigger random faction penalties.

---

## 9. Shop System

Accessible any time via the Secret tab (bypasses tab lock):

| Item | Cost | Effect |
|------|------|--------|
| Media Coverage | 80 | Freeze People faction relations for the round |
| Media Shielding | 80 | Freeze Military faction relations for the round |
| Media Blackout | 80 | Freeze Business faction relations for the round |
| Statue (×3) | 100 / 150 / 200 | +1 charisma (max 3 statues total) |

Faction freezes reset after each round.

---

## 10. Win / Loss Conditions

**Loss — Overthrow**: Any faction relation drops to −10.
**Loss — Bankruptcy**: Treasury reaches 0.
**Victory**: Survive all 10 rounds without either loss condition triggering.

**Special Ending**: If any faction reaches +10 by round 9, a secret narrative
ending unlocks (accessible via the Secret tab). Outcome is charisma-weighted:
- Military max: "Emperor of the Wasteland" (good) or betrayed by generals (bad)
- Business max: Escape with stolen funds (good) or trapped at the airport (bad)
- People max: Call free elections and retire peacefully (good) or assassinated in
  the garden (bad)

---

## 11. 3D Scene & Visual Presentation

The game renders a Three.js scene visible behind the UI. Tab navigation moves
the camera to contextually relevant positions:

- Meet tab → camera faces the three faction representatives
- Laws tab → camera shows the law/governance area
- Street tab → overhead/street view of the city (coming soon)

**Street View (planned)**: Shows the current state of the country as a living
visualization. Planned visual feedback:
- High security budget → streets filled with army figures
- Statues purchased → visible monuments in the scene
- Future: additional aesthetic changes reflecting player decisions

This aesthetic layer reinforces the tone — decisions that feel bureaucratic on
paper have visible human consequences in the world.

---

## 12. Tone & References

**Tone**: Overly serious meets dumb shit. The game never winks at the camera —
every decision is presented with bureaucratic weight and earnest consequence
text. The absurdity emerges from the scenarios themselves, not from comedic
framing.

**Primary reference**: *Papers Please* — moral weight in mundane paperwork,
dark humor through accumulated consequence, not through jokes.

**Secondary feel**: The cynical gravity of *Reigns* without the card-flip
randomness — this game gives you information and makes you choose anyway.

---

## 13. Platform & Tech

- **Platform**: Browser (web)
- **Stack**: React 19, TypeScript, Three.js, Zustand, Vite
- **i18n**: Multi-language support implemented (language switcher active)
- **Save/Load**: JSON export/import implemented

---

## 14. Open Design Questions

1. **Timer duration**: 5 minutes is likely too long. What's the right pressure
   point? Should the timer accelerate in later rounds?
2. **Education mechanic expansion**: "Too dumb to revolt" mechanic — what's the
   design boundary? Hard threshold? Probability modifier? Waiting for faction
   AI improvements.
3. **Street view scope**: What visual changes are in scope for v1.0? Just statues
   + security army men, or more?
4. **Special ending discoverability**: Does the player know the secret ending
   exists before triggering it, or is it a genuine surprise?
5. **End-game stats screen**: What stats matter most to show on the victory/loss
   screen?
