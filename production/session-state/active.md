# Session State
<!-- QA-PLAN: 2026-06-17 | System: sprint-7 | Plan written: production/qa/qa-plan-sprint-7-2026-06-17.md -->

## Session Extract — Multi-texture pipeline (external, by material name) 2026-06-22
- Problem: previous export script replaced each object's material with ONE PhysicalMaterial → MERGED multi-material meshes (env_roads 9 parts→1) to a single texture. User wants external multi-texture.
- DESIGN (external, robust, exporter-image-mode-independent): export names each sub-material after its texture basename + keeps UVs + preserves Multi-material structure; engine preloads all public/textures PNGs once and applies each to the mesh part whose material NAME matches (normalized basename); embedded-map fallback, then palette fallback.
- Files changed:
  - src/types/WorldLayout.ts: IDEObject.texture(string) → textures(string[]); ResolvedPlacement.textures: string[].
  - src/Hooks/useStreetLayout.ts: pass textures[]; export STREET_TEXTURES (union of all IDE textures).
  - src/3d/StreetView.tsx: removed PlacedObjectSolid/Textured split + applyMaterial; new PlacedObject (per-material-slot texture by name via normalizeTexName) + PlacedObjects (preload all textures, build Map, render list); Suspense renders <PlacedObjects>.
  - tools/ipl/convert_maxdump.mjs: manifest value string|array → IDE `textures: [...]`.
  - tools/maxscript/export_unique_meshes.ms: diffuseBitmapFor/texBasenameOf/toGltfSubMat/convertMaterialTree (multi-aware, names mats after textures); manifest now model→[textures]; loop uses convertMaterialTree.
- Re-ran convert (old single-string manifest → wrapped to 1-elem arrays). tsc -b clean, vite build green.
- INTERIM STATE: current GLBs are still the FLATTENED single-material ones (material "export_uv_mat" + 1 embedded image) → engine keeps embedded map → shows single texture per model (not broken). Multi-texture needs RE-EXPORT with updated .ms.
- Camera still TEMP close overhead [0,18,14]; PhysCamera values preserved in GameState.ts comment (restore after mesh verification + wide-aspect fov work).
- NOT committed. Next: user re-exports (new .ms) → I read a multi-material GLB to confirm per-part materials named after textures → copy manifest to middleground → re-run convert → multi-texture lights up. Then restore PhysCamera + fov.

## Session Extract — Street mesh integration + PhysCamera grab 2026-06-22
- Integrated the 26 exported GLBs + 60 IPL placements into the Street view (was a single wireframe plaza.obj placeholder).
- Pipeline already existed (useStreetLayout + PlacedObject); changes:
  - tools/ipl/convert_maxdump.mjs: reads optional texture-manifest.json (modelName→texture) → emits IDE `texture` field; report now written next to the dump. Re-ran it → regenerated src/assets/data/{street-placement.ipl.ts,street-objects.ide.ts} (--no-scale; meshes baked to size).
  - src/types/WorldLayout.ts: added `texture?` to IDEObject + `texture` to ResolvedPlacement. src/Hooks/useStreetLayout.ts: pass-through.
  - src/3d/StreetView.tsx: OBJLoader→GLTFLoader; dropped forced wireframe; PlacedObjectSolid (palette colour by model name) + PlacedObjectTextured (external PNG over UVs, dormant until re-export) + dispatcher.
  - src/Stores/GameState.ts: Street-tab camera grabbed from Max PhysCamera001 — pos [8.116,67.961,124.141], rot [-0.4364,0] (aimed via target point; raw Max cam quaternion does NOT map), fov 50.3 (vertical FOV of the 25.571mm lens on 35mm; Max reports 60° horizontal). Target Distance 142.22 confirmed geometry.
  - tools/maxscript/export_unique_meshes.ms: assigns temp PhysicalMaterial so ATF glTF exporter keeps UVs; writes texture-manifest.json from each source material's diffuse/base map.
- KEY FINDING: current GLBs are geometry-only (POSITION+NORMAL, "fallback Material", NO UVs/materials/textures) — so external PNGs can't map yet. Needs a RE-EXPORT with the updated .ms. No unit conversion needed (dump space self-consistent, 1 unit = 1 m).
- KNOWN LIMITATION: manifest = 1 texture/model; multi-material meshes (env_roads 9 prims, env_tree 3 prims) need per-submaterial mapping (follow-up). They render solid palette for now.
- Verified: tsc -b clean, 579/579 tests pass (lone "error" = vitest fork-pool teardown timeout, not a test), vite build green.
- NOT committed. Next: user re-exports (updated .ms) → copy texture-manifest.json next to dump → re-run convert → textures light up automatically. Then confirm/nudge camera fov vs Max.

## Session Extract — Street view fixes (post-reexport) 2026-06-22
- User re-exported: UVs now present (TEXCOORD_0), images embedded (harmless — engine uses external PNGs). texture-manifest.json correct. Copied to middleground/, re-ran convert → IDE now has `texture:` fields → textured render path active.
- FIX 1: gated the 8 box-building placeholders + road strip behind debugEnabled (were always-on, looked like "placeholder models" over the GLBs). src/3d/StreetView.tsx.
- FIX 2 (root cause): Max ATF glTF exporter leaves GEOMETRY Z-up (does NOT convert to Y-up, contrary to old script comment). IPL pos/rot already Y-up. Proof: ground meshes thin-in-Z, poles tall-in-Z. Engine now applies ZUP_TO_YUP = [-π/2,0,0] to each GLB INSIDE the placement (outer group=pos/quat/scale, inner primitive=rot -90°X). Math: world = T·R(iplQuat)·Rx(-90)·geom_zup; verified sign via streetlight. IPL conjugated rotations are correct as-is.
- Updated export_unique_meshes.ms axis note (warns: if exporter ever fixed to Y-up, remove ZUP_TO_YUP or double-rotation).
- tsc -b clean, vite build green. Still NOT committed. Next: user hard-refresh Street tab → should see textured, upright, correctly-placed meshes. Then nudge camera fov.

## Session Extract — GLB scale/orientation root cause 2026-06-22
- Symptom: meshes loaded (network) but rendered as a tiny clump on a green plane.
- ROOT CAUSE (via parsing GLB node tree): every GLB = root node Rx(-90) [exporter DOES Y-up, matches convert_maxdump] + mesh node scale 0.001 [mm→m, Max scene is in millimetres]. Uniform 0.001 across all 26.
- So my earlier ZUP_TO_YUP=[-π/2,0,0] was a WRONG double-rotation (net 180° flip), AND everything was 1000× too small.
- FIX (src/3d/StreetView.tsx): removed ZUP_TO_YUP; added GLB_UNIT_FIX=1000 → placement scale ×1000 (net 1000×0.001=1, mathematically exact). Both PlacedObjectSolid/Textured now render gltf.scene directly at pos/quat/scale×1000.
- Proper source fix (documented in export_unique_meshes.ms): set Max System Units to metres, re-export, then GLB_UNIT_FIX=1.
- Street camera TEMP reverted to close overhead [0,18,14]/fov50/rot[-0.76,0] for mesh verification; PhysCamera values preserved in GameState.ts comment to restore after.
- Lesson: GLB bbox from raw POSITION accessor is misleading — must apply node transforms. The 0.001 + root rotation only show in the node tree.
- tsc clean. NOT committed. Next: user reloads (HMR fine, not stale) → verify meshes upright/sized/textured on close cam → restore PhysCamera + solve wide-aspect fov.

