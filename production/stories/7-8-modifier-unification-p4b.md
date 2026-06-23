# Story 7-8: Modifier Unification P4b — Engine Wiring & Read Sites

> **Epic**: Modifier Engine
> **Status**: Complete
> **Layer**: Core
> **Type**: Integration
> **Estimate**: 2.0 days
> **Manifest Version**: 2026-06-13
> **Last Updated**: 2026-06-22

## Context

**GDD**: `design/gdd/laws.md`, `design/gdd/deals.md`
**Requirement**: `TR-modifier-004`
*(Requirement text lives in `docs/architecture/tr-registry.yaml`)*

**ADR Governing Implementation**: [ADR-0008: Timed Modifier Engine — Amendment 2026-06-18](docs/architecture/adr-0008-timed-modifier-engine.md)
**ADR Decision Summary**: Wire `actUponLaw`/`actUponDeal` to build modifiers from `acceptMods`/`rejectMods`. Remove `buildRecurringModifier()` bridge. Add `getEffectiveBudgetStat()` helper. Switch all budget read sites to effective values. Apply `treasury` modifier stat in `nextRound()`. Update `Advisor.ts` verdict functions. All covered by integration tests.

**Secondary ADRs**:
- [ADR-0002](docs/architecture/adr-0002-state-management-pattern.md): `actUponLaw`/`actUponDeal` changes must remain single atomic `set()` calls. Handler pattern — pure functions, no store imports.
- [ADR-0010](docs/architecture/adr-0010-seeded-rng-commit-on-roll.md): No inline `Math.random()`.

**Engine**: React 19 + TypeScript | **Risk**: MEDIUM — modifies the decision path for every law/deal; touches multiple read sites.
**Engine Notes**: Run `npx vitest run` before starting (baseline), after `actUponLaw`/`actUponDeal` change, and after each read-site update. Fix any failures immediately before proceeding to the next site.

**Control Manifest Rules (Core layer)**:
- Required: Single atomic `set((s) => ({...}))` per logical mutation (ADR-0002). No `any` in handler files.
- Forbidden: `buildRecurringModifier`, `LawEffect`, `DealEffect`, `RecurringEffect` references after this story.
- Forbidden: Direct reads of `state.budget.taxes.*` or `state.budget.expenditures.*` at gameplay logic sites — must go through `getEffectiveBudgetStat()`.
- Guardrail: `GameState.ts` soft limit 1500 lines.

---

## Acceptance Criteria

**`buildRecurringModifier` removal:**
- [ ] **AC-1**: `buildRecurringModifier` does not exist in `src/assets/modifierContent.ts`.
- [ ] **AC-2**: `getModifierContent()` in `modifierContent.ts` no longer reads `.recurringEffect.label` — it reads the modifier label from a new `label` field on `acceptMods` context OR from a separate i18n lookup. (*Implementation decision: see notes below.*)

**`actUponLaw` / `actUponDeal` wiring:**
- [ ] **AC-3**: `actUponLaw(hasAccepted)` reads `law.acceptMods` or `law.rejectMods` and calls `resolveWindow(spec.time, round)` per spec to create one `Modifier` instance, pushed to `gameManagement.modifiers` in the single atomic `set()`.
- [ ] **AC-4**: `actUponDeal(hasAccepted)` does the same from `deal.acceptMods` / `deal.rejectMods`.
- [ ] **AC-5**: Treasury is NOT applied immediately in `actUponLaw`/`actUponDeal` — it is summed in `nextRound()` (AC-8). The old immediate `budget.treasury +=` call is removed.
- [ ] **AC-6**: `risk` field on `Deal` is still handled separately (probability roll in `EffectHandler`); it is NOT part of the modifier pipeline.

**`nextRound()` treasury application:**
- [ ] **AC-7**: `calculateRoundFinancials` (or `resolveRound` step 1) computes `treasuryModDelta = sumModifiers(modifiers, 'treasury', round)` and adds it to `newTreasury` alongside `financials.netChange`.
- [ ] **AC-8**: Integration test: accept a law with `acceptMods: [{ stat:'treasury', amount:50, time:1 }]` → after `nextRound()`, `budget.treasury` increased by 50. Verify the change did NOT happen at `actUponLaw` time (check treasury before nextRound, then after).

**`getEffectiveBudgetStat()` helper:**
- [ ] **AC-9**: `src/Utils/Modifiers.ts` exports `getEffectiveBudgetStat(budget, modifiers, stat, round): number`. Returns `base + sumModifiers(modifiers, stat, round)`, clamped to the appropriate range (0–100 for tax rates, 0–10 for expenditures).
- [ ] **AC-10**: All former direct reads of `state.budget.taxes.businessTaxes` / `state.budget.taxes.peopleTaxes` at gameplay logic sites are replaced with `getEffectiveBudgetStat(...)`. Affected sites: tax-penalty check in `RoundResolver.ts` (step 3).
- [ ] **AC-11**: All former direct reads of `state.budget.expenditures.*` at gameplay logic sites are replaced with `getEffectiveBudgetStat(...)`. Affected sites: `CitizenHandler` employment/happiness inputs, `applyBudgetEffects` in `EffectHandler.ts`, health check for rep statuses in `RoundResolver.ts`.

**Advisor update:**
- [ ] **AC-12**: `computeLawVerdict` and `computeDealVerdict` in `src/Utils/Advisor.ts` no longer read `acceptEffect`/`rejectEffect`. They read `acceptMods`/`rejectMods` to infer the law/deal's impact (net relation delta, treasury cost, income gain).

