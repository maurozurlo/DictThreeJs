# Interaction Pattern Library
**Project**: Dictator Simulator
**Created**: 2026-06-14 (Story 5-5)
**Stack**: React 19 + CSS Modules + i18next

This document is the authoritative reference for reusable UI interaction patterns.
New UI work should consult this library before inventing new patterns; additions
require a brief rationale and an example component.

---

## Pattern 1 — Tab Navigation

### Intent
Switch the content area between discrete functional views without a page reload.

### Structure
- **`Navbar`** renders one `<button>` per tab (Meet, Laws, Budget, Shop, Street, Log).
- Each button carries a `data-tutorial="tab-{Name}"` attribute for tutorial targeting.
- Active tab is stored in `GameState.tabs.activeTab` (Zustand). Changing it via
  `tabs.setActiveTab()` triggers a camera transition in the 3D Scene.
- The **`TabManager`** component renders the content for the active tab.
- The **`ActionPanel`** renders the contextual action widget for the active tab
  (law propose/vote, deal accept/reject, meet action buttons).

### Pending-dot indicator
A small amber dot on a tab button signals that the player has an **unresolved
pending item** on that tab (e.g., a law not yet voted on, a deal not yet decided).
Implemented via conditional class on the `<button>` driven by a store selector.
The dot is purely informational — it never blocks navigation.

### Tab lock
Periodic events (rounds 3, 6, 9) lock all tabs until the event is resolved.
Lock state lives in `GameState.gameManagement.phase`. Locked tabs render as
`disabled` buttons with reduced opacity; the `TabManager` shows the periodic
event UI instead of the normal tab content.

### Example files
- `src/components/Navbar/Navbar.tsx`
- `src/components/Tabs/TabManager.tsx`

---

## Pattern 2 — Action Panel Dual-Mode (Status vs. Contextual)

### Intent
The right-side `ActionPanel` serves two roles that must not conflict:
1. **Status strip** (always visible): clock, round counter, treasury, faction
   relations, charisma slider.
2. **Contextual widget** (tab-dependent): the interactive content for the
   current tab (e.g., law vote buttons, deal accept/reject, meet action).

### Structure
The panel is split vertically:
- **Top** (`genStats` + `respect`): always-on status — never hidden or replaced.
- **Bottom** (`actions → activeTab`): renders the contextual widget for the
  active tab. Switches via `{activeTab === Tabs.Meet ? <Meet /> : null}` guards.

### Rules
- The status strip must remain readable at all times — do not obscure it with
  modal content or overlays that extend into that zone.
- The contextual widget area may be empty (e.g., Budget tab has no action widget).
- Never render two contextual widgets simultaneously.

### Example files
- `src/components/ActionPanel/ActionPanel.tsx`

---

## Pattern 3 — Pending-Dot (Unresolved Item Indicator)

### Intent
Draw the player's eye to a tab that requires a decision, without interrupting
the current flow with a modal or forced redirect.

### Behaviour
- Appears as a small coloured dot on the tab button in `Navbar`.
- Dot is amber (`#f1c40f`) by default; red for time-critical items.
- Computed from store state — never set manually.
- Disappears as soon as the item is resolved (law voted, deal decided).

### When to use
- Law proposed but not yet voted.
- Deal offered but not yet accepted/rejected.
- **Do not** use for informational tabs (Log, Shop) — those are pull, not push.

---

## Pattern 4 — Modal / Overlay Priority

### Intent
Define a clear stacking order so overlapping UI elements don't conflict.

### Z-index tiers (ascending priority)

| Tier | z-index | Usage |
|------|---------|-------|
| Scene | 0 | Three.js canvas |
| Base UI | 10–49 | Tabs, Navbar, ActionPanel |
| Overlay | 50–99 | DayEnded, Newspaper, FadeOverlay |
| Tutorial | 100–119 | TutorialOverlay spotlight + tooltip |
| Debug | 120–201 | DebugRecurringOverlay, DebugSelectorOverlay |
| Modal | 200+ | Full-screen modal (EndScreen, HelpOverlay) |

### Rules
- Only one overlay at a tier may be active at a time (enforced by game phase).
- Tutorial overlay pauses the round timer and must be dismissible at all times
  via the Skip button (never block it with a higher-z element).
- Debug overlays are pointer-events:none by default unless they require
  interaction (selector panel uses pointer-events:auto).

---

## Pattern 5 — Advance-Button State Machine

### Intent
The "Advance Round" button transitions through states that reflect game flow and
prevent accidental double-advance.

### States

```
idle ──────────────────────────────► ready
  │   (player completes meet action)    │
  │                                     │
  ◄── (new round starts) ─────────── clicked ──► advancing
                                             (timer/animation)
```

| State | Visual | Enabled |
|-------|--------|---------|
| `idle` | Normal label, neutral colour | No — not until meet action taken |
| `ready` | Highlighted / pulsing | Yes |
| `clicked` | Spinner or "Advancing…" | No — prevents double-click |
| `advancing` | Hidden (DayEnded shown) | — |

### Implementation notes
- State is derived from `gameManagement.phase` and `gameManagement.dayEnded`.
- The button's `disabled` prop is set when phase is not `'start'` or when
  `dayEnded` is true (the DayEnded sequence is in progress).
- Do not add a debounce — rely on the `disabled` state instead.

### Example files
- `src/components/RoundAdvanceController/RoundAdvanceController.tsx`

---

## Pattern 6 — Contextual Camera Transition

### Intent
The 3D scene camera moves to a tab-specific position when the active tab changes,
reinforcing that each tab represents a physical location in the game world.

### Behaviour
- Tab change → `tabs.setActiveTab()` → camera lerps to the registered position
  for that tab over ~0.4 s.
- Camera positions are defined in `GameState.scene.camera` and can be overridden
  in debug mode (scroll to adjust FOV, `I` to save position).

### Rules
- The camera transition must not interrupt gameplay — it is purely visual.
- If the tab changes during a camera transition, the target position updates
  immediately (no queuing).
- Never hard-cut the camera except during the FadeOverlay transition.

---

*To add a new pattern: describe Intent, Structure/Behaviour, Rules, and reference
at least one example file. Submit a PR or run `/design-review` on this file.*
