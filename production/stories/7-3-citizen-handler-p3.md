# Story 7-3: CitizenHandler P3 — Role Fork + Death + Feedback + nextRound() Wiring

> **Epic**: Citizen Simulation
> **Status**: Complete
> **Layer**: Core
> **Type**: Integration
> **Estimate**: 2.0 days
> **Manifest Version**: 2026-06-13
> **Last Updated**: 2026-06-18

## Context

**GDD**: `design/gdd/citizen-simulation.md`
**Requirement**: `TR-citizen-003`
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: [ADR-0002: State Management Pattern](docs/architecture/adr-0002-state-management-pattern.md)
**ADR Decision Summary**: The citizen pipeline runs as a **late step** inside the existing `nextRound()` action, after financials/relations/budget effects resolve and before render. Feedback (protestor → peopleRelation; thief → treasury) is a **direct same-round mutation** in the same atomic `set((s) => ({...}))` call — not a windowed modifier. A single `set()` call owns the entire nextRound resolution.

**Secondary ADRs**:
- [ADR-0010](docs/architecture/adr-0010-seeded-rng-commit-on-roll.md): `gone` roll and starvation roll go through `rollChance()` from `src/Utils/Math.ts` — never inline `Math.random()`.
- [ADR-0008](docs/architecture/adr-0008-timed-modifier-engine.md): inputs to the pipeline (happiness, employment) read **effective** relations already resolved by the modifier engine earlier in the same `nextRound()` call.

**Engine**: React 19 + TypeScript | **Risk**: LOW
**Engine Notes**: Integration risk is in `RoundResolver.ts` — adding the citizen pipeline step must not break existing test suite. Run `npx vitest run` before and after.

**Control Manifest Rules (Core layer)**:
- Required: All multi-slice state mutations use a single atomic `set((s) => ({...}))`. The citizen feedback (peopleRelation delta, treasury delta) must be part of the same set call as the rest of nextRound.
- Required: All `Math.random()` calls go through named utility functions in `src/Utils/Math.ts`.
- Forbidden: Multiple `set()` calls within one logical operation.
- Forbidden: `Math.random()` inline in CitizenHandler.ts.
- Guardrail: `GameState.ts` soft limit 1500 lines — if adding `citizens/citizenStates` exceeds this, split into Zustand slice files.

---

## Acceptance Criteria

*From GDD `design/gdd/citizen-simulation.md` §4.3–§4.8 and edge cases 2–12:*

**Role fork (§4.3)**:
- [ ] **AC-7a**: Role bands at exact boundaries (gone mocked false): `h=6.0`→content; `h=5.9`→neutral; `h=4.0`→neutral; `h=3.9`→unrest branch. Off-by-one: `h=4` is neutral (not unrest); `h=6` is content (not neutral).
- [ ] **AC-7b**: At `h≤1`, mock `rollChance` true → `role=gone`; mock false → falls through to faction/education fork.
- [ ] **AC-8**: Education fork applies to **people-faction only**: `education=4`→thief; `education=5`→protestor. Army-faction at `education=7` → thief (faction gate fires before education check).
- [ ] **AC-20**: A people-faction ped at `h=3, education=4` (thief) flips to protestor when `education` raised to 5; lowering 5→4 flips back. Army-faction is unaffected regardless of education.

**Death (§4.4)**:
- [ ] **AC-9**: Mock gone roll true → `alive=false`; ped absent from living population on subsequent rounds (never replaced).
- [ ] **AC-10**: Starvation eligibility — employed elites are **immune** even at `health=0`:
  - People-faction, `health=0` → `starvationChance=0.15`
  - Displaced army (`employed=false`), `health=0` → `starvationChance=0.15`
  - **Employed army**, `health=0` → `starvationChance=0` (immune)
  - **Employed business**, `health=0` → `starvationChance=0` (immune)
  - People-faction, `health=3` → `starvationChance=0`
- [ ] **AC-11**: With gone roll mocked true, starvation `rollChance` is **not called** for that ped (mutual exclusion — assert via call count).
- [ ] **AC-22**: people-faction at `h≤1, health=0` (both eligible): gone roll true → dies via gone; starvation not evaluated; counted once dead.

