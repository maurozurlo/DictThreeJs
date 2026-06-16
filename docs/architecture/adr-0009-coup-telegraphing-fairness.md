# ADR-0009: Coup Telegraphing & Fairness

## Status

Accepted — 2026-06-16. Authored alongside Sprint 6 (ADR-0008 P2 shipped). Establishes the
**fairness contract** for the coup system: what the player is guaranteed to see and act on
before a coup can end a run. The data source (effective relations) is already live from
ADR-0008/Story 6-1; this ADR governs the telegraphing/fairness design on top of it.

> **Authorship note:** authored and self-reviewed against the live `CoupHandler`
> implementation in an autonomous session; owner (Mauro Zurlo) / Technical-Director
> ratification recommended before the UI work in Story 6-7 ships the player-facing readout.

## Date

2026-06-16

## Last Verified

2026-06-16

## Decision Makers

Authored by Claude (autonomous session, 2026-06-16); pending owner (Mauro Zurlo) ratification.

## Overview

A coup is the harshest loss state in the game: a faction the player has empowered turns on
them. To be *fair* rather than *feel-bad*, a coup must be **telegraphed and avoidable** — the
player must get at least one full round of explicit, unambiguous warning, with visible inputs
they can act on, and no hidden RNG deciding the moment of death. This ADR fixes the contract:
**deterministic arming + a guaranteed grace round + a two-tier telegraph**, all read from the
*effective* relations of ADR-0008.

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Web Platform (browser) |
| **Domain** | Core logic / Game-over conditions |
| **Knowledge Risk** | LOW — no engine-specific APIs |
| **References Consulted** | `src/Stores/CoupHandler.ts`, `src/Constants/GameState.ts` (COUP block), ADR-0008 |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | None |

## Context

### Problem Statement

The coup check (`src/Stores/CoupHandler.ts`, run at step 0 of `resolveRound`) evaluates two
tiers against **effective** relations (base + in-window modifier contributions, re-clamped
±10 — ADR-0008 §6) and charisma:

- **Armed** — any faction `effectiveRelation ≥ RELATION_THRESHOLD` (8, ±1 from security spend)
  **AND** `charisma ≤ CHARISMA_THRESHOLD` (−3).
- **Yellow warning** — any faction `effectiveRelation ≥ WARN_RELATION` (6) **AND**
  `charisma ≤ WARN_CHARISMA` (−2).

On the first armed round the player today survives a **50% grace roll** (`GRACE_CHANCE`); a
second consecutive armed round (`coupArmedLastRound`/`graceTaken`) fires the coup with
certainty. The threatening faction is the highest-relation armed faction (tiebreak
military > business > people).

Two fairness gaps follow from this:

1. **No guaranteed warning round.** A player can cross from *safe* (or even yellow) straight
   into *armed* in a single round (a large relation swing plus a charisma drop), then **lose
   the 50% grace roll** — ending the run with zero rounds of red warning. A coin-flip death
   is the canonical "unfair" loss.
2. **Hidden RNG at the moment of death.** The grace roll is the only randomness in the coup
   path. Whether the player dies *this* round or *next* round is non-deterministic and
   un-telegraphed, which undercuts the "you could see it coming" contract.

### Constraints

- Coup reads **effective** relations (ADR-0008 §6) — this ADR does not change the data source.
- Determinism (ADR-0004): the fairness guarantee must not depend on RNG.
- Single atomic `set` per logical mutation (ADR-0002); coup resolution stays in `resolveRound`.
- Threshold *numbers* (8 / −3 / 6 / −2, security ±1) are **balance**, owned by the
  economy/political-systems designers — out of scope here. This ADR governs the *contract*,
  not the values.

### Requirements

- The player is guaranteed **≥ 1 full round of explicit, unambiguous warning** before a coup
  can end the run.
