# Story 7-2: CitizenHandler P2 — Employment + Happiness + Body-Type

> **Epic**: Citizen Simulation
> **Status**: Not Started
> **Layer**: Core
> **Type**: Logic
> **Estimate**: 1.5 days
> **Manifest Version**: 2026-06-13
> **Last Updated**: 2026-06-18

## Context

**GDD**: `design/gdd/citizen-simulation.md`
**Requirement**: `TR-citizen-002`
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: [ADR-0008: Timed Modifier Engine](docs/architecture/adr-0008-timed-modifier-engine.md)
**ADR Decision Summary**: Happiness reads **effective** relations — `getEffectiveRelation(base, modifiers, stat, round)` from `src/Utils/Modifiers.ts` — not base relations. This ensures citizen mood correctly reflects active timed modifiers (e.g., a deal that boosted military relations is visible on Marco's happiness this round).

**Secondary ADR**: [ADR-0002: State Management Pattern](docs/architecture/adr-0002-state-management-pattern.md) — `computeEmployment`, `computeHappiness`, `computeBodyType` are pure functions in `CitizenHandler.ts`; they receive their inputs as arguments and return results. No store imports.

**Engine**: React 19 + TypeScript | **Risk**: LOW
**Engine Notes**: All functions are plain TypeScript math — no engine API risk. `getEffectiveRelation` already exists in `src/Utils/Modifiers.ts` (shipped in Story 6-1).

**Control Manifest Rules (Core layer)**:
- Required: Handler files are pure functions — plain data in, typed result out — no store imports.
- Required: Gameplay values (costs, thresholds, tier amounts) come from constants files (`src/Constants/`), never hardcoded inline.
- Forbidden: `any` type in Handler files.
- Forbidden: Handler files importing from `../../Stores/GameState`.

---

## Acceptance Criteria

*From GDD `design/gdd/citizen-simulation.md` §4.1 (Happiness), §4.2 (Employment), §4.5 (Body-Type):*

- [ ] **AC-3**: Pinned Marco examples must match exactly:
  - R1: `sec=7, rel=+4, char=+2, faction=army, employed=true, lastRel=+4` → `happiness = 7.0`
  - R4: `sec=2, rel=-1, char=+2, faction=army, employed=false, lastRel=+4` → `happiness = 0.5`
- [ ] **AC-4**: Raw happiness below 0 clamps to 0; above 10 clamps to 10. Both endpoints reachable.
- [ ] **AC-5**: Employment boundaries tested explicitly at each threshold:
  - Army employed: `security=4, rel=0` → `employed=true`; displaced: `security=3` OR `rel=-1`
  - Business employed: `rel=0, infrastructure=3` → `employed=true`; displaced: `rel=-1` OR `infrastructure=2`
  - People: always `employed=true` regardless of any input
- [ ] **AC-6**: An army/business ped displaced in one round (`employed=false, displacement=2`) is re-employed and `displacement=0` the round its thresholds recover.
- [ ] **AC-17**: Body-type lerp at both extremes:
  - `health=0`: `fatShare=0.05, slimShare=0.70, fitShare=0.25`
  - `health=10`: `fatShare=0.40, slimShare=0.15, fitShare=0.45`
  - Classification boundaries tested at `bodySeed=0.03`, `0.20`, `0.90` at both health extremes
- [ ] **AC-18**: On round 1, every ped's `volatility` term is 0 (initialized `lastFactionRelation` equals round-1 `rel`; no phantom whiplash).
- [ ] **AC-19**: Three-round elite recovery arc traced through employment and displacement values.
- [ ] All constants (`GONE_CHANCE`, `HEALTH_DEATH_THRESHOLD`, etc.) come from `src/Constants/GameState.ts` or a new `src/Constants/Citizens.ts` — not hardcoded inline.
- [ ] `tsc --noEmit` clean; no `any` types.

---

## Implementation Notes

*Derived from GDD citizen-simulation.md §4.1–§4.5 and ADR-0008:*

**`computeEmployment(ped: Citizen, security: number, infrastructure: number, relations: Record<Power, number>): boolean`**
```
army:     security >= 4 AND rel >= 0
business: rel >= 0 AND infrastructure >= 3
people:   always true
```
`rel` here is the **effective** relation for the ped's faction (from `getEffectiveRelation`).

**`computeHappiness(inputs: HappinessInputs): number`** → clamp(5 + factionFortune + charismaTerm − displacement − volatility, 0, 10)

```
factionFortune = (rel / 10) * 3 + budgetSignal
  where budgetSignal:
    army:     (security − 5) / 5
    business: (infrastructure − 5) / 5 + (businessTax > 45 ? −0.5 : 0)
    people:   (health − 5) / 5 + (peopleTax > 30 ? −0.5 : 0)

charismaTerm = (charisma / 10) * 2
displacement = employed ? 0 : 2  (army/business only; people never displaced)
volatility   = min(2, abs(rel − lastRel) * 0.4)
```

**`computeBodyType(bodySeed: number, health: number): 'slim' | 'fit' | 'fat'`**
```
fatShare  = lerp(0.05, 0.40, health / 10)
slimShare = lerp(0.70, 0.15, health / 10)
fitShare  = 1 − fatShare − slimShare

bodySeed < fatShare              → fat
bodySeed < fatShare + fitShare   → fit
else                             → slim
```

All three are pure functions exported from `src/Stores/CitizenHandler.ts`.

**Constants to add** (`src/Constants/GameState.ts` or new `src/Constants/Citizens.ts`):
- `FACTION_FORTUNE_REL_WEIGHT = 3`
- `FACTION_FORTUNE_BUDGET_DIVISOR = 5`
- `CHARISMA_TERM_WEIGHT = 2`
- `DISPLACEMENT_PENALTY = 2`
- `VOLATILITY_COEFFICIENT = 0.4`
- `VOLATILITY_CAP = 2`
- `BUSINESS_TAX_PENALTY_THRESHOLD = 45`
- `PEOPLE_TAX_PENALTY_THRESHOLD = 30`
- `TAX_PENALTY_AMOUNT = 0.5`
- `ARMY_SECURITY_THRESHOLD = 4`
- `BUSINESS_INFRA_THRESHOLD = 3`
- Body-type lerp endpoints: `FAT_AT_ZERO = 0.05`, `FAT_AT_MAX = 0.40`, `SLIM_AT_ZERO = 0.70`, `SLIM_AT_MAX = 0.15`

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 7-1: Citizen generation and identity types
- Story 7-3: Role fork, gone/starvation death, feedback, `nextRound()` wiring
- Rendering or UI

---

## QA Test Cases

*Imported from `production/qa/qa-plan-sprint-7-2026-06-17.md`.*

- **AC-3 Marco R1**:
  - Given: `sec=7, rel=+4, char=+2, faction=army, employed=true, lastRel=+4`
  - When: `computeHappiness` is called
  - Then: returns exactly `7.0` (`factionFortune=1.6, charismaTerm=0.4, displacement=0, volatility=0`)

- **AC-3 Marco R4**:
  - Given: `sec=2, rel=-1, char=+2, faction=army, employed=false, lastRel=+4`
  - When: `computeHappiness` is called
  - Then: returns exactly `0.5` (`volatility=2.0, displacement=2`)
  - Edge cases: verify `volatility = min(2, |−1 − 4| * 0.4) = min(2, 2.0) = 2.0` exactly

- **AC-4 clamp max**:
  - Given: `rel=+10, charisma=+10, sec=10, faction=army, employed=true`
  - When: `computeHappiness` is called
  - Then: returns `10` (raw 11 → clamped)

- **AC-4 clamp min (taxed people)**:
  - Given: `rel=-10, charisma=-10, health=0, peopleTax=50, faction=people, employed=true`
  - When: `computeHappiness` is called
  - Then: returns `0` (raw -1.5 → clamped)

- **AC-5 employment boundaries** (7 individual cases):
  - Army: `security=4, rel=0` → `true`; `security=3, rel=+5` → `false`; `security=5, rel=-1` → `false`
  - Business: `rel=0, infra=3` → `true`; `rel=-1, infra=5` → `false`; `rel=+5, infra=2` → `false`
  - People: any inputs → always `true`

- **AC-6 elite recovery**:
  - R1: army `sec=7, rel=+3` → `employed=true, displacement=0`
  - R2: `sec=2` → `employed=false, displacement=2`
  - R3: `sec=5, rel=+1` → `employed=true, displacement=0` (penalties lift same round)

- **AC-17 body-type lerp at health=0 and health=10**:
  - `health=0, bodySeed=0.03` → `fat`; `bodySeed=0.20` → `fit`; `bodySeed=0.90` → `slim`
  - `health=10, bodySeed=0.03` → `fat`; `bodySeed=0.20` → `fat` (threshold shift); `bodySeed=0.90` → `slim`
  - `bodySeed=0.20` changes from `fit` → `fat` as health improves (threshold-cross case)

- **AC-18 round-1 volatility**:
  - Given: `rel=+10, lastRel=+10`; then `rel=-8, lastRel=-8`
  - Then: both return `volatility=0`

- **AC-19 three-round arc** (extend AC-6 with happiness values):
  - R1 employed → healthy happiness value computed; R2 displaced → lower by displacement=2; R3 re-employed → displacement lifts

- **Volatility cap**:
  - Given: `prevRel=+5, rel=-5`
  - Then: `volatility = min(2, 10 * 0.4) = min(2, 4) = 2` (cap applies)

- **Tax threshold boundary**:
  - `peopleTax=30` → no penalty; `peopleTax=31` → `−0.5`
  - `businessTax=45` → no penalty; `businessTax=46` → `−0.5`

**Estimated test count**: ~18 unit tests

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/citizens/citizen_employment_happiness.test.ts` — must exist and all tests must pass
**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 7-1 must be DONE (Citizen and CitizenState types; citizens slice in store)
- Unlocks: Story 7-3 (role fork reads happiness; death reads employment)