**Feedback (§4.6)**:
- [ ] **AC-12**: `peopleRelation -= min(floor(protestorCount / 3), 5)` — underflow guard: `rel=-8, count=15` → exactly `-10`; `rel=-10` → unchanged.
- [ ] **AC-13**: `treasury -= thiefCount * THIEF_SKIM` — underflow guard: `treasury=5, thiefCount=4` → `0` (not negative).
- [ ] **AC-21**: When `protestorCount=0` and `thiefCount=0`, no change to relations or treasury.
- [ ] **AC-23**: `protestorCount=25, peopleRelation=+5` → subtracts exactly 5 (cap applies; raw `floor(25/3)=8` is NOT used).

**Population (§4.8)**:
- [ ] **AC-14**: `displayedPopulation = round(aliveCount / 25 * 5_924_511)`: 25 alive → 5,924,511; 0 → 0; 12 → 2,843,765.
- [ ] **AC-24**: After any round where one ped dies, `displayedPopulation` is strictly less than the previous round's value.
- [ ] **AC-25**: Starvation linearity: `health=1` → `starvationChance=0.10`; `health=2` → `0.05`.

**CI gate**:
- [ ] **AC-15**: `rg 'Math\.random' src/Stores/CitizenHandler.ts` returns **0 matches**.

**Integration**:
- [ ] After `nextRound()` resolves, `citizenStates` in the returned state reflects updated `role`, `alive`, `happiness`, and `lastFactionRelation` for all peds.
- [ ] `peopleRelation` and `treasury` reflect feedback deltas within the same `set()` call.
- [ ] Existing test suite: `npx vitest run` → 0 new failures after wiring (pre-existing `secret-room-rework.test.ts` failure is known and must not worsen).

---

## Implementation Notes

*Derived from GDD citizen-simulation.md §4.3–§4.8 and ADR-0002:*

**`computeRole(ped, happiness, education, rollFn): Role`** — the elif chain (DO NOT nest):
```typescript
if (happiness >= 6)                           return 'content';
else if (happiness >= 4)                      return 'neutral';
else if (happiness <= 1 && rollFn(GONE_CHANCE)) return 'gone';
else if (ped.faction !== 'people')            return 'thief';
else if (education <= 4)                      return 'thief';
else                                          return 'protestor';
```
`rollFn` is `rollChance` from `Utils/Math.ts`, injected as a parameter for testability.

**`computeFeedback(citizens, citizenStates, currentPeopleRel, currentTreasury)`**:
```typescript
const protestorCount = citizenStates.filter(cs => cs.role === 'protestor').length;
const thiefCount = citizenStates.filter(cs => cs.role === 'thief').length;
const relDelta = Math.min(Math.floor(protestorCount / PROTEST_DIVISOR), PROTEST_FEEDBACK_CAP);
return {
  peopleRelation: Math.max(currentPeopleRel - relDelta, -10),
  treasury: Math.max(currentTreasury - thiefCount * THIEF_SKIM, 0),
};
```

**Death (§4.4)** — in per-ped loop, after `computeRole`:
```typescript
if (role === 'gone') { alive = false; continue; }  // gone exits early — no starvation
if (!employed || faction === 'people') {
  const starvationChance = health <= HEALTH_DEATH_THRESHOLD
    ? DEATH_RATE_MAX * (1 - health / HEALTH_DEATH_THRESHOLD)
    : 0;
  if (rollChance(starvationChance)) alive = false;
}
```

**`displayedPopulation`**:
```typescript
const aliveCount = citizenStates.filter(cs => cs.alive).length;
const displayedPopulation = Math.round(aliveCount / TOTAL_CITIZENS * BASE_POPULATION);
```

**nextRound() wiring** (`src/Stores/RoundResolver.ts` or `GameState.ts`):
- Add citizen pipeline as the **final step** before the atomic `set`, after financials/relations/modifiers have resolved.
- The feedback writes (peopleRelation delta, treasury delta) are included in the same `set((s) => ({...}))` — not a separate `set`.

