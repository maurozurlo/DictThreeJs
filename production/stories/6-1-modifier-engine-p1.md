# Story 6-1: ADR-0008 P1 — Modifier Schema + Charisma/Relations Windowing

## Header
- **Story ID**: 6-1
- **Sprint**: 6
- **Status**: Ready
- **Type**: Integration
- **Layer**: Foundation
- **TR-ID**: TR-mod-001, TR-mod-002, TR-mod-003, TR-mod-004, TR-mod-005, TR-coup-001
- **Governing ADR**: docs/architecture/adr-0008-timed-modifier-engine.md
- **Manifest Version**: 2026-06-13
- **Estimate**: 1.5 days
- **Last Updated**: 2026-06-15

## Summary

Extend the shipped `Modifier` / `src/Utils/Modifiers.ts` class-C system into the full
ADR-0008 timed modifier engine — behaviour-preserving for the statue. Adds the
`TimeModifier` / `TIME_MODIFIERS` registry, `ResolvedWindow`, `ResolvedStatMod`, and
extended `Modifier` types. Updates `sumModifiers(round)` to be round-aware and
`isWindowActive`. Adds `getEffectiveRelation` (re-clamped ±10) and switches all
coup/overthrow/special-ending/display read-sites to effective relations. Wires the
`onStart` fire site into `nextRound()`. Statue behaviour is byte-identical after this story.

## Acceptance Criteria

- [ ] `TimeModifier` interface + `TIME_MODIFIERS` registry added to `src/Constants/GameState.ts` or `src/Utils/Modifiers.ts`
- [ ] `ResolvedWindow`, `ResolvedStatMod` types added to `src/types/GameState.ts`; `Modifier` extended with `state`, `acquiredRound`, `onStartTriggerRound?`, `onStartFired?`; `mods` updated to `ResolvedStatMod[]`
- [ ] `ModifierStat` extended to include `'military' | 'business' | 'people' | 'roundIncome' | 'roundExpense'`
- [ ] `ModifierType` extended to include all ADR-0008 §4 types
- [ ] `isWindowActive(w, round)` implemented (exclusive upper bound: `round < w.endRound`)
- [ ] `sumModifiers(modifiers, stat, round)` updated — skips non-`active`, checks window per `ResolvedStatMod`
- [ ] `getEffectiveCharisma` updated to pass `round` through; `getEffectiveRelation(base, modifiers, stat, round)` added (re-clamped ±10)
- [ ] Coup armed/warn check, overthrow check, special-ending threshold, DayEnded coup re-check — all read **effective** relations
- [ ] Displays (ActionPanel, DayEnded, EndScreen) read **effective** relations/charisma
- [ ] Repeal relation-penalty and timer-skip penalty target selection read **base** relations
- [ ] `onStart` fire site added in `nextRound()` — single atomic `set`; fires for each modifier where `!onStartFired && newRound >= onStartTriggerRound`, looks up headline key from asset by `id`, sets `onStartFired = true`
- [ ] Statue still resolves to `{delay:0, duration:null}` → `state:'active'`, permanent window — `statue_charisma.test.ts` regression stays green
- [ ] `setPhase('start')` resets `modifiers: []`; `loadGame` rehydrates with `?? []`
- [ ] Full test suite green; tsc clean

## Implementation Notes

*Derived from ADR-0008 §2, §3, §4, §5, §6, §7:*

- **Registry vs inline**: `TIME_MODIFIERS` is authoring-time only. Windows are resolved to concrete
  `{startRound, endRound}` at acquisition and stored on the `ResolvedStatMod` — never persisted as
  an id. Mutating the registry cannot change a loaded save.
- **Per-`StatMod` timing**: timing lives on each `ResolvedStatMod.window`, not the `Modifier` — one
  deal can carry delayed income AND a one-round relation bump.
- **Single chokepoint**: `sumModifiers(modifiers, stat, round)` is the only place active/window
  checks happen. `getEffectiveCharisma` and `getEffectiveRelation` call it; display and game-logic
  sites call those getters.
- **Re-clamp ±10**: `getEffectiveRelation` = `Clamp(base + sumModifiers(...), RELATIONS.MIN, RELATIONS.MAX)`.
  Base erosion is unchanged.
- **`onStart`** — the headline key is content (lives on the Deal/Law asset). The engine stores only
  `onStartTriggerRound` + `onStartFired`. For purely-immediate hooks (`onStartTriggerRound <= acquiredRound`),
  set `onStartFired = true` at acquisition so `nextRound()` skips them.
