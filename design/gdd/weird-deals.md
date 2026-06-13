# Weird Deals

**Status**: WIP — Tier 1 targets Sprint 5 / Tier 2 targets Sprint 6 (blocked on ADR-0007)
**Source**: User design session 2026-06-13

---

## 1. Overview

Ten absurd-but-real-inspired deals that surface in the deal pool alongside normal deals. Split into two implementation tiers: Tier 1 (4 deals) fits the existing accept/reject deal system and ships in Sprint 5. Tier 2 (6 deals) requires the end-of-round delayed effect system (ADR-0007) and targets Sprint 6.

---

## 2. Player Fantasy

The player feels like their nation is entangled in the same absurd logic that governs actual geopolitics. Each deal is a small story — accepting a miniature cow initiative or commissioning a giant computer mouse makes the dictatorship feel lived-in and ridiculous. Tier 2 deals introduce consequence uncertainty: the player commits resources not knowing whether the iceberg will arrive intact, or whether the seawater wheat will ever work.

---

## 3. Detailed Rules

### Tier 1 — Sprint 5 (existing deal system)

These four deals use the same shape as deals 16–18: immediate `acceptEffect` / `rejectEffect`, optional `recurringEffect`, optional `power`.

---

#### Deal 19 — Dog-Sized Cow Initiative
*International Agricultural Consortium offers a miniature cattle patent.*

| Field | Value |
|---|---|
| Accept | +15 Treasury, −1 People |
| Reject | No effect |
| Recurring | +5 Treasury/round |
| Power | `people` |
| Street view | Tiny cows wander parks and sidewalks (Sprint 5 visual pass) |

> **Implementation note**: +5/round is below `RECURRING.SMALL` (8). Requires either a new `RECURRING.TINY = 5` constant or an inline value. Decision deferred to Sprint 5 implementation.

---

#### Deal 20 — Giant National Computer Mouse
*The Technology Ministry proposes constructing the world's largest computer mouse as a national landmark.*

| Field | Value |
|---|---|
| Accept | −50 Treasury, +2 Charisma |
| Reject | No effect |
| Power | None (prestige project — no faction sponsor) |
| Street view | A giant mouse-shaped building appears on the plaza (Sprint 5 visual pass) |

> **Repeal note**: no `power` field means no faction sponsor. Repeal eligibility TBD — simplest resolution is to make it not repealable (one-time deal, no recurring effect).

---

#### Deal 21 — Strategic Pigeon Surveillance Program
*Pigeons are cheaper than drones.*

| Field | Value |
|---|---|
| Accept | +1 Military, −1 People |
| Reject | No effect |
| Power | `military` |
| Street view | Pigeons wear tiny cameras (Sprint 5 visual pass) |

---

#### Deal 22 — Swiss Hostage Diplomacy
*After a dispute involving the son of a neighboring ruler, the neighboring country has arrested several of our citizens.*

Originally designed with three choices (Accept / Refuse / Escalate). Downgraded to accept/reject for Sprint 5 — the escalate path is a natural mini-challenge candidate in a later sprint.

The "2-round trade penalty" on refuse is simplified to an immediate treasury hit to avoid needing ADR-0007.

| Field | Value |
|---|---|
| Accept Demands | −1 Military, +1 People |
| Refuse | +1 Military, −20 Treasury (immediate trade cost) |
| Power | `people` |

---

### Tier 2 — Sprint 6 (blocked on ADR-0007: End-of-Round Effect Timing)

These six deals have delayed consequences that fire N rounds after acceptance. They require the scheduled effect queue introduced by ADR-0007.

---

#### Deal 23 — National Console Computing Program
*Ministry of Technology proposes a national supercomputer built from imported game consoles. (Inspired by the PS2 cluster story.)*

| Field | Value |
|---|---|
| Accept | −25 Treasury/round, +1 Business |
| Reject | No effect |
| Power | `military` |
| Delayed event (random round, ~4–6 after accept) | A (30%): "Supercomputer successfully calculates the ideal soup temperature for every citizen." → +50 Treasury, +1 People |
| | B (70%): "Supercomputer catches fire after attempting to simulate the economy." → −30 Treasury, −1 Business |

---

