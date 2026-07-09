# Story 10-5: Dead-Code Sweep

> **Epic**: Simplification & Debt (Sprint 10)
> **Status**: Complete
> **Layer**: Core
> **Type**: Config/Data
> **Estimate**: 0.5 days
> **Last Updated**: 2026-07-08

## Context

**Source**: [Code Audit 2026-07-08](../../docs/architecture/code-audit-2026-07-08.md) §C — every item verified truly dead (knip + grep). Owner rule: only truly dead code; live features stay.

## Completion Notes

All ACs met. Deleted: `LanguageSwitcher.tsx`, `getRandomDailyEventForPower`,
`debugLog`, `middleground/` (git rm — 3ds Max scratch dumps + stale street-data
duplicates), `export { testI18n }`. Un-exported (internal use kept):
`INITIAL_STATE`, `EXPENDITURE_MULTIPLIER`, 9 CitizenHandler tuning constants,
`TIME_MODIFIERS`/`TimeModifier`, `weirdLawModifierId`, `NUM_BUILDING_SLOTS`,
21 `Constants/GameState.ts` shape interfaces (+`PowerKeys`), 4 `types/GameState.ts`
types, `MiniChallengeEffect`, `PeriodicEventEffect`/`PeriodicEventOption`,
`Vec3`/`CrossingLink`/`PathZone`, `IDEObject`/`IPLInstance`, `ShopModTemplate`,
plus `buildRoundStats` (became internal-only after 10-1 — caught by the re-scan).
`visualConsequences.ts` exports left untouched (dormant by design, audit §D).

Post-sweep knip output = exactly the 7 documented false positives + the
visualConsequences types (documented). Suite 738/738, `tsc -b` clean, build green.

## Acceptance Criteria

- [ ] **AC-1**: `src/components/LanguageSwitcher.tsx` deleted (zero imports).
- [ ] **AC-2**: `getRandomDailyEventForPower` removed from `DailyEventHandler.ts` (zero callers).
- [ ] **AC-3**: `middleground/` removed from the repository (git rm — 3ds Max scratch dumps + stale duplicates of `src/assets/data/` files; conversion pipeline lives in `tools/ipl/`).
- [ ] **AC-4**: Unused value exports un-exported (kept local where internally used) or deleted where fully unused: `INITIAL_STATE` (un-export), `EXPENDITURE_MULTIPLIER`, `CitizenHandler` tuning-constant exports, `TIME_MODIFIERS` (un-export only), `weirdLawModifierId`, `NUM_BUILDING_SLOTS`, `debugLog`, `testI18n`.
- [ ] **AC-5**: Unused type exports per audit list un-exported/deleted (`Constants/GameState.ts`, `types/GameState.ts`, `types/StreetLayout.ts`, `types/WorldLayout.ts`, `types/MiniChallenge.ts`, `types/PeriodicEvent.ts`, `assets/ShopItems.ts`, `assets/visualConsequences.ts`, `Utils/Modifiers.ts`).
- [ ] **AC-6**: Documented knip false positives NOT touched: `src/global.d.ts`, `.claude/hooks/sync-sprint-status.mjs`, `tools/**`, `prototypes/**`, `design/balance/balance_calc.js`. `visualConsequences.ts` module kept (dormant by design).
- [ ] **AC-7**: Post-sweep `npx knip` output contains only the documented false positives.

**Regression:**
- [ ] **AC-8**: `npx vitest run` 0 failures; `tsc -b` clean; build green.

## Test Evidence
**Story Type**: Config/Data — smoke check: suite + build + knip re-run recorded in commit message.
