# Difficulty Curve and Emotional Arc
**Status**: Draft — reverse-documented from playtest observations (2026-06-13)
**Last Updated**: 2026-06-14

---

## 1. Overview

The game runs for 10 rounds. The difficulty curve is not linear — it has deliberate inflection points where pressure spikes (rounds 3 and 6 from periodic budget events) and a late-game narrowing where every decision carries permanent consequence. The emotional arc moves from cautious experimentation through mounting paranoia to a final round of survival or collapse.

---

## 2. Player Fantasy

The player should feel like a dictator who started confident, got scared, found a footing, lost it again, and is now clinging to power with sweaty hands in round 9. The game should never feel random — every death should be traceable to a specific mistake. But the game should feel like a pressure cooker: survivable in hindsight, agonizing in the moment.

The designed emotional sequence: **Optimism → First shock → Adaptation → Paranoia → Desperation → Resolution.**

---

## 3. Round-by-Round Arc

### Act 1: Orientation (Rounds 1–3)

| Round | Player Feeling | Mechanical Driver |
|-------|---------------|-------------------|
| 1 | "What does this do?" | Grace period active: negative relation deltas dampened. Budget surplus likely. Tutorial visible. |
| 2 | "I think I've got this." | Grace period ends. First real relation consequences arrive. Still comfortable on treasury. |
| 3 | "Wait, what's this bill?" | **Periodic event fires.** First major budget demand. Player must decide under cost pressure for the first time. |

**Round 3 is the first difficulty cliff.** Players who have been spending freely hit a wall. Conservative players feel the reward of their caution. This is the first point where a run can start to visibly diverge.

---

### Act 2: Equilibrium and Paranoia (Rounds 4–6)

| Round | Player Feeling | Mechanical Driver |
|-------|---------------|-------------------|
| 4 | "Okay, I can manage this." | Recovery round. Recurring effects are now active from early laws/deals. First players hit positive relation values, which is actually threatening (coup risk arm zone). |
| 5 | "Something's off." | Coup warning system begins to matter. High-relation factions with low charisma surface the ⚠️ badge. Player may not know why yet. |
| 6 | "Not another one." | **Second periodic event fires.** Compounds with active recurring costs from round 3 commitments. More expensive than round 3 — intended. |

**Round 6 is the second cliff and the game's peak difficulty.** The player is managing recurring obligations from rounds 1–5 while absorbing a new cost spike. This is the most common death window.

---

### Act 3: Endgame Pressure (Rounds 7–10)

| Round | Player Feeling | Mechanical Driver |
|-------|---------------|-------------------|
| 7 | "I can see the end." | 3 rounds remaining. Special ending conditions become legible — faction at ≥5 at round 9 means targeting a special room. Coup-armed factions are now live threats. |
| 8 | "Every decision matters." | Coup armed checks are real and regular. Grace is exhausted for any threatened faction. One bad round can end the run. |
| 9 | **Special ending check fires.** | If any faction is ≥5, its special ending room activates. This is the "perfect run" reward. Normal run: advance through standard checks. |
| 10 | "Just survive." | Final round. Bankruptcy check fires on advancement. Overthrow check fires. Win if you reach the end. |

---

## 4. Difficulty Curve Shape

```
Difficulty
(player pressure / threat of loss)

HIGH  │
      │          ████
      │         ██  ██
      │    ████ ██  ██████████
      │   ██  ██          ███
      │  ██                 ██
      │ ██                   ██ (win)
LOW   └──────────────────────────
       1  2  3  4  5  6  7  8  9  10
              ↑              ↑
          Round 3         Round 6
         (1st cliff)    (2nd cliff)
```

The curve has two distinct peaks (rounds 3 and 6) rather than a monotonic rise. This is intentional: monotonic curves feel relentless; two peaks give players a moment of recovery after each crisis, which makes the second crisis feel more threatening because they know they've been through it before.

---

## 5. Named Inflection Points