## Session Extract — /sprint-plan new Sprint 7 2026-06-17
- Sprint 7 plan written: production/sprints/sprint-7.md
- sprint-status.yaml reset to Sprint 7 (8 stories: 7-1..7-6, 5-8 carryover, 5-9 carryover)
- Goal: Citizen Simulation implementation (CitizenHandler P1/P2/P3 + Street View rendering + Inspector UI)
- Must Have: 7-1 (1d generation), 7-2 (1.5d employment/happiness), 7-3 (2d role fork/death/feedback/integration)
- Should Have: 7-4 (Street View rendering), 7-5 (Inspector UI)
- Nice to Have: 7-6 (Population HUD), 5-8, 5-9 carryovers
- New TR-IDs needed: TR-citizen-001..003 (not yet in tr-registry.yaml — register during /create-stories or /story-readiness)
- Story files (7-1..7-6) not yet created — run /create-stories or /qa-plan sprint next
- QA plan: user chose to run /qa-plan sprint before implementation begins

## Session Extract — /story-done 6-7 2026-06-17
- Verdict: COMPLETE WITH NOTES
- Story: production/stories/6-7-coup-fairness-ui.md — Coup Fairness UI — Telegraphing Readout
- Tech debt logged: None (advisories noted in story file only)
- Next recommended: Sprint 6 close-out — all Must Have + Should Have done. Run /smoke-check sprint → /team-qa sprint → /retrospective → /sprint-plan new

## Session Extract — /dev-story 6-3 2026-06-17
- Story: production/stories/6-3-modifier-engine-p3.md — ADR-0008 P3: Remaining Content + Street View/Advisor Consumers
- Files changed: src/Utils/Modifiers.ts (added getVisibleModifiers export), src/3d/StreetView.tsx (wired getVisibleModifiers selector; debug overlay shows active effect count), src/components/Advisor/AdvisorButton.tsx (wired getVisibleModifiers selector; included in useMemo deps)
- Test written: tests/integration/modifiers/content_migration.test.ts (16 tests — getVisibleModifiers projection, class-A content, statue regression, isWindowActive boundary)
- Key decision: Periodic events and mini-challenges are all ADR-0008 class A (immediate one-shot deltas) — no modifier emitted; documented via test. Statues already emit modifiers via buildShopModifier (regression-guarded). getVisibleModifiers filters active modifiers with at least one in-window StatMod; empty-mods entries (weird-law slot) are correctly excluded.
- Pre-existing issue: secret-room-rework.test.ts fails when run in the full suite (store state leak from test ordering) but passes in isolation — unrelated to P3 changes.
- Tests: 16/16 new pass; tsc clean; vite build not yet run.
- Next: /code-review src/Utils/Modifiers.ts src/3d/StreetView.tsx src/components/Advisor/AdvisorButton.tsx then /story-done production/stories/6-3-modifier-engine-p3.md

## Session Extract — /story-done 2026-06-17
- Verdict: COMPLETE
- Story: production/stories/6-3-modifier-engine-p3.md — ADR-0008 P3: Remaining Content + Street View/Advisor Consumers
- Tech debt logged: None
- Code review suggestions applied: S1 (visibleModifiers as load-bearing AdvisorContext dep); S2 (stable primitive selectors + useMemo in StreetView + AdvisorButton)
- 455/455 tests pass; tsc clean
- Next recommended: /sprint-plan new (Sprint 7 planning, which was the original goal before 6-3 was found incomplete)

## Session Extract — /dev-story 6-7 2026-06-17
- Story: production/stories/6-7-coup-fairness-ui.md — Coup Fairness UI — Telegraphing Readout
- Files changed: src/Utils/CoupRisk.ts (new — selectCoupRisk pure function), src/components/CoupRiskReadout/CoupRiskReadout.tsx (new — readout component), src/components/CoupRiskReadout/CoupRiskReadout.module.css (new), src/components/Navbar/Navbar.tsx (replaced inline badge with CoupRiskReadout), src/components/Navbar/Navbar.module.css (removed dead coup badge styles), public/locales/en/menu.json (3 new hud keys), public/locales/es/menu.json (3 new hud keys)
- Test written: tests/unit/coup/coup_risk_readout.test.ts (14 tests — safe state, yellow/red tier, faction selection tiebreak, modifier-driven relations, security spend)
- Pre-existing issue: secret-room-rework.test.ts fails in full suite (store state leak) but passes in isolation — unrelated to 6-7
- Tests: 14/14 new pass; 468/469 suite (1 pre-existing); tsc clean
- Next: /code-review src/Utils/CoupRisk.ts src/components/CoupRiskReadout/CoupRiskReadout.tsx src/components/Navbar/Navbar.tsx then /story-done production/stories/6-7-coup-fairness-ui.md

