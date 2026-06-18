# Story 6-3: ADR-0008 P3 — Remaining Content + Street View/Advisor Consumers

## Header
- **Story ID**: 6-3
- **Sprint**: 6
- **Status**: Complete
- **Type**: Integration
- **Layer**: Feature
- **TR-ID**: TR-mod-001, TR-street-001
- **Governing ADR**: docs/architecture/adr-0008-timed-modifier-engine.md
- **Manifest Version**: 2026-06-13
- **Estimate**: 1.5 days
- **Last Updated**: 2026-06-17

## Summary

Migrate the remaining effect-bearing content (opportunities/periodic events, mini-challenges,
buyable structures) onto the modifier engine. Implement `getVisibleModifiers(modifiers, round)`
as the single projection source for Street View and Advisor — replacing any bespoke per-system
lists. No new gameplay mechanics; this is purely migrating existing content onto the unified
engine and switching consumers to the one list (ADR-0003 projection boundary).

## Acceptance Criteria

- [ ] Opportunities/periodic events that produce recurring or windowed effects push a `Modifier` on resolution
- [ ] Mini-challenges with persistent effects push a `Modifier` on resolution
- [ ] Buyable structures push a `Modifier` on resolution (statue already does — verify pattern matches)
- [ ] `getVisibleModifiers(modifiers, round): Modifier[]` implemented — returns only `state:'active'` entries whose at least one `ResolvedStatMod.window` is currently active
- [ ] Street View reads the active-modifier list via `getVisibleModifiers` (no gameplay imports in Scene — ADR-0003)
- [ ] Advisor reads the same active-modifier list via `getVisibleModifiers`
- [ ] A content item with no recurring/windowed effect creates no lingering modifier (or a one-shot that expires at acquisition round)
- [ ] `getVisibleModifiers` excludes not-yet-started (delayed) windows — a modifier whose earliest window is still in the future is not shown
- [ ] No regression on existing deal/opportunity/challenge/structure resolution flows
- [ ] Full test suite green; tsc clean

## Implementation Notes

*Derived from ADR-0008 §8 (consequences), Migration Plan P3:*

- **`getVisibleModifiers`**: filter `state === 'active'`, then check that at least one `sm.window` in `m.mods`
  satisfies `isWindowActive(sm.window, round)`. A modifier that is all-future (no window open yet) is not shown
  even though it is active in state — it has nothing to display yet.
- **Street View / Advisor (ADR-0003)**: these are pure projections. They must not import game logic directly.
  Pass the `getVisibleModifiers(modifiers, round)` result as a prop or via a selector. Label / headline text
  is looked up from the content asset by `modifier.id` at render time.
- **Content-with-no-effect**: if an opportunity/event/challenge produces no recurring stat change, either
  don't push a modifier, or push one with `mods: []` that is immediately `state:'rejected'` (no-op ledger entry).
  Choose consistency — document the approach.
- **Structures**: the statue pattern (`type:'statue'`, permanent charisma mod) is the reference. Other structures
  follow the same pattern with their appropriate `type:'structure'` discriminator.
- **ADR-0007 check**: after P3 is complete, review ADR-0007's remaining scope with the owner. Any one-shot
  delayed non-stat consequence (treasury hit, cosmetic trigger) that cannot be expressed as a modifier goes
  through ADR-0007 Option A when that ADR is resolved.

## Out of Scope

- ADR-0007 implementation (non-stat delayed one-shots) — that is a separate sprint
- ADR-0009 / coup fairness UI — that is 6-5/6-7
- Repeal of opportunities/structures — the repeal UI already reads from `modifiers`; this story just ensures content pushes modifiers

## QA Test Cases

*Embedded from `production/qa/qa-plan-sprint-6-2026-06-15.md`. Test file: `tests/integration/modifiers/content_migration_test.ts`.*

- **AC — Opportunity/event creates modifier**
  - Given: an opportunity with a recurring effect (e.g. `roundIncome +3`) is accepted
  - When: resolution handler fires
  - Then: `modifiers` array contains a new entry with `type:'opportunity'`, correct `mods`, `state:'active'`

- **AC — Mini-challenge creates modifier**
  - Given: a mini-challenge with a windowed people bonus is won
  - When: resolution handler fires
  - Then: `modifiers` array contains a new entry with `type:'mini-challenge'`, correct windowed `ResolvedStatMod`

- **AC — `getVisibleModifiers` excludes future windows**
  - Given: modifier `{state:'active', mods:[{window:{startRound:r+3, endRound:null}}]}` at round r
  - When: `getVisibleModifiers(modifiers, r)` called
  - Then: modifier NOT in result (no window is active yet)

- **AC — `getVisibleModifiers` includes in-window**
  - Given: modifier `{state:'active', mods:[{window:{startRound:r, endRound:null}}]}` at round r
  - When: `getVisibleModifiers(modifiers, r)` called
  - Then: modifier IS in result

- **AC — No-effect content creates no lingering modifier**
  - Given: opportunity with no stat effect is accepted
  - When: resolution fires
  - Then: no new modifier in `modifiers` array (or a one-shot that is immediately state-closed — document which)

- **AC — No regression on existing flows**
  - Given: existing deal/law resolution tests
  - When: full suite run after P3 migration
  - Then: all pre-existing tests pass; income/relation/coup outcomes unchanged

## Test Evidence

- **Story Type**: Integration
- **Required evidence**: `tests/integration/modifiers/content_migration.test.ts` — must exist and pass; full suite green
- **Status**: [x] Created — 16 tests, all pass (455/455 suite green)

## Dependencies

- Depends on: 6-2 (P2 must be DONE — recurring engine must be live before migrating remaining content)
- Unlocks: None (P3 is the final modifier engine phase)

## Completion Notes
**Completed**: 2026-06-17
**Criteria**: 10/10 passing
**Deviations**: None — ADR-0008 §8 followed; ADR-0003 boundary clean; manifest v2026-06-13 matches
**Test Evidence**: Integration test at `tests/integration/modifiers/content_migration.test.ts` — 16 tests pass (filename in QA plan had `_test.ts` suffix; corrected to `.test.ts` for Vitest compatibility)
**Code Review**: Complete — APPROVED WITH SUGGESTIONS; both suggestions applied (S1: visibleModifiers as load-bearing AdvisorContext dep; S2: stable primitive selectors + useMemo in StreetView and AdvisorButton)
