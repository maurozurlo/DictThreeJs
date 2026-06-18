# Round Impact Breakdown — Design Note

> Scope: Log view (under newspaper panel). Part of the newspaper overhaul sprint.

---

## The problem it solves

The player's three honest stats — treasury, faction relations, charisma — are correct but shallow. They show *what the score is*, not *why it moved*. When Military drops from +3 to 0, the number is truthful but illegible: was it the security cut? The expropriation? A daily event?

Illegible ground truth doesn't anchor decisions. The player can't form a sentence like "I'll eat the Military hit this round because I can earn it back with a bribe next round" without knowing what caused the hit. This forecloses intentional, legible risk — the core fantasy of the game.

The breakdown fixes this by turning a snapshot into a model the player can learn.

---

## What it is

A **per-faction attribution delta**, shown in the log view at the end of each round, immediately below the newspaper section.

**Granularity: medium** — per-source totals, not a full event trace.

### Format

```
── Round Impact ──────────────────────────────────

  Military        −3   (security cut −2, expropriation −1)
  Business        +1   (deal bonus +1)
  People          −1   (tax increase −1)

  Treasury        −$4  (security −$6, tax revenue +$2)
  Charisma        —
```

- Only show factions/stats that actually moved. No-change rows are omitted.
- Signed values only: `−2`, `+1`. No percentages.
- Source labels are bureaucratic, not tutorial: "security cut", "expropriation", "deal bonus" — not "you raised security and this happened."
- Treasury breakdown follows the same pattern when multiple sources contributed.
- Charisma shows `—` unless it moved from an explicit action.

---

## Design rationale

### Straight edge for catching lies

The breakdown is the honest anchor that makes the newspaper's propaganda readable as propaganda. If the player can see:

> Military: −3 (security cut −2, expropriation −1)

…and the paper's headline at high charisma reads:

> ARMED FORCES MORALE AT RECORD HIGH

…the dissonance lands. The lie only works when the player holds a truth to measure it against. Without attribution, the player suspects the paper is lying but can't prove it. With it, they *know*.

### Pre-commit projection (companion mechanic, same sprint)

For deterministic actions (a bribe is flat +3 Military, no roll), show the projected delta *before* the player clicks — in the action tooltip or confirmation modal. Reserve advisor noise for probabilistic rolls only.

This cleanly separates "what I know before I commit" from "what I'm betting on."

---

## What it is NOT

- Not a tutorial tooltip. No explanatory prose, no "this happened because...".
- Not a full event log. Individual event lines (laws triggered, daily events) belong in the existing event log if one exists. This is a *summary* by source, not a trace.
- Not always-visible. Lives in the log view, revealed after the round resolves — not in the persistent HUD.

---

## Connections

- **Newspaper overhaul sprint** — the breakdown and the charisma-scaled propaganda bias are the same sprint. They're complementary: the paper shows the spin, the breakdown shows the receipts.
- **Obituary system** — if a citizen death affected relations (vacancy in a role, happiness drop), it should appear as a source in the breakdown: `People: −1 (citizen death — José Álvarez)`.
- **Advisor system** — the breakdown answers "what happened"; the advisors answer "what will happen." Keep them on separate tiers. Don't let the breakdown surface predicted future values.

---

## Open questions for systems-designer

1. What sources feed each faction relation delta? (Full list needed to enumerate the attribution labels.)
2. Does the breakdown show treasury sub-sources (budget spend by department) or just net?
3. If two events cancel out (bribe +2, expropriation −2 = net 0), does the faction row appear with `0 (bribe +2, expropriation −2)` or get omitted? Recommend: show the row with sources if any source moved, even if net is zero — hiding a cancelled bribe+expropriation is the paper's job, not the log's.

---

*Design note from sim-design-advisor session, 2026-06-18. Target sprint: newspaper overhaul.*
