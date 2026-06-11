# Story 2-9: Visual Consequence Registry — Scaffolding

## Header
- **Story ID**: 2-9
- **Sprint**: 2
- **Status**: Ready
- **Type**: Logic
- **Layer**: Feature
- **TR-ID**: TR-lasting-009
- **Governing ADR**: docs/architecture/adr-0002-state-management-pattern.md
- **Manifest Version**: N/A (control manifest not yet created)
- **Estimate**: 0.5 days
- **Last Updated**: 2026-06-11

## Summary

Create the data file and pure evaluator function for the visual consequence
registry. No 3D assets this sprint — the 3D team fills `assetSlot`
implementations later without refactoring the registry itself.

The evaluator `getActiveVisualConsequences(state)` returns the subset of entries
whose conditions match the current game state. Tests verify the AND logic, the
empty case, and the exclusive-replacement rule.

## Acceptance Criteria

- [ ] `src/assets/visualConsequences.ts` exists with `VisualConsequenceEntry` type and 5 starter entries
- [ ] `getActiveVisualConsequences(state: GameState): VisualConsequenceEntry[]` is exported and pure
- [ ] AND logic: all fields in `condition` must match for an entry to be active
- [ ] Empty result when no conditions match
- [ ] `exclusive` field: when an entry is active, it removes other listed entry IDs from the result
- [ ] 5 starter entries present: casino-sign, military-checkpoint, dilapidated-buildings, faction-coup-crown, public-housing-blocks
- [ ] No regression to existing street view rendering (registry is data-only; no 3D calls this sprint)
- [ ] Unit tests: evaluator correct for AND logic, empty case, exclusive replacement

## Implementation Notes

### From PRD (Feature 5 — Visual Consequence Registry)

Types (from `design/gdd/lasting-effects-prd.md`):

```typescript
// src/assets/visualConsequences.ts

type VisualTriggerCondition = {     // AND logic across all provided fields
  activeRecurringEffectId?: string; // checks activeRecurringEffects[].sourceId
  faction?: Power;
  factionRelation?: { gte?: number; lte?: number };
  budgetSlider?: { key: Expenditures; gte?: number; lte?: number };
  round?: { gte?: number; lte?: number };
}

type VisualLayerHint =
  | 'street-prop-foreground'
  | 'street-prop-background'
  | 'street-overlay'
  | 'meet-character-badge'
  | 'plaza-prop'

type VisualConsequenceEntry = {
  id: string
  label: string        // human-readable for the 3D team
  condition: VisualTriggerCondition
  assetSlot: string    // e.g. "casino_sign" — placeholder for 3D impl
  layer: VisualLayerHint
  position?: { x: number; y: number; z: number }
  exclusive?: string[] // entry IDs this replaces when active
}
```

### 5 starter entries

```typescript
export const VISUAL_CONSEQUENCES: VisualConsequenceEntry[] = [
  {
    id: 'casino-sign',
    label: 'Casino sign on main street',
    condition: { activeRecurringEffectId: 'law-A' },  // Legalize Gambling
    assetSlot: 'casino_sign',
    layer: 'street-prop-foreground',
  },
  {
    id: 'military-checkpoint',
    label: 'Military checkpoint on corner',
    condition: { budgetSlider: { key: 'security', gte: 8 } },
    assetSlot: 'military_checkpoint',
    layer: 'street-prop-foreground',
  },
  {
    id: 'dilapidated-buildings',
    label: 'Crumbling building facades',
    condition: { budgetSlider: { key: 'infrastructure', lte: 2 } },
    assetSlot: 'dilapidated_buildings',
    layer: 'street-prop-background',
    exclusive: ['normal-buildings', 'high-end-buildings'],
  },
  {
    id: 'faction-coup-crown',
    label: 'Faction power badge in Meet (coup warning)',
    condition: { factionRelation: { gte: 6 } },  // yellow-warning threshold
    assetSlot: 'faction_crown_badge',
    layer: 'meet-character-badge',
  },
  {
    id: 'public-housing-blocks',
    label: 'Public housing towers in background',
    condition: { activeRecurringEffectId: 'law-B' },  // Free Housing Program
    assetSlot: 'public_housing_blocks',
    layer: 'street-prop-background',
    exclusive: ['dilapidated-buildings'],
  },
]
```

Note: use the actual `sourceId` strings from the law/deal definitions (story 2-4).
Update if the IDs change when content is added.

### Evaluator function

```typescript
export function getActiveVisualConsequences(state: GameState): VisualConsequenceEntry[] {
  const activeIds = new Set(state.gameManagement.activeRecurringEffects.map(e => e.sourceId))
  const matched: VisualConsequenceEntry[] = []
  const excluded = new Set<string>()

  for (const entry of VISUAL_CONSEQUENCES) {
    if (excluded.has(entry.id)) continue
    if (conditionMet(entry.condition, state, activeIds)) {
      matched.push(entry)
      entry.exclusive?.forEach(id => excluded.add(id))
    }
  }
  return matched
}
```

`conditionMet` checks each defined field with AND logic — undefined fields are
ignored (always pass).

### No 3D calls this sprint

The evaluator is called from wherever the 3D scene needs to know what to render.
This sprint: a debug console log is sufficient — no 3D scene integration required.
The registry exists so the 3D team can connect it without changing the registry itself.

### From ADR-0002 (Handler Contract)

`getActiveVisualConsequences` is a pure function: state in → array out. No
store imports, no side effects. It can be called from a React component via
`useGameStore(s => getActiveVisualConsequences(s))` or from a debug utility.

## Out of Scope

- Connecting the registry output to actual 3D asset rendering (future sprint)
- More than 5 starter entries
- Position coordinates (optional field — leave undefined for now)

## QA Test Cases

*Story Type: Logic — automated test specs.*

Test file: `src/assets/visualConsequences.test.ts`

- **AC-1**: AND logic — all fields must match
  - Given: Entry with `condition: { budgetSlider: { key: 'security', gte: 8 } }`; state has security = 7
  - When: `getActiveVisualConsequences(state)` is called
  - Then: Entry NOT in result
  - Edge cases: Security = 8 → entry IS in result; security = 9 → entry IS in result

- **AC-2**: Empty result when no conditions match
  - Given: Fresh game state (no recurring effects, default budget sliders, default relations)
  - When: `getActiveVisualConsequences(state)` is called
  - Then: Returns `[]`

- **AC-3**: activeRecurringEffectId condition
  - Given: `state.gameManagement.activeRecurringEffects = [{ sourceId: 'law-A', ... }]`
  - When: `getActiveVisualConsequences(state)` is called
  - Then: casino-sign entry IS in result

- **AC-4**: Exclusive replacement
  - Given: State where dilapidated-buildings condition is met AND public-housing-blocks condition is met
  - When: `getActiveVisualConsequences(state)` is called
  - Then: Result contains public-housing-blocks but NOT dilapidated-buildings (because public-housing-blocks lists it in `exclusive`)

- **AC-5**: Multiple independent entries
  - Given: Security ≥ 8 AND gambling law active
  - When: `getActiveVisualConsequences(state)` is called
  - Then: Both military-checkpoint AND casino-sign appear in result

## Test Evidence

**Story Type**: Logic
**Required evidence**: `src/assets/visualConsequences.test.ts` — 5 test cases above, all passing.

**Status**: [ ] Not yet created

## Dependencies

- Depends on: Story 2-1 must be DONE (`ActiveRecurringEffect` type, `activeRecurringEffects` in store shape)
- Unlocks: Nothing in sprint 2 — enables 3D team in a future sprint
