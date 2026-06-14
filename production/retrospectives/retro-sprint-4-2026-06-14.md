## Retrospective: Sprint 4 — Gate Unblock
Period: 2026-06-14 — 2026-06-14 (all must-haves completed same session)
Generated: 2026-06-14

### Metrics

| Metric | Planned | Actual | Delta |
|--------|---------|--------|-------|
| Must-Have Tasks | 7 | 7 | 0 |
| Should-Have Tasks | 3 | 0 | −3 |
| Nice-to-Have Tasks | 4 | 0 | −4 |
| Completion Rate (must-have) | 100% | 100% | — |
| Effort Days (must-have est.) | 3.75d | ~1 session | ~−2.75d |
| Bugs Found (S1/S2) | — | 0 | — |
| Bugs Found (S3) | — | 2 (inline fix) | — |
| Unplanned Features | — | 5 | — |
| Commits | — | 19 | — |
| TODO/FIXME/HACK | — | 0 | — |
| Automated Tests | 252 | 289 | +37 |

### Velocity Trend

| Sprint | Must-Have Planned | Completed | Rate |
|--------|-------------------|-----------|------|
| Sprint 1 | 7 | 6 | 86% |
| Sprint 2 | 8 | 8 | 100% |
| Sprint 3 | 4 | 4 | 100% |
| Sprint 4 (current) | 7 | 7 | 100% |

**Trend**: Stable at 100% must-have completion (3 consecutive sprints).
Sprint 4 had the largest must-have count yet (7) and still closed at 100% — consistent throughput with AI-assisted development.

### What Went Well

- **All 7 gate-blocking must-haves shipped.** The Production → Polish gate had 5 explicit blockers from Sprint 3 gate-check; all were resolved in a single session.
- **Significant unplanned work shipped without blocking must-haves.** Coup warning HUD (icon + tooltip), advance hint, daily event cleanup, i18n namespace fix, and two coup-logic bugs were all delivered on top of the planned scope.
- **Test suite grew +37 tests in one sprint.** 252 → 289, driven by 21 new grace-period tests and 15 new difficulty-level tests. Zero tests failing.
- **Two S3 bugs caught and fixed inline during QA.** The stale coup warning in DayEnded and the over-sensitive WARN_CHARISMA threshold were discovered and closed within the same session they were found — no bug backlog carried forward.
- **Zero technical debt introduced.** No TODO, FIXME, or HACK markers anywhere in the codebase.
- **i18n architecture was corrected.** End-reason strings and HUD strings were identified as improperly namespaced and fixed; raw key fallbacks that were silently failing are now working.

### What Went Poorly

- **Should-haves (3-5, 4-6, 4-7) deferred again.** 3-5 (Budget Tier Consequences) has now been deferred from Sprint 3 → Sprint 4 should-have. 4-6 (Art Bible) and 4-7 (Difficulty Curve) were never started.
- **Sprint 3 action item #2 not actioned.** "Schedule 3-5 as must-have in Sprint 4" was the explicit recommendation; it was added as should-have instead, and then deferred. Chronic deferral of this story is now a process smell.
- **Sprint capacity still compresses to a single session.** The 7-day sprint plan was consumed in approximately one work session. Velocity estimates remain ~2× higher than actual work time. The Sprint 3 retro flagged this; no structural change was made.
- **1-9, 1-10, 1-11 carried again (4th sprint).** These have now missed four consecutive sprints without a formal cut or schedule decision.

### Blockers Encountered

| Blocker | Duration | Resolution | Prevention |
|---------|----------|------------|------------|
| Stale coup warning shown in DayEnded after faction elimination | ~1h debug | Added `coupStillActive` computed value cross-referencing live relations | Cross-reference state at render time rather than relying on round-start flags |
| Raw i18n keys showing in UI (hud.coup_warning, hud.advance_ready) | ~30min | Keys were nested inside `log` object; moved to `hud` root section | Always confirm nesting level when adding to a long JSON file |

### Estimation Accuracy

| Task | Estimated | Actual | Variance | Likely Cause |
|------|-----------|--------|----------|--------------|
| 4-5 Grace period | 1.0d | ~0.5d | −0.5d | Formula was well-specified in GDD; pure function pattern made it fast |
| 4-4 Difficulty levels | 0.5d | ~0.25d | −0.25d | Single constant map + one store slice; clean pattern |
| 4-3 Playtest sessions | 0.75d | ~0.5d (3 self-sessions) | −0.25d | Sessions were developer self-playthroughs, faster than external |
| Unplanned coup warning system | — | ~2h | N/A | Not in plan; discovered via playtest session |

