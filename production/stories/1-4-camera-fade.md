# Story 1-4: Camera — Fade-to-Black Tab Transition

## Header
- **Story ID**: 1-4
- **Sprint**: 1
- **Status**: In Progress
- **Type**: UI
- **Layer**: Feature
- **TR-ID**: TR-scene-001
- **Governing ADR**: docs/architecture/adr-0003-react-threejs-integration.md
- **Manifest Version**: N/A (control manifest not yet created)
- **Estimate**: 0.5 days
- **Last Updated**: 2026-06-10

## Summary

Replace the lerp-based camera animation in `CameraController.tsx` with an
instant teleport. Add a fade-to-black overlay scoped to the tab content panel
that hides the teleport and provides a satisfying ~200ms blink transition when
switching tabs.

## Acceptance Criteria

- [ ] Switching any tab triggers a fade-to-black on the tab content panel (~100ms in, ~100ms out)
- [ ] Camera position changes happen at peak opacity — never visible to the player
- [ ] `CameraController.tsx` no longer lerps; it sets camera position directly
- [ ] The Navbar remains fully visible throughout the transition (not affected by the overlay)
- [ ] The 3D scene canvas is not affected by the overlay
- [ ] Rapid tab switches cancel the in-flight transition (no stacked or flickering fades)
- [ ] `FADE_DURATION_MS` is a named constant — not a magic number scattered across files

## Implementation Notes

### Architecture (from ADR-0003)

The overlay is scoped to the tab content panel — **not** full-screen:
- `FadeOverlay` uses `position: absolute; inset: 0` inside a `position: relative`
  wrapper div that wraps `<TabManager />` in `App.tsx`
- The Navbar and 3D canvas are outside this wrapper and are never covered

### Timing sequence

```
t=0ms:    user clicks tab → useFadeTransition intercepts
t=0ms:    setFading(true) → CSS transition begins: opacity 0 → 1 (100ms)
t=100ms:  setActiveTab(tab) fires (camera teleports, tab content swaps)
t=100ms:  setFading(false) → CSS transition begins: opacity 1 → 0 (100ms)
t=200ms:  fade complete
```

The constant `FADE_DURATION_MS = 100` lives in `src/Hooks/useFadeTransition.ts`.

### Rapid click handling

If `transitionTo` is called while a fade is already in progress, cancel the
pending `setTimeout` and start a fresh fade cycle. This prevents stacked fades
from rapid clicking.

### Files to create / modify

| File | Action | Notes |
|------|--------|-------|
| `src/Hooks/useFadeTransition.ts` | CREATE | The timing hook; exports `useFadeTransition(setActiveTab)` and `FADE_DURATION_MS` |
| `src/components/FadeOverlay/FadeOverlay.tsx` | CREATE | `position: absolute; inset: 0` overlay component |
| `src/components/FadeOverlay/FadeOverlay.module.css` | CREATE | Black overlay, `transition: opacity 100ms ease-in-out` |
| `src/3d/CameraController.tsx` | MODIFY | Remove `useRef(currentPos)` + lerp; use `ref.current.position.set(...cameraPos)` directly |
| `src/components/Navbar/Navbar.tsx` | MODIFY | Use `transitionTo` from `useFadeTransition` instead of `setCurrentTab` directly |
| `src/App.tsx` | MODIFY | Wrap `<TabManager />` in a `position: relative` container div; render `<FadeOverlay visible={fading} />` inside it |

### CameraController change

```typescript
// BEFORE (lerp):
const currentPos = useRef(new Vector3(...cameraPos));
useFrame(() => {
  currentPos.current.lerp(new Vector3(...cameraPos), 0.1);
  ref.current.position.copy(currentPos.current);
});

// AFTER (teleport):
useFrame(() => {
  if (!ref.current) return;
  ref.current.position.set(...cameraPos);
});
```

The `PerspectiveCamera` ref (`ref`) is still needed for the `makeDefault`
behaviour — keep the ref and the `<PerspectiveCamera>` JSX, just remove the
lerp logic.

### useFadeTransition interface

```typescript
export const FADE_DURATION_MS = 100

export function useFadeTransition(setActiveTab: (tab: Tabs) => void) {
  // returns { fading: boolean, transitionTo: (tab: Tabs) => void }
}
```

### Navbar wiring

In `Navbar.tsx`, replace both call sites of `setCurrentTab` with `transitionTo`:
- Game title click: `onClick={() => transitionTo(Tabs.Menu)}`
- Tab button click: `onClick={() => transitionTo(tab)}`

The `fading` state is lifted from the hook and stays local to Navbar + FadeOverlay.
No store changes needed.

## Out of Scope

- Changing which camera positions map to which tabs
- Adding new camera positions (that is story 1-5/1-6)
- Fading Meet/Laws within the ActionPanel's `activeTab` section (those render
  outside TabManager; treat as follow-up if it feels incomplete)
- Keyboard navigation triggering fades
- Transition when the game title click returns to Menu tab (include if trivial, exclude if messy)

## Test Evidence

**Type: UI** — manual walkthrough required. No automated test needed per coding standards.

Evidence document: `production/qa/evidence/1-4-camera-fade-evidence.md`

The evidence doc should confirm:
1. Fade is visible on tab switches (screenshot or description)
2. Navbar stays visible during fade
3. Rapid clicking doesn't cause flickering
4. No console errors

## Dependencies

None — this story is independent.