- The inputs that drive the coup are **visible** and **actionable** within that round.
- **Arming is deterministic** — no hidden roll decides whether the coup arms or fires.
- The warning re-evaluates each round on **current effective relations**, so the player can
  defuse it (lower the faction's effective relation, raise charisma) — including by letting a
  windowed relation modifier expire.

## Decision

### 1. Two-tier, deterministic telegraph

| Tier | Condition (effective) | Player-facing signal | Ends run? |
|------|-----------------------|----------------------|-----------|
| **Safe** | below all thresholds | none | no |
| **Yellow (approaching)** | `relation ≥ WARN_RELATION` AND `charisma ≤ WARN_CHARISMA` | advisory badge on the faction + log line | no |
| **Red (armed / grace)** | `relation ≥ armedThreshold` AND `charisma ≤ CHARISMA_THRESHOLD` | explicit red warning naming the faction; "coup imminent next round" | no, **this round** |
| **Coup** | red condition **still** met the following round | run ends (`{faction}_coup`) | yes |

The yellow tier sits strictly *inside* the red tier's approach (lower relation, higher
charisma bound), so a gradual slide surfaces yellow first. Yellow is **advisory** — it is not
the guaranteed warning (a single large swing may skip it). The **red/grace round is the
guaranteed warning** (decision 2).

### 2. The first armed round is always survived (deterministic grace) — fairness fix

Replace the stochastic 50% grace roll with a **deterministic guarantee**: the *first* round a
faction is armed, the coup **never** fires. The system arms, emits the red warning, and sets
`coupArmedLastRound = true`. The coup fires **only if the armed condition is still met the
next round**. This converts "≥ 1 round of warning" from a 50/50 hope into a hard guarantee and
removes the only RNG from the coup path (arming + firing become fully deterministic).

- The existing `coupArmedLastRound` / `graceTaken` carry already models "second consecutive
  armed round = certain coup"; this decision only makes the *first* armed round certain to
  survive (retire `GRACE_CHANCE`).
- The grace round is **re-evaluated** the next round on current effective relations: if the
  player has dropped the faction's effective relation below `armedThreshold` or raised charisma
  above `CHARISMA_THRESHOLD`, the condition is no longer met and the coup does **not** fire —
  the player survived. The warning state clears.

### 3. Arming is deterministic; only thresholds + visible state decide it

Arming is a pure function of `effectiveRelations`, `charisma`, and `securitySpend` (the ±1
security modifier is visible via the security slider). No hidden roll. `checkCoup` stays pure
and testable (ADR-0004): with the grace roll retired, its output is a deterministic function
of game state.

### 4. Visible inputs the player can act on

Within the red warning round the player can see and influence:

- **Per-faction effective relation** (what the coup reads) and **charisma** — the two arming
  inputs. Displays already read effective values (ADR-0008 §6).
- **The threatening faction** named explicitly in the red warning.
- **The actions that defuse it**, all available that round: a deal/meet that lowers the
  faction's effective relation, a charisma gain, repealing a relation-raising modifier, or
  security spend (shifts the armed threshold +1 at HIGH spend).

Story 6-7 implements the player-facing readout (the explicit thresholds/where-you-stand panel)
on top of this contract; this ADR fixes *what must be knowable*, not the pixels.

### 5. Windowed-modifier interaction with the grace round

Because the coup reads **effective** relations and re-evaluates every round, a windowed
relation modifier (ADR-0008 §3) that **expires** between the armed round and the next round
can drop a faction's effective relation below `armedThreshold` — in which case the next-round
check returns *safe/yellow* and the coup does **not** fire. Conversely, a delayed relation
modifier that *opens* its window can arm a faction. The warning always reflects the relations
in effect for the round being resolved. This is intended: the engine is the single source of
truth and the player can reason about it from the visible effective values.

## Alternatives Considered

- **Keep the 50% grace roll.** Rejected: a coin-flip death on first arming is the exact
  unfairness this ADR exists to remove, and it injects un-telegraphed RNG into the loss moment.
- **Stochastic arming (probability rises with relation).** Rejected: violates the
  "no hidden RNG / fully telegraphed" requirement and is harder for the player to reason about.
- **Yellow warning as the sole guarantee (no grace round).** Rejected: a single large
  relation+charisma swing can skip yellow, leaving no guaranteed warning. The deterministic
  grace round is the backstop that always fires.