#### Deal 24 — National Emu Export Program
*Experts claim foreign markets desperately need emus. (Inspired by Australia's emu-related misfortunes.)*

| Field | Value |
|---|---|
| Accept | +10 Treasury/round |
| Reject | No effect |
| Power | `business` |
| Delayed consequence (round+3) | "Emu population exceeds military personnel." → −1 Military, −1 People |

---

#### Deal 25 — Ministry of Seawater Agriculture
*Scientists insist saltwater wheat is only months away. (Based on recurring real-world miracle farming schemes.)*

| Field | Value |
|---|---|
| Accept | −20 Treasury/round |
| Reject | No effect |
| Power | `business` |
| Delayed outcome (round+3–5, probabilistic) | 20%: Huge success → +100 Treasury; 80%: Complete failure → −1 Business |

---

#### Deal 26 — National Iceberg Import Program
*Freshwater shortages could be solved by importing an iceberg. (Based on actual iceberg-towing proposals.)*

| Field | Value |
|---|---|
| Accept | −40 Treasury (one-time) |
| Reject | No effect |
| Power | `people` |
| Delayed outcome (round+2) | Success (50%): +80 Treasury, +1 People; Failure (50%): "The iceberg arrives completely melted." → no effect |

---

#### Deal 27 — International Friendship Tunnel
*Engineers propose a tunnel connecting our nation to a neighboring country.*

| Field | Value |
|---|---|
| Accept | −30 Treasury/round |
| Reject | No effect |
| Power | `business` |
| Delayed reveal (round+3) | "Engineers reveal neighboring country never agreed to participate." → −50 Treasury, −1 Business (stranded cost) |

---

#### Deal 28 — Department of Strategic Bees
*Bees have been identified as a critical national security resource.*

| Field | Value |
|---|---|
| Accept | +1 People |
| Reject | No effect |
| Power | `people` |
| Unlock | Activates a pool of bee-related random events that can fire in subsequent rounds |
| Example bee events | "Bees accidentally elected mayor." (−1 Charisma, +1 People); "Military bees deployed successfully." (+2 Military); "Treasury stolen by bees." (−30 Treasury) |

> The bee event pool is a new sub-system — scope to be defined separately once ADR-0007 is Accepted and the Sprint 6 event architecture is known.

---

## 4. Formulas

Tier 1 recurring tier constants:

```
RECURRING.TINY   =  5 treasury/round  ← new constant needed for Deal 19
RECURRING.SMALL  =  8 treasury/round
RECURRING.MEDIUM = 15 treasury/round
RECURRING.LARGE  = 25 treasury/round
```

Tier 2 delayed outcome probabilities:

```
P(Console event A: success) = 0.30    P(Console event B: fire) = 0.70
P(Seawater success)         = 0.20    P(Seawater failure)       = 0.80
P(Iceberg success)          = 0.50    P(Iceberg failure)        = 0.50
```

All probabilities are TBD — these are suggested starting values for Sprint 6 implementation.

---

## 5. Edge Cases

- **Run ends before delayed consequence fires** (Tier 2): consequence is cancelled. No retroactive effect at end screen.
- **Recurring deal repealed before consequence fires** (Deals 23, 24, 25, 27): recurring effect stops; delayed consequence still fires if already scheduled.
- **Bee event pool exhausted**: no further bee events. Pool is not refilled within the same run.
- **Multiple Tier 2 deals with overlapping timers**: each tracked independently in the delayed-effect queue; both can fire in the same round.
- **Deal 20 (Giant Mouse) repeal**: no `power` field means no faction sponsor. Mark as non-repealable for Sprint 5 (one-time deal, no recurring effect, so repeal is moot anyway).
- **Deal 22 (Swiss) refuse → treasury penalty when treasury is near zero**: penalty still applies; can trigger bankruptcy. This is intentional.

---

## 6. Dependencies

- **Existing deal system** (`src/assets/deals.ts`, `src/Stores/EffectHandler.ts`) — Tier 1 extends directly.
- **Recurring effect system** (stories 2-1 through 2-4, `src/Stores/RecurringHandler.ts`) — Deal 19 uses `recurringEffect`.
- **ADR-0007 (Effect Timing)** — Tier 2 deals blocked on this reaching Accepted.
- **Visual consequence registry** (`src/assets/visualConsequences.ts`, story 2-9) — street view entries for Deals 19, 20, 21 wired in Sprint 5.
- **i18n** (`public/locales/{en,es}/deals.json`) — all deal text in the `deals` namespace.
- **Repeal system** (story 2-8) — Tier 1 recurring deals are repealable where `power` is set.

---

## 7. Tuning Knobs

| Knob | Default | Safe Range | Affects |
|------|---------|-----------|---------|
| Deal 19 recurring income | 5/round | 3–10 | Cow income vs normal recurring deals |
| Deal 22 refuse treasury penalty | −20 | −10 to −50 | Cost of refusing Swiss demands |
| Console event A probability | 30% | 20%–50% | Reward vs punishment on NEXUS-64 |
| Seawater success probability | 20% | 10%–35% | Whether the wheat scheme pays off |
| Iceberg success probability | 50% | 30%–70% | Risk/reward of the iceberg deal |
| Bee event pool size | 3 | 2–6 | How many bee events can fire per run |

---

## 8. Acceptance Criteria

### Tier 1 (Sprint 5)

- [ ] Deal 19 (Cows): accept gives +15 treasury, −1 people, activates +5/round recurring; reject has no effect
- [ ] Deal 20 (Mouse): accept gives −50 treasury, +2 charisma; reject has no effect; not repealable
- [ ] Deal 21 (Pigeons): accept gives +1 military, −1 people; reject has no effect
- [ ] Deal 22 (Swiss): accept gives −1 military, +1 people; refuse gives +1 military, −20 treasury
- [ ] All four deals i18n'd (EN + ES) with `deals.{id}.text`, `.acceptText`, `.rejectText`
- [ ] Visual consequence registry entries stubbed for Deals 19, 20, 21 (no 3D work yet)

### Tier 2 (Sprint 6 — blocked on ADR-0007)

- [ ] Each Tier 2 deal's delayed consequence fires exactly N rounds after acceptance
- [ ] Consequences cancelled cleanly if run ends before timer fires
- [ ] Deal 23: recurring −25/round + random event fires with correct probability split
- [ ] Deal 24: recurring +10/round + emu consequence fires at round+3
- [ ] Deal 25: recurring −20/round + probabilistic outcome fires with correct probabilities
- [ ] Deal 26: one-time −40 upfront + binary outcome fires at round+2
- [ ] Deal 27: recurring −30/round + twist reveal fires at round+3
- [ ] Deal 28: +1 people on accept; bee event pool activates and events fire as expected
