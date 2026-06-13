## Retrospective: Sprint 3 — Ending Loop
Period: 2026-06-13 — 2026-06-13 (all must-haves completed day 1 of a 14-day sprint)
Generated: 2026-06-13

### Metrics

| Metric | Planned | Actual | Delta |
|--------|---------|--------|-------|
| Must-Have Tasks | 4 | 4 | 0 |
| Should-Have Tasks | 1 | 0 | −1 |
| Nice-to-Have Tasks | 4 | 0 | −4 |
| Completion Rate (must-have) | 100% | 100% | — |
| Effort Days (must-have) | 4.25d | ~1.5d actual | −2.75d |
| Bugs Found (S1/S2) | — | 0 | — |
| Unplanned Outputs | — | 1 (story 3-6) | — |
| Commits | — | 13 | — |
| TODO/FIXME/HACK | — | 0 | — |
| Automated Tests | — | 252 (13 new: 3-3; 10 new: 3-4) | — |

### Velocity Trend

| Sprint | Must-Have Tasks Planned | Completed | Rate |
|--------|------------------------|-----------|------|
| Sprint 1 | 7 | 6 | 86% |
| Sprint 2 | 8 | 8 | 100% |
| Sprint 3 (current) | 4 | 4 | 100% |

**Trend**: Increasing → Stable at 100%
Sprint 1 had one unfinished must-have (1-7, Log.tsx commit). Sprint 2 onward has been 100% must-have completion every sprint.

### What Went Well

- **Perfect must-have completion, again.** 4/4 stories done with 0 S1/S2 bugs — second consecutive 100% sprint.
- **Zero technical debt markers.** No TODO, FIXME, or HACK comments introduced across the entire codebase.
- **Test suite is healthy.** 252 passing tests, 0 failing. 23 new test functions added this sprint (13 for 3-3, 10 for 3-4), all deterministic.
- **Non-deterministic test root cause was caught and fixed before close.** The `dailyEvent` random modifier affecting relation values in `nextRound()` could have silently flaked indefinitely; it was traced, fixed, and the fix was applied in two places.
- **Scope discipline.** The `endReason: null` decision (not setting endReason for special endings) and the `FACTION_ROOM_INDEX` constant kept the store clean and avoided magic numbers. Both were caught in code review.

### What Went Poorly

- **AC4 partial pass on story 3-3.** The action panel positioning for the Secret Room card (renders in main screen area rather than the action panel region) was not completed. This was technically out of scope per the story's Out of Scope section, but the user expected it — the story created a new follow-up (3-6). The mismatch between written scope and user expectation suggests the story's scope should have been clearer, or 3-3 should have explicitly included panel layout.
- **Sprint capacity is dramatically over-planned.** All 4 must-have stories (4.25 estimated days) were completed in approximately 1.5 actual work sessions. The 14-day sprint window was largely empty. This makes velocity tracking meaningless and burndown charts flat.
- **Same 4 nice-to-have stories (1-9 through 1-12) have carried over for 3 consecutive sprints.** They are clearly deprioritized in practice but occupy space in every sprint plan. This creates noise.

### Blockers Encountered

| Blocker | Duration | Resolution | Prevention |
|---------|----------|------------|------------|
| Non-deterministic tests in 3-3 (daily event applying random mod to relations before threshold check) | ~1 session | Added `dailyEvent: { current: null }` to `seedRound8()` helper and the boundary test inline state | Seed all game state slices that could produce random side-effects when testing threshold logic |

### Estimation Accuracy

| Task | Estimated | Actual | Variance | Likely Cause |
|------|-----------|--------|----------|--------------|
| 3-3 Secret room rework | 2.0d | ~1.0d impl + extra for test debugging | Roughly matched | Non-deterministic test added 30–60min of investigation |
| 3-4 Stats enhancements | 0.75d | ~0.5d | Under actual | Well-scoped; 4 fields + 4 UI rows; clean pattern from existing code |
| 3-1 Meta-progression | 0.5d | ~0.25d | Under actual | Straightforward localStorage r/w; no novel logic |
| 3-2 Records panel | 1.0d | ~0.5d | Under actual | Mostly UI mapping; depends on 3-1 data which was clean |

**Overall estimation accuracy**: Estimates are 1.5–2× higher than actual. This is consistent with AI-assisted development; the bottleneck is design clarity, not implementation time.

### Carryover Analysis

| Task | Original Sprint | Times Carried | Reason | Action |
|------|----------------|---------------|--------|--------|
| 1-9 Street waypoint movement | Sprint 1 | 3 | Consistently deprioritized vs. feature work | Decide: schedule in Sprint 4 or drop from backlog |
| 1-10 UX Review: hud.md | Sprint 1 | 3 | Same | Same |
| 1-11 ADR: Street Scene Architecture | Sprint 1 | 3 | Same | Same |
| 1-12 Sync stage.txt | Sprint 1 | 3 | Same | Same |
| 3-5 Budget Tier Consequences | Sprint 3 | 0 (first miss) | Should-have deferred; capacity used by must-haves | Schedule in Sprint 4 as must-have |

### Technical Debt Status

- TODO count: 0 (previous: 0)
- FIXME count: 0 (previous: 0)
- HACK count: 0 (previous: 0)
- Trend: Stable at zero
- No areas of concern.

### Previous Action Items Follow-Up

No prior retrospective existed — this is the first retrospective for this project.

### Action Items for Next Iteration

| # | Action | Owner | Priority | Deadline |
|---|--------|-------|----------|----------|
| 1 | Complete story 3-6 (action panel layout fix) before any external playtest | developer | High | Before Sprint 4 playtest milestone |
| 2 | Schedule 3-5 (Budget Tier Consequences) as a must-have in Sprint 4 | developer | High | Sprint 4 planning |
| 3 | Make a final decision on 1-9/1-10/1-11/1-12: schedule or drop | developer | Medium | Sprint 4 kickoff |
| 4 | Right-size sprint capacity to match actual velocity (4.25d planned, ~1.5d actual); consider shorter sprint cadence or pulling more should/nice-to-haves | developer | Medium | Sprint 4 planning |

### Process Improvements

- **Add layout/positioning ACs explicitly to UI stories.** Story 3-3 had implicit UI placement expectations not captured in AC4. Going forward, every story with a UI component should have an AC that specifies the container region (e.g., "renders in the action panel area, same region as Meet/Law panels").
- **Pull should-haves into sprint plan more aggressively.** At current velocity, a sprint can handle 4–6 days of must-haves plus 2–3 days of should-haves simultaneously. Leaving the should-have column empty wastes capacity.

### Summary

Sprint 3 hit 100% must-have completion with zero bugs and zero technical debt — a clean, repeatable result. The only substantive issue was an implicit UI layout expectation in story 3-3 that became a follow-up story; this is a planning and scope-writing gap, not an implementation failure. The bigger systemic concern is that sprint capacity is consistently over-planned: all work is done in the first 1–2 days of a 14-day sprint. Sprint 4 should either pack in significantly more scope or compress the sprint window to match actual throughput.