**CI gate:**
- [ ] **AC-13**: `tsc -b` exits 0.
- [ ] **AC-14**: `npx vitest run` — 0 new failures beyond the 1 known pre-existing failure.
- [ ] **AC-15**: `rg 'buildRecurringModifier|acceptEffect|rejectEffect|recurringEffect' src/` → 0 matches.

---

## Implementation Notes

### Label lookup after `buildRecurringModifier` removal

`getModifierContent(id)` currently reads `law.recurringEffect.label` for the Active-Legislation display. After removing `recurringEffect`, the label must come from elsewhere. Two options:

**Option A (recommended)**: Add an optional `label?: string` (i18n key) to `Law`/`Deal` types. Content authors set it on laws/deals that produce recurring income (same as the old `recurringEffect.label`). `getModifierContent` reads it.

**Option B**: Derive the label from the modifier's `id` via a fixed i18n key pattern (e.g., `laws.39.activeLabel`).

Option A is simpler and requires no i18n convention changes. Use Option A unless Option B fits better with existing i18n structure.

### `actUponLaw` construction pattern

```ts
// In actUponLaw — build modifier from specs:
const chosenMods = hasAccepted ? law.acceptMods : law.rejectMods;
const resolvedMods: ResolvedStatMod[] = chosenMods
    .filter(s => s.stat !== 'risk') // risk handled separately
    .map(s => ({ stat: s.stat, amount: s.amount, window: resolveWindow(s.time, round) }));
const modifier: Modifier = {
    id: lawModifierId(law.id),
    type: hasAccepted ? 'law-recurring' : 'rejected-law',
    state: hasAccepted ? 'active' : 'rejected',
    acquiredRound: round,
    mods: resolvedMods,
};
// Add to modifiers in the atomic set()
```

Note: `rejected` modifiers with `time: 1` relation specs still contribute for one round even in rejected state — check that the summation guard (`m.state !== 'active'`) correctly handles this. Rejected-path mods are one-round base-equivalent; consider applying them as direct base mutations instead (see note below).

### Reject-path option

Reject mods (`time: 1`) could either:
- (A) Be stored as a rejected modifier and summed for one round — but `state: 'rejected'` modifiers are currently excluded from summation (`if (m.state !== 'active') continue`). This would require changing the summation or storing them as short-lived active modifiers.
- (B) Be applied as direct base mutations at rejection time (`handleRelations`) and NOT stored as modifiers — preserves exact current behavior, simpler.

**Recommendation**: Option B for reject-path only. Reject effects are punishments, not ongoing contributions; they don't need ledger entries or repeal capability. Store only the `rejected`-state modifier for ledger purposes (no `mods[]`); apply the relation delta as a direct base mutation via `handleRelations`.

### `getEffectiveBudgetStat` clamping

```ts
export function getEffectiveBudgetStat(
    budget: GameState['budget'],
    modifiers: Modifier[],
    stat: 'businessTaxes' | 'peopleTaxes' | 'securitySpend' | 'educationSpend' | 'healthSpend' | 'infrastructureSpend',
    round: number,
): number {
    const base = stat === 'businessTaxes' || stat === 'peopleTaxes'
        ? budget.taxes[stat === 'businessTaxes' ? 'businessTaxes' : 'peopleTaxes']
        : budget.expenditures[stat.replace('Spend', '') as keyof Expenditures];
    const delta = sumModifiers(modifiers, stat, round);
    const max = stat === 'businessTaxes' || stat === 'peopleTaxes' ? 100 : 10;
    return Clamp(base + delta, 0, max);
}
```

---

## Out of Scope

- Type changes to Law/Deal → story 7-7 (must be done first)
- Content migration (laws.ts, deals.ts) → story 7-7 (must be done first)
- Street View / Active-Legislation display changes for the new stats → future story
- `risk` becoming a ModifierStat → explicitly out of scope for this story

---

## QA Test Cases

- **AC-8 (treasury timing)**: accept law with treasury spec → verify treasury unchanged before nextRound(), then +50 after nextRound().
- **AC-10 (effective tax)**: add a `businessTaxes: +20` modifier → verify `getEffectiveBudgetStat` returns `base + 20`; tax-penalty fires at lower base threshold than before.
- **AC-11 (effective budget)**: add a `securitySpend: +2` modifier → employment check uses effective security, not base.
- **AC-12 (Advisor)**: law with net-positive military in acceptMods → Advisor verdict recommends accept for military faction.
- **AC-15 (clean)**: `rg 'buildRecurringModifier|acceptEffect|rejectEffect|recurringEffect' src/` → 0 matches.
- **AC-13 (TypeScript)**: `npx tsc -b` → exit 0.
- **Integration**: full `nextRound()` with an active treasury modifier → treasury correctly delta'd; no double-application.

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `tests/integration/modifiers/modifier_application.test.ts` — must exist and pass. Cover AC-8, AC-10, AC-11, AC-12.

---

## Dependencies

- Depends on: Story 7-7 must be DONE (types and content must exist before wiring)
- Unlocks: Active-Legislation UI can display effective budget contributions; Advisor reads full modifier context

## Completion Notes
**Completed**: 2026-06-22
**Criteria**: 15/15 passing
**Deviations**: ADVISORY — `miniChallenges.ts` naming (resolved in 7-7 close-out); double `set()` in normal-law/deal paths (pre-existing ADR-0002 debt, logged in tech-debt-register.md); string-slice key derivation in `getEffectiveBudgetStat` (logged); missing reject-path/floor clamping tests (logged)
**Test Evidence**: Integration — `tests/integration/modifiers/modifier_application.test.ts` exists and passes; `tsc -b` clean; vitest 583/583
**Code Review**: APPROVED WITH SUGGESTIONS (2026-06-22)
