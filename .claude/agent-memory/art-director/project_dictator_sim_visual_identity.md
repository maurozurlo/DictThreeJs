---
name: dictator-sim-visual-identity
description: Dictator Simulator's emergent visual identity, where it lives in code, and the documentation gaps as of the Polish gate review
metadata:
  type: project
---

Dictator Simulator is a browser game (React 19 + TypeScript + Three.js + Zustand + Vite). Its visual identity emerged from implementation, not from an art bible. As of 2026-06-13 it is NOT formally documented.

The de-facto style is **pixel-art retro-bureaucratic**:
- Fonts (in `src/index.css` @font-face): PressStart2P (primary/body), 8-BIT WONDER, Bitmgothic
- Partial token set lives in `src/index.css` `:root`-equivalent block: `--text-color #ffffff`, `--text-body #dfdfdf`, `--accent-color #fbee32` (yellow), `--accent-muted #d1d37f`, `--hud-border-dark #401d09`, `--hud-panel-bg #2b1807` (dark brown HUD), plus `--navbar-height 84px`, `--action-panel-height 200px`.
- Tone target (game-concept.md sec 12): "overly serious meets dumb shit", Papers Please energy, never winks at camera.

**Why:** The token set is incomplete and not authoritative — 55 hardcoded color values are scattered across 11 component .module.css files (e.g. EndScreen uses raw `#27ae60`/`#e74c3c` for positive/negative, and `rgba(255,255,255,0.x)` borders everywhere) with no documented palette governing them. Semantic relation colors (red/orange/neutral/green tiers) are specified in `design/ux/hud.md` but not centralized as tokens.

**How to apply:** When asked to create the art bible, the job is largely REVERSE-DOCUMENTATION + reconciliation, not greenfield design. Extract the real palette/type/spacing from index.css + the 11 component files, promote hardcoded values to tokens, and codify the relation color tiers from hud.md. Related: [[dictator-sim-doc-gaps]].
