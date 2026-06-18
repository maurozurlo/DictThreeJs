# Story 7-6: Population HUD Readout

> **Epic**: Citizen Simulation
> **Status**: Not Started
> **Layer**: Presentation
> **Type**: UI
> **Estimate**: 0.25 days
> **Manifest Version**: 2026-06-13
> **Last Updated**: 2026-06-18

## Context

**GDD**: `design/gdd/citizen-simulation.md`
**Requirement**: `TR-citizen-006`
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: [ADR-0003: React / Three.js Integration](docs/architecture/adr-0003-react-threejs-integration.md)
**ADR Decision Summary**: The `displayedPopulation` value is computed by the citizen pipeline in `nextRound()` (Story 7-3) and stored in the Zustand state. This UI story wires it to the stat display area — a plain React component reading from the store, no Three.js.

**Engine**: React 19 + TypeScript + CSS Modules | **Risk**: LOW
**Engine Notes**: No new engine APIs — wiring a Zustand selector to an existing stat display pattern.

**Control Manifest Rules (Presentation layer)**:
- Required: Components subscribe to minimum required Zustand slice via `useGameStore(selector)`.
- Required: All player-facing text (including number formatting) through `i18next`.
- Forbidden: UI components importing from `three`, `@react-three/fiber`, `@react-three/drei`.

---

## Acceptance Criteria

*From GDD `design/gdd/citizen-simulation.md` §4.8 (Population HUD) and UI Requirements:*

- [ ] `displayedPopulation` appears in the existing stat area alongside treasury and relations.
- [ ] Formatted with **thousands separators**: `5,924,511` not `5924511`.
- [ ] Starts at `5,924,511` at game start (all 25 citizens alive).
- [ ] Decreases by ~237k after any round in which exactly 1 citizen dies; decreases by ~474k for 2 deaths; etc.
- [ ] Does **not** decrease in a round where 0 citizens die (population is monotonically non-increasing).
- [ ] Recomputes every round — value shown is always the post-round value.
- [ ] No ADR-0003 violation: the HUD widget does not import from Three.js.
- [ ] `tsc --noEmit` clean.

---

## Implementation Notes

*From GDD citizen-simulation.md §4.8:*

**Data flow**: `displayedPopulation` is computed in Story 7-3 (`nextRound()` pipeline) and stored in the `gameManagement` slice (or the `citizens` slice — wherever `citizenStates` lives). This story is purely the **read side**.

**Selector**:
```typescript
const displayedPopulation = useGameStore(s => s.gameManagement.displayedPopulation);
```
(Adjust slice path to match where 7-3 stores it.)

**Thousands formatting**: use `toLocaleString()` or an i18n number formatter. If the project already has a number formatting utility, use that; otherwise `(n: number) => n.toLocaleString('en-US')` is sufficient for EN; `i18next` `formatters` can handle locale-aware formatting.

**Placement**: add the population stat alongside the existing treasury/relations stat bar. Match the visual style of existing stat rows.

**i18n key**: add `stat.population` (or equivalent) to `menu.json` in both EN and ES namespaces.

---

## Out of Scope

- Story 7-3: `displayedPopulation` formula and computation
- Story 7-5: citizen inspector panel
- Any animation of the decrement (the gut-punch tick-down is a visual polish item, not v1)

---

## QA Test Cases

*UI story — manual verification steps.*

- **Displays at game start**:
  - Setup: start a new game
  - Verify: `5,924,511` appears in the stat area with comma formatting
  - Pass condition: number visible and formatted correctly

- **Decrements after a citizen death**:
  - Setup: advance rounds (or mock `citizenStates` with one dead citizen)
  - Verify: `displayedPopulation` is ~237k less than the previous round
  - Pass condition: value equals `round(24/25 * 5_924_511) = 5,687,531` after first death

- **No change when nobody dies**:
  - Setup: a round where all 25 citizens are alive and remain alive (safe budget)
  - Verify: `displayedPopulation` unchanged
  - Pass condition: value identical to previous round

- **ADR-0003 check**:
  - Grep: no Three.js imports in the HUD widget file
  - Pass condition: 0 matches for `'three'` in the component

---

## Test Evidence

**Story Type**: UI
**Required evidence**: note appended to `production/qa/evidence/7-5-citizen-inspector-evidence.md`
  OR separate `production/qa/evidence/7-6-population-hud-evidence.md`
  — brief manual walkthrough (3 checks above)
  — sign-off: owner
**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 7-3 must be DONE (`displayedPopulation` stored in state after each `nextRound()`)
- Unlocks: nothing (sprint close-out can begin after this)
