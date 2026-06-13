# Early-Game Grace Period

**Status**: Approved — pending implementation
**Target sprint**: 4
**Source**: Playtester feedback — players feel too constrained in rounds 1–2 to experiment
**Reviewed by**: Economy Designer, Political Systems Designer (2026-06-12)

---

## Overview

In rounds 1 and 2, all negative relation deltas are dampened by a multiplier
before being applied. Positive deltas are always full strength. Timer is
extended in early rounds. Round 3 onwards is identical to current behavior.

The goal is legibility through exploration: players should be able to try
Expropriate, reject a law, or nudge a slider without immediately feeling like
they've broken the game. The dampening is invisible — no UI indicator.

---

## The Rule

```
applyGraceDampening(delta: number, round: number): number
  if delta >= 0 → return delta unchanged
  multiplier = round 1 → 0.25 | round 2 → 0.50 | round 3+ → 1.0
  return Math.round(delta * multiplier)
```

Applied at the `handleRelations()` call site in `src/Stores/EffectHandler.ts`.
All relation changes — budget effects, Meet actions, Law/Deal decisions, events —
flow through this single function, so one helper covers all code paths.

### Rounding examples

| Original delta | Round 1 (×0.25) | Round 2 (×0.50) | Round 3+ |
|---|---|---|---|
| −1 | −0.25 → **0** | −0.50 → **−1** | −1 |
| −2 | −0.50 → **−1** | −1.00 → **−1** | −2 |
| −3 | −0.75 → **−1** | −1.50 → **−2** | −3 |
| +1 | **+1** | **+1** | +1 |
| +3 | **+3** | **+3** | +3 |

> Note: `Math.round(−0.5)` returns **0** in JavaScript (rounds toward +∞).
> This means a −2 in round 1 (= −0.50) rounds to **0**, not −1.
> Intentional — round 1 is the exploration round.

### Revised round 1 table (JavaScript Math.round behavior)

| Original delta | Round 1 result |
|---|---|
| −1 | 0 |
| −2 | 0 (−0.5 rounds toward 0 in JS) |
| −3 | −1 |
| −4 | −1 |

---

## Timer

| Round | Duration |
|---|---|
| 1 | 180,000 ms (3 min) |
| 2 | 150,000 ms (2.5 min) |
| 3–10 | 120,000 ms (2 min) — unchanged |

Timer init reads `round === 1 ? 180000 : round === 2 ? 150000 : 120000`.

---

## Starting Relations

Unchanged — all factions start at **0**.

The grace dampening provides the buffer. Starting at +2 was considered and
rejected: it teaches players that Expropriate "only costs −1 net" in round 1
when the true cost model is −3, creating wrong expectations that bite at round 4.

---

## What is NOT dampened

- Positive relation deltas — always full strength (good decisions feel immediately rewarding)
- Treasury changes — full effect in all rounds
- Charisma deltas — full effect in all rounds (charisma is already hard to swing)
- Budget benefit effects (Security > 7, Health > 7, Infra > 7) — fire normally
- Coup arming threshold — unchanged

---

## Risk: Round 3 cliff

If a player exploits round 1–2 budget dampening (sliders below threshold = 0
net penalty), round 3 suddenly fires the full penalty stack. Example worst case:
all three sliders at 1 → round 3 hits −2 Military, −2 People, −1 Business
simultaneously (−5 total relations in one round end).

**Mitigation already planned**: the DayEnded breakdown (story 3-4) shows budget
effect line items. Players will see these rows appear for the first time at round
3 end and understand where the penalties came from.

If DayEnded is not live before this ships, add a neutral log message at round 3
start: something like *"The pressures of governing begin to show."* — no
mention of grace period.

---

## Implementation notes

**One helper, one insertion point:**

```typescript
// src/Utils/GracePeriod.ts
export function applyGraceDampening(delta: number, round: number): number {
    if (delta >= 0) return delta;
    const multiplier = round === 1 ? 0.25 : round === 2 ? 0.5 : 1.0;
    return Math.round(delta * multiplier);
}
```

```typescript
// src/Stores/EffectHandler.ts — handleRelations()
export function handleRelations({ power, amount, current, round }: {
    power: keyof GameState["relations"]["current"];
    amount: number;
    current: number;
    round: number;        // ← new param
}) {
    const dampened = applyGraceDampening(amount, round);
    const newValue = Clamp(dampened + current, GAMESTATE.RELATIONS.MIN, GAMESTATE.RELATIONS.MAX);
    ...
}
```

`round` is already in `gameManagement.round` — all call sites that invoke
`handleRelations` have access to it via the `GameState` they already hold.

**Timer change:**

```typescript
// src/Constants/GameState.ts — or derive dynamically in timer init
function getRoundTimerMs(round: number): number {
    if (round === 1) return 180_000;
    if (round === 2) return 150_000;
    return 120_000;
}
```

---

## Acceptance criteria (for story file)

- [ ] Round 1: negative relation deltas multiplied by 0.25, `Math.round`, result applied
- [ ] Round 2: negative relation deltas multiplied by 0.50, `Math.round`, result applied
- [ ] Round 3+: relation deltas unmodified (multiplier = 1.0)
- [ ] Positive deltas always unmodified in all rounds
- [ ] Timer: round 1 = 180,000ms, round 2 = 150,000ms, round 3+ = 120,000ms
- [ ] Starting relations unchanged (still 0)
- [ ] No UI indicator visible to player
- [ ] `applyGraceDampening` unit-tested: all rounding cases including JS `Math.round(−0.5) = 0`
- [ ] Charisma and treasury unaffected by dampening
