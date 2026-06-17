# Dictator Simulator — Balance Report

Generated from `balance_calc.js`. Re-run with `node balance_calc.js` if constants change.

---

## 1. Treasury Simulation (defaults, no events)

### Default financials per round

| Component | Formula | Value |
|---|---|---|
| People income | floor(200 × 30/100) | 60 |
| Business income | floor(180 × 40/100) — infra=3, edu=3, no modifier | 72 |
| Total income | | **132** |
| Expenses | (3+3+3+3) × 10 | 120 |
| **Net per round** | | **+12** |

### Treasury over 10 rounds (no actions, no events)

| Round | Start | Income | Expenses | Net | End |
|---|---|---|---|---|---|
| 1 | 500 | 132 | 120 | +12 | 512 |
| 2 | 512 | 132 | 120 | +12 | 524 |
| 3 | 524 | 132 | 120 | +12 | 536 |
| 4 | 536 | 132 | 120 | +12 | 548 |
| 5 | 548 | 132 | 120 | +12 | 560 |
| 6 | 560 | 132 | 120 | +12 | 572 |
| 7 | 572 | 132 | 120 | +12 | 584 |
| 8 | 584 | 132 | 120 | +12 | 596 |
| 9 | 596 | 132 | 120 | +12 | 608 |
| 10 | 608 | 132 | 120 | +12 | 620 |

**Player never goes bankrupt at defaults.** Treasury grows from 500 to 620 (+120 over 10 rounds).

### Break-even tax combinations (expenses=120)

At infra=3 / edu=3, the player needs combined income ≥ 120 to stay flat:

| People Tax | Business Tax | Net |
|---|---|---|
| 15% | 50% | +0 |
| 20% | 45% | +1 |
| 25% | 40% | +2 |
| 30% | 35% | +2 |

### Absolute worst case (0% taxes, all expenditures at 10)

- Net per round: **-400**
- Bankrupt after **round 2** (treasury drops to -300)

---

## 2. Daily Event Expected Values

The event pool has **36 events**. Each round exactly one event fires, drawn uniformly (P = 1/36 per event). The `chance` field is a design-intent annotation, not a draw weight.

### Per-faction EV (uniform draw)

| Faction | Events | EV/round | Cumulative Δ over 10 rounds |
|---|---|---|---|
| Military | 8 | -0.1389 | **-1.39** |
| Business | 10 | -0.1944 | **-1.94** |
| People | 18 | -0.3333 | **-3.33** |

**People has 18 events, 12 of them negative** — the heaviest event drag by far. Over 10 rounds, random events alone are expected to push people relations down ~3.3 points from starting zero.

### Alternative (weighted-by-chance, design-intent reading)

If `chance` is treated as an independent trigger probability per round (multiple events could fire, sum can exceed 100%):

| Faction | Weighted EV/round | Cumulative ×10 |
|---|---|---|
| Military | -1.03 | -10.3 |
| Business | -1.74 | -17.4 |
| People | -3.23 | -32.3 |

This interpretation is almost certainly not how the code works (only one event fires per round), but it shows the design skew: **all factions have negative net event pressure**, meaning the player is always fighting erosion.

---

## 3. Action Values at Charisma 0

### Dialogue (charisma = 0)

| Faction | Fail% | Success% | Neutral% | EV per use |
|---|---|---|---|---|
| Military | 6.00 | 28.00 | 66.00 | **+0.22** |
| Business | 7.00 | 21.00 | 72.00 | **+0.14** |
| People | 2.00 | 56.00 | 42.00 | **+0.54** |

Dialogue mechanics: `failThreshold = 0.1 × (1 - baseRate)`, `successThreshold = failThreshold + baseRate × 0.7 + charismaBonus`. Military and Business spend most of their probability mass in neutral (no change), making dialogue unreliable for those factions without charisma investment.

### Bribe (guaranteed +3 relations)

| Faction | Cost | Cost per relation point |
|---|---|---|
| Military | 60 | 20.00 |
| Business | 80 | 26.67 |
| People | 40 | 13.33 |

Bribe is expensive per point versus the income rate (+12/round). Bribing business costs 6.7 rounds of income for one use. People bribe is the best value at 3.3 rounds per use.

### Expropriate (charismaDelta = -1, relations -3)

| Faction | Treasury gain | Δ relation | Δ charisma | Rounds of income equivalent |
|---|---|---|---|---|
| Military | +80 | -3 | -1 | 6.7 |
| Business | +120 | -3 | -1 | **10.0** |
| People | +30 | -3 | -1 | 2.5 |