## Session Extract — Seeded RNG + Commit-on-Roll (ADR-0010) 2026-06-17
- TRIGGER: citizen-sim GDD review (retried systems-designer + qa-lead agents — credit error cleared, both ran). Then owner chose to add seeded RNG for anti-save-scum ("live with it" pillar enforcement), not just reproducibility.
- KEY INSIGHT (owner): seed alone ≠ anti-save-scum. Need seed + persisted PRNG cursor (resume mid-stream on reload) + commit-on-roll (outcome written to state at commit instant). Audit confirmed commit-on-roll ALREADY HOLDS via ADR-0002 atomic set() — every roll (Meet/accept/round-resolution) resolves inside one set, no mid-save gap. So no refactor of timing needed; ADR-0010 formalizes existing invariant + adds seed.
- SHIPPED CODE: mulberry32 in src/Utils/Math.ts (module cursor `_rngState`; seedRng/getRngState/setRngState; all 5 draws route through private next(); signatures unchanged). DailyEventHandler 2 raw Math.random → rollFloat (ADR-0004 deferred cleanup, now load-bearing). StateFactory.buildStartState seeds from entropy before first draw + stores gameManagement.rngSeed; buildLoadedState restores cursor (guarded for pre-RNG saves). SaveLoad.buildSavePayload attaches top-level `rngState` (mirrors `meta` pattern). types/GameState + initial state gained rngSeed:number.
- TEST SEAM CHANGE: switched RNG source off Math.random → broke 3 files' `vi.spyOn(Math,'random')`. Migrated to mocking named Utils/Math fns: Math.test (seeded property test), EffectHandler.test (rollChance mockImpl), ActionHandler.test (full rewrite, module partial-mock; threshold tests use `rollChance: (p)=>ROLLED<p` to keep charisma-shaping coverage). 439/439 pass, tsc -b + vite build green.
- DOCS: docs/architecture/adr-0010-seeded-rng-commit-on-roll.md (Accepted, supersedes ADR-0004). ADR-0004 status → Superseded w/ banner. technical-preferences.md ADR log + Forbidden Patterns updated (Math.random allowed only for seed entropy + cosmetic). 
- CITIZEN-SIM GDD review fixes applied (design/gdd/citizen-simulation.md): factionFortune range −4.5 (biz/people) + raw happiness floor −5.5; unrest band prose `≤3`→`1<h<4` (band-accurate); §4.3 role-fork elif-chain implementation note (don't nest gone check); Marco R4 "assuming gone roll fails"; protest-cap claim corrected (4 rounds only from +10; 2-3 realistic); starvation eligible 11-25 (not ~18) + gone+starvation combined lifespan ~3-4; Edge 6/11 + Dependencies row → ADR-0010. ACs: note updated (qa-lead consulted, RNG harness now exists), AC-1 split a/b, AC-5 boundary, AC-7 split gate/roll, AC-9/11 mock rollChance, AC-14 mid-range, AC-15 → CI grep, AC-16 dismiss+ADR-0003; added AC-17..25 (body-lerp, vol round-1, elite recovery, edu flip, empty-street, gone+starvation order, protest cap, pop monotonicity, starvation linearity). Story-type tags [L]/[I]/[U]/[CI]/[rng] added.
- NOT committed (awaiting owner). Suggested follow-ups: round-trip test asserting reload→retry reproduces identical roll (ADR-0010 validation criteria last box, unchecked); then resume citizen-sim pipeline: /design-review → /art-bible + /asset-spec → carve epics/stories. CitizenHandler will be first consumer of seeded gone/starvation rolls.


## Session Extract — /design-system citizen-simulation 2026-06-16 (in progress)
- Coup: deterministic grace SHIPPED + pushed (commit 0cf6c1b) — ADR-0009 ratified by owner; GRACE_CHANCE retired; 439/439 tests. Story 6-7 logic slice done, UI readout remains.
- Visual update planning kicked off. Owner decisions: LIGHT-FEEDBACK sim tier; full GDD+art-bible+asset-spec pipeline.
- Source braindumps: "user ideas.md" (infra/health/security → palette/body/spawn rules), "wills ideas.md" (faction+role+happiness sim, education fork, light-feedback hooks, Marco example), "entities.md" (ped/vehicle asset sheet, mix-and-match textures).
- STRUCTURE DECISION: new GDD design/gdd/citizen-simulation.md owns the sim; street-view.md citizen sections (§3.4-3.6, §4) to be TRIMMED to a pointer afterward (street-view stays environment/buildings/props doc). street-view.md is deferred+unbuilt so safe to restructure.
- This GDD realizes game-concept.md Open Q#2 + §5 deferred "too dumb to revolt" education mechanic.
- Review mode: lean (systems-designer/qa-lead only for Formulas + Acceptance Criteria).
- Skeleton created. Sections: Overview (in progress).
- TODO after GDD: /art-bible (palettes + middle-ground interpolation), /asset-spec (entities.md), trim street-view.md, carve epics/stories.

## Session Extract — /dev-story 6-5 2026-06-16 (Author ADR-0009)
- Story: production/stories/6-5-coup-fairness-adr.md — Status → Complete.
- Wrote docs/architecture/adr-0009-coup-telegraphing-fairness.md (Status: Accepted), grounded in live CoupHandler.ts + GAMESTATE.COUP. Added to ADR log in .claude/docs/technical-preferences.md.
- KEY DECISION: replace the 50% grace roll with DETERMINISTIC first-armed-round grace → guarantees ≥1 explicit red-warning round + removes all RNG from the coup path. Coup fires only if armed condition still met next round (re-evaluated on effective relations, so a deal/charisma/repeal or a windowed modifier expiring can defuse it). Threshold values stay designer-owned balance. Implementation (retire GRACE_CHANCE) = Story 6-7's slice.
- Honesty: self-reviewed vs implementation; no separate technical-director agent run; owner ratification recommended (flagged in ADR Status).
- Sprint 6 now: MUST-HAVES done (6-1,6-4,6-2); SHOULD-HAVES done (6-5,6-6); remaining should-have 6-3 (P3 content + Street View/Advisor consumers, ~1.5d code). Nice-to-haves: 5-8/5-9 playtests (need human), 6-7 coup UI (now unblocked by 6-5).

## Session Extract — /dev-story 6-6 2026-06-16 (Modifier authoring guide)
- Story: production/stories/6-6-modifier-authoring-guide.md — Status → Complete.
- Wrote docs/modifier-authoring-guide.md: 5-field quick ref, TIME_MODIFIERS table, Cattle worked example (content asset → runtime instance → round-by-round table matching isWindowActive), 6-step "add a timed deal" recipe, anti-patterns. Cross-checked vs shipped P2 code; honest self-review note (no separate lead-programmer agent run).
- Sprint 6 status: all MUST-HAVES done (6-1, 6-4, 6-2). Should-haves: 6-6 done; remaining 6-3 (P3 content + Street View/Advisor consumers, larger), 6-5 (author ADR-0009). Nice-to-have: 5-8/5-9 playtests (need human), 6-7 (blocked by 6-5).
- Next: 6-5 (ADR-0009 authoring, 0.5d) or 6-3 (1.5d code).

## Session Extract — /dev-story 6-2 2026-06-16 (ADR-0008 P2)
- Story: production/stories/6-2-modifier-engine-p2.md — replace ActiveRecurringEffect with the modifier engine. Status → Complete.
- Pre-step: committed/pushed in-flight RoundResolver refactor (user's commit 16e16aa); fixed leftover `buildStatsUpdate`→`buildRoundStats` (18 failing tests) + removed dangling imports the refactor left (npm run build was broken on master — now green).
- New file: src/assets/modifierContent.ts — buildRecurringModifier / buildWeirdLawModifier / getModifierContent (id→label+faction) / isRepealable / migrateLegacyEffect. Engine stays content-free (ADR-0008 §4); content lookup lives here.
- Modifier id namespace: laws.{id} / deals.{id} / weird.{id} (statues keep statue.{n}). filterLawPool AC requires `laws.${law.id}`.
- Source touched: BudgetHandler (sumModifiers at round, dropped sumRecurringEffects), RecurringHandler (filterLawPool(modifiers) + re-offer guard; removed withRecurringEffect/getRepealTier), EffectHandler (build recurring modifier on accept, dedup by active id), RoundResolver (financials at resolving round = state.round pre-increment; weird-slot findIndex), GameState (weird path, expireTimer, repeal flips state→rejected w/ content faction lookup, swapLaw), StateFactory (one-way legacy→modifiers migration, console.info), types/GameState (removed ActiveRecurringEffect type+field), Log RepealCard, Budget forecast, DebugRecurringOverlay, visualConsequences (id namespace + reads modifiers). New i18n key log.repeal_cost_no_faction (EN/ES).
- Decision: recurring summed at PRE-increment resolving round (state.gameManagement.round) in both resolveRound + expireTimer — parity for all current immediate+permanent content; documented in code.
- Tests: rewrote 7 tsc-erroring + 3 runtime-failing suites for the modifier API; created tests/integration/modifiers/recurring_migration.test.ts (renamed from `_test.ts` — default vitest glob only collects `.test.ts`). 438/438 pass, tsc -b clean, npm run build green.
- Lint: 3 PRE-EXISTING errors left as-is (let peopleIncome, miniChallenge let newTreasury, Log useMemo dep) — not in changed logic; honoring "no drive-by refactors".
- Next: 6-3 (P3 — opportunities/mini-challenges/structures + Street View/Advisor consumers; unblocked) OR 6-5/6-6 (no blockers).

## Session Extract — Charisma action tuning 2026-06-12
- Owner decision after economy-designer review (a02bb3f5ac062c463): expropriate charisma −1→−2 (same price as eliminate; treasury-positive aggression), dialogue success 0→+1 (charisma recovery loop), dialogue roll-fail stays 0 (agent's tuning — 2-7% band, not player-controlled; owner agreed own −1 proposal "would be unfair"), education-gated fail stays −1, bribe stays 0, eliminate stays −2
- Range decision: charisma stays −10..+10 (agent: thresholds well-placed; +5..+10 is unhooked dead space — future idea only)
- Files: src/Stores/ActionHandler.ts (2 deltas + comments), src/Stores/ActionHandler.test.ts (4 charismaDelta assertions added)
- Tests: 172/172 pass
- Relates to 2-10 balance pass: coup math now — 2 expropriates reach −4 (armed from round 3); single expropriate drops to −2 → expropriation incompatible with special-ending route (intended sharpening)

## Session Extract — /dev-story 2-7 2026-06-12
- Story: production/stories/2-7-coup.md — Coup mechanic: thresholds, grace roll, warnings, narratives
- Files changed: src/Stores/CoupHandler.ts (new — pure checkCoup + CoupResult), src/Stores/CoupHandler.test.ts (new, 9 tests), src/Constants/GameState.ts (COUP block + Coup interface), src/types/GameState.ts (EndCause +3 coup values; coupArmedLastRound/coupWarningFaction fields), src/Stores/GameState.ts (coup check at step 0 of nextRound, warning log lines, state carry, setPhase reset, loadGame whitelist), src/components/DayEnded/DayEnded.tsx+css (red coup warning row), src/components/EndScreen/EndScreen.tsx (3 coup tier cases), src/components/Tabs/Meet.tsx (warning badge on selected faction), public/locales/{en,es}/{menu,endscreen}.json (coup keys + tiers + narratives)
- Test written: src/Stores/CoupHandler.test.ts — 9 tests; 172/172 pass; tsc clean
- Note: story AC-1 spec said relation+7/charisma−3 → 'safe', but that satisfies yellow-warning thresholds (≥+6, ≤0); test asserts AC-1 intent (no coup/grace) and yellow-warning instead
- Balance review: economy-designer (a40b72c33296a83e7) — SOUND WITH CONCERNS; concern #1 (double-eliminate skips yellow warning) INVALIDATED by owner: only one meet action per round (Meet.tsx actionTaken lock); eliminate = −2 charisma (ActionHandler.ts), so worst single-round drop is −2 meet + −2 tax corrosion, and tax corrosion requires pre-existing high-tax state. Remaining 2-10 items: military +3 deal can shortcut relation warning round; charisma recovery thin (+1/round)
- Blockers: None
- Next: /code-review src/Stores/CoupHandler.ts src/Stores/GameState.ts production/stories/2-7-coup.md then /story-done production/stories/2-7-coup.md

## Session Extract — /story-done 2-6 2026-06-12
- Verdict: COMPLETE
- Story: production/stories/2-6-forecast-fix.md — Budget Forecast Fix (recurring effects)
- Tech debt logged: None
- Next recommended: 2-7 Coup mechanic (1.5d, ready-for-dev)

## Session Extract — /dev-story 2-6 2026-06-12
- Story: production/stories/2-6-forecast-fix.md — Budget forecast fix: recurring effects in rounds-left
- Files changed: src/components/Tabs/Budget.tsx (add activeRecurringEffects selector, pass to calculateRoundFinancials), src/components/Tabs/Budget.forecast.test.ts (new, 5 tests)
- Test written: src/components/Tabs/Budget.forecast.test.ts — 5 tests; 163/163 pass
- Blockers: None
- Note: "In:" / "Out:" subtotals in Budget sideMenu still show base income/expenses only (recurring not broken out per-row); net and roundsLeft are correct. Adding per-law rows is explicitly out of scope (story 2-9).
- Next: /code-review src/components/Tabs/Budget.tsx src/components/Tabs/Budget.forecast.test.ts then /story-done production/stories/2-6-forecast-fix.md

## Session Extract — /story-done 2026-06-12
- Verdict: COMPLETE WITH NOTES
- Story: production/stories/2-5-dayended-breakdown.md — DayEnded Breakdown (Recurring + One-Time Rows)
- Tech debt logged: None
- Next recommended: 2-6 Budget forecast includes recurring effects (0.5d, ready-for-dev) OR 2-7 Coup mechanic (1.5d, ready-for-dev)

<!-- STATUS -->
Epic: Round Loop & Street Reveal (Sprint 9)
Feature: Must Haves 9-1/9-2/9-3 complete
Task: Should Haves 9-4 (round-1 opening) / 9-5 (crisis docket check) ready-for-dev, not started
<!-- /STATUS -->

## Session Extract — /dev-story 2-5 2026-06-12
- Story: production/stories/2-5-dayended-breakdown.md — DayEnded breakdown: recurring + one-time rows
- Files changed: src/components/DayEnded/DayEnded.tsx (2 selectors, 2 conditional rows, PRD row order, net includes recurring), public/locales/{en,es}/menu.json (actionPanel.recurring_income/recurring_expenses)
- Test written: None — UI story; evidence skeleton at production/qa/evidence/2-5-dayended-breakdown-evidence.md
- Note: row order changed — Bonus income moved below Legislation rows per PRD Feature 3 order
- Blockers: None
- Next: manual walkthrough (AC-1..AC-5) → /story-done production/stories/2-5-dayended-breakdown.md

## Session Extract — /story-done 2-4 2026-06-12
- Verdict: COMPLETE WITH NOTES
- Story: production/stories/2-4-recurring-content.md — 9 recurring laws/deals + i18n
- Code review: APPROVED WITH SUGGESTIONS — all applied (resolveKey cast, magic-number comments, empty-pool console.warn in 3 GameState sites)
- Smoke: production/qa/smoke-2026-06-12.md PASS WITH NOTES (law + ES verified in-game; deal/pool-cap via automated tests)
- Bonus: DebugRecurringOverlay (src/components/Debug/) — debug-mode panel, z-index 120, shows active effects/totals/income-cap/law-offer tag; wired in App.tsx
- Tech debt logged: None (advisories in story Completion Notes)
- Next recommended: 2-5 DayEnded breakdown (0.5d, deps done) — user noticed missing DayEnded rows during playtest

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

## Session Extract — /story-done 2026-06-12
- Verdict: COMPLETE WITH NOTES
- Story: production/stories/2-7-coup.md — Coup Mechanic (Thresholds, Grace Roll, Warnings, Narratives)
- Code review: APPROVED WITH SUGGESTIONS — all 3 suggestions applied (type-safe COUP_CAUSE_MAP, terminal-branch cleanup, DayEnded timing comment)
- Tests: 172/172 pass
- Tech debt logged: None (advisory deviation documented inline in story)
- Uncommitted work: ActionHandler.ts + ActionHandler.test.ts (charisma tuning), CoupHandler.ts + CoupHandler.test.ts, GameState.ts + types/GameState.ts + Constants/GameState.ts, DayEnded.tsx + DayEnded.module.css, Meet.tsx, EndScreen.tsx, locales (menu EN/ES + endscreen EN/ES), 2-7-coup.md
- Next recommended: production/stories/2-8-repeal-ui.md — Repeal UI (Active Legislation in Log)

## Session Extract — /dev-story 2026-06-12
- Story: production/stories/2-9-visual-registry.md — Visual Consequence Registry (scaffolding)
- Files changed: src/assets/visualConsequences.ts (new — types, 5 starter entries, pure evaluator), src/assets/visualConsequences.test.ts (new — 13 tests)
- Key decision: real sourceIds used (law-39 = L-A Gambling, law-40 = L-B Housing) per RecurringHandler `${sourceType}-${id}` format — NOT the PRD's law-A/law-B placeholders
- Key decision: two-pass exclusion (match all, then filter excluded IDs) — PRD's single-pass pseudocode fails AC-4 because dilapidated-buildings precedes public-housing-blocks in array order
- Tests: 185/185 pass, tsc clean
- Blockers: None
- Next: /code-review src/assets/visualConsequences.ts then /story-done production/stories/2-9-visual-registry.md

## Session Extract — /story-done 2026-06-12 (2-9)
- Verdict: COMPLETE WITH NOTES
- Story: production/stories/2-9-visual-registry.md — Visual Consequence Registry (scaffolding)
- Code review: APPROVED WITH SUGGESTIONS — WARN_RELATION constant reference applied
- Tests: 185/185 pass, tsc clean
- Tech debt logged: None
- Next recommended: production/stories/2-8-repeal-ui.md — Repeal UI (last must-have in sprint 2)

## Session Extract — /dev-story + /story-done 2026-06-12 (2-8, autonomous)
- Verdict: COMPLETE WITH NOTES (manual walkthrough sign-off pending — user away)
- Story: production/stories/2-8-repeal-ui.md — Repeal UI (Active Legislation in Log)
- Implemented by: ui-programmer agent (a87998ffe321a38fa); orchestrator fixed 3 review findings:
  (1) test fixtures seeded incomeBonus 25 as "Medium" but 25 > 15 = Large — corrected to 15
  (2) agent drive-by removed emoji prefixes (🎲✓✗⚡) in Log.tsx — reverted
  (3) bankruptcy check was a second set() — folded into the atomic repeal set() per ADR-0002
- Files: GameState.ts (repeal action), RecurringHandler.ts (getRepealTier), Constants/GameState.ts (REPEAL_COST), types/GameState.ts, Log.tsx (RepealCard), Tabs.module.css, locales EN/ES, repeal.test.ts (14 tests)
- Tests: 199/199 pass, tsc clean
- Evidence: production/qa/evidence/2-8-repeal-ui-evidence.md — user must run walkthrough + sign off
- Next: 2-10 balance analysis (provisional, simulation-based)
<!-- QA-PLAN: 2026-06-12 | System: sprint-3 | Plan written: production/qa/qa-plan-sprint-3-2026-06-12.md -->

## Session Extract — /dev-story 2026-06-12 (3-1)
- Story: production/stories/3-1-meta-progression.md — Meta-Progression Data Layer
- Files created: src/types/MetaProgress.ts, src/Utils/MetaProgress.ts, tests/integration/meta/meta-progression.test.ts
- Files modified: src/Utils/SaveLoad.ts (buildSavePayload + meta merge on import), docs/architecture/tr-registry.yaml (TR-meta-001 added)
- Tests: 225/225 pass (new tests: 10 cases in TC-1 through TC-10, plus 15 tier-ordering combinations in TC-5)
- Blockers: None
- Next: /code-review then /story-done 3-1, then /dev-story 3-2

## Session Extract — /story-done 2026-06-12
- Verdict: COMPLETE WITH NOTES
- Story: production/stories/3-1-meta-progression.md — Meta-Progression Data Layer
- Tech debt logged: None
- Next recommended: Story 3-2 (Records panel on Menu tab) — production/stories/3-2-records-panel.md

## Session Extract — /dev-story 2026-06-12 (3-2)
- Story: production/stories/3-2-records-panel.md — Records Panel on Menu Tab
- Files changed: src/components/Tabs/Menu.tsx (Records panel + loadMeta wiring), src/components/Tabs/Tabs.module.css (7 new classes), public/locales/en/menu.json (records.* keys), public/locales/es/menu.json (records.* keys ES)
- Test written: None — UI story; manual walkthrough evidence required at production/qa/evidence/3-2-records-panel-evidence.md
- Blockers: None
- Next: Manual walkthrough + evidence doc, then /story-done production/stories/3-2-records-panel.md

## Session Extract — /story-done 2026-06-13 (3-4)
- Verdict: COMPLETE WITH NOTES
- Story: production/stories/3-4-stats-enhancements.md — Stats Screen Enhancements
- Code review: APPROVED WITH SUGGESTIONS — null guard on specialEndingOutcome (EndScreen.tsx:108), missing initial-value test for totalRecurringExpensesSpent — both applied; 239/239 pass
- Tech debt logged: None
- Next recommended: Story 3-2 (Records panel walkthrough + /story-done) or Story 3-3 (Secret Room Rework — /dev-story)

## Session Extract — /dev-story 2026-06-12 (3-4)
- Story: production/stories/3-4-stats-enhancements.md — Stats Screen Enhancements
- Files changed: src/types/GameState.ts (4 fields added to GameStats), src/Stores/GameState.ts (initial state, reset, buildStatsUpdate, repeal, loadGame), src/components/EndScreen/EndScreen.tsx (recordGameEnd wiring + 4 new stat rows), public/locales/en/endscreen.json (5 keys), public/locales/es/endscreen.json (5 keys)
- Test written: tests/unit/stats/stats-enhancements.test.ts (10 tests — all pass; 238 total suite pass)
- Blockers: None
- Next: /code-review then /story-done production/stories/3-4-stats-enhancements.md

## Session Extract — /story-done 2026-06-13 (3-3)
- Verdict: COMPLETE WITH NOTES
- Story: production/stories/3-3-secret-room-rework.md — Secret Room Rework
- Key fix: dailyEvent null-out in seedRound8 resolved non-deterministic test failures (random daily event could reduce target faction below threshold)
- AC4 partial: SecretRoom action panel content appears in main screen area instead of action panel region; follow-up story 3-6 created
- Code review: APPROVED WITH SUGGESTIONS — both applied (dailyEvent isolation in threshold test + AC3 text aligned to tested values)
- Tech debt logged: None
- Follow-up created: production/stories/3-6-secret-room-action-panel-layout.md
- Next recommended: Sprint 3 Must Haves are all done — run sprint close-out sequence, or pull 3-6 (UI bug) or 3-5 (Budget Tier Consequences)

<!-- QA RUN: 2026-06-13 | Sprint: sprint-3 | Verdict: APPROVED WITH CONDITIONS | Report: production/qa/qa-signoff-sprint3-2026-06-13.md -->

## Session Extract — Sprint 3 Close-Out 2026-06-13
- /smoke-check sprint: PASS (252/252, report: production/qa/smoke-2026-06-13.md)
- /team-qa sprint: APPROVED WITH CONDITIONS — condition: complete 3-6 before shipping secret ending as finished feature. QA sign-off: production/qa/qa-signoff-sprint3-2026-06-13.md
- /retrospective: written to production/retrospectives/retro-sprint-3-2026-06-13.md. Key finding: sprint capacity 1.5-2× over-planned; 0 playtests documented; AC4 partial on 3-3 traced to unclear scope on panel positioning.
- /gate-check (Production → Polish): FAIL — blockers: 0 playtest sessions (requires ≥3), no performance budgets configured, story 3-6 open (QA condition), 3-5 design call unresolved, stage.txt stale.
- /sprint-plan new: Sprint 4 written — production/sprints/sprint-4.md, production/sprint-status.yaml. Goal: close all gate blockers. Must-haves: 3-6, 1-12, 4-1 (ADR housekeeping), 4-2 (perf budgets), 4-3 (playtests), 4-4 (difficulty levels), 4-5 (grace period).
- Next: implement sprint 4 must-haves → /gate-check to re-gate for Polish
<!-- QA-PLAN: 2026-06-13 | System: sprint-4 | Plan written: production/qa/qa-plan-sprint-4-2026-06-13.md -->

## Session Extract — /dev-story 2026-06-13 (3-6)
- Story: production/stories/3-6-secret-room-action-panel-layout.md — Secret Room Action Panel Layout
- Files changed: src/components/ActionPanel/SecretPanel.tsx (created), src/components/ActionPanel/ActionPanel.tsx (import + activeTab render), src/components/Tabs/Secret.tsx (cleared — now returns null)
- Test written: None — UI story, manual walkthrough required
- Blockers: None
- Next: /code-review src/components/ActionPanel/SecretPanel.tsx src/components/ActionPanel/ActionPanel.tsx src/components/Tabs/Secret.tsx then /story-done production/stories/3-6-secret-room-action-panel-layout.md

<!-- QA-PLAN: 2026-06-15 | System: sprint-6 | Plan written: production/qa/qa-plan-sprint-6-2026-06-15.md -->

## Session Extract — /architecture-review 2026-06-15
- Verdict: CONCERNS (no blockers for Sprint 6 — ADR-0008 covered + unblocked)
- Requirements (new/affected): 12 — 9 covered, 1 partial (TR-deals-003 / ADR-0007 Proposed), 1 gap (TR-coup-002 / ADR-0009 unwritten)
- New TR-IDs registered: 12 (TR-mod-001..006, TR-deals-001..003, TR-coup-001..002, TR-street-001); registry bumped to v3
- GDD revision flags: None
- Top ADR gaps: ADR-0009 Coup Telegraphing (Sprint 6 story 6-5), ADR-0007 finalisation (non-Sprint-6)
- Story TR-ID placeholders replaced with real IDs in 6-1/6-2/6-3/6-5/6-7
- Report: docs/architecture/architecture-review-2026-06-15.md

## Session Extract — /design-system 2026-06-16 (Citizen Simulation GDD)
- File: design/gdd/citizen-simulation.md — ALL 11 sections written (Overview → Open Questions). Status: Draft, pending /design-review.
- Model: 25 persistent citizens (born name/skin/faction, fixed split 11 people/7 army/7 business). Per-round: happiness (Will's formula) → employment → role fork (content/neutral/thief/protestor/gone via happiness × education) → death. Feedback: peopleRelation -= min(floor(protestorCount/3), 5); treasury -= thiefCount*2.
- New constants (proposed, all tuning knobs): GONE_CHANCE=0.15, HEALTH_DEATH_THRESHOLD=3, DEATH_RATE_MAX=0.15, PROTEST_DIVISOR=3, PROTEST_FEEDBACK_CAP=5 (NEW safety rail, not in Will's draft), THIEF_SKIM=2.
- New feature added mid-session (user idea): displayedPopulation HUD = round(aliveCount/25 * BASE_POPULATION); ~237k/death at default scale. §4.8.
- Click-to-inspect citizen feature speced in UI Requirements (AC-16).
- NEW asset required: ped_special_man_protestor (registered in entities.yaml + flagged for /asset-spec).
- Trimmed street-view.md: §3.4-3.6 + all of §4 + citizen edge/tuning/AC replaced with pointers to citizen-simulation.md. Environment half (assets/buildings/statues/clickables) retained.
- Registry: entities.yaml bumped v1→v2; registered ped_special_man_protestor + TOTAL_CITIZENS. systems-index.md updated (new row + street-view row reworded).
- Agent note: systems-designer (Formulas) and qa-lead (AC) NOT spawned — both fail on "Usage credits required for 1M context". Authored directly; recommend qa-lead review before production.
- NOT committed yet (awaiting user). Next: /design-review design/gdd/citizen-simulation.md → then /art-bible + /asset-spec → carve epics/stories.

## Session Extract — /dev-story 7-1 2026-06-18
- Story: production/stories/7-1-citizen-handler-p1.md — CitizenHandler P1 (Generation + Immutable Identity)
- Files changed: src/types/Citizen.ts (new), src/Stores/CitizenHandler.ts (new), src/types/GameState.ts (citizens/citizenStates fields added), src/Stores/StateFactory.ts (buildStartState + buildLoadedState wired), src/Stores/GameState.ts (citizens/citizenStates: [] in INITIAL_STATE)
- Test written: tests/unit/citizens/citizen_generation.test.ts — 10 tests, all pass
- Key decision: Citizen.faction uses 'military' (not 'army') to match existing Power type — avoids translation seam in stories 7-2/7-3
- Test results: 10/10 new; 478/479 suite (secret-room-rework.test.ts failure is pre-existing, not introduced)
- Blockers: None
- Next: /code-review src/Stores/CitizenHandler.ts src/types/Citizen.ts src/Stores/StateFactory.ts then /story-done 7-1

## Session Extract — /story-done 7-1 2026-06-18
- Verdict: COMPLETE WITH NOTES
- Story: production/stories/7-1-citizen-handler-p1.md — CitizenHandler P1 (Generation + Immutable Identity)
- Tech debt logged: None
- Next recommended: Story 7-2 — CitizenHandler P2 (employment + happiness + body-type) — production/stories/7-2-citizen-handler-p2.md

## Session Extract — /dev-story 7-2 2026-06-18
- Story: production/stories/7-2-citizen-handler-p2.md — CitizenHandler P2 (Employment + Happiness + Body-Type)
- Files changed: src/Stores/CitizenHandler.ts (3 new exported functions + HappinessInputs interface + 16 P2 constants)
- Test written: tests/unit/citizens/citizen_employment_happiness.test.ts — 25 tests, all pass
- Suite: 504/504 (clean — prior 1-test failure also resolved)
- Key decisions: computeEmployment takes faction:Power (not Citizen) for cleaner tests; effectiveRelation pre-computed by caller per ADR-0008; no lerp utility needed (inlined)
- Blockers: None
- Next: /code-review src/Stores/CitizenHandler.ts then /story-done 7-2

## Session Extract — /story-done 7-2 2026-06-18
- Verdict: COMPLETE WITH NOTES
- Story: production/stories/7-2-citizen-handler-p2.md — CitizenHandler P2 (Employment + Happiness + Body-Type)
- Tech debt logged: None (constants-location advisory noted in Completion Notes; Clamp→clamp rename deferred)
- Key note: Power = typeof Power[number] from non-`as const` array resolves to `string` — `default: never` trick cannot be used; replaced with `default: throw` in both computeHappiness and computeEmployment
- Next recommended: Story 7-3 — CitizenHandler P3 (role fork + death + feedback + nextRound() wiring) — production/stories/7-3-citizen-handler-p3.md

## Session Extract — /dev-story 7-3 2026-06-18
- Story: production/stories/7-3-citizen-handler-p3.md — CitizenHandler P3 (Role Fork + Death + Feedback + nextRound() Wiring)
- Files changed:
  - src/Stores/CitizenHandler.ts (added computeRole, computeFeedback, CitizenPipelineInputs, resolveCitizenPipeline; rollChance added to import)
  - src/types/GameState.ts (added displayedPopulation: number)
  - src/Stores/StateFactory.ts (added BASE_POPULATION import; displayedPopulation to buildStartState and buildLoadedState)
  - src/Stores/RoundResolver.ts (added resolveCitizenPipeline/CitizenState imports; extracted effectiveCharisma var; const→let newTreasury; added step 7 citizen pipeline; extended RoundResolution with newCitizenStates/newDisplayedPopulation; moved end conditions to step 8)
  - src/Stores/GameState.ts (added displayedPopulation:0 to INITIAL_STATE; newCitizenStates/newDisplayedPopulation to all 5 nextRound set() branches)
- Test written: tests/integration/citizens/citizen_resolution.test.ts — 32 tests covering AC-7a/7b, AC-8, AC-9, AC-10, AC-11, AC-12, AC-13, AC-14, AC-20, AC-21, AC-22, AC-23, AC-24, AC-25
- Suite: 551/551 passing (33 test files, 0 new failures)
- Key decisions: citizen pipeline inserted as step 7 in resolveRound (before end conditions which moved to step 8); end conditions read post-citizen values; effectiveRelationsForCoup reused from step 0; effectiveCharisma extracted for reuse
- Advisory: AC-15 `rg Math\.random` has 2 comment-only matches (pre-existing from P1 JSDoc + inline comment); no actual Math.random() calls in code
- Blockers: None
- Next: /code-review src/Stores/CitizenHandler.ts src/Stores/RoundResolver.ts then /story-done 7-3

## Session Extract — /dev-story 7-4 2026-06-18
- Story: production/stories/7-4-street-view-citizens.md — Street View: Citizen Rendering by Role/Outfit/BodyType
- Files changed:
  - src/3d/StreetView.tsx (added imports for CitizenState/Citizen/computeBodyType; added getOutfit/getPedDimensions pure functions; added CITIZEN_BASE_POSITIONS/PROTESTOR_POSITIONS/THIEF_POSITIONS constants; added citizens/citizenStates/health selectors; added citizen rendering block after Vehicles section)
- Test written: None — Visual/Feel story; evidence doc required at production/qa/evidence/7-4-street-view-citizens-evidence.md
- Suite: 551/551 passing (33 test files, 0 new failures)
- Key decisions: citizens rendered as separate layer alongside existing PedWalker atmosphere peds; protestors cluster at plaza (PROTESTOR_POSITIONS); thieves at shopfronts (THIEF_POSITIONS); others at CITIZEN_BASE_POSITIONS[i]; gone peds filtered by cs.alive guard; computeBodyType imported as pure function — no gameplay logic inline
- Placeholder: ped_special_man_protestor not yet created — using color #c0392b (red) with TODO comment
- Blockers: None
- Next: /code-review src/3d/StreetView.tsx then /story-done production/stories/7-4-street-view-citizens.md (requires evidence doc with screenshots before full sign-off)

## Session Extract — /dev-story 7-5 2026-06-18
- Story: production/stories/7-5-citizen-inspector-ui.md — Citizen Inspector UI (ActionPanel sidebar)
- Files changed:
  - src/types/GameState.ts (added selectedPedId/selectPed to scene slice type)
  - src/Stores/GameState.ts (added selectedPedId:null + selectPed action to INITIAL_STATE scene object)
  - src/3d/StreetView.tsx (added selectPed selector; onClick on ground plane for deselect; onClick+stopPropagation on alive ped meshes)
  - src/components/Tabs/CitizenInspector.tsx (new — sidebar panel component)
  - src/components/Tabs/CitizenInspector.module.css (new — styles)
  - src/components/ActionPanel/ActionPanel.tsx (added CitizenInspector import + Street tab branch)
  - public/locales/en/menu.json (added citizen.inspector block)
  - public/locales/es/menu.json (added citizen.inspector block in ES)
- Test written: None — UI story; evidence doc required at production/qa/evidence/7-5-citizen-inspector-evidence.md
- Suite: 551/551 passing (33 test files, 0 new failures); tsc clean
- Key decisions: ActionPanel sidebar placement instead of floating overlay (user preference); no backdrop/dismiss needed; idle prompt shown when selectedPedId=null; StateFactory.ts unchanged (scene slice not reconstructed by buildStartState/buildLoadedState)
- Blockers: None
- Next: /code-review src/components/Tabs/CitizenInspector.tsx src/3d/StreetView.tsx then /story-done production/stories/7-5-citizen-inspector-ui.md

## Session Extract — /dev-story 7-6 2026-06-18
- Story: production/stories/7-6-population-hud.md — Population HUD Readout
- Files changed:
  - src/components/ActionPanel/ActionPanel.tsx (added displayedPopulation selector + third budget row)
  - public/locales/en/menu.json (added stat.population = "Population")
  - public/locales/es/menu.json (added stat.population = "Población")
- Test written: None — UI story; evidence doc required at production/qa/evidence/7-6-population-hud-evidence.md
- Suite: 551/551 passing, tsc clean
- Key decisions: toLocaleString('en-US') for thousands formatting; sat alongside existing treasury/month rows in .budget CSS column; top-level store selector s.displayedPopulation
- Blockers: None
- Next: /code-review src/components/ActionPanel/ActionPanel.tsx then /story-done production/stories/7-6-population-hud.md

## Session Extract — /story-done 2026-06-18
- Verdict: COMPLETE WITH NOTES (both stories)
- Story: production/stories/7-5-citizen-inspector-ui.md — Citizen Inspector UI (9/9 criteria, evidence doc ADVISORY)
- Story: production/stories/7-6-population-hud.md — Population HUD Readout (8/8 criteria, evidence doc ADVISORY)
- Tech debt logged: None
- Code reviews: Deferred — to run before sprint close-out
- Next recommended: 7-7 Modifier Unification P4a (Must Have, currently backlog)

## Session Extract — /story-done + /code-review 2026-06-22
- Verdict: COMPLETE WITH NOTES (both stories)
- Story: production/stories/7-7-modifier-unification-p4a.md — Modifier Unification P4a (17/17 criteria)
- Story: production/stories/7-8-modifier-unification-p4b.md — Modifier Unification P4b (15/15 criteria)
- Files changed: src/types/MiniChallenge.ts, src/assets/miniChallenges.ts, src/Stores/GameState.ts, tests/integration/modifiers/content_migration.test.ts (acceptOutcome/rejectOutcome rename); src/Utils/Modifiers.ts (doc comment fix); docs/architecture/adr-0008-timed-modifier-engine.md (tax bound fix); docs/tech-debt-register.md (created)
- Code review: APPROVED WITH SUGGESTIONS — double set() pre-existing debt, string-slice key derivation, missing reject-path tests logged
- Tech debt logged: 3 items in docs/tech-debt-register.md
- Suite: 583/583 passing, tsc clean
- Next: All Must Have stories complete. Run /smoke-check sprint → /team-qa sprint → /retrospective before sprint close-out

## Session Extract — /dev-story 8-1 2026-06-22
- Story: production/stories/8-1-budget-projection-breakdown.md — Budget Projection Breakdown
- Files changed: src/Stores/BudgetHandler.ts (RoundFinancials + lawTreasuryDelta/dealTreasuryDelta + totalTreasuryDelta in netChange), src/Stores/RoundResolver.ts (removed duplicate treasuryModDelta — now in financials.netChange), src/components/Tabs/Budget.tsx (7-row itemized projection sideMenu), public/locales/en/menu.json (+6 budget.* keys), public/locales/es/menu.json (+6 budget.* keys)
- Key fix: RoundResolver was adding treasuryModDelta separately; after including treasury in netChange, the removal of that line was required to avoid double-counting
- Test written: None — UI story; evidence doc required at production/qa/evidence/8-1-budget-projection-evidence.md
- Blockers: None
- Suite: 583/583, tsc clean
- Next: /code-review src/Stores/BudgetHandler.ts src/components/Tabs/Budget.tsx then /story-done production/stories/8-1-budget-projection-breakdown.md

## Session Extract — Junker vehicle model 2026-07-06
- Task: replace box cars with the new car_junker.glb model (first real vehicle; more models later)
- Files changed: src/3d/Vehicles.tsx (new — junker rendering, per-car paint tint, wheel spin, ported CarWalker movement/stopFor logic), src/3d/StreetView.tsx (CarWalker + box car removed; renders <Vehicles/> in Suspense)
- GLB facts (recorded from binary inspection): nose points +X; parts chassis_hi / wheels_front / wheels_back under exporter dummies (0.258245 dummy scale × 0.001 mesh scale); material→texture map matched by image size: Material__1627=body(128²), 1628=lights(64²), 1629+1630=wheels(256×32), 'fallback Material'=untextured back-wheel slot
- Key fixes: wheels_back has NO UVs → shares wheels_front geometry; wheel geometry offset from node origin → re-pivoted (idempotent, StrictMode/useLoader-cache safe); car_junker_body.png is grayscale → tint pool multiplies like ped textures
- Scale/speed: VEHICLE_WORLD_SCALE 3.7 (matches PED_WORLD_SCALE), CAR_LENGTH_M 4.5, CAR_SPEED_MPS 3.5
- Verified: screenshot sequence — stopFor gate holds during ped phase, drives loops, heading matches nose, textures + tints render, no console errors; suite 596/596, tsc clean
- NOT committed

## Session Extract — Vehicle size + count 2026-07-06
- CAR_LENGTH_M 4.5 → 2.9 (~65%, user said car too big)
- Spawning: was 1 car per loop (3 total) → now proportional, one per CAR_TARGET_SPACING=100 units of loop length → 3+3+8 = 14 cars (loops are 336/336/822 units)
- Added same-loop follow gap (MIN_CAR_SEPARATION=13, carPositions registry) so cars queue behind a stopFor-gated leader instead of stacking; no timeout needed (uniform speed per loop, leader always clears)
- Suite 662/662, tsc clean; user checks visuals themselves (no more screenshots)
- NOT committed

## Session Extract — Sprint 9: Round Loop Phase Split 2026-07-08
- TRIGGER: user found `ROUND_LOOP_STREET_REVEAL_0_1.md` (design notes from a prior willbot/sim-design-advisor session, committed 2026-06-23 alongside the then-new Epic 8 building-degradation stories but never acted on). User explicitly said stop worrying about closing out the informal "Sprint 8" (epic-8 stories 8-1..8-8 are implemented + smoke-tested per `production/qa/smoke-2026-06-24.md` 655/655 but story files still show Backlog/In Progress — left as-is, not blocking) — go straight to implementing the round-loop idea, no questions, ASAP.
- Wrote docs/architecture/adr-0012-round-loop-phase-split.md (Accepted) formalizing the design doc's decisions against the existing expireTimer()/nextRound()/setActiveTab architecture. TR-roundloop-001/002 registered (tr-registry.yaml v5).
- Sprint 9 created: production/sprints/sprint-9.md, production/sprint-status.yaml (sprint 9). Must Haves 9-1/9-2/9-3 implemented + closed same session (auto-synced to `done` by a hook watching story Status fields). Should Haves 9-4 (round-1 opening) and 9-5 (crisis docket consistency spike) scoped as stories but NOT implemented this session — ready-for-dev, left for a follow-up.
- Architecture found (via Explore agent + direct reads): `gameManagement.phase` has no work/hinge sub-state; Street was reachable any time during `phase==='start'` (never phase-gated, only tab-gated); `expireTimer()` sets `dayEnded:true` but does NOT call `nextRound()` — that's the Continue button's job; `DayEnded` is an unconditional full-viewport Modal in App.tsx that already overlays whatever tab is active. A `Newspaper.tsx` + `dumbifyText(text, dumbScore)` propaganda-distortion pattern already existed (used in Log/Meet/Laws/Deals) — reused for the newsreel headline instead of inventing a new mechanism.
- Implementation: added `gameManagement.dwelling: boolean` (types/GameState.ts, GameState.ts INITIAL_STATE, StateFactory build/load — load always forces false, the hinge is never persisted mid-flight). `expireTimer()` (both branches) now sets `dwelling:true` + force-navigates `activeTab:Tabs.Street` in the same atomic set(). All 6 `nextRound()` branches (coup/bankruptcy/overthrown/victory/periodicEvent/normal — turned out to be 6, not the 5 estimated) reset `dwelling:false`. `setActiveTab` gate: blocks Meet/Laws/Deals/Budget when dwelling, blocks Street when `!dwelling && phase==='start'`, debug bypasses both. `Navbar.tsx` disabled logic mirrors the gate. `DayEnded.tsx` two-stage render: mandatory scrim (existing stat rows + new headline, `GAMESTATE.ROUNDS.MANDATORY_REVEAL_MS`=3000ms, no advance button) → non-blocking `.dwellBanner` corner card (headline + advance button) once the window elapses. New `src/Utils/RevealHeadline.ts` (deterministic round%5 pool, i18n `hinge.headline.*` EN/ES, dumbifyText applied at DayEnded call site).
- Bug caught during live verification (not by tests): dwellBanner's first CSS placement (`bottom: 1.5rem`) visually overlapped the existing ActionPanel bottom HUD strip's "Click a citizen to inspect" prompt. Fixed by repositioning to `top: calc(var(--navbar-height) + 1rem)` — confirmed clean via a second screenshot pass.
- Verified: 20 new unit tests (tests/unit/roundloop/{dwelling_state,tab_gating,reveal_headline}.test.ts) + full suite 696/696, tsc -b clean, npm run build green. Also ran an end-to-end Puppeteer walkthrough against the live dev server (New Game → force round-end → screenshot mandatory reveal → wait past window → screenshot dwell stage confirming no full-viewport scrim + Street interactive underneath → click advance → confirm tabs flip back) — this is real behavioral proof, not just unit-test coverage.
- Committed and pushed per standing "autonomous sprint" preference (implement → commit → push → continue, no per-story questions).
- Next: design doc §8's actual validation question ("does the player linger or mash?") requires real human playtesting across 3-4 months — not something this session can answer. Should Haves 9-4/9-5 are scoped and ready whenever picked up.