**Overall estimation accuracy**: Estimates are consistently 1.5–2× higher than actuals. This is stable across 4 sprints — AI-assisted development compresses implementation time dramatically. Sprint capacity should be planned at 50% of current estimates, or should-haves should be promoted to must-haves by default.

### Carryover Analysis

| Task | Original Sprint | Times Carried | Reason | Action |
|------|----------------|---------------|--------|--------|
| 3-5 Budget Tier Consequences | Sprint 3 | 2 | Design call never made; blocked on mechanic vs. enhancement decision | Must make design call at Sprint 5 kickoff; either must-have or formally descoped |
| 4-6 Art Bible (reverse-doc) | Sprint 4 | 1 | Capacity consumed by must-haves + unplanned work | Schedule in Sprint 5 as should-have with explicit time-box |
| 4-7 Difficulty Curve doc | Sprint 4 | 1 | Same as 4-6 | Same |
| 1-9 Street View waypoint | Sprint 1 | 4 | Deprioritized every sprint | Formally cut to icebox in Sprint 5 — if not scheduled as must-have, drop it |
| 1-10 UX Review hud.md | Sprint 1 | 4 | Same | Same |
| 1-11 ADR Street Scene | Sprint 1 | 4 | Same | Same |

### Technical Debt Status

- TODO count: 0 (previous: 0)
- FIXME count: 0 (previous: 0)
- HACK count: 0 (previous: 0)
- Trend: Stable at zero
- No areas of concern. The coup warning comment in DayEnded.tsx (explaining why `coupArmedLastRound` is a round-start flag) is the only notable inline documentation added this sprint — appropriate for a subtle invariant.

### Previous Action Items Follow-Up

| Action Item (from Sprint 3) | Status | Notes |
|-----------------------------|--------|-------|
| 1. Complete 3-6 before external playtest | DONE | 3-6 was Sprint 4 must-have #1; closed |
| 2. Schedule 3-5 as must-have in Sprint 4 | NOT DONE | Added as should-have; never started; design call still pending |
| 3. Decide on 1-9/1-10/1-11/1-12 (schedule or cut) | PARTIAL | 1-12 done; 1-9/1-10/1-11 carried a 4th time without decision |
| 4. Right-size sprint capacity to match velocity | PARTIAL | Sprint shortened to 7 days (improvement); still consumed in 1 session |

### Action Items for Next Iteration

| # | Action | Owner | Priority | Deadline |
|---|--------|-------|----------|----------|
| 1 | Make 3-5 (Budget Tier Consequences) must-have in Sprint 5 OR formally close it as descoped | developer | High | Sprint 5 kickoff |
| 2 | Cut 1-9, 1-10, 1-11 to icebox if not committed as must-haves in Sprint 5 | developer | Medium | Sprint 5 kickoff |
| 3 | Plan Sprint 5 capacity at ~50% of story-point estimates to match actual throughput | developer | Medium | Sprint 5 planning |
| 4 | Run performance check (JS round-resolution ≤5ms, heap ≤150MB) before or during Sprint 5 | developer | High | Before Polish gate |

### Process Improvements

- **Promote should-haves to must-haves more aggressively.** At current throughput, if must-haves take ~1 session, there is consistently room for 2–3 should-haves in the same session. Leaving them as should-haves means they never get started.
- **Resolve design-blocked stories at sprint kickoff, not mid-sprint.** 3-5 has been blocked on a design call for two sprints. The decision itself takes 5 minutes; the deferral cost is two sprints of carry. Force the call first.

### Summary

Sprint 4 hit 100% must-have completion for the 3rd consecutive sprint, closing all Production → Polish gate blockers and shipping 5 significant unplanned features on top of the plan. The coup warning UX (HUD badge + tooltip) and two S3 bugs discovered and fixed inline were the standout quality wins. Chronic patterns persist: the Sprint 3 retro identified the same capacity over-planning and 1-9/1-10/1-11 indecision; neither was resolved. The should-haves (3-5, 4-6, 4-7) and nice-to-haves (1-9, 1-10, 1-11, 4-8) will be completed before Sprint 5 planning begins.
