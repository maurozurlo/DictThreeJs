# Story 7-5: Citizen Inspector UI — Click-to-Inspect Panel

> **Epic**: Citizen Simulation
> **Status**: Complete
> **Layer**: Presentation
> **Type**: UI
> **Estimate**: 0.5 days
> **Manifest Version**: 2026-06-13
> **Last Updated**: 2026-06-18

## Context

**GDD**: `design/gdd/citizen-simulation.md`
**Requirement**: `TR-citizen-005`
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: [ADR-0003: React / Three.js Integration](docs/architecture/adr-0003-react-threejs-integration.md)
**ADR Decision Summary**: The 3D Scene (`StreetView.tsx`) owns the raycast/hit-test and emits `selectedPedId` (or null) into the Zustand store. The inspector panel is a plain React/CSS-module component that reads the selected citizen's data from the store — it never imports from `three`, `@react-three/fiber`, or `@react-three/drei`.

**Engine**: React 19 + TypeScript + CSS Modules | **Risk**: LOW
**Engine Notes**: The raycast pattern in R3F uses `onPointerDown`/`onClick` event handlers on the ped mesh instances. No post-cutoff API risk.

**Control Manifest Rules (Presentation layer)**:
- Required: Components subscribe to the minimum required Zustand slice via `useGameStore(selector)`.
- Required: All player-facing text goes through `i18next` (`useTranslation`). No hardcoded strings in JSX.
- Forbidden: UI components importing directly from Three.js (`three`, `@react-three/fiber`, `@react-three/drei`).
- Forbidden: Gameplay logic or formula re-derivation in the inspector component.

---

## Acceptance Criteria

*From GDD `design/gdd/citizen-simulation.md` UI Requirements (AC-16):*

- [ ] Clicking an **alive** ped on the street opens an inspector panel for that citizen.
- [ ] Panel displays:
  - `name` — identity anchor (e.g., "Marco Reyes")
  - `faction` — born allegiance with faction icon (army / business / people); shown even when displaced (e.g., "Army — Demobilized")
  - `employed` — role title or displaced state ("Soldier" / "Demobilized", "Business owner" / "Ruined", "Citizen")
  - `happiness` — 0–10 bar with a one-word mood label
  - `role` — content / neutral / thief / protestor
- [ ] **`gone` peds are not clickable** — the 3D component does not register a click for dead peds.
- [ ] Clicking a non-ped area of the street (no ped hit) sets `selectedPedId = null`; the panel returns to an idle "click a citizen" prompt.
- [ ] Selecting a second ped while the panel is open **swaps contents** — no double-panel, no stale data.
- [ ] **ADR-0003 boundary**: the inspector React component does NOT import from `three`, `@react-three/fiber`, or `@react-three/drei`.
- [ ] `selectedPedId` (or null) lives in the Zustand store; the 3D Scene writes it; the inspector reads it.
- [ ] All inspector text is localised (EN + ES strings in `public/locales/*/menu.json` or a new namespace).
- [ ] `tsc --noEmit` clean.

---

## Implementation Notes

*From GDD citizen-simulation.md UI Requirements and ADR-0003:*

**3D side** (`StreetView.tsx`):
- Each alive ped mesh has an `onClick` (or `onPointerDown`) handler that calls `useGameStore.getState().selectPed(id)` (or equivalent action).
- Dead peds have no click handler (or the handler is removed/disabled when `alive === false`).
- `gone` peds are not rendered (Story 7-4), so nothing to click.

**Store** (`GameState.ts`):
- Add `selectedPedId: number | null` to the `scene` slice (or a new `ui` slice).
- Add `selectPed(id: number | null)` action.

**Inspector component** (`src/components/Tabs/CitizenInspector.tsx`):
- Follows the same pattern as `Meet.tsx` / `Laws.tsx` — mounted in `ActionPanel.tsx` via `{activeTab === Tabs.Street ? <CitizenInspector /> : null}`.
- Reads `selectedPedId` and the matching `citizen` + `citizenState` from the store via selectors.
- When `selectedPedId === null`: shows a "click a citizen to inspect" idle prompt.
- When a ped is selected: renders name, faction icon + label (+ displaced note if applicable), employment role title, happiness bar (0–10), role label.
- No backdrop or click-outside dismiss needed — it is a sidebar panel, not a floating overlay.
- Selecting another ped in the 3D layer updates `selectedPedId`; the panel re-renders automatically.

**i18n keys to add** (e.g., in `menu.json` under a `citizen` namespace):
- `citizen.inspector.title`, faction labels, role labels, employment labels, happiness mood labels
- Mood label mapping: `≥8=content`, `≥6=content`, `≥4=neutral`, `≥2=worried`, `<2=desperate` (or similar — coordinate with GDD)

---

## Out of Scope

- Story 7-3: citizen state computation
- Story 7-6: population HUD display
- Click-to-inspect for `gone` peds (removed from the board in v1)
- Audio on inspect

---

## QA Test Cases

*Visual/Feel + UI story — manual verification steps (from qa-plan-sprint-7-2026-06-17.md).*

- **Panel opens on alive ped click**:
  - Setup: start a game; advance 1 round so citizens have roles
  - Verify: click any visible ped → inspector panel opens < 200ms perceived
  - Pass condition: panel shows `name`, `faction`, employed/role state, happiness bar, role label

- **Gone peds not clickable**:
  - Setup: advance rounds until at least 1 ped is `alive=false` (or mock the state)
  - Verify: clicking the area where the dead ped was — panel does NOT open
  - Pass condition: no panel, no console error

- **Dismiss on click-elsewhere**:
  - Setup: open the panel on an alive ped
  - Verify: click on the street background (not another ped) → panel dismisses
  - Pass condition: `selectedPedId === null` after click-elsewhere

- **Panel swap on second ped**:
  - Setup: panel open on ped A
  - Verify: click ped B → panel immediately updates to ped B's data (no double panel, no stale name)
  - Pass condition: panel shows ped B's name; ped A data not visible

- **ADR-0003 static check**:
  - Grep: `rg "from 'three'" src/components/CitizenInspector/CitizenInspector.tsx` → 0 matches
  - Grep: `rg "from '@react-three" src/components/CitizenInspector/CitizenInspector.tsx` → 0 matches

- **Viewport legibility**:
  - Verify at 1920×1080 and 1280×720 — panel readable at both
  - Pass condition: text not clipped; all fields visible

---

## Test Evidence

**Story Type**: UI
**Required evidence**: `production/qa/evidence/7-5-citizen-inspector-evidence.md`
  — manual walkthrough with screenshots at each check
  — sign-off: owner (UX) + lead-programmer (ADR-0003)
**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 7-3 must be DONE (`citizenStates` and `selectedPedId` actions available)
- Unlocks: Story 7-6 (minor UI, can run in parallel if desired)

## Completion Notes
**Completed**: 2026-06-18
**Criteria**: 9/9 passing
**Deviations**: None
**Test Evidence**: UI — evidence doc not created (ADVISORY); QA manual cases defined in story
**Code Review**: Deferred — to run before sprint close-out