| Name | Round | Type | Description |
|------|-------|------|-------------|
| Grace End | 2→3 | Mechanic toggle | Grace period dampening removed. Real consequences begin. |
| First Bill | 3 | Spike | First periodic budget event. Introduces cost-pressure pattern. |
| Coup Arm Zone | 4–5 | Rising threat | Relations can reach 6–8 from accumulated bribe/dialogue actions. Charisma drift begins to matter. |
| Second Bill | 6 | Spike | Second periodic event. Compounds with established recurring costs. Higher base cost than round 3. |
| Endgame Clarity | 7 | Shift | 3 rounds remaining becomes visible. Special ending paths either viable or lost. |
| Coup Hot Zone | 8 | Max threat | Grace is exhausted on any threatened faction. Armed check fires every round. |
| Win Gate | 10 | Resolution | Bankruptcy + overthrow check. Pass both to survive. |

---

## 6. Difficulty Modifier by Starting Condition

| Difficulty | Starting Treasury | Impact on curve |
|-----------|-------------------|-----------------|
| Easy | 1000 | Round 3 spike is absorbed without crisis; round 6 is the first real test. Extends the "orientation" phase to ~rounds 4. |
| Medium | 500 | Designed experience. Round 3 creates real pressure; round 6 is frequently a death point. |
| Hard | 150 | Round 1 is already a treasury emergency. Round 3 spike can be immediately fatal. Act 1 is the hardest phase. Act 2 becomes about survival, not optimization. |

---

## 7. Edge Cases

- **Rich but hated**: Player accumulates high treasury through aggressive taxation and expropriation; relations crater. Coup armed by round 5. Gold run financially but dead politically — illustrates the game's dual-resource tension.
- **Beloved but broke**: Player stays diplomatic; all factions high. Treasury drained by generous laws and bribes. Bankruptcy at round 8. The "nice dictator" death.
- **Perfect storm at round 6**: Player has round-3 periodic event recurring cost PLUS second periodic event firing PLUS negative charisma from expropriation. Can overdraw treasury by 200–400 in a single round. Recoverable only by emergency expropriation or favorable laws.
- **Special ending locked out**: Faction relation must be ≥5 at round 9 check — but player has been keeping all factions at 2–4 for safety. No special ending available. Clean run outcome (survive round 10) is still valid.

---

## 8. Tuning Knobs

| Knob | Current Value | Effect | Safe Range |
|------|--------------|--------|------------|
| Grace period dampening multiplier | See GDD: early-game-grace-period | Controls how forgiving rounds 1–2 are | 0.0 (no penalty) to 1.0 (no dampening) |
| Periodic event rounds | 3, 6 | Controls where the two pressure spikes land | Rounds 2–4 for first; rounds 5–8 for second |
| Periodic event cost magnitude | Varies by event | Controls spike height | Keep second ≥ first |
| Coup WARN_CHARISMA | −2 | Charisma threshold for yellow warning | −1 to −3 |
| Coup RELATION_THRESHOLD (armed) | 8 | Relation level to arm a faction | 7–9 |
| Special ending threshold | 5 | Minimum faction relation for special room at round 9 | 4–7 |
| Hard difficulty treasury | 150 | Sets Act 1 severity on Hard | 50–250 |

---

## 9. Acceptance Criteria

- [ ] A first-time player on Medium reaches round 3 before experiencing significant pressure (rounds 1–2 feel learnable)
- [ ] Round 3 periodic event creates a recognizable budget spike that players can trace to a specific cause
- [ ] Round 6 is a harder test than round 3 for the same player on the same run
- [ ] Hard difficulty creates financial pressure in round 1 (treasury ≤ 0 possible without immediate corrective action)
- [ ] Easy difficulty allows a player to make one major mistake (over-spending, bad law) and still survive past round 6
- [ ] The coup warning (⚠️) first appears naturally between rounds 4 and 6 for an "average" player who has been moderately aggressive with relation-building actions
- [ ] A player can identify, in retrospect, the specific decision that started their terminal decline

---

## Open Questions

- **Third spike?** Current curve has two spikes (rounds 3, 6) then a gradual rise. Consider a round-8 or round-9 event to raise the endgame ceiling — currently Act 3 is tense but not event-driven.
- **Charisma bleed rate**: Charisma can drift negatively from laws and expropriations. The rate at which this moves players into coup range is not explicitly designed — it emerges from accumulated decisions. Should it be quantified?
- **Difficulty curve for Hard**: Has not been playtested. The above Hard row is predicted, not observed.
