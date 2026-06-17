---
name: citizen-sim-ac-review
description: Citizen Simulation GDD acceptance-criteria QA review, 2026-06-17 — verdict INCOMPLETE, 9 coverage gaps, seeded RNG harness missing
metadata:
  type: project
---

QA reviewed design/gdd/citizen-simulation.md AC-1..AC-16 on 2026-06-17.

Verdict: INCOMPLETE — 9 specified behaviours have no AC; seeded RNG harness absent in src/Utils/Math.ts (rollChance uses bare Math.random, no seed parameter).

**Why:** The GDD note in the AC section acknowledges qa-lead was not consulted during authoring.

**How to apply:** Before any implementation sprint begins, the AC set must be expanded with the 9 proposed ACs (see QA report), and a seeded rollChance(p, rng?) overload must be added to src/Utils/Math.ts before any Logic tests relying on probabilistic thresholds can be written deterministically.

Key gaps: body-type lerp (§4.5), volatility round-1 init (Edge Case 1), displaced-elite-recovers (Edge Case 4), education-flip mid-game (Edge Case 5), population-collapse feedback (Edge Case 2), gone-then-starvation ordering (Edge Case 3), protest cap safety rail (§4.6 PROTEST_FEEDBACK_CAP), population-HUD monotonicity (§4.8), starvation formula linearity (§4.4).

Related: [[rng-seeding-gap]]
