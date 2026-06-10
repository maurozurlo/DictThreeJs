# ADR-0001: Tech Stack Choice — React + Three.js + Zustand + TypeScript + Vite

## Status
Proposed

## Date
2026-06-10

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Web Platform (browser) |
| **Domain** | Full Stack — UI, Rendering, State Management |
| **Knowledge Risk** | LOW — React 19, Three.js, Zustand, Vite are within LLM training data |
| **References Consulted** | N/A — no engine-reference docs for web stack |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | None |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | None |
| **Enables** | ADR-0002 (state management pattern), ADR-0003 (React/Three.js integration) |
| **Blocks** | None |
| **Ordering Note** | All other ADRs for this project must be consistent with this stack. |

## Context

### Problem Statement
Dictator Simulator requires two things that typically belong to different tool
categories: a rich, data-driven UI (tabs, sliders, event cards, budget screens)
and an atmospheric 3D scene. Game engines provide strong 3D support but poor UI
primitives for data-heavy interfaces. Pure UI frameworks lack 3D. A hybrid
approach was needed.

### Constraints
- Deployment target: browser (no install, no download)
- Solo development — minimal tooling overhead
- Must support i18n (multi-language)
- Must support save/load (JSON export/import)
- 3D scene is atmospheric, not physics-driven (no ragdolls, no collision, no
  complex simulation)

### Requirements
- Must render a 3D scene alongside a full React UI without significant integration
  friction
- Must manage complex, deeply nested game state across many simultaneous systems
- Must be TypeScript-native for safety and IDE support
- Must deploy as static HTML/JS (no server required)

## Decision

Use **React 19 + React Three Fiber + Zustand + TypeScript + Vite** as the complete
application stack:

- **React 19** — component model for all UI screens, tabs, HUD, menus, event
  cards. Suspense boundary wraps the 3D scene for async asset loading.
- **React Three Fiber** (`@react-three/fiber`) + **`@react-three/drei`** — 3D
  scene rendering. R3F wraps Three.js in React's component model; `drei`
  provides PerspectiveCamera, helpers, and loaders. Camera positions are driven
  by Zustand state via `useFrame` lerp in `CameraController.tsx`.
- **Zustand** — global game state store. The Handler pattern (BudgetHandler,
  ActionHandler, EffectHandler) separates state mutation logic into testable
  pure functions that the Zustand store calls.
- **TypeScript** — strict typing throughout. All game state, asset data, and
  store interfaces are fully typed.
- **Vite** — build tooling and dev server. No server-side rendering; final
  build is static HTML/JS deployable to any CDN or GitHub Pages.

### Why React Three Fiber Over Raw Three.js
R3F integrates naturally with React's component model — 3D objects are declared
as JSX components within `<Canvas>`, `useFrame` hooks drive per-frame updates,
and asset loading integrates with React Suspense. This allows the 3D scene to
use the same component and hook patterns as the rest of the application, reducing
context switching and keeping the scene composable. The `drei` library provides
camera helpers and loaders that would require manual implementation with raw Three.js.

### Why Zustand Over Redux / React Context
Game state is deeply nested and mutated frequently (every round resolution
triggers cascading updates across budget, relations, charisma, log, and events
simultaneously). Zustand's fine-grained subscriptions ensure components only
re-render when their specific slice changes. React Context would cause full
component-tree re-renders on every state change. Redux adds boilerplate without
proportional benefit for a single-player game with no need for time-travel
debugging.

### Architecture Overview

```
Browser
  └── React App (index.html + main.tsx)
        ├── Suspense boundary
        │     └── Scene.tsx (Three.js canvas — owns render loop)
        │           ├── CameraController.tsx
        │           ├── MainModel.tsx
        │           ├── People.tsx / Military.tsx / Elite.tsx / Statue.tsx
        │           └── SecretRoom.tsx
        └── UI overlay (z-index above canvas)
              ├── Navbar.tsx
              ├── TabManager.tsx (routes active tab)
              ├── ActionPanel.tsx
              └── EndScreen.tsx

State (Zustand)
  └── useGameStore
        ├── gameManagement (round, phase, charisma, timer)
        ├── budget (treasury, taxes, expenditures)
        ├── relations (military, business, people)
        ├── law / deals / periodicEvent / miniChallenge
        ├── meet / shop / specialEnding / stats / log
        └── scene.camera (position drives Three.js camera)

Mutation logic (pure functions, imported by store)
  ├── BudgetHandler.ts
  ├── ActionHandler.ts
  └── EffectHandler.ts
```

### Key Interfaces
- **Store access**: `useGameStore(selector)` — all components subscribe via Zustand selector
- **Camera control**: `scene.camera.cameraPos` in Zustand state → Three.js camera lerps to it
- **State mutation**: Handler functions take `(state) → Partial<GameState>` — pure, testable
- **Asset data**: Typed arrays in `src/assets/` (`LAWS`, `DEALS`, `PERIODIC_EVENTS`, etc.)

## Alternatives Considered

