# Gate Check: Production → Polish

**Date**: 2026-06-14
**Review mode**: lean (all four phase-gate directors spawned)
**Checked by**: gate-check skill
**Verdict**: **CONCERNS → advanced** (no blockers; three quick items fixed before advancing)

---

## Required Artifacts: 9/9 present

- [x] `src/` organized into subsystems (Stores, Constants, Features, Hooks, components, 3d, Utils, i18n, types)
- [x] Test files in `tests/unit/` (difficulty, grace, secret, stats) + `tests/integration/` (meta)
- [x] All Logic stories have unit tests
- [x] Smoke check PASS WITH WARNINGS — `production/qa/smoke-2026-06-14.md`
- [x] QA plan exists — `production/qa/qa-plan-sprint-4-2026-06-13.md`
- [x] QA sign-off APPROVED WITH CONDITIONS — `production/qa/qa-signoff-sprint4-2026-06-14.md`
- [x] ≥3 playtest sessions (new player / mid-game / hard difficulty)
- [x] Playtests cover the three required dimensions
- [x] Difficulty curve doc — `design/difficulty-curve.md`

## Quality Checks: 6/10 clean at gate time

- [x] Tests passing — 289/289
- [x] No S1/S2 bugs
- [x] Playtest findings addressed (daily events removed, coup warning added)
- [x] Difficulty curve doc matches design intent
- [x] Core loop validated by playtest
- [?] Performance within budget — budgets documented, NOT measured → **first Polish task**
- [?] Accessibility tier — deferred to backlog (revisit before Release)
- [?] Interaction pattern library — `design/ux/interaction-patterns.md` missing → Polish task
- [?] All screens have UX specs — hud + tutorial only → Polish task

## Director Panel Assessment

| Director | Verdict | Key points |
|----------|---------|------------|
| Creative | CONCERNS | Core fantasy lands; pillars faithful. All playtests dev self-plays. Street View promised in tutorial but unbuilt. 5-min timer un-tuned. |
| Technical | CONCERNS | Architecture sound. Unmeasured perf = correct first Polish task, not a blocker. Doc drift in ADR log + Godot scaffolding. |
| Producer | CONCERNS | All Sprint-3 blockers closed. sprint-status.yaml was stale (now fixed). 3-5 deferral = scope creep unless descoped (now descoped). |
| Art | CONCERNS | Visual identity established. Sections 5-9 not a blocker. Art-bible Section 2 stale vs tokens (now fixed). `--tab-bg` undefined (now fixed). |

**Escalation**: No NOT READY verdict → eligible to advance. Minimum verdict CONCERNS.

**Chain-of-Verification**: 5 questions checked — verdict unchanged. Tests verified by re-run; performance correctly flagged unmeasured; deferred items are user-decided, not dismissed blockers.

## Quick Items Fixed Before Advancing

1. **`sprint-status.yaml` synced** — 4-6, 4-7, 1-10 → done; 3-5 → descoped (enhancement, deferred to Polish); 1-9, 1-11 → icebox (future visual-update sprint); 4-8 blocker note updated.
2. **Art-bible Section 2 corrected** — "Proposed Future Tokens" now documented as defined; residual hardcoded values categorized as acceptable.
3. **`--tab-bg` defined** — set to `transparent` in `index.css` (intentional: tab content over 3D scene).

## Carried into Polish (tracked, not blocking)

- Performance baseline measurement (TD + PR: first Polish task) — High priority
- External (non-developer) playtest of Medium (CD)
- Hard difficulty doc/playtest reconciliation (CD)
- Street View scope decision + tutorial copy alignment (CD)
- 5-minute timer tuning experiment (CD)
- Doc drift: technical-preferences ADR log + Godot scaffolding cleanup (TD)
- `interaction-patterns.md` creation (gate quality check)
- Accessibility tier — revisit before Release (AD/PR)
- ADR-0007 (Effect Timing) — promote to Accepted only if Tier-2 deals enter scope (TD)

## Decisions Recorded

- **3-5 Budget Tier Consequences**: classified as **enhancement** (not core mechanic). Deferred to Polish. Resolves two-sprint design-call carry.
- **1-9 / 1-11 (Street View + Street Scene ADR)**: moved to icebox, bundled into a future "visual update" sprint.
- **4-8 Accessibility**: deferred to backlog until the game is more mature; revisit before Release.

## Stage Updated

`production/stage.txt`: Production → **Polish**
