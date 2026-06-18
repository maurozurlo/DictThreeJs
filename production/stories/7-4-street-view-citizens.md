# Story 7-4: Street View — Citizen Rendering by Role/Outfit/BodyType

> **Epic**: Citizen Simulation
> **Status**: Not Started
> **Layer**: Presentation
> **Type**: Visual/Feel
> **Estimate**: 0.5 days
> **Manifest Version**: 2026-06-13
> **Last Updated**: 2026-06-18

## Context

**GDD**: `design/gdd/citizen-simulation.md`
**Requirement**: `TR-citizen-004`
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: [ADR-0003: React / Three.js Integration](docs/architecture/adr-0003-react-threejs-integration.md)
**ADR Decision Summary**: The rendering boundary must be respected. `StreetView.tsx` (the 3D component) reads citizen data from the Zustand store via selectors — it does NOT compute happiness, role, or outfit. Outfit/posture derivation from `role` and `faction` is a render-time pure function local to the 3D component; no gameplay logic lives there.

**Engine**: React 19 + Three.js via @react-three/fiber | **Risk**: LOW
**Engine Notes**: Citizen data flows from store → selector → StreetView; existing ped mesh IDs (`ped_special_man_army`, `ped_special_man_business`, `ped_special_man_thief`, base civilian) are already in `entities.yaml`. `ped_special_man_protestor` is a **new asset not yet created** — use `ped_special_man_thief` as a placeholder. Note the placeholder in evidence sign-off.

**Control Manifest Rules (Presentation layer)**:
- Required: Components subscribe to the minimum required Zustand slice via `useGameStore(selector)`. Never select the entire store.
- Forbidden: UI components importing directly from Three.js (`three`, `@react-three/fiber`, `@react-three/drei`) — this applies to plain React/CSS components, NOT to `StreetView.tsx` which is the dedicated 3D component.
- Forbidden: Gameplay logic (employment thresholds, happiness math) inline in `StreetView.tsx`.

---

## Acceptance Criteria

*From GDD `design/gdd/citizen-simulation.md` Visual/Audio Requirements, §3.2 (outfit precedence):*

- [ ] StreetView.tsx reads `citizenStates` (and `citizens` for faction/bodySeed) from the Zustand store via selectors — not from props or inline computation.
- [ ] **Outfit precedence chain** applied at render time (first matching rule wins):
  1. `role === 'thief'` → thief outfit (skulking posture)
  2. `role === 'protestor'` → protestor outfit (placeholder: thief mesh; note in evidence)
  3. `employed AND faction === 'army'` → army uniform
  4. `employed AND faction === 'business'` → business suit
  5. otherwise → civilian
- [ ] **Body type** (`slim / fit / fat`) from `computeBodyType(bodySeed, health)` is applied to the ped mesh independently of outfit.
- [ ] **Protestor cluster**: peds with `role === 'protestor'` are grouped spatially in the square, distinct from thieves skulking at shopfronts.
- [ ] **`gone` peds are absent** — no ghost meshes at former positions; alive peds only.
- [ ] **No ADR-0003 violation**: `StreetView.tsx` reads state from Zustand; no gameplay logic (happiness formulas, employment checks) inline in the 3D component.
- [ ] Draw calls stay `< 100` (verified in Chrome DevTools).
- [ ] Frame rate ≥ 60 fps with all 25 peds rendered.

---

## Implementation Notes

*From GDD citizen-simulation.md Visual/Audio Requirements and ADR-0003:*

**What StreetView.tsx needs**:
- A selector that returns `citizenStates` (alive, role, employed, happiness) and `citizens` (faction, bodySeed, skin) in parallel arrays.
- A local pure function `getOutfit(role, employed, faction)` → outfit mesh ID (see precedence chain above).
- `computeBodyType(bodySeed, health)` can be imported from `CitizenHandler.ts` (pure function, no store).

**Protestor clustering**: when rendering, group all `role === 'protestor'` peds at a cluster position (e.g., in the town square area of the street layout). All other roles use their normal spread positions.

**Placeholder**: until `ped_special_man_protestor` is created, use `ped_special_man_thief` for the protestor mesh. Add a `// TODO: swap to ped_special_man_protestor` comment at the assignment.

**`gone` peds**: filter to `citizenStates.filter(cs => cs.alive)` before rendering; do not render dead peds.

**Performance**: instance/share ped meshes by `(bodyType, outfit)` combination to stay under the 100-draw-call budget.

---

## Out of Scope

- Story 7-3: role computation and citizen state data (must be DONE first)
- Story 7-5: Citizen Inspector UI click-to-inspect panel
- Audio (street murmur density, protest chant layer) — deferred to a sound sprint
- `ped_special_man_protestor` asset creation — flagged for an asset-spec pass

---

## QA Test Cases

*Visual/Feel story — manual verification steps (from qa-plan-sprint-7-2026-06-17.md).*

- **Outfit precedence**:
  - Setup: set army rel ≤-1 and security=2 (army peds displaced)
  - Verify: displaced army peds render in civilian clothes (no uniform)
  - Pass condition: no army-uniform mesh visible on displaced peds

- **Protestor cluster**:
  - Setup: set people happiness ≤3 and education≥5 to trigger protestors
  - Verify: protestor peds cluster in the square; thief peds skulk at shopfronts
  - Pass condition: protestors visually grouped, separate from thieves

- **Body type tracks health**:
  - Setup: set `health=1` (low) then `health=9` (high)
  - Verify: crowd's average body build shifts visibly (more fat at low health; more fit at high)
  - Pass condition: visible distribution change across the 25 peds

- **Gone peds absent**:
  - Setup: advance rounds until at least 1 citizen has `alive=false`
  - Verify: no ghost mesh at the dead citizen's last position
  - Pass condition: ped count on street equals alive citizen count

- **Performance**:
  - Verify: Chrome DevTools → Performance → draw calls < 100 with all 25 peds
  - Verify: frame rate ≥ 60 fps

- **ADR-0003 check** (static):
  - Grep: `rg "from '.*GameState'" src/3d/StreetView.tsx` — no gameplay-logic imports
  - Grep: no happiness/employment formulas inline in StreetView.tsx

---

## Test Evidence

**Story Type**: Visual/Feel
**Required evidence**: `production/qa/evidence/7-4-street-view-citizens-evidence.md`
  — 3 screenshots (well-run city, declined city with displaced elites, unrest with protestors)
  — sign-off table: lead-programmer (ADR-0003) + owner (visual read)
**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 7-3 must be DONE (`citizenStates` populated in store each round)
- Unlocks: nothing blocked, but visually enriches 7-5 and 7-6
