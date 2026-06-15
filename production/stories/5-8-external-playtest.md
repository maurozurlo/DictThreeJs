# Story 5-8: External Playtest — Non-Developer Medium Difficulty Session

## Header
- **Story ID**: 5-8
- **Sprint**: 6 (carryover from Sprint 5 — never started)
- **Status**: Ready
- **Type**: Playtest
- **Layer**: N/A
- **TR-ID**: N/A
- **Governing ADR**: N/A
- **Manifest Version**: 2026-06-13
- **Estimate**: 0.5 days
- **Last Updated**: 2026-06-15

## Summary

Validate that the core game loop holds for a non-developer player on Medium difficulty.
This is the only external-facing validation gap from Sprint 5. The goal is not feature
discovery — it is confirming that a fresh player can understand the core loop, make
meaningful choices, and feel the intended political tension without developer guidance.

## Acceptance Criteria

- [ ] At least 1 playtest session completed with a non-developer player on Medium difficulty
- [ ] Session lasts ≥ 15 minutes (enough to reach mid-game tensions)
- [ ] Playtest notes written to `production/playtests/playtest-sprint5-5-8-[date].md`
- [ ] Notes include: player background, session length, confusion moments, enjoyment moments, whether coup threat was felt, whether the core fantasy ("staying in power") landed
- [ ] Notes reviewed by game-designer (or owner) before this story is marked Complete
- [ ] Any S1/S2 bugs discovered reported as GitHub issues or inline in the notes

## Implementation Notes

This is an observation-only story. No code changes are expected. If bugs are found:
- Document them in the playtest notes
- Create follow-up stories for any that are S1/S2

Suggested session structure:
1. Brief the player: "You're running a country. Keep yourself in power."
2. Observe silently — do not guide or explain mechanics
3. Note every moment the player pauses, misreads, or asks a question
4. Debrief 5 minutes after: what felt powerful, what was confusing

## Out of Scope

- Balance changes — document findings; don't tune mid-session
- Hard difficulty — that is story 5-9

## QA Test Cases

*Playtest story — no automated tests. Evidence = written session notes.*

- **Manual check — core fantasy**
  - Setup: player sits down, sees main menu; no explanation given
  - Verify: player understands they are making governance decisions without prompting
  - Pass condition: player uses at least 2 different action types (budget, laws/deals) before round 5

- **Manual check — tension felt**
  - Setup: reach mid-game (round 5+)
  - Verify: player expresses concern about faction relations or treasury
  - Pass condition: player makes a suboptimal choice intentionally to preserve political standing

## Test Evidence

- **Story Type**: Playtest
- **Required evidence**: `production/playtests/playtest-sprint5-5-8-[date].md` — written notes + game-designer sign-off
- **Status**: [ ] Not yet created

## Completion Notes

*(Fill in when done)*

## Dependencies

- Depends on: None
- Unlocks: None
