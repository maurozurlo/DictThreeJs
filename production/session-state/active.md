# Session State

<!-- STATUS -->
Epic: Lasting Effects (Sprint 2)
Feature: Sprint 2 stories
Task: 2-4 implemented — needs code review + smoke check
<!-- /STATUS -->

## Session Extract — /dev-story 2-4 2026-06-12
- Story: production/stories/2-4-recurring-content.md — Content: 9 recurring-effect laws/deals + i18n EN/ES
- Files changed: src/Constants/Costs.ts (RECURRING tiers + MAX_INCOME_LAWS_PER_RUN), src/assets/laws.ts (laws 39–44), src/assets/deals.ts (deals 16–18 with power), src/Stores/RecurringHandler.ts (filterLawPool pure helper), src/Stores/GameState.ts (lawPool wired into both pickNextLaw closures), public/locales/{en,es}/laws.json (labels 39–44 + laws.recurring.*), public/locales/{en,es}/deals.json (16–18 + deals.recurring.*)
- Tests written: src/Stores/RecurringHandler.filterLawPool.test.ts (7), src/assets/recurringContent.test.ts (13 — PRD tier/penalty/i18n validation)
- Tests: 158/158 pass; build green
- Note: pool cap counts ACTIVE income law effects (per story implementation notes); repealed laws free a slot — revisit in 2-8 if "ever accepted" semantics wanted
- Blockers: None
- Next: /code-review then /story-done production/stories/2-4-recurring-content.md + smoke check evidence (production/qa/smoke-2026-06-XX.md)

## Session Extract — Tab polish 2026-06-12
- Committed d4e0496: Budget side-menu restyle (i18n budget.in/out keys, .netStatus/.positive/.negative classes), dumbify spread to Laws/Log/Meet, inline styles → Tabs.module.css


## Session Extract — Sprint 2 planning 2026-06-11
- PRD written: design/gdd/lasting-effects-prd.md (lasting effects, repeal, coup, DayEnded breakdown, visual registry + future-sprint specs for budget tiers & economy advisor)
- Sprint plan: production/sprints/sprint-2.md (10 stories + 6 carryover; 1-8 superseded by 2-9)
- sprint-status.yaml updated to sprint 2
- Owner decisions logged in PRD Decision Log: no stack cap (pool weighting max 3 income laws/run + −2 opposing relation), tiered repeal (15/25/40, −2/−2/−3), coup at relation ≥+8 AND charisma ≤−3 with 50% grace roll, fires at start of nextRound
- Agents consulted: game-designer (ab259bb027bb3331a), economy-designer (a4ff41d24e3227d6a)
- Critical correctness item: Budget tab forecast must include recurring effects (story 2-6)
- Story files production/stories/2-1 through 2-10 CREATED 2026-06-11
- ADR-0002 advanced from Proposed → Accepted 2026-06-11
- TR-lasting-001..010 appended to docs/architecture/tr-registry.yaml
- Next: /dev-story production/stories/2-2-financials-recurring.md

## Session Extract — /dev-story 2026-06-11
- Story: production/stories/2-1-recurring-types.md — Types & data model: recurring effect fields
- Files changed: src/types/Law.ts (RecurringEffect type), src/types/Deal.ts (recurringEffect field), src/types/GameState.ts (ActiveRecurringEffect interface + 4 gameManagement fields), src/Stores/GameState.ts (initial state + setPhase reset), src/Stores/GameState.recurring.test.ts (new, 12 tests), src/Stores/ActionHandler.test.ts (fix pre-existing mock gap)
- Test written: src/Stores/GameState.recurring.test.ts — 12 tests, all pass
- Bonus fix: ActionHandler.test.ts mocks missing budget.expenditures.education — 5 pre-existing failures now resolved
- All 97 tests pass (was 85 + 5 failing + 12 new)
- Blockers: None

## Session Extract — /dev-story 2-2 2026-06-11
- Story: production/stories/2-2-financials-recurring.md — calculateRoundFinancials recurring summation
- Files changed: src/Stores/BudgetHandler.ts (optional activeRecurringEffects param, recurringIncome/recurringExpenses in RoundFinancials, sumRecurringEffects helper), src/Stores/BudgetHandler.recurring.test.ts (new, 7 tests)
- Tests: 104/104 pass; build succeeds
- Committed: bc67789 (2-2), 65879fb (2-1)
- Blockers: None

