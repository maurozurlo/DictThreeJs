# Control Manifest

**Manifest Version:** 2026-06-13
**Derived from:** ADR-0001, ADR-0002, ADR-0003, ADR-0004, ADR-0005, ADR-0006

This is the flat programmer rules sheet. Stories embed the `Manifest Version` date;
`/story-done` checks for staleness. Update this file when an ADR decision changes
a Required/Forbidden rule, and bump the `Manifest Version` date.

---

## Foundation Layer
_Core architecture: state, rendering boundary, RNG, event scheduling, round loop._

### Required
- All game state lives in the single Zustand store (`useGameStore`). No additional
  stores, no React Context for game data.
- All multi-slice state mutations use a single atomic `set((s) => ({...}))` call.
- Handler files (`BudgetHandler.ts`, `ActionHandler.ts`, `EffectHandler.ts`, etc.)
  are pure functions: plain data in, typed result out — no store imports, no React hooks.
- All `Math.random()` calls go through named utility functions in `src/Utils/Math.ts`.
  Stores and components never call `Math.random()` inline.
- The Three.js canvas (`<Scene />`) is a leaf node React never re-renders into.
  UI components must not import from `src/3d/` or `src/Scene.tsx` siblings.
- Camera position changes must go through `scene.camera.cameraPos` in Zustand state.
  No direct Three.js camera mutations from UI components.
- Timer state lives in `gameManagement` (ADR-0006). `expireTimer()` is the only
  path that triggers round resolution from timer expiry.

### Forbidden
- Handler files importing from `../../Stores/GameState` (coupling creep).
- UI components importing directly from Three.js (`three`, `@react-three/fiber`,
  `@react-three/drei`) — 3D is the Scene boundary's concern.
- Calling `Math.random()` inline in store actions, Handlers, or components.
- Multiple `set()` calls within one logical operation (use a single atomic call).
- `any` type in Handler files or asset data arrays.

### Guardrails
- `GameState.ts` soft limit: 1500 lines. If exceeded, split into Zustand slice files.
- State slices must be JSON-serializable (no class instances, no functions in persisted
  slices). `Set<>` types require manual serialization in `SaveLoad.ts`.
- New `Set<>` state fields must be added to both `buildSavePayload` and `loadGame`
  whitelist explicitly.

---

## Feature Layer
_Tab screens, ActionPanel, gameplay mechanics, recurring effects, events._

### Required
- Components subscribe to the minimum required Zustand slice via `useGameStore(selector)`.
  Never select the entire store object.
- Gameplay values (costs, gains, thresholds, tier amounts) must come from constants
  files (`src/Constants/`) or asset arrays (`src/assets/`), never hardcoded inline.
- All player-facing text goes through `i18next` (`useTranslation`). No hardcoded
  strings in JSX.
- Recurring effect labels follow the `'<namespace>.<dotted.key>'` convention
  (e.g. `'laws.recurring.contractor_cost'`). Pass the full label to the namespace
  translator — do not strip the namespace prefix before calling `lawsT`/`dealsT`.
- New tab content panels that require user interaction belong in `ActionPanel`
  (alongside Meet and Laws), not in the `TabManager` main area.

### Forbidden
- Gameplay logic (formulas, probability) inside React components — extract to
  Handler or utility functions.
- Hardcoded money amounts, relation deltas, or probability values in component JSX.
- Direct DOM manipulation from game logic code.

### Guardrails
- New recurring effect labels must have EN and ES translations before the story
  can be closed. The `recurringContent.test.ts` i18n test enforces this.
- `Secret` tab interactions follow the ActionPanel pattern (SecretPanel.tsx),
  not the TabManager pattern.

---

## UI / Presentation Layer
_Styling, layout, icons, typography._

### Required
- All layout uses CSS Modules (`.module.css`) co-located with the component.
- Pixel-art assets use `image-rendering: pixelated`.
- Button chrome comes from `border-image-source: url("/assets/button.png")` via
  the `Button` component — do not recreate button chrome in ad-hoc elements.

### Forbidden
- Inline `style` objects for layout concerns that belong in CSS (use className).
- Global CSS mutations from component code.

### Guardrails
- Animated effects on interactive elements (e.g. advance-button glow) must use
  `pointer-events: none` on overlay layers to preserve click behaviour.
