---
name: rng-seeding-gap
description: src/Utils/Math.ts rollChance() and all RNG helpers use bare Math.random() — no seed parameter exists, so probabilistic unit tests cannot be made deterministic today
metadata:
  type: project
---

As of 2026-06-17, src/Utils/Math.ts exports rollChance(p), rollFloat(), getRandomFromList(), getRandomUniqueItem(), and getRandomNumberInRange() — all backed by bare Math.random() with no seed or injectable RNG.

ADR-0004 declares RNG is seedable via Math.ts, but the implementation does not yet fulfill this. The GDD citizen-simulation.md and ADR-0009 (coup) both depend on rollChance() being seedable for deterministic tests.

**Why:** Matters for every Logic story whose acceptance criteria involve probabilistic thresholds. Tests that assert on a random outcome are flaky by definition.

**How to apply:** Any story that needs to test rollChance() behaviour must first have lead-programmer add a seeded RNG overload (e.g., injectable PRNG function parameter with Math.random as default). Flag this as a pre-condition blocker on citizen-sim and coup stories before assigning to implementation.

Related: [[citizen-sim-ac-review]]
