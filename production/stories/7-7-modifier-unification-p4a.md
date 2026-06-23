# Story 7-7: Modifier Unification P4a — Type Contracts & Content Migration

> **Epic**: Modifier Engine
> **Status**: Complete
> **Layer**: Core
> **Type**: Integration
> **Estimate**: 1.5 days
> **Manifest Version**: 2026-06-13
> **Last Updated**: 2026-06-22

## Context

**GDD**: `design/gdd/laws.md`, `design/gdd/deals.md`
**Requirement**: `TR-modifier-004`
*(Requirement text lives in `docs/architecture/tr-registry.yaml`)*

**ADR Governing Implementation**: [ADR-0008: Timed Modifier Engine — Amendment 2026-06-18](docs/architecture/adr-0008-timed-modifier-engine.md)
**ADR Decision Summary**: Expand `ModifierStat` to include `treasury`, `businessTaxes`, `peopleTaxes`, `securitySpend`, `educationSpend`, `healthSpend`, `infrastructureSpend`. Replace `LawEffect`/`DealEffect`/`RecurringEffect` authoring types with `ModifierSpec[]`. Migrate all content in `laws.ts`, `deals.ts`, `weirdLaws.ts` to `acceptMods`/`rejectMods`. This story covers the type contracts and content migration only — engine wiring is story 7-8.

**Engine**: React 19 + TypeScript | **Risk**: LOW — type-level refactor; no runtime behavior change in this phase (engine wiring lands in 7-8).
**Engine Notes**: TypeScript strict must remain clean (`tsc -b`) after every file change. Migrate content files one-by-one and run `tsc` between each to catch mismatches early.

**Control Manifest Rules (Core layer)**:
- Required: No `any` type in handler files or asset data arrays.
- Forbidden: `LawEffect`, `DealEffect`, `RecurringEffect` types in any file after this story.
- Guardrail: All gameplay values (amounts) must use named constants from `src/Constants/Costs.ts` — never inline numbers.

---

## Acceptance Criteria

**Type contracts:**
- [ ] **AC-1**: `ModifierStat` in `src/types/GameState.ts` includes all seven new stats: `'treasury' | 'businessTaxes' | 'peopleTaxes' | 'securitySpend' | 'educationSpend' | 'healthSpend' | 'infrastructureSpend'`.
- [ ] **AC-2**: `ModifierSpec` interface exported from `src/types/GameState.ts`: `{ stat: ModifierStat; amount: number; time: number }`.
- [ ] **AC-3**: `LawEffect`, `DealEffect`, `RecurringEffect` types **do not exist** in the codebase (`rg 'LawEffect|DealEffect|RecurringEffect' src/` returns 0 matches).
- [ ] **AC-4**: `Law` type has `acceptMods: ModifierSpec[]` and `rejectMods: ModifierSpec[]`. No `acceptEffect`, `rejectEffect`, `recurringEffect`, `charismaEffect` fields.
- [ ] **AC-5**: `Deal` type has `acceptMods: ModifierSpec[]` and `rejectMods: ModifierSpec[]`. No `acceptEffect`, `rejectEffect`, `recurringEffect`, `charismaEffect` fields.

**Content migration:**
- [ ] **AC-6**: All entries in `src/assets/laws.ts` use `acceptMods`/`rejectMods`. No law entry has `acceptEffect`, `rejectEffect`, or `recurringEffect`.
- [ ] **AC-7**: All entries in `src/assets/deals.ts` use `acceptMods`/`rejectMods`. No deal entry has `acceptEffect`, `rejectEffect`, or `recurringEffect`.
- [ ] **AC-8**: `src/assets/weirdLaws.ts` updated to match the new `Law` type shape.
- [ ] **AC-9**: `rg 'acceptEffect|rejectEffect|recurringEffect|charismaEffect' src/assets/` returns 0 matches.

