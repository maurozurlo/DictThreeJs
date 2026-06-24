# Story 8-8: `buildingVariantForSlot` — Scene Wiring

> **Epic**: Street View — Dynamic Assets
> **Status**: Backlog
> **Layer**: Feature
> **Type**: Logic / UI
> **Estimate**: 0.75 days
> **Manifest Version**: 2026-06-23
> **Last Updated**: 2026-06-23

## Context

**GDD**: `design/gdd/street-view.md §3.1`
**Dependencies**: Story 8-6 (conditionStage in state), Story 8-7 (counter advances each round), Story 8-4 (poor building IPL placements exist at matching positions).

Replaces the static `visibleIf.infrastructure: [min, max]` filter on building entries with a slot-index-based lookup driven by `conditionStage`. After this story, each building slot renders the correct variant (poor / normal / rich) for the current condition stage without requiring separate IDE entries per tier.

**Design source**: systems-designer 2026-06-23.

### Formula: `buildingVariantForSlot`

```
poorSlotCount  = max(0, -conditionStage)
richSlotCount  = max(0, +conditionStage)

slot < poorSlotCount                         → Variant.Poor
slot < (NUM_SLOTS - richSlotCount)           → Variant.Normal
otherwise                                    → Variant.Rich
```

Where `slot` is zero-indexed (0–4) and `NUM_SLOTS = 5`.

### Stage → variant table (quick reference)

| conditionStage | Slot 0 | Slot 1 | Slot 2 | Slot 3 | Slot 4 |
|---|---|---|---|---|---|
| −5 | poor | poor | poor | poor | poor |
| −4 | poor | poor | poor | poor | normal |
| −3 | poor | poor | poor | normal | normal |
| −2 | poor | poor | normal | normal | normal |
| −1 | poor | normal | normal | normal | normal |
| 0 | normal | normal | normal | normal | normal |
| +1 | normal | normal | normal | normal | rich |
| +2 | normal | normal | normal | rich | rich |
| +3 | normal | normal | rich | rich | rich |
| +4 | normal | rich | rich | rich | rich |
| +5 | rich | rich | rich | rich | rich |

---

## Acceptance Criteria

### Building slot definition

The five building slots are defined by the following IPL `modelName` groups (one entry per slot, slot index = order in this list):

| Slot index | Normal modelName | Poor modelName | Rich modelName (future) |
|---|---|---|---|
| 0 | `env_bld_mixeduse_normal` | `env_bld_mixeduse_poor` | `env_bld_mixeduse_rich` |
| 1 | `env_bld_apartment_normal` | `env_bld_apartment_poor` | `env_bld_apartment_rich` |
| 2 | `env_bld_commercial_normal` | `env_bld_commercial_poor` | `env_bld_commercial_rich` |
| 3 | `env_bld_civic_normal` | `env_bld_civic_poor` | `env_bld_civic_rich` |
| 4 | `env_bld_residential_normal` | `env_bld_residential_poor` | `env_bld_residential_rich` |

- [ ] **AC-1**: This slot-to-modelName mapping is defined as a typed constant (array or record) in the implementation, not scattered inline. Rich entries may be `null` or omitted until rich building models exist.

### `buildingVariantForSlot` pure function

- [ ] **AC-2**: `buildingVariantForSlot(slotIndex: number, conditionStage: number): 'poor' | 'normal' | 'rich'` exists as a named export in `src/Utils/BuildingDegradation.ts` (same file as `advanceConditionStage`)
- [ ] **AC-3**: Output matches the stage→variant table above for all 11 stage values × 5 slot indices (verified by unit tests)

### `useStreetLayout` changes

- [ ] **AC-4**: `useStreetLayout` reads `conditionStage` from the store (alongside `infrastructure`, `activeTab`, `modifiers`, `round`)
- [ ] **AC-5**: When resolving building IPL entries (those whose `modelName` matches any of the 10 normal/poor building model names), the hook calls `buildingVariantForSlot(slotIndex, conditionStage)` to determine which variant's `asset` and `textures` to use — it does NOT rely on `visibleIf.infrastructure` for these entries
- [ ] **AC-6**: The resolved `ResolvedPlacement` for each building slot always contains exactly one entry (the correct variant), never zero or two — no visual gap and no z-fighting
- [ ] **AC-7**: When `buildingVariantForSlot` returns `'rich'` but no rich model exists for that slot (asset is `null`), the hook falls back to rendering the `'normal'` variant for that slot (graceful degradation until rich models arrive)
- [ ] **AC-8**: Non-building IPL entries (trees, decals, security props, roads, etc.) continue to use the existing `visibleIf.infrastructure` and `visibleIf.security` filter path — this story does not touch them

### IDE cleanup

- [ ] **AC-9**: The `visibleIf.infrastructure` ranges on building IDE entries (IDs 2001–2010) are removed — they are now inert since `useStreetLayout` bypasses `visibleIf` for building slots. This avoids confusing future readers. A comment is added: `// variant selected by conditionStage in useStreetLayout — visibleIf.infrastructure not used for buildings`
- [ ] **AC-10**: The `tab: 'Street'` condition on building IDE entries is retained (buildings still only render on the Street tab)

### Unit tests

File: `tests/unit/street/building_variant.test.ts`

- [ ] **AC-11**: `buildingVariantForSlot` is tested for all 55 combinations (11 stage values × 5 slot indices) against the table in this story
- [ ] **AC-12**: The fallback to `'normal'` when rich variant asset is null is tested explicitly

### Integration / visual verification

- [ ] **AC-13**: With infrastructure slider at 2 and after 1 round resolved, `conditionStage` is −2 (degrade rate 2 from 0), slot 0 and 1 render poor variants, slots 2–4 render normal variants — verified by advancing a round in-game with dev tools or a store test
- [ ] **AC-14**: After 3+ rounds at infrastructure 2, `conditionStage` is −5 (clamped), all 5 building slots render their poor variant
- [ ] **AC-15**: After returning infrastructure to 6 for 3 rounds from `conditionStage = −3`, `conditionStage` is 0, all 5 slots render normal (recovery at 1/round: −3 → −2 → −1 → 0)
- [ ] **AC-16**: `tsc --noEmit` passes
- [ ] **AC-17**: `npx vitest run` passes

---

## Implementation Notes

`useStreetLayout` currently iterates `STREET_IPL.inst` and looks up each instance in the `ideMap`. For building entries, instead of passing through the IDE's static `modelName`, the hook should compute the variant model name from `buildingVariantForSlot` and substitute it before building the `ResolvedPlacement`. The `asset` and `textures` for the substituted model name are looked up from `ideMap` using the computed variant name.

This means the IPL still references the canonical model name (e.g., `env_bld_mixeduse_normal`), and the hook dynamically remaps it to the appropriate variant. No IPL changes are required.

The slot index is derived from the position of the building's canonical model name in the `BUILDING_SLOTS` constant defined in AC-1.

---

## Test Evidence

- **Type**: Logic — automated unit tests required (BLOCKING gate for `buildingVariantForSlot`)
- **Visual**: Manual walkthrough at `conditionStage` −5, −3, 0, +3, +5 confirms correct building mix (ADVISORY)
- **Location**: `tests/unit/street/building_variant.test.ts`