### Alternative A: Godot 4 Exported to WebAssembly
- **Description**: Build the game entirely in Godot 4, export to WebAssembly for browser play.
- **Pros**: Integrated 3D engine, asset pipeline, animation system, physics
- **Cons**: Godot's UI system (Control nodes) is poorly suited to the tab-heavy,
  data-driven interface design. WASM bundle size is large (~20 MB+). Export
  pipeline adds friction for web iteration. TypeScript ecosystem unavailable.
- **Rejection Reason**: The UI complexity and browser deployment friction outweighed
  Godot's 3D advantages, especially since the 3D scene is non-interactive atmosphere.

### Alternative B: Unity WebGL
- **Description**: Build in Unity, export to WebGL.
- **Pros**: Mature 3D pipeline, Unity UI Toolkit for data-heavy UIs
- **Cons**: Very large WebGL build sizes, poor loading experience, Unity's WebGL
  export is notoriously fragile. License and cost concerns for solo dev.
- **Rejection Reason**: Build size, loading time, and licensing cost ruled this out.

### Alternative C: Raw Three.js + React (No R3F)
- **Description**: Use Three.js directly — manage the renderer, scene, and camera
  manually; treat the `<canvas>` element as a React leaf node that React never
  re-renders into.
- **Pros**: Full render loop control, no R3F abstraction overhead
- **Cons**: Camera management, asset loading (GLB/GLTF), and per-frame hooks all
  require manual wiring. R3F's `useFrame`, Suspense integration, and `drei`
  helpers solve these cleanly. Without R3F, linking Zustand camera state to
  Three.js requires imperative wiring outside React's model.
- **Rejection Reason**: R3F's integration with React Suspense and hooks brings
  the 3D scene into the same programming model as the rest of the app. The
  overhead is negligible for a scene with no real-time physics.

### Alternative D: Phaser.js
- **Description**: Use Phaser.js, a browser game framework.
- **Pros**: Designed for browser games, good 2D support
- **Cons**: Phaser is 2D-focused; 3D support is minimal. The atmospheric Three.js
  scene is a key visual differentiator.
- **Rejection Reason**: Lacks the 3D scene capability the game requires.

## Consequences

### Positive
- Entire stack deploys as static files — zero server cost, GitHub Pages compatible
- React ecosystem (i18next, Zustand, Vite) solves i18n, state, and build tooling
- TypeScript provides end-to-end type safety across game data and UI
- Fast dev iteration via Vite HMR
- Handler pattern makes core game logic fully unit-testable without React/DOM
- Three.js is well-documented and widely understood

### Negative
- No built-in game loop: round timer is managed manually via `Date.now()` and
  React hooks rather than a native game loop
- No asset pipeline: 3D models and textures are imported manually; no LOD,
  streaming, or automatic optimization
- React's reconciler adds rendering overhead not present in a pure canvas app
  (acceptable given the UI complexity)

### Risks
- **React + Three.js render loop conflict**: Two independent render cycles
  (React's virtual DOM and Three.js's requestAnimationFrame loop) must coexist.
  Three.js renders to a canvas element that React treats as a leaf node —
  direct manipulation outside React's model.
  *Mitigation*: Scene is wrapped in a single `<Scene />` component that React
  never re-renders into; Three.js owns the canvas entirely.
- **Zustand selector over-subscription**: Poorly written selectors cause
  components to re-render on unrelated state changes.
  *Mitigation*: Always select the minimum required slice. Avoid selecting the
  entire store object.
- **TypeScript strictness drift**: As game data grows, types may be loosened
  for convenience.
  *Mitigation*: No `any` in Handler files. Asset data arrays must be fully typed.

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|------------|-------------|--------------------------|
| game-concept.md | Platform: Browser (web), no install | React + Vite produces static build deployable to any web host |
| game-concept.md | Stack: React 19, TypeScript, Three.js, Zustand, Vite | This ADR formally records and justifies that choice |
| game-concept.md | i18n: Multi-language support | React ecosystem enables i18next integration (already implemented) |
| game-concept.md | Save/Load: JSON export/import | Pure TypeScript state serialization; no engine-specific save format |

## Performance Implications
- **CPU**: React reconciler adds ~1–2ms per state update cycle (acceptable for
  a turn-based game with no real-time physics)
- **Memory**: Three.js scene + React app together target < 150 MB in-browser
- **Load Time**: Vite code-splitting keeps initial bundle lean; 3D assets (GLB)
  load async behind Suspense boundary
- **Network**: Static deployment — no server round-trips during gameplay

## Migration Plan
N/A — this was the initial technology choice, not a migration from a previous stack.

## Validation Criteria
- Game loads and runs in Chrome, Firefox, and Safari without modification
- Build output is static files (no Node.js server required to serve)
- Round resolution completes with no React render cascade observable in DevTools
- Handler unit tests pass headlessly (no browser required to run tests)

## Related Decisions
- ADR-0002: State Management Pattern (Zustand Handler architecture)
- ADR-0003: React / Three.js Integration (rendering boundary and camera coupling)
- [design/gdd/game-concept.md](../../design/gdd/game-concept.md) — Platform & Tech section
