# Sprint 1 — 2026-06-10 to 2026-06-24

## Sprint Goal
Implement the Street View feature (static scene + state-driven visuals + basic
movement) and close the 3 architecture gaps from the CONCERNS review.

## Capacity
- Total days: 10 (2-week sprint, solo developer)
- Buffer (20%): 2 days reserved for unplanned work
- Available: 8 days

## Tasks

### Must Have (Critical Path)
| ID  | Task | Agent/Owner | Est. Days | Dependencies | Acceptance Criteria |
|-----|------|-------------|-----------|-------------|---------------------|
| 1-1 | ADR: RNG & Determinism Strategy | /architecture-decision | 0.5 | — | TR-rng-001 resolved; ADR in docs/architecture/, status Accepted |
| 1-2 | ADR: Event Scheduling System | /architecture-decision | 0.5 | — | TR-events-001 resolved; ADR accepted |
| 1-3 | ADR: Round Timer & Game Loop | /architecture-decision | 0.5 | — | TR-timer-001 resolved; ADR accepted |
| 1-4 | Camera: fade-to-black transition (~200ms) | gameplay-programmer | 0.5 | — | CSS overlay replaces lerp in useCameraSwitcher.ts; all tab switches use fade cut; no jarring movement |
| 1-5 | Street View: layout config + types | gameplay-programmer | 0.5 | — | `src/assets/streetLayout.ts` defines typed positions for buildings, plaza, pedestrian paths, car paths |
| 1-6 | Street View: static scene (placeholder cubes) | gameplay-programmer | 1.0 | 1-4, 1-5 | Street tab shows buildings, plaza, stationary pedestrian + car cubes; camera positioned correctly |
| 1-7 | Log.tsx: commit in-progress changes | gameplay-programmer | 0.5 | — | `git status` clean for Log.tsx; `npx vitest run` all green |

**Must Have total: 4.0 days**

### Should Have
| ID  | Task | Agent/Owner | Est. Days | Dependencies | Acceptance Criteria |
|-----|------|-------------|-----------|-------------|---------------------|
| 1-8 | Street View: state→visual mapping (4 variables) | gameplay-programmer | 1.0 | 1-6 | Security budget ≥7 → army cubes; statues 1–3 → plaza monuments; low people relations → sparse crowd; low treasury → building state changes |
| 1-9 | Street View: basic waypoint movement (A→B→A) | gameplay-programmer | 1.0 | 1-6 | 2–3 pedestrian cubes + 1 car loop continuously along paths defined in streetLayout.ts; smooth lerp between waypoints |
| 1-10 | UX Review: hud.md | /ux-review | 0.5 | — | APPROVED or NEEDS REVISION verdict issued; design/ux/hud.md progresses from In Review |
| 1-11 | ADR: Street Scene Architecture | /architecture-decision | 0.5 | 1-6 | ADR documents entity config pattern, state→scene mapping approach, and path interpolation strategy |

**Should Have total: 3.0 days**

### Nice to Have
| ID   | Task | Agent/Owner | Est. Days | Dependencies | Acceptance Criteria |
|------|------|-------------|-----------|-------------|---------------------|
| 1-12 | Sync production/stage.txt to Technical Setup | producer | 0.25 | — | stage.txt reads `Technical Setup` |
| 1-13 | End-game stats screen: design only | game-designer | 0.5 | — | Quick spec in design/quick-specs/end-game-stats.md covering what stats to show |

**Nice to Have total: 0.75 days**

**Combined total: 7.75 days — within 8-day available capacity.**

## Carryover from Previous Sprint
*(None — Sprint 1)*

## Risks
| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Waypoint movement conflicts with Three.js render loop (frame timing) | Medium | Medium | Use `useFrame` hook already in use in CameraController; same pattern applies |
| State→visual mapping creates derived Three.js state that re-renders on every game state change | Medium | Low | Memoize derived scene state; derive from store snapshot, not full subscription |
| Camera fade overlay flickers on fast tab switches | Low | Low | Debounce tab change; abort in-flight fade if another switch fires |

## Dependencies on External Factors
- None — fully local development

## Definition of Done for this Sprint
- [ ] All Must Have tasks completed
- [ ] All tasks pass acceptance criteria
- [ ] `npx vitest run` all green (no regressions)
- [ ] No S1 or S2 bugs in delivered features
- [ ] 3 new ADRs written and status: Accepted
- [ ] Code committed and pushed

> **No QA Plan**: This sprint was started without a QA plan. Run `/qa-plan sprint`
> before the last story is implemented. The Production → Polish gate requires a QA
> sign-off report, which requires a QA plan.
