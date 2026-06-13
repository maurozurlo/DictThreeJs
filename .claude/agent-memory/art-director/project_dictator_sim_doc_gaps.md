---
name: dictator-sim-doc-gaps
description: Visual/UX documentation that exists vs is missing for Dictator Simulator, assessed at the Production-to-Polish gate
metadata:
  type: project
---

Visual/UX doc state for Dictator Simulator as of 2026-06-13 Polish gate review.

**Strong / present:**
- `design/ux/hud.md` — excellent: zones, visual budget (max 9 persistent elements, area caps per zone), categorization, relation color tiers, accessibility section. This is the de-facto partial style guide.
- `design/ux/tutorial-onboarding.md` — implementation-ready first-run tutorial spec with accessibility checklist.
- `design/gdd/game-concept.md` sec 11-12 — 3D scene intent + tone reference.

**Missing:**
- `design/art/art-bible.md` — does NOT exist. No formal visual source of truth.
- `design/accessibility-requirements.md` — accessibility tier undefined (hud.md recommends WCAG-AA but it's unratified; no contrast audit run against the dark-brown/yellow theme).
- `design/ux/interaction-patterns.md` — no pattern library. hud.md explicitly flags the Secret-tab announcement dialog as a "new pattern" needing one.
- No screenshots/visual evidence in `production/qa/evidence/`.
- Many implemented screens lack UX specs: Shop, Budget, Laws, Deals, Log, EndScreen (14-slot Records panel), Menu tab.

**Known visual defect:** Story 3-6 open — SecretRoom action panel renders in the main center area instead of the Zone 2 ActionPanel region, violating the hud.md zone contract (Meet/Laws/Deal panels belong in Zone 2).

**Why:** Game was reverse-documented after implementation, so specs lag the code.

**How to apply:** For a Polish gate, the load-bearing gaps are the art bible (palette/type/spacing tokens) and the accessibility tier ratification + contrast audit — both are latest-responsible-moment decisions because deferring them past Polish causes retheming rework. The per-screen UX specs are lower priority (screens already exist and are usable). Related: [[dictator-sim-visual-identity]].
