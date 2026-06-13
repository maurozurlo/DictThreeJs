# Sprint 4 — 2026-06-14 to 2026-06-21

## Sprint Goal
Close all Production → Polish gate blockers: ship the secret room layout fix,
difficulty selection, grace period, and run the first documented playtest pass —
then re-gate for Polish.

## Capacity
- Total days: 7 (short close-out sprint — aligned to actual velocity)
- Buffer (20%): 1.4 days reserved for unplanned work
- Available: 5.6 days

## Tasks

### Must Have (Critical Path)

| ID    | Task | Agent/Owner | Est. Days | Dependencies | Acceptance Criteria |
|-------|------|-------------|-----------|--------------|---------------------|
| 3-6   | Secret Room action panel layout — move card to action panel region (same zone as Meet/Law/Deal) | ui-programmer | 0.5 | 3-3 ✅ | Secret room card renders inside action panel area; no regression on Meet/Law/Deal panels; panel absent when special ending not active |
| 1-12  | Sync stage.txt to "Production" | producer | 0.25 | — | `production/stage.txt` reads `Production`; status line shows correct stage |
| 4-1   | ADR housekeeping — promote ADR-0001 and ADR-0007 to Accepted; create control-manifest.md | technical-director | 0.5 | — | ADR-0001 status: Accepted; ADR-0007 status: Accepted (or documented rationale for Proposed); `docs/architecture/control-manifest.md` exists with layer rules for Foundation and Feature layers |
| 4-2   | Configure performance budgets in technical-preferences.md | technical-director | 0.25 | — | `technical-preferences.md` has numeric values for: target FPS, frame budget (ms), JS heap ceiling (MB), GLB load budget (ms) |
| 4-3   | Run ≥3 playtest sessions + /playtest-report | developer (manual) | 0.75 | 3-6 | `production/playtests/` has ≥3 session docs; sessions cover new player experience, mid-game systems, difficulty curve; coup warning legibility assessed in at least one session |
| 4-4   | Difficulty levels — pre-game treasury selection (Easy 1000 / Medium 500 / Hard 150) | gameplay-programmer | 0.5 | — | Difficulty screen appears before round 1; selection persists in save; Easy=1000, Medium=500 (default), Hard=150; backward-compatible with saves lacking this field |
| 4-5   | Early-game grace period — rounds 1–2 dampened negative relation deltas, extended timer | gameplay-programmer | 1.0 | ADR-0002 ✅ | Negative deltas in rounds 1–2 dampened per GDD formula; positive deltas unaffected; timer extended in early rounds; no UI indicator; unit-tested |

**Must-have total: 3.75 days**

### Should Have

| ID    | Task | Agent/Owner | Est. Days | Dependencies | Acceptance Criteria |
|-------|------|-------------|-----------|--------------|---------------------|
| 4-6   | Art bible — reverse-document existing visual identity from code | art-director | 1.0 | — | `design/art/art-bible.md` exists with color token set (named tokens for all 55+ scattered hardcoded values), typography, spacing, zone definitions — minimum sections 1–4 |
| 4-7   | Difficulty curve + emotional arc doc | game-designer | 0.5 | 4-3 (playtest data) | `design/difficulty-curve.md` documents intended feeling per round (1–10); names the round-3 difficulty cliff; maps emotional arc |
| 3-5   | Budget Tier Consequences — requires design call first | gameplay-programmer | 2.5 | Design call: core mechanic or enhancement? Resolve before sprint start | Sick faction skips Meet; infra tab lockout at Low; security coup modifier — all unit-tested |

> **3-5 design call required before this story is startable**: Is Budget Tier
> Consequences a core mechanic (must ship in Production) or an enhancement (defer
> to Sprint 5+)? The story file (`production/stories/3-5-budget-tier-consequences.md`)
> needs to exist before implementation begins.

### Nice to Have (final carry-over decision)

| ID    | Task | Agent/Owner | Est. Days | Dependencies | Notes |
|-------|------|-------------|-----------|--------------|-------|
| 4-8   | Accessibility tier ratification + contrast audit | ux-designer | 0.5 | 4-6 | Ratify WCAG-AA; audit PressStart2P at small sizes; update hud.md Open Question #2 |
| 1-9   | Street View waypoint movement (A→B→A) | gameplay-programmer | 1.0 | — | **Carry x3 — schedule or formally cut to icebox** |
| 1-10  | UX Review: hud.md | ux-designer | 0.5 | — | **Carry x3 — schedule or formally cut to icebox** |
| 1-11  | ADR: Street Scene Architecture | technical-director | 0.5 | — | **Carry x3 — schedule or formally cut to icebox** |

> Stories 1-9, 1-10, and 1-11 have carried for 3 consecutive sprints without being
> started. If any are genuinely planned for the next 2 sprints, move them to Should Have.
> Otherwise, cut to icebox this sprint.

## Carryover from Sprint 3

| Task | Reason | New Estimate |
|------|--------|-------------|
| 3-6 Secret Room action panel layout | AC4 partial — out of scope for 3-3, follow-up filed | 0.5d |
| 1-12 Sync stage.txt | Nice-to-have 3 sprints — now gate-blocking | 0.25d |
| 3-5 Budget Tier Consequences | Should-have — needs design decision before startable | 2.5d |
| 1-9 Street View waypoint | Nice-to-have, carry x3 | 1.0d |
| 1-10 UX Review hud.md | Nice-to-have, carry x3 | 0.5d |
| 1-11 ADR Street Scene | Nice-to-have, carry x3 | 0.5d |

## Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Playtest recruitment — solo dev may struggle to get ≥3 distinct sessions | Medium | High | Count self-playthroughs in different modes (Easy/Medium/Hard) as 3 separate sessions; use /playtest-report to structure each |
| Early-game grace period requires careful formula tuning | Medium | Medium | GDD specifies dampening multiplier; unit tests lock formula; manual playtest validates feel |
| 3-5 design call delays story mid-sprint | Medium | Low | Make the call before sprint start; 3-5 stays blocked until resolved |
| Art bible reverse-doc scope creep | Low | Low | Lock to sections 1–4; full bible in Sprint 5 if needed |

## Dependencies on External Factors
- Playtest sessions require at least one complete game run each (~15–20 min per session)
- ADR-0007 (Effect Timing) status resolution depends on Sprint 5 scope for Tier-2 delayed deals

## Definition of Done for this Sprint
- [ ] All Must Have tasks completed
- [ ] All tasks pass acceptance criteria
- [ ] Logic/Integration stories have passing unit/integration tests
- [ ] Smoke check passed (`/smoke-check sprint`)
- [ ] QA sign-off: APPROVED or APPROVED WITH CONDITIONS (`/team-qa sprint`)
- [ ] No S1 or S2 bugs in delivered features
- [ ] `production/stage.txt` reads "Production"
- [ ] ≥3 playtest session docs in `production/playtests/`
- [ ] Performance budgets configured in `technical-preferences.md`
- [ ] `/gate-check` re-run — verdict PASS or CONCERNS before entering Polish

> ⚠️ **No QA Plan**: Run `/qa-plan sprint` before the last story is implemented. The
> Production → Polish gate requires a QA sign-off report, which requires a QA plan.