Business expropriate equals an entire game's worth of default net income in one action — powerful but lethal diplomatically. Repeated use triggers game over via overthrow before treasury benefits materialise.

**Critical: Expropriate business every round → Business overthrown at round 4** (relations hit -10). Treasury at that point: ~1028, but game over from faction.

### Eliminate (charismaDelta = -2)

| Charisma | Backlash% | Target outcome | EV relation change to other factions |
|---|---|---|---|
| -10 | 45% | reset to 0 | -0.90 |
| -5 | 45% | reset to 0 | -0.90 |
| 0 | 30% | reset to 0 | -0.60 |
| 5 | 15% | reset to 0 | -0.30 |
| 10 | 15% | reset to 0 | -0.30 |

Eliminate is extremely costly: -2 charisma permanently shifts dialogue rates downward and raises future backlash probability. Two eliminates drop charisma to -4, pushing backlash near 45% and making further eliminates almost as likely to hurt you as help.

---

## 4. Budget Effects Breakeven

### Security → Military relations

| Level | Expense/round | Relation effect |
|---|---|---|
| 1 | 10 | military **-2/round** |
| 2 | 20 | military **-2/round** |
| 3 | 30 | none (safe floor) |
| 4–7 | 40–70 | none |
| 8 | 80 | military **+1/round** |
| 9 | 90 | military +1/round |
| 10 | 100 | military +1/round |

### Health → People relations

| Level | Expense/round | Relation effect |
|---|---|---|
| 1–2 | 10–20 | people **-2/round** |
| 3–7 | 30–70 | none |
| 8+ | 80+ | people **+1/round** |

### Infrastructure → Business + People + Income modifier

| Level | Expense/round | Relation effect | Income effect |
|---|---|---|---|
| 1–2 | 10–20 | business -1, people **-1**/round | Business income ×0.70 |
| 3–7 | 30–70 | none | none |
| 8+ | 80+ | business +1, people **+1**/round | Business income ×1.10 |

### Upgrading to security=8 to get +1 military/round

- Default net: **+12/round** (expenses=120)
- Security=8 net: **-38/round** (expenses=170)
- Extra cost: **+50/round**
- **This puts the entire budget in the red.** Spending 50 extra per round to gain +1 military relation per round is not viable unless treasury is far above 500.
- Breakeven vs one bribe (cost 60): 1.2 rounds of budget drain — meaning the high-spend approach is only ahead of bribing if you can sustain the loss for longer than 2 rounds, which you cannot at defaults.

**Verdict:** Budget effects at HIGH threshold (>7) are not cost-effective given starting treasury. They are a trap for players who over-invest. The LOW threshold (<3) penalties are the real danger — letting health or security drop to 1-2 causes -2 relation/round which compounds faster than income can recover.

---

## 5. Charisma Impact on Dialogue

### Military (base success rate 0.40)

| Charisma | Fail% | Success% | Neutral% | EV |
|---|---|---|---|---|
| -10 | 6.00 | 3.00 | 91.00 | **-0.03** |
| -5 | 6.00 | 13.00 | 81.00 | +0.07 |
| 0 | 6.00 | 28.00 | 66.00 | +0.22 |
| +5 | 6.00 | 43.00 | 51.00 | +0.37 |
| +10 | 6.00 | 53.00 | 41.00 | +0.47 |

### Business (base success rate 0.30)

| Charisma | Fail% | Success% | Neutral% | EV |
|---|---|---|---|---|
| -10 | 7.00 | 1.00 | 92.00 | **-0.06** |
| -5 | 7.00 | 6.00 | 87.00 | **-0.01** |
| 0 | 7.00 | 21.00 | 72.00 | +0.14 |
| +5 | 7.00 | 36.00 | 57.00 | +0.29 |
| +10 | 7.00 | 46.00 | 47.00 | +0.39 |

### People (base success rate 0.80)

| Charisma | Fail% | Success% | Neutral% | EV |
|---|---|---|---|---|
| -10 | 2.00 | 31.00 | 67.00 | +0.29 |
| -5 | 2.00 | 41.00 | 57.00 | +0.39 |
| 0 | 2.00 | 56.00 | 42.00 | **+0.54** |
| +5 | 2.00 | 71.00 | 27.00 | +0.69 |
| +10 | 2.00 | 81.00 | 17.00 | +0.79 |

### Key observations

