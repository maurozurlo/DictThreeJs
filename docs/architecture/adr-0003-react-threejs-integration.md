# ADR-0003: React / Three.js Integration — R3F Canvas Boundary and Zustand Camera Bridge

## Status
Accepted

## Date
2026-06-10

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Web Platform (browser) |
| **Domain** | Rendering — React / Three.js boundary |
| **Knowledge Risk** | LOW — React Three Fiber, @react-three/drei, Zustand are within LLM training data |
| **References Consulted** | N/A |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | None |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0001 (React Three Fiber chosen), ADR-0002 (Zustand owns camera state) |
| **Enables** | Street View feature (deferred — will add a new camera position and tab) |
| **Blocks** | None |
| **Ordering Note** | Any new 3D scene elements must follow the Canvas boundary and Zustand camera bridge patterns defined here. |

## Context

### Problem Statement
The application has two distinct rendering systems that must coexist without
interfering: React's virtual DOM (UI layer) and React Three Fiber's WebGL canvas
(3D layer). Additionally, the 3D camera must respond to UI events (tab switching)
without creating circular dependencies between the UI and rendering layers.

### Constraints
- UI components must not import from `src/3d/` — the 3D layer is a visual
  output, not a UI concern
- Camera position changes during tab switches must be visually concealed from
  the player via a **fade-to-black overlay** (~200ms total: 100ms fade-in,
  camera teleports at peak opacity, 100ms fade-out). The lerp approach was
  replaced because the floating camera motion was jarring. See story 1-4.
- The 3D scene must be replaceable or expandable without changing UI components
- Debug mode requires free-camera WASD/look controls that bypass the tab-driven
  camera positions

### Requirements
- Tab switching must drive the camera to a contextually relevant position
- Camera state must persist across re-renders without causing performance issues
- 3D objects (faction characters, environment) must be separately composable
- Asset loading (GLB models) must not block the initial render

## Decision

Use a **Zustand camera bridge** pattern: camera position is stored in Zustand
state, the R3F `CameraController` component reads this state and teleports
the camera to it instantly, and UI components write to this state when
switching tabs. The `<Canvas>` element is a self-contained leaf in the React
tree that React never re-renders into directly.

Tab transitions are visually masked by a **CSS fade-to-black overlay**
(`FadeOverlay.tsx`) rendered in `App.tsx`. The `useFadeTransition` hook
(used in `Navbar.tsx`) intercepts tab change clicks, triggers the fade,
waits for peak opacity (~100ms), then calls `setActiveTab` (which teleports
the camera), and immediately begins the fade-out. Total duration: ~200ms.

### Rendering Boundary

```
React DOM (UI layer)                 R3F Canvas (3D layer)
─────────────────────────────        ────────────────────────────────
App.tsx
  ├── Navbar.tsx                     <Canvas>
  ├── TabManager.tsx          ┐        ├── <CameraController />   ← reads Zustand
  ├── ActionPanel.tsx         │        ├── <MainModel />
  └── EndScreen.tsx           │        ├── <Elite />
                              │        ├── <People />
                              ▼        ├── <Military />
                    Zustand store      ├── <SecretRoom />
                    scene.camera       └── <Statue />
                    .cameraPos   ──►  CameraController lerps to this
                                       each frame via useFrame
```

The `<Canvas>` is rendered by `<Scene />`, which is a sibling of the UI overlay
in `App.tsx`. React treats `<Canvas>` as a standard DOM element — it mounts once
and R3F owns everything inside it. React's reconciler does not touch Three.js
objects.

### Zustand Camera Bridge

**Write side** (UI / store): `setActiveTab()` in the Zustand store writes a new
`[x, y, z]` position to `scene.camera.cameraPos` based on which tab was selected:

```typescript
// In GameState.ts setActiveTab():
if (tab === Tabs.Meet)   newCameraPos = cameraPositions[0];
if (tab === Tabs.Laws)   newCameraPos = cameraPositions[1];
if (tab === Tabs.Street) newCameraPos = cameraPositions[2];
if (tab === Tabs.Secret) newCameraPos = new Vector3(1.5, 0.7, 1.0);
// (other tabs leave camera unchanged)
```

Camera positions for Meet/Laws/Street are set by the 3D scene at mount time
via `setCameraPositions()`, which populates `scene.camera.cameraPositions[]`.

**Read side** (3D scene): `CameraController.tsx` subscribes to `cameraPos` via
`useGameStore()` and sets the camera position directly each frame (no lerp):

```typescript
// CameraController.tsx
const cameraPos = useGameStore(s => s.scene.camera.cameraPos);

useFrame(() => {
  if (!ref.current) return;
  ref.current.position.set(...cameraPos);
});
```

The visual masking of the teleport is the responsibility of `FadeOverlay.tsx`
(DOM layer), not `CameraController.tsx` (3D layer). This respects the
UI / 3D layer boundary.