**Convention compliance (from ADR-0008 §9 migration table):**
- [ ] **AC-10**: Accept-path relation specs use `time: 0` (permanent modifier — stays until repealed).
- [ ] **AC-11**: Reject-path relation specs use `time: 1` (one-round — equivalent to former base mutation).
- [ ] **AC-12**: Treasury specs use `time: 1` (applied in the accepting round's `nextRound()`).
- [ ] **AC-13**: Budget-slider specs (`securitySpend` etc.) use `time: 0` (permanent modifier on slider).
- [ ] **AC-14**: Recurring income/expense specs use `time: 0` (permanent) — previously `recurringEffect.incomeBonus`.
- [ ] **AC-15**: Charisma delta (formerly `charismaEffect`) folded into `acceptMods` as `{ stat: 'charisma', amount: N, time: 0 }`.

**CI gate:**
- [ ] **AC-16**: `tsc -b` exits 0 (TypeScript strict clean) after all changes.
- [ ] **AC-17**: `npx vitest run` — 0 new failures (existing suite passes; engine wiring in 7-8 so runtime behavior unchanged here).

---

## Implementation Notes

*Key convention from ADR-0008 §9:*

```ts
// Before (Law id 0):
acceptEffect: { treasury: -COSTS.MEDIUM, security: GAINS.SMALL, military: GAINS.SMALL },
rejectEffect: { military: -GAINS.SMALL, business: GAINS.SMALL }

// After:
acceptMods: [
    { stat: 'treasury',     amount: -COSTS.MEDIUM, time: 1 }, // one-shot, applied in nextRound()
    { stat: 'securitySpend', amount: GAINS.SMALL,   time: 0 }, // permanent slider modifier
    { stat: 'military',     amount: GAINS.SMALL,   time: 0 }, // permanent relation modifier
],
rejectMods: [
    { stat: 'military', amount: -GAINS.SMALL, time: 1 }, // one-round (reject penalty)
    { stat: 'business', amount: GAINS.SMALL,  time: 1 },
],
```

**`risk` field**: `DealEffect` includes `risk` for coup-risk rolls. This is a probability modifier handled separately by `EffectHandler` — it is NOT part of `ModifierStat`. Keep `risk` as a separate optional field on `Deal` rather than a `ModifierSpec`. Do NOT add `risk` to `ModifierStat`.

**`riskText`**: stays on `Deal` as-is.

**Step order**: migrate `src/types/` first (Law.ts, Deal.ts, GameState.ts), then `src/assets/` one file at a time, running `tsc -b` between each.

**Note for 7-8**: `actUponLaw` and `actUponDeal` in `GameState.ts` will fail TypeScript after this story — they still reference the old effect fields. That's expected and is resolved in 7-8. Document the compile error count before and after each change.

---

## Out of Scope

- Engine wiring: `actUponLaw`/`actUponDeal` changes → story 7-8
- `buildRecurringModifier` removal → story 7-8
- `getEffectiveBudgetStat` helper → story 7-8
- Read-site updates (CitizenHandler, BudgetHandler, Advisor) → story 7-8
- `getModifierContent()` update (reads `.recurringEffect.label`) → story 7-8

---

## QA Test Cases

- **AC-3**: `rg 'LawEffect|DealEffect|RecurringEffect' src/` → 0 matches
- **AC-9**: `rg 'acceptEffect|rejectEffect|recurringEffect|charismaEffect' src/assets/` → 0 matches
- **AC-16**: `npx tsc -b` → exit 0
- **AC-17**: `npx vitest run` → 550/551 (1 known pre-existing failure)
- Spot-check: Law 0 `acceptMods` contains treasury (time:1), securitySpend (time:0), military (time:0)
- Spot-check: Law with former `recurringEffect` now has `roundIncome`/`roundExpense` in `acceptMods` (time:0)
- Spot-check: Deal with former `charismaEffect` has `{ stat:'charisma', time:0 }` in `acceptMods`

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: TypeScript clean (`tsc -b`) + vitest run (0 new failures) + grep assertions (AC-3, AC-9)
**Note**: No new test file required — the evidence is compiler + grep + existing suite.

---

## Dependencies

- Depends on: Story 7-3 must be DONE (establishes P3; no type conflicts)
- Unlocks: Story 7-8 (engine wiring cannot proceed until types are correct)

## Completion Notes
**Completed**: 2026-06-22
**Criteria**: 17/17 passing
**Deviations**: ADVISORY — `miniChallenges.ts` `acceptEffect`/`rejectEffect` fields (MiniChallengeEffect, a different type system) were not in scope; resolved by renaming to `acceptOutcome`/`rejectOutcome` on 2026-06-22
**Test Evidence**: Integration — `tsc -b` clean + vitest 583/583 + grep assertions (AC-3, AC-9)
**Code Review**: APPROVED WITH SUGGESTIONS (2026-06-22)