## Session Extract — /dev-story 2-3 + coverage 2026-06-11
- Coverage pass: 100% on all Stores files (was 76.9%) — applyBudgetEffects, charisma backlash branches, education dialogue-fail, income modifiers (commit c49e7e4)
- Story 2-3: production/stories/2-3-store-recurring.md — store wiring COMPLETE (commit 1f4560c)
- New file: src/Stores/RecurringHandler.ts (pure withRecurringEffect helper, dedup by sourceId)
- EffectHandler.handleDecision activates on accept (laws + deals); Deal type gains optional power field
- nextRound: 5 branches write lastRoundRecurring* + reset repealTakenThisRound via shared recurringGmFields
- expireTimer passes effects for DayEnded display; loadGame whitelists 4 new fields (old saves default)
- Tests: 138/138 pass (12 new integration tests against real store); build green
- User guideline saved: small files — React components ≤400 lines hard limit, logic ≤1200, prefer helper extraction in touched code, no drive-by refactors
- Stories 2-1, 2-2, 2-3 all DONE. Next: 2-4 (content+i18n), 2-7 (coup), 2-9 (registry) — all unlocked; 2-5/2-6/2-8 unlocked too (depend on 2-3)

## Session Extract — /architecture-review 2026-06-10
- Verdict: CONCERNS
- Requirements: 20 total — 13 covered, 4 partial, 3 gaps
- New TR-IDs registered: 20 (platform, save, state, budget, relations, charisma, meet, rng, events, timer, scene)
- GDD revision flags: None
- Top ADR gaps: RNG & Determinism Strategy, Event Scheduling System, Round Timer & Game Loop
- Report: docs/architecture/architecture-review-2026-06-10.md

## Session Extract — /test-setup 2026-06-10
- Stack: web (Vitest already configured) — NOT Godot despite template config
- Existing: 5 colocated *.test.ts suites in src/ (85 tests, all passing)
- Fixed: removed coverage.enabled:true from vite.config.ts (was breaking full `vitest run` → "No test suite found")
- Created: .github/workflows/tests.yml (Vitest CI on push/PR to master)
- Verified: `npx vitest run --coverage` → 5 passed, 85 tests, 72.8% coverage
- Note: test convention is colocated src/*.test.ts, not tests/unit|integration (src/CLAUDE.md doc is stale)

## Session Extract — /dev-story 1-4 2026-06-10
- Story: production/stories/1-4-camera-fade.md — Camera fade-to-black transition
- Files changed: src/Hooks/useFadeTransition.ts (new), src/components/FadeOverlay/FadeOverlay.tsx (new), src/components/FadeOverlay/FadeOverlay.module.css (new), src/3d/CameraController.tsx (lerp removed), src/components/Navbar/Navbar.tsx (transitionTo prop), src/App.tsx (FadeOverlay + useFadeTransition), src/components/Navbar/Navbar.module.css (z-index: 100)
- ADR-0003 updated: status Proposed→Accepted, lerp constraint replaced with fade-to-black spec
- TR-scene-001 revised in tr-registry.yaml
- Tests: 85/85 pass
- Status: Complete — visually verified by user 2026-06-11 (evidence: production/qa/evidence/1-4-camera-fade-evidence.md)

## Session Extract — /ux-design hud 2026-06-10
- Task: HUD Design spec for Dictator Simulator
- Current section: COMPLETE — all sections written, In Review
- Design change noted: Next Round/Skip button moved to Navbar (Zone 1), confirmation becomes full-screen overlay
- Street tab added to permanent nav (after Shop, locks with others during events)
- New pattern flagged: Secret Tab Announcement Dialog
- File: design/ux/hud.md (skeleton created)
- Input: Keyboard/Mouse only, Web browser
- Key observation: Meet + Laws tabs render inside ActionPanel (not center tab area)
- Key observation: No player journey, accessibility requirements, or art bible exist yet
