# Story 8-4: Building Tier Swap — Poor Buildings + Infra Conditions

> **Epic**: Street View — Dynamic Assets
> **Status**: Backlog
> **Layer**: Feature
> **Type**: Config / Data
> **Estimate**: 0.5 days
> **Manifest Version**: 2026-06-23
> **Last Updated**: 2026-06-23

## Context

**GDD**: `design/gdd/street-view.md §3.1–3.2`
**Art Bible**: `design/art/art-bible.md §7.2.3`

The player modelled and added 5 "poor" building variants (`env_bld_*_poor`) to the IDE with placeholder `infrastructure: [0, 2]` ranges. This story:
1. Fixes the poor building ranges to match the GDD tier thresholds ([1, 3])
2. Adds the missing `infrastructure: [4, 7]` condition to normal buildings (currently showing unconditionally)
3. Adds IPL placement entries for poor buildings at the **same world positions** as their normal counterparts, so the tier swap is seamless

**Art Bible §7.2.3** specifies the architectural vocabulary for each tier and confirms that poor, normal, and rich building variants occupy identical footprint positions.

**Budget slider bounds** (from `GAMESTATE.BUDGET.BOUNDS.EXPENDITURE`): MIN=1, MAX=10.

**Infrastructure tier thresholds** (GDD §3.1):
| Tier | Range |
|------|-------|
| Poor | 1–3 |
| Normal | 4–7 |
| Rich | 8–10 |

Rich building variants (`env_bld_*_rich`) are not yet modelled — those will be addressed in a future story. This story only covers Poor ↔ Normal swap.

---

## Acceptance Criteria

### IDE changes (`src/assets/data/street-objects.ide.ts`)

- [ ] **AC-1**: All 5 poor building entries (IDs 2006–2010) have `visibleIf: { tab: 'Street', infrastructure: [1, 3] }` (was `[0, 2]`)
- [ ] **AC-2**: All 5 normal building entries (IDs 2001–2005) have `visibleIf: { tab: 'Street', infrastructure: [4, 7] }` added (were tab-only, no infrastructure condition)
- [ ] **AC-3**: No other IDE entries are modified in this story (security props and infra props are 8-5 scope)

### IPL changes (`src/assets/data/street-placement.ipl.ts`)

- [ ] **AC-4**: Five new IPL instances are added for the poor building variants, each at the **exact same `pos` and `rot`** as the corresponding normal building instance:

| New IPL `modelName` | Matches position of |
|---------------------|---------------------|
| `env_bld_mixeduse_poor` | inst 1 (`env_bld_mixeduse_normal`) |
| `env_bld_apartment_poor` | inst 2 (`env_bld_apartment_normal`) |
| `env_bld_commercial_poor` | inst 5 (`env_bld_commercial_normal`) |
| `env_bld_civic_poor` | inst 6 (`env_bld_civic_normal`) |
| `env_bld_residential_poor` | inst 11 (`env_bld_residential_normal`) |

- [ ] **AC-5**: New IPL IDs are unique (use IDs 59–63, continuing from the highest existing ID of 58)

### Runtime behaviour

- [ ] **AC-6**: When infrastructure is set to 3, only poor building instances render (normal buildings are filtered out); when set to 4, only normal building instances render — verified by manually setting the budget slider in-game or via a store test
- [ ] **AC-7**: At infrastructure = 3, no z-fighting or visual doubling occurs (only one set of building models occupies each position)
- [ ] **AC-8**: `npx vitest run` passes
- [ ] **AC-9**: `tsc --noEmit` passes

---

## Implementation Notes

The visibleIf ranges are mutually exclusive by design — `[1, 3]` and `[4, 7]` do not overlap, so only one set renders at any given slider value. Infrastructure = 8–10 (Rich tier) will show neither set until rich building models are added; this is the expected interim state.

The IPL entries for poor buildings use the same quaternion `rot` as their normal counterpart. Do not attempt to offset `pos` — the poor model is a full building replacement at the same footprint.

---

## Test Evidence

- **Type**: Config/Data — smoke check pass (ADVISORY gate)
- **Location**: `production/qa/smoke-[date].md`
- **Manual check**: Tab to Street View, slide infrastructure to 2 (poor buildings visible), slide to 5 (normal buildings visible), confirm no overlap at boundary value 3→4