- **Atomic set**: `nextRound()` already uses a single `set((s) => ({...}))`. The `onStart` fire and
  `onStartFired` update must be inside that same call.
- **Statue regression**: the statue modifier push remains unchanged; extend types so the existing
  `{type:'statue', mods:[{stat:'charisma', amount:1}]}` structure round-trips through the new schema
  with `window:{startRound:acquiredRound, endRound:null}` (permanent) and `state:'active'`.

## Out of Scope

- **6-2**: Replacing `ActiveRecurringEffect` with `roundIncome`/`roundExpense` mods — that is P2.
- **6-3**: Migrating opportunities, mini-challenges, structures to modifiers — that is P3.
- **6-4**: Repeal-tier numbers — balance pass by economy-designer, not this story.
- **6-5/6-7**: ADR-0009 / coup-fairness UI.

## QA Test Cases

*Embedded from `production/qa/qa-plan-sprint-6-2026-06-15.md`. Test file: `tests/unit/modifiers/timed_modifiers_test.ts` (extend `tests/unit/shop/statue_charisma.test.ts` for regression).*

- **AC — Statue regression**
  - Given: existing statue modifier in `modifiers` array
  - When: `getEffectiveCharisma(base, modifiers, round)` is called at any round
  - Then: result = `Clamp(base + 1, MIN, MAX)` — identical to pre-P1 behaviour
  - Edge cases: statue with `state:'rejected'` contributes 0

- **AC — `isWindowActive` bounds**
  - Given: `ResolvedWindow { startRound: 5, endRound: 7 }`
  - When: checked at rounds 4, 5, 6, 7, 8
  - Then: false, true, true, false, false (exclusive upper bound: `round < endRound`)
  - Edge cases: `endRound: null` (permanent) → always true once `round >= startRound`

- **AC — `getEffectiveRelation` re-clamp**
  - Given: base relation = 10, modifier `{stat:'military', amount:3, window:permanent}`
  - When: `getEffectiveRelation(10, modifiers, 'military', round)` called
  - Then: returns 10 (clamped at MAX = 10), not 13
  - Edge cases: base = -9, modifier = -3 → effective = -10 (clamped at MIN)

- **AC — One-round windowed people bump**
  - Given: modifier `{stat:'people', amount:1, window:{startRound:r, endRound:r+1}}`
  - When: effective people queried at rounds r, r+1, r+2
  - Then: base+1, base, base (active only during round r; r+1 is exclusive)

- **AC — Delayed roundIncome window**
  - Given: modifier `{stat:'roundIncome', amount:5, window:{startRound:r+2, endRound:null}}`
  - When: `sumModifiers(mods,'roundIncome',round)` at rounds r, r+1, r+2, r+3
  - Then: 0, 0, 5, 5

- **AC — `onStart` fires exactly once**
  - Given: modifier with `onStartTriggerRound: r+2`, `onStartFired: false`
  - When: `nextRound()` called at rounds r+1, r+2, r+3
  - Then: fires (asset headline looked up by id) exactly at r+2; `onStartFired` = true thereafter
  - Edge cases: save at r+1, reload, advance to r+2 → fires once and only once; run ends at r+1 → never fires

- **AC — Resolved windows survive registry edit**
  - Given: modifier acquired at round r with window `{startRound:r, endRound:null}` resolved from TIME_MODIFIERS[0]
  - When: TIME_MODIFIERS[0] is changed (simulated) and the modifier is re-evaluated
  - Then: window is unchanged — persisted fields, not re-resolved from registry

- **AC — `state:'rejected'` not summed**
  - Given: modifier with `state:'rejected'`, `{stat:'charisma', amount:5}`
  - When: `sumModifiers(mods,'charisma',round)` called
  - Then: 0 (rejected modifiers skipped regardless of window)

- **AC — Coup reads effective; repeal reads base**
  - Given: base military = 3, active windowed modifier +2 on military
  - When: coup armed-check threshold evaluated
  - Then: uses effective (5); repeal relation penalty uses base (3)

## Test Evidence

- **Story Type**: Integration
- **Required evidence**: `tests/unit/modifiers/timed_modifiers_test.ts` — must exist and pass; `tests/unit/shop/statue_charisma.test.ts` — all pre-existing tests must remain green
- **Status**: [ ] Not yet created

## Dependencies

- Depends on: None
- Unlocks: 6-2 (P2 can start), 6-6 (authoring guide can be written)
