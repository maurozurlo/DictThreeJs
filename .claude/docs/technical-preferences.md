# Technical Preferences

<!-- Populated by /setup-engine. Updated as the user makes decisions throughout development. -->
<!-- All agents reference this file for project-specific standards and conventions. -->

## Engine & Language

- **Engine**: Web Platform — React 19 + React Three Fiber + Three.js (see ADR-0001)
- **Language**: TypeScript (strict mode)
- **Rendering**: React Three Fiber (`@react-three/fiber`) + `@react-three/drei`; Three.js canvas owns the render loop as a React leaf node
- **Physics**: None — atmospheric 3D scene only; no physics simulation

## Input & Platform

<!-- Written by /setup-engine. Read by /ux-design, /ux-review, /test-setup, /team-ui, and /dev-story -->
<!-- to scope interaction specs, test helpers, and implementation to the correct input methods. -->

- **Target Platforms**: Web (browser) — Chrome, Firefox, Safari
- **Input Methods**: Keyboard + Mouse
- **Primary Input**: Mouse (click-driven UI; all game actions are button/slider clicks)
- **Gamepad Support**: None
- **Touch Support**: None
- **Platform Notes**: Static HTML/JS deployment (GitHub Pages compatible). No server required. No mobile layout.

## Naming Conventions

- **Classes / Components**: PascalCase — `ActionPanel`, `BudgetHandler`, `GameState`
- **Variables / Functions**: camelCase — `applyGraceDampening`, `activeRecurringEffects`
- **Events / Signals**: camelCase verb phrase — `requestAdvanceRound`, `expireTimer`
- **Files**: PascalCase for components and handlers; camelCase for utilities — `ActionPanel.tsx`, `Math.ts`
- **CSS Modules**: camelCase selectors — `.advanceWrapper`, `.glowing`
- **Constants / Enums**: SCREAMING_SNAKE_CASE for top-level constants — `DIFFICULTY_TREASURY`; PascalCase for enum members — `Tabs.Meet`
- **Test files**: `[system]_[feature].test.ts` — `difficulty_levels.test.ts`, `grace_period.test.ts`

## Performance Budgets

- **Target Framerate**: 60 fps
- **Frame Budget**: 16.7 ms total (JS + render)
- **JS Round-Resolution Budget**: ≤ 5 ms (state update + React reconcile for a single `nextRound()` call)
- **Three.js Draw Calls**: < 100 per frame (atmospheric scene — no LOD required at this count)
- **JS Heap Ceiling**: 150 MB (Chrome DevTools Memory panel; measured at mid-game with recurring effects active)
- **Initial Bundle Size**: < 500 KB gzipped (Vite code-split; 3D assets load async behind Suspense)
- **3D Asset Load Time**: < 3 s on a 10 Mbps connection (GLB files behind Suspense boundary)

## Testing

- **Framework**: Vitest + React Testing Library
- **Runner command**: `npx vitest run` (headless, no browser required)
- **Minimum Coverage**: N/A — story-by-story evidence required (see Coding Standards)
- **Required Tests**: All Logic and Integration stories must have automated unit/integration tests before `/story-done`

## Forbidden Patterns

- Inline `Math.random()` in stores, Handlers, or components — use `src/Utils/Math.ts` named functions (ADR-0004)
- Handler files importing from `../../Stores/GameState` — Handlers are pure functions (ADR-0002)
- UI components importing from `three`, `@react-three/fiber`, or `@react-three/drei` — 3D is the Scene boundary's concern (ADR-0003)
- Multiple `set()` calls within one logical state mutation — use a single atomic `set((s) => ({...}))` (ADR-0002)
- `any` type in Handler files or asset data arrays
- Hardcoded gameplay values (costs, thresholds, probabilities) inline in JSX — use `src/Constants/` or `src/assets/`

## Allowed Libraries / Addons

- `react` 19, `react-dom` 19
- `@react-three/fiber`, `@react-three/drei`, `three`
- `zustand`
- `i18next`, `react-i18next`
- `vite`, `vitest`, `@testing-library/react`
- `clsx` (conditional className utility)
- TypeScript, ESLint

## Architecture Decisions Log

- [ADR-0001](../../docs/architecture/adr-0001-tech-stack-choice.md) — Tech Stack Choice (Accepted 2026-06-13)
- [ADR-0002](../../docs/architecture/adr-0002-state-management-pattern.md) — State Management Pattern (Zustand + Handler pattern)
- [ADR-0003](../../docs/architecture/adr-0003-react-threejs-integration.md) — React / Three.js Integration
- [ADR-0004](../../docs/architecture/adr-0004-rng-determinism.md) — RNG & Determinism Strategy (`src/Utils/Math.ts`)
- [ADR-0005](../../docs/architecture/adr-0005-event-scheduling.md) — Event Scheduling System
- [ADR-0006](../../docs/architecture/adr-0006-round-timer-game-loop.md) — Round Timer / Game Loop
- [ADR-0007](../../docs/architecture/adr-0007-effect-timing.md) — End-of-Round Effect Timing (Proposed — narrowed to non-stat delayed consequences by ADR-0008)
- [ADR-0008](../../docs/architecture/adr-0008-timed-modifier-engine.md) — Timed Modifier Engine / Unified Effect System (Accepted 2026-06-15)
- ADR-0009 — Coup Telegraphing & Fairness (Planned — not yet written)

## Engine Specialists

<!-- Read by /code-review, /architecture-decision, /architecture-review, and team skills -->
<!-- to know which specialist to spawn for engine-specific validation. -->

- **Primary**: `lead-programmer` (web stack — no engine-specific specialist exists for React/Vite)
- **Language/Code Specialist**: `lead-programmer` (TypeScript + React patterns)
- **Shader Specialist**: N/A (Three.js materials are simple; no custom GLSL shaders)
- **UI Specialist**: `ui-programmer` (React components, CSS Modules, i18next)
- **Additional Specialists**: N/A
- **Routing Notes**: This is a web app, not a game-engine project. Skip engine-specialist spawning for all story types. Use `lead-programmer` for architecture review and `gameplay-programmer` for game-logic implementation.

### File Extension Routing

<!-- Skills use this table to select the right specialist per file type. -->

| File Extension / Type | Specialist to Spawn |
|-----------------------|---------------------|
| `.ts` / `.tsx` (game logic, stores, handlers) | `lead-programmer` |
| `.tsx` (UI components, panels, menus) | `ui-programmer` |
| `.module.css` (CSS Modules) | `ui-programmer` |
| `.json` (i18n locale files, asset data) | `ui-programmer` (i18n) / `gameplay-programmer` (asset data) |
| `.test.ts` / `.test.tsx` (test files) | `lead-programmer` |
| General architecture review | `lead-programmer` |
