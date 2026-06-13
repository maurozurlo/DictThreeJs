# Story 3-1: Meta-Progression Data Layer

## Header
- **Story ID**: 3-1
- **Sprint**: 3
- **Status**: Complete
- **Type**: Integration
- **Layer**: Feature
- **TR-ID**: TR-meta-001
- **Governing ADR**: docs/architecture/adr-0002-state-management-pattern.md
- **Manifest Version**: N/A (control manifest not yet created)
- **Estimate**: 0.5 days
- **Last Updated**: 2026-06-12

## Summary

Create the `MetaProgress` type and utility layer that persists cross-session
player records (highest tier achieved, endings unlocked) to localStorage. Bundle
`MetaProgress` into the `.dict` save file export so records survive a browser
clear if the player loads a save. On import, merge incoming meta with existing
localStorage meta using best-of logic (never downgrade tier, union endings).

This is the foundation story for 3-2 (Records panel) and 3-4 (stats screen
wiring). Neither can be implemented until this data layer exists.

## Acceptance Criteria

- [ ] `MetaProgress` type defined: `{ highestTier: TierRank | null, endingsUnlocked: EndingId[] }`
- [ ] `TierRank` type: `'S' | 'A' | 'B' | 'C' | 'D' | 'F'`
- [ ] `EndingId` type: all 14 valid ending IDs as a union (see Ending ID table below)
- [ ] Fresh localStorage → `loadMeta()` returns `{ highestTier: null, endingsUnlocked: [] }`
- [ ] `recordGameEnd(tier, endingId)` loads existing meta, applies best-of merge, saves back
- [ ] Tier merge: F < D < C < B < A < S — never downgrades `highestTier`
- [ ] Ending merge: union — no duplicates, no removal of existing entries
- [ ] `exportSave` includes top-level `meta` field containing current `MetaProgress`
- [ ] `importSave` result: if `meta` field present, merges with localStorage meta (best-of); if absent, localStorage meta unchanged
- [ ] localStorage key: `dict_meta`
- [ ] localStorage unavailable (SecurityError) → functions fail silently; game continues

## Ending ID Reference

| EndingId | Description |
|----------|-------------|
| `military` | Overthrown by Military |
| `business` | Overthrown by Business |
| `people` | Overthrown by People |
| `bankruptcy` | Treasury depleted |
| `military_coup` | Coup — Military faction |
| `business_coup` | Coup — Business faction |
| `people_coup` | Coup — People faction |
| `victory` | Survived all 10 rounds |
| `secret_room_0_good` | Secret Room 0 — good outcome |
| `secret_room_0_bad` | Secret Room 0 — bad outcome |
| `secret_room_1_good` | Secret Room 1 — good outcome |
| `secret_room_1_bad` | Secret Room 1 — bad outcome |
| `secret_room_2_good` | Secret Room 2 — good outcome |
| `secret_room_2_bad` | Secret Room 2 — bad outcome |

## Implementation Notes

### File layout

```
src/types/MetaProgress.ts          — TierRank, EndingId, MetaProgress types
src/Utils/MetaProgress.ts          — loadMeta, saveMeta, mergeMeta, recordGameEnd
src/Utils/SaveLoad.ts              — modify exportSave and importSave
```

### ADR-0002 guidance

`MetaProgress` is NOT part of the Zustand store — it is cross-session state
that survives game resets. It follows ADR-0002's serialization rules (plain
objects, no class instances) but lives outside the store.

Utility functions must be pure where possible:
- `mergeMeta(existing, incoming): MetaProgress` — pure, no side effects
- `loadMeta(): MetaProgress` — reads localStorage, returns default on failure
- `saveMeta(meta: MetaProgress): void` — writes localStorage, silent on failure
- `recordGameEnd(tier, endingId): void` — load → merge → save (orchestrator)

### Tier ordering

Map ranks to numeric values for comparison:
```
F=0, D=1, C=2, B=3, A=4, S=5
```
`mergeMeta` picks `Math.max` of the two numeric values and maps back to the string.

### Save file integration

In `exportSave(state)`: after building the serializable object, call `loadMeta()`
and attach as `meta` at the top level of the export JSON.

In `importSave(file)`: the function already resolves to `Record<string, unknown>`.
After the current parse, if `data.meta` is a valid `MetaProgress` shape, call
`mergeMeta(loadMeta(), data.meta as MetaProgress)` and `saveMeta` the result.
The caller (store's `loadGame`) does not need to handle meta — it happens as a
side effect of the import.

### Error handling

Wrap all `localStorage` calls in try/catch. If `localStorage` is unavailable,
`loadMeta` returns the default empty state; `saveMeta` does nothing. The game
must not crash.

## Out of Scope

- UI display of MetaProgress (story 3-2)
- Wiring `recordGameEnd` to the game-end flow (story 3-4)
- Any MetaProgress fields beyond `highestTier` and `endingsUnlocked`

## QA Test Cases

**Test file**: `tests/integration/meta/meta-progression.test.ts`

| # | Scenario | Expected |
|---|----------|----------|
| 1 | `loadMeta()` with empty localStorage | `{ highestTier: null, endingsUnlocked: [] }` |
| 2 | `recordGameEnd('S', 'bankruptcy')` then `loadMeta()` | `{ highestTier: 'S', endingsUnlocked: ['bankruptcy'] }` |
| 3 | `recordGameEnd('A', 'victory')` after highestTier is 'S' | highestTier stays 'S' |
| 4 | `recordGameEnd('S', 'bankruptcy')` after highestTier is 'A' | highestTier becomes 'S' |
| 5 | Tier order: F < D < C < B < A < S all combinations | merge always picks higher |
| 6 | `recordGameEnd` with already-unlocked ending | no duplicate in array |
| 7 | `exportSave(state)` output | includes `meta` field matching current localStorage |
| 8 | `importSave` with `meta: { highestTier: 'A', endingsUnlocked: ['victory'] }` + existing `{ highestTier: 'S', endingsUnlocked: ['bankruptcy'] }` | merged: `{ highestTier: 'S', endingsUnlocked: ['victory', 'bankruptcy'] }` |
| 9 | `importSave` with no `meta` field | existing localStorage meta unchanged |
| 10 | localStorage throws SecurityError | loadMeta returns default; saveMeta does not throw |

## Test Evidence

**Story Type**: Integration
**Required evidence**: `tests/integration/meta/meta-progression.test.ts` — all 10 test cases passing.

**Status**: [x] PASS — `tests/integration/meta/meta-progression.test.ts` — 29/29 tests passing

## Dependencies

- None (foundation story)

## Unlocks

- Story 3-2 (Records panel — reads `loadMeta()`)
- Story 3-4 (Stats screen — calls `recordGameEnd()` on game end)

## Completion Notes
**Completed**: 2026-06-12
**Criteria**: 11/11 passing
**Deviations**: docs/architecture/tr-registry.yaml modified (TR-meta-001 added) — valid infrastructure; code review skipped by user
**Test Evidence**: Integration test at `tests/integration/meta/meta-progression.test.ts` — 29/29 passing (10 QA cases, TC-5 exhaustive 15-pair tier combinations, TC-11 and TC-12 added post-review)
**Code Review**: Skipped
