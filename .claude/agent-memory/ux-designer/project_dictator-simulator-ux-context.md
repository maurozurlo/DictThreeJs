---
name: project_dictator-simulator-ux-context
description: Core UX context for Dictator Simulator — layout zones, visual direction, interaction patterns, and citizen inspect pattern
metadata:
  type: project
---

Dictator Simulator is a browser-based political survival game (React 19 + Three.js). 10 rounds, real-time countdown (3min/2.5min/2min graduated), mouse+keyboard only. No touch, no gamepad.

**Layout:** Zone 1 Navbar (84px top), Zone 2 ActionPanel (200px bottom), Zone 3 tab content (fluid center), Zone 4 3D scene (always-on background), Zone 5 overlays.

**Art direction:** PressStart2P pixel font (0.45rem minimum), dark brown bg (#2b1807), four text colors (#fff, #dfdfdf, #fbee32 accent, #d1d37f muted), pixel 9-slice borders, semantic colors green/red/yellow for income/expense/warning.

**Seven tabs:** Log, Meet, Laws, Deals, Budget, Shop, Street (+ conditional Secret).

**Pending patterns:** Click-to-inspect citizen peds in Street View (new). Citizens have name, faction, happiness, role, employment, alive status. 25 persistent peds.

**UX specs live in:** `design/ux/hud.md`, `design/ux/interaction-patterns.md`, `design/ux/tutorial-onboarding.md`

**Why:** Understanding the full layout and color system is needed before any new UX work touching Street View, HUD, or color semantics.

**How to apply:** When working on Street View UX, ActionPanel extensions, or accessibility items — reference hud.md Zone definitions and interaction-patterns.md before proposing anything new.