**Fade orchestration** (UI layer): `useFadeTransition(setActiveTab)` is used in
`Navbar.tsx`. When a tab is clicked:
1. `setFading(true)` → CSS overlay fades to black (100ms transition)
2. After 100ms: `setActiveTab(tab)` fires (camera teleports; the tab content panel is hidden behind the overlay)
3. `setFading(false)` → overlay fades back out (100ms transition)

The constant `FADE_DURATION_MS = 100` lives in `src/Hooks/useFadeTransition.ts`.

**Scope of the fade**: The overlay is `position: absolute` inside a container
div that wraps `<TabManager />` in `App.tsx`. It covers **only the tab content
panel** — the Navbar remains fully visible throughout the transition, and the
3D scene canvas behind the UI is never affected. Total visible transition: ~200ms.

### Debug Camera Override

In debug mode (`debug.enabled === true`), `CameraController` is replaced by
`CameraControllerFree` — a component that attaches WASD + mouse-look controls
and logs a console message. This bypasses the Zustand bridge entirely, giving
full free-flight camera navigation for scene inspection.

The `useCameraSwitcher` hook in `Scene.tsx` adds a Space key binding in debug
mode to cycle through the registered camera positions.

### 3D Object Composition

Each major scene element is a separate R3F component in `src/3d/`:
- `MainModel.tsx` — static environment mesh (the room)
- `Elite.tsx`, `People.tsx`, `Military.tsx` — faction representatives (interactive)
- `SecretRoom.tsx` — hidden room accessible via Secret tab
- `Statue.tsx` — purchasable through Shop; visibility driven by `shop.statueCount`

Each component reads from Zustand independently to determine its visual state
(e.g., `Statue` reads `shop.statueCount` to decide how many statues to render).
No 3D component receives props from parent React components — they are all
self-contained Zustand subscribers.

### Asset Loading

GLB/GLTF models load asynchronously via R3F's built-in loader (backed by
`@react-three/drei`'s `useGLTF`). The `<Canvas>` is wrapped in React `<Suspense>`
in `App.tsx` with a `"Loading..."` fallback. This prevents the UI from blocking
on 3D asset load times.

### Key Interfaces

| Contract | Pattern | Owner |
|----------|---------|-------|
| Camera position write | `store.scene.camera.cameraPos: [x,y,z]` | UI layer (setActiveTab) |
| Camera position read | `useGameStore(s => s.scene.camera.cameraPos)` | CameraController.tsx |
| Camera positions register | `scene.camera.setCameraPositions(positions, targets)` | 3D scene (on mount) |
| 3D state read | `useGameStore(selector)` directly in each 3D component | Each `src/3d/` component |
| Asset load | React Suspense boundary in App.tsx | App.tsx |

### Architecture Diagram

```
App.tsx
├── <Suspense fallback="Loading...">
│     └── <Scene /> ────────────────────────────────────────────────────┐
│           useCameraSwitcher(debug)                                     │
│                                                                        ▼
│           <Canvas shadows dpr={[1,2]}>                          R3F render loop
│             <ambientLight />                                    (requestAnimationFrame)
│             <pointLight × 2 />                                         │
│             {debug                                              CameraController
│               ? <CameraControllerFree />                        reads Zustand every frame
│               : <CameraController />}   ◄── reads cameraPos    lerps camera position
│             <MainModel />
│             <Elite />        ◄── reads Zustand for interactivity state
│             <People />       ◄── reads Zustand
│             <Military />     ◄── reads Zustand
│             <SecretRoom />
│             <Statue />       ◄── reads shop.statueCount from Zustand
│           </Canvas>
│
├── <Navbar />
├── <TabManager />    ──── setActiveTab(tab) ──► store.scene.camera.cameraPos
├── <ActionPanel />
└── <EndScreen />
```

## Alternatives Considered

### Alternative A: Camera State Owned by Three.js (Not Zustand)
- **Description**: Manage the camera directly in Three.js; emit events from the
  UI to a global event bus that the 3D layer listens to.
