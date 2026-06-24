# Story 8-5: Wire Security and Infrastructure Conditions on Street Props

> **Epic**: Street View — Dynamic Assets
> **Status**: Backlog
> **Layer**: Feature
> **Type**: Config / Data
> **Estimate**: 0.5 days
> **Manifest Version**: 2026-06-23
> **Last Updated**: 2026-06-23

## Context

**GDD**: `design/gdd/street-view.md §3.1–3.2`
**Art Bible**: `design/art/art-bible.md §7.2.3–7.2.4`

**Dependencies**: Story 8-3 must be complete (security condition in `visibleIf` type and `useStreetLayout` filter) before this story can be implemented.

Currently, all street props in the IDE render whenever the Street tab is active, regardless of budget slider values. This story wires the correct `visibleIf` conditions onto each prop category so the scene composition reflects game state:

- Security props only appear at their tier (Controlled / Militarised)
- Disorder props disappear above Disorder tier
- Infrastructure props (trees, furniture, decals) appear only at Normal+ tier
- Poor-tier decals disappear above Poor tier

**Validated tier values** (from GDD §3.1 and political-systems-designer review 2026-06-23):

| Axis | Poor/Disorder | Normal/Controlled | Rich/Militarised |
|------|--------------|-------------------|-----------------|
| infrastructure | [1, 3] | [4, 7] | [8, 10] |
| security | [1, 3] | [4, 7] | [8, 10] |

---

## Acceptance Criteria

### Security props — Controlled tier (`security: [4, 7]`)

- [ ] **AC-1**: `env_guard_post_small` has `visibleIf: { tab: 'Street', security: [4, 7] }` (was: `{ tab: 'Street' }`)
- [ ] **AC-2**: `env_camera_pole_medium` has `visibleIf: { tab: 'Street', security: [4, 7] }` (was: `{ tab: 'Street' }`)

### Security props — Militarised tier (`security: [8, 10]`)

- [ ] **AC-3**: `env_tank_large` has `visibleIf: { tab: 'Street', security: [8, 10] }` (was: `{ tab: 'Street' }`)
- [ ] **AC-4**: `env_gunnest_small` has `visibleIf: { tab: 'Street', security: [8, 10] }` (was: `{ tab: 'Street' }`)
- [ ] **AC-5**: `env_cannon_medium` has `visibleIf: { tab: 'Street', security: [8, 10] }` (was: `{ tab: 'Street' }`)
- [ ] **AC-6**: `env_searchlight_large` has `visibleIf: { tab: 'Street', security: [8, 10] }` (was: `{ tab: 'Street' }`)

### Disorder props — Disorder tier (`security: [1, 3]`)

- [ ] **AC-7**: `env_graffiti_decal` has `visibleIf: { tab: 'Street', security: [1, 3] }` (was: `{ tab: 'Street' }`)
- [ ] **AC-8**: `env_streetbarricade_medium` has `visibleIf: { tab: 'Street', security: [1, 3] }` (was: `{ tab: 'Street' }`)

### Infrastructure-tier props

- [ ] **AC-9**: `env_pothole_decal` has `visibleIf: { tab: 'Street', infrastructure: [1, 3] }` — Poor tier only (was: `{ tab: 'Street' }`)
- [ ] **AC-10**: `env_tree_medium` has `visibleIf: { tab: 'Street', infrastructure: [4, 10] }` — Normal+ placeholder until `env_palm_tree` is added; range narrows to `[4, 7]` in the palm-tree delivery story
- [ ] **AC-11**: `env_parkbench_medium` has `visibleIf: { tab: 'Street', infrastructure: [4, 10] }` — Normal+ (was: `{ tab: 'Street' }`)
- [ ] **AC-12**: `env_electricpole_medium` has `visibleIf: { tab: 'Street', infrastructure: [4, 10] }` — Normal+. Note: GDD §3.2 lists "Electric Pole x1" at Rich vs x6 at Normal; the current IPL has 9 instances at Normal positions. Per-tier instance count reduction is deferred — tracked as future work.
- [ ] **AC-13**: `env_streetlight_standard_medium` has `visibleIf: { tab: 'Street', infrastructure: [4, 10] }` — Normal+ placeholder until `env_streetlight_luxury_medium` is added
- [ ] **AC-14**: `env_scaffolding_large` has `visibleIf: { tab: 'Street', infrastructure: [4, 7] }` — Normal only; Rich tier is "complete," scaffolding would be anachronistic

### Props that remain always-visible (no conditions added)

- [ ] **AC-15**: `env_flagpole_large`, `env_flag_small`, `env_skyline`, `env_roads`, `env_plaza`, `env_billboard` retain `visibleIf: { tab: 'Street' }` — these are permanent scene elements present at all infrastructure tiers

### Documentation fix

- [ ] **AC-16**: `design/gdd/street-view.md §3.2` is updated to move "Burning Trash Can ×4" from **Security — Disorder** to **Infrastructure — Poor**, matching the Art Bible §7.2.3 and the transition arc narrative in §7.2.3 ("the city stops being illuminated by things on fire"). The `env_trash_can_burning_small` prop itself is not yet in the IDE — it is tracked as future work; this AC only covers the documentation correction.

### Verification

- [ ] **AC-17**: At security = 3 (Disorder), guard posts and tanks are absent; graffiti and barricades are visible
- [ ] **AC-18**: At security = 5 (Controlled), guard posts and camera poles are visible; tanks and graffiti are absent
- [ ] **AC-19**: At security = 9 (Militarised), tanks, cannons, gun nests, and searchlights are visible; graffiti is absent
- [ ] **AC-20**: At infrastructure = 2 (Poor), potholes are visible; trees, benches, poles, streetlights, and scaffolding are absent
- [ ] **AC-21**: At infrastructure = 5 (Normal), trees, benches, poles, streetlights, scaffolding are visible; potholes are absent
- [ ] **AC-22**: At infrastructure = 9 (Rich), trees, benches, poles, and streetlights are visible; scaffolding is absent; potholes are absent
- [ ] **AC-23**: `npx vitest run` passes
- [ ] **AC-24**: `tsc --noEmit` passes

---

## Implementation Notes

All changes are to `src/assets/data/street-objects.ide.ts` only (IDE metadata), plus the GDD doc fix. No IPL placements change. No store or component changes.

The `visibleIf` pattern is simple property addition; double-check that the security field exists on the type (Story 8-3 prerequisite) before implementing.

---

## Test Evidence

- **Type**: Config/Data — smoke check pass (ADVISORY gate)
- **Location**: `production/qa/smoke-[date].md`
- **Manual check**: Step through all six tier combinations (Poor/Disorder, Poor/Militarised, Normal/Controlled, Normal/Militarised, Rich/Controlled, Rich/Disorder) in dev by setting the budget sliders and confirming props appear/disappear correctly per AC-17–AC-22