- **Business dialogue at charisma -5 is nearly neutral (-0.01 EV)** — just one eliminate makes it unprofitable to attempt business dialogue.
- **Military dialogue at charisma -10 goes negative (-0.03 EV)** — the player would actively hurt themselves by using dialogue on military at minimum charisma.
- **People dialogue is robust** — even at -10 charisma, EV remains positive (+0.29). It's the safest dialogue target in all conditions.
- The fail threshold is fixed (does not change with charisma); only the success zone expands/contracts. Charisma cannot prevent the fixed ~6-7% hard fail floor.

---

## 6. Starting Balance Verdict

### Is +12/round enough buffer?

Yes — at defaults the player survives 10 rounds comfortably and ends with a treasury of 620, up from 500.

However:
- The **+12/round buffer is thin**. One large cost law (e.g., law 26: -50 treasury, or law 16: -50 treasury) consumes 4+ rounds of buffer in a single decision.
- **Bribe business every round** drains 80/round against +12 income: net -68/round → bankrupt at round 8.
- **Expropriate business every round** is treasury-positive but triggers overthrow at round 4 (relations hit -10).

### Worst-case bankruptcy timeline

| Scenario | Net/round | Bankrupt at |
|---|---|---|
| Defaults (idle) | +12 | Never (treasury: 620 after R10) |
| 0% taxes, expenses=10 | -400 | Round 2 |
| Default taxes, expenses=1 | +62 | Never (but relation collapse imminent) |
| Bribe business every round | +12-80 = -68 | Round 8 |
| 0% taxes, expenses=4 (min safe) | -108 | Round 5 |

### Tax threshold warning

- People tax **>30** triggers: people -1/round AND charisma -1/round
- Business tax **>45** triggers: business -1/round AND charisma -1/round
- Default taxes sit at exactly the thresholds (30 and 40) — **not triggered**
- Raising people tax by even 1 (to 31) triggers the penalty. The threshold is a trap: players seeking more income by nudging taxes up will hit the penalty zone immediately.

---

## 7. Deal Treasury Effects

### Best treasury-positive deals (accept)

| Deal | Treasury | Relations impact |
|---|---|---|
| 10 | +120 | business +1, military -1 |
| 9 | +100 | business +2, people -2 |
| 2 | +80 | business +1, people -2 |
| 12 | +80 | business +1 (with 25% risk) |
| 7 | +50 | military +2 (with 40% risk) |
| 11 | +40 | business +1, people -1 |

### Most expensive deals (accept)

| Deal | Treasury | Relations impact |
|---|---|---|
| 6 | -70 | military +3 |
| 5 | -60 | military +2, people -1 |
| 14 | -60 | people +3 |
| 1 | -50 | military +2 (with 30% risk) |

Deals 10 and 9 provide enormous treasury gains but consistently hurt people relations (-2). Using them offsets positive-event gains and requires dialogue/bribe investment to compensate.

---

## 8. Law Treasury Costs by Power

| Power | Laws | Laws with treasury effect | Average treasury impact |
|---|---|---|---|
| Military | 13 | 9 | **-18.9** |
| Business | 13 | 9 | -8.6 |
| People | 13 | 11 | **-23.5** |

- Military laws cost ~19 per law on average if accepted.
- People laws cost ~24 per law on average if accepted.
- Business laws are mixed — Law 20 (privatise) grants **+50 treasury** with +2 business relations but hurts people and military.
- The game naturally selects biased law pools when tax thresholds are exceeded (plan G), meaning a player who over-taxes people will keep seeing people-friendly laws that cost 20-50 treasury.

---

## Summary of Concerns

| Issue | Severity | Notes |
|---|---|---|
| Net income only +12/round | Medium | Any large spend (law, bribe, bad deal) wipes multiple rounds of buffer |
| People event drain (-0.33 EV/round) | High | 18 events, 12 negative — people relations decay fastest without active intervention |
| Business dialogue near-useless at low charisma | Medium | EV goes negative at charisma -5; eliminate chains make this worse |
| Tax threshold is a cliff, not a slope | Medium | Exactly at 30/40 is safe; +1 triggers penalty — players nudging taxes get punished immediately |
| HIGH budget threshold not cost-effective | Low | Security/health/infra at 8+ costs 50+/round extra, turning budget negative — high-spend strategy is a trap |
| Expropriate business = game-over loop | High | Highest treasury gain but hits overthrow condition at round 4 if used every round; needs a cooldown or diminishing returns |
| Bribe business is the most expensive action | Low | 80 cost for +3 = 26.67/point; people bribe at 13.33/point is far more efficient |