- **Guarantee N > 1 warning rounds.** Rejected for now: one full round with visible,
  actionable inputs is sufficient and keeps the loss state tense. Revisit if playtests show
  one round is too tight.

## Consequences

### Positive

- Hard guarantee: no coup ever ends a run without ≥ 1 explicit red-warning round.
- Coup path becomes fully deterministic (arming + firing) — easier to test, reason about, and
  telegraph (ADR-0004 alignment improves).
- Re-evaluation on effective relations makes the coup defusable through normal play, including
  by managing windowed modifiers.

### Negative

- Removes a difficulty lever (the 50% roll). The armed thresholds may need a balance pass so
  the now-always-survivable first armed round doesn't make late game too forgiving — owned by
  the economy/political-systems designers, tracked separately.
- Requires retiring `GRACE_CHANCE` in `CoupHandler`/constants and updating coup tests that pin
  the roll (a small, bounded change in the 6-7 implementation slice).

### Neutral

- The two-tier (yellow/red) structure and `coupArmedLastRound` carry already exist; this ADR
  ratifies and tightens them rather than introducing new machinery.

## Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Deterministic grace makes late game too easy | Med | Med | Balance pass on armed thresholds (designer-owned); revisit after playtests |
| Players miss the red warning (UI not loud enough) | Med | High | Story 6-7 readout: explicit, persistent, faction-named red state |
| Windowed-modifier expiry mid-grace confuses players | Low | Low | Surface effective relations + the threatening faction so the change is legible |

## Performance Implications

None. Retiring the grace roll removes one RNG call; `checkCoup` stays O(factions).

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0008 (effective relations as the coup data source), ADR-0004 (determinism — arming has no RNG), ADR-0002 (single atomic `set` in `resolveRound`), ADR-0006 (coup evaluated at start of `nextRound`) |
| **Enables** | Story 6-7 (coup fairness UI / telegraphing readout) |
| **Supersedes** | None |
| **Ordering Note** | Contract only. Implementation (retire `GRACE_CHANCE`, deterministic grace, readout) lands in Story 6-7; balance of armed thresholds is a separate designer-owned pass. |

## GDD Requirements Addressed

| GDD Document | System | Requirement | How This ADR Satisfies It |
|-------------|--------|-------------|--------------------------|
| `design/gdd/lasting-effects-prd.md` | Coup | Coup must be telegraphed and avoidable | Two-tier telegraph + guaranteed deterministic grace round (§1, §2) |
| (TR-coup-002) | Coup fairness | ≥ 1 round explicit warning before a coup can fire; no hidden arming RNG | Deterministic arming (§3) + guaranteed first-armed-round survival (§2) |

## Validation Criteria

- [ ] A faction reaching the armed condition for the first time **never** ends the run that
      round — it arms and emits an explicit red warning naming the faction.
- [ ] A coup fires only when the armed condition is **still** met the following round.
- [ ] Dropping the faction's effective relation below `armedThreshold` (or raising charisma
      above `CHARISMA_THRESHOLD`) during the grace round prevents the coup.
- [ ] A windowed relation modifier expiring between the armed round and the next round, such
      that effective relation falls below `armedThreshold`, prevents the coup.
- [ ] `checkCoup` is a deterministic function of `(effectiveRelations, charisma, securitySpend,
      coupArmedLastRound)` — no RNG (the grace roll is retired).
- [ ] The yellow tier surfaces an advisory signal whenever its (lower) condition is met.
- [ ] Threshold *values* remain in `GAMESTATE.COUP` (data-driven; balance-owned).

## Related

- ADR-0002 — Handler pattern / single atomic `set`
- ADR-0004 — RNG determinism (coup arming/firing now RNG-free)
- ADR-0006 — round timer / game loop (coup checked at start of `nextRound`)
- ADR-0008 — Timed Modifier Engine (effective relations are the coup data source)
- `src/Stores/CoupHandler.ts`, `src/Constants/GameState.ts` (COUP block) — current implementation
- Story 6-7 — Coup fairness UI (telegraphing readout; blocked on this ADR)