- **Pros**: Camera logic stays in the 3D layer where it physically lives
- **Cons**: Event bus creates hidden coupling. State is split across two systems —
  Zustand owns game state, Three.js owns camera state — making save/load and
  testing more complex. Camera position is game-meaningful (it tells the player
  which faction they're looking at) and belongs in the authoritative game state.
- **Rejection Reason**: Zustand as the single source of truth for all meaningful
  game state is the core pattern of this architecture. Camera position is
  meaningful game state.

### Alternative B: Pass Camera Props Down Through React Tree
- **Description**: Store camera position in a top-level React component, pass
  it as props to `<Scene>` and down to `<CameraController>`.
- **Pros**: Explicit data flow, no global state for camera
- **Cons**: Any UI component that needs to change the camera must receive a
  callback prop, creating prop-drilling through `TabManager` → `Tabs` → `setCamera`.
  Adding a new tab that changes the camera requires threading props through the
  whole tree.
- **Rejection Reason**: Zustand eliminates the prop-drilling without the hidden
  coupling of an event bus.

### Alternative C: Separate React Three Fiber App (Iframe or Portal)
- **Description**: Render the 3D scene in a completely separate R3F context or
  iframe, communicate with the UI via postMessage.
- **Pros**: Maximum isolation between rendering layers
- **Cons**: postMessage adds async latency to camera transitions; shared state
  (e.g., faction state driving 3D character appearance) requires duplication or
  a sync protocol. Vastly overengineered for a single-page application.
- **Rejection Reason**: Unnecessary complexity for a same-origin, same-page
  rendering scenario.

## Consequences

### Positive
- UI components have zero knowledge of Three.js — they only write to Zustand
- 3D components are self-contained and independently testable (mock the store)
- Adding a new tab with a new camera position requires one line in `setActiveTab()`
  and registering the position at mount time
- Debug free-camera mode is isolated and has no impact on production code paths
- Fade-to-black transitions are encapsulated in `useFadeTransition.ts` and `FadeOverlay.tsx`; `CameraController.tsx` only concerns itself with position, not timing
- Camera teleport is instantaneous — no frame budget consumed by lerp per-frame calculations

### Negative
- Camera position is stored as a plain `[x, y, z]` tuple in Zustand — Vector3
  objects cannot be stored in Zustand without serialization issues
- R3F `useGameStore()` in `CameraController.tsx` subscribes to the full camera
  object (known violation of the full-store-selector pattern from ADR-0001 —
  existing code uses `useGameStore()` without a narrow selector; should be fixed)
- 3D components that read Zustand state are tightly coupled to the store shape —
  refactoring state structure requires updating both store and 3D components

### Risks
- **Camera position type mismatch**: `cameraPos` is stored as `[number, number, number]`
  but `setCameraPositions` registers `Vector3[]`. The conversion is done at write
  time in `setActiveTab`. If a new code path sets a Vector3 directly into
  `cameraPos`, the lerp in `CameraController` will silently produce NaN.
  *Mitigation*: `cameraPos` type is `[number, number, number]` in TypeScript —
  compiler catches incorrect assignments. Any new camera write must use the tuple form.
- **Mount-order dependency**: `scene.camera.cameraPositions[]` is populated by the
  3D scene at mount time. If `setActiveTab` is called before the scene mounts
  (e.g., a loaded save file sets the tab during `loadGame()`), the camera position
  array may be empty and the camera won't move.
  *Mitigation*: `setActiveTab` guards against empty `cameraPositions` with
  `if (cameraPositions.length === 0) return`. Acceptable for now; a future
  improvement could defer tab-linked camera moves until after scene mount.

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|------------|-------------|--------------------------|
| game-concept.md | 3D scene is functional — clicking faction representatives initiates Meet interaction | Faction 3D components read Zustand state and are independently composable |
| game-concept.md | Tab navigation moves camera to contextually relevant positions | Zustand camera bridge drives camera from `setActiveTab()` |
| game-concept.md | Street view planned — shows country state visually | Camera position slot 2 is reserved for Street tab; pattern supports adding it without changing UI code |
| game-concept.md | Statues purchased in Shop are visible in scene | `Statue.tsx` reads `shop.statueCount` directly from Zustand |

## Performance Implications
- **CPU**: `CameraController.useFrame` runs every frame (~60fps). It reads one
  Zustand value and performs a Vector3 lerp — negligible overhead.
- **Re-renders**: `CameraController` subscribes to the full camera object
  (known issue — see Negative consequences). Should be narrowed to `cameraPos`
  only to avoid re-renders when other camera fields change.
- **Asset loading**: GLB assets load async behind Suspense; no frame blocking.

## Migration Plan
If the 3D scene grows significantly (more characters, animated environment,
street view), consider:
1. Move `src/3d/` components into a dedicated `src/scene/` directory with its
   own barrel export
2. Introduce a `useSceneStore` Zustand slice for scene-only state (camera,
   lighting, character animation states) — keeping it separate from game state

## Validation Criteria
- Switching tabs shows a ~200ms fade-to-black on the tab content panel, then the new tab content appears (manual test)
- Camera teleports to the expected position at peak fade opacity (not visible to player)
- No UI component imports from `src/3d/` (grep check)
- `shop.statueCount` change is reflected in the 3D scene without a page reload
- Debug free-camera activates in debug mode and does not persist to next session

## Related Decisions
- [ADR-0001: Tech Stack Choice](adr-0001-tech-stack-choice.md) — R3F chosen
- [ADR-0002: State Management Pattern](adr-0002-state-management-pattern.md) — Zustand as single source of truth
- [design/gdd/game-concept.md](../../design/gdd/game-concept.md) — 3D Scene section