**Constants to add** (`src/Constants/Citizens.ts` or `src/Constants/GameState.ts`):
- `GONE_CHANCE = 0.15`
- `HEALTH_DEATH_THRESHOLD = 3`
- `DEATH_RATE_MAX = 0.15`
- `PROTEST_DIVISOR = 3`
- `PROTEST_FEEDBACK_CAP = 5`
- `THIEF_SKIM = 2`
- `TOTAL_CITIZENS = 25`
- `BASE_POPULATION = 5_924_511`

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 7-1 and 7-2: identity generation, employment/happiness/body-type computation
- Story 7-4: Street View rendering
- Story 7-5: Citizen Inspector UI
- Story 7-6: Population HUD display (formula is implemented here; the HUD widget is story 7-6)

---

## QA Test Cases

*Imported from `production/qa/qa-plan-sprint-7-2026-06-17.md`.*

- **AC-7a (band boundaries, gone mocked false)**:
  - `h=6.0` → content; `h=5.9` → neutral (off-by-one guard on ≥6)
  - `h=4.0` → neutral; `h=3.9` → unrest (off-by-one guard on ≥4)
  - At `h=3.9`, people-faction, `education=4`, `rollChance` mocked false → thief

- **AC-7b (gone roll both paths)**:
  - `h=0.5`, mock `rollChance` → true → `role=gone`
  - `h=0.5`, mock `rollChance` → false → thief or protestor per education

- **AC-8 (education fork — faction gate)**:
  - people-faction, `h=3, education=4` → thief
  - people-faction, `h=3, education=5` → protestor
  - army-faction, `h=3, education=7` → thief (army ignores education)

- **AC-10 (starvation — 5 eligibility cases)**:
  - people `health=0` → 0.15; displaced army `health=0` → 0.15
  - **employed army `health=0` → 0** (immune); **employed business `health=0` → 0** (immune)
  - people `health=3` → 0

- **AC-11 (mutual exclusion)**:
  - Mock gone roll true; assert starvation `rollChance` called 0 times for that ped

- **AC-12 (protest skim + underflow)**:
  - `rel=+5, count=3` → +4; `count=6` → +3; `count=15` → 0
  - `rel=-8, count=15` → exactly -10 (not -13); `rel=-10, count=15` → -10 (no-op)

- **AC-13 (thief skim + underflow)**:
  - `treasury=100, count=10` → 80; `treasury=5, count=4` → 0; `treasury=0, count=5` → 0

- **AC-23 (protest cap at 25 protestors)**:
  - `count=25, rel=+5` → subtracts exactly 5 (cap=5, not raw floor(25/3)=8) → rel=0

- **AC-14 (displayedPopulation formula)**:
  - 25 alive → 5,924,511; 0 → 0; 12 → 2,843,765

- **AC-25 (starvation linearity)**:
  - `health=1` → 0.10; `health=2` → 0.05

- **nextRound integration**:
  - Given: mock store with 25 citizens
  - When: `nextRound()` is called
  - Then: `citizenStates[i].role`, `.alive`, `.happiness`, `.lastFactionRelation` all updated; `peopleRelation` and `treasury` reflect feedback in the same set

**Estimated test count**: ~30 integration tests

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `tests/integration/citizens/citizen_resolution.test.ts` — must exist and all tests must pass
**CI gate**: `rg 'Math\.random' src/Stores/CitizenHandler.ts` must return 0 matches
**Status**: [ ] Not yet created

---

## Completion Notes
**Completed**: 2026-06-18
**Criteria**: 15/15 passing (AC-7a, 7b, 8, 9, 10, 11, 12, 13, 14, 20, 21, 22, 23, 24, 25 all covered by 46 integration tests)
**Test Evidence**: `tests/integration/citizens/citizen_resolution.test.ts` — 46 tests, all passing. Suite: 550/551 (1 pre-existing `secret-room-rework.test.ts` failure, unrelated).
**Code Review**: APPROVED WITH SUGGESTIONS — `resolveCitizenPipeline` (68 lines) exceeds 40-line guideline; advisory to extract `resolveOnePed` helper in a follow-up.
**Deviations**: None from ADR-0002 or ADR-0010.

---

## Dependencies

- Depends on: Story 7-2 must be DONE (computeEmployment, computeHappiness, computeBodyType exist)
- Unlocks: Story 7-4 (Street View rendering), Story 7-5 (Inspector UI), Story 7-6 (Population HUD)
