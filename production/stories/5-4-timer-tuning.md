# Story 5-4: Timer Tuning Experiment

## Header
- **Story ID**: 5-4
- **Sprint**: 5
- **Status**: Complete
- **Type**: Config/Data
- **Layer**: Polish
- **TR-ID**: N/A
- **Governing ADR**: docs/architecture/adr-0006-round-timer-game-loop.md
- **Manifest Version**: 2026-06-14
- **Estimate**: 0.25 days
- **Last Updated**: 2026-06-15

## Summary

Self-playtest at 3-minute timer to evaluate pacing. Record the decision in
`design/gdd/game-concept.md` Tuning Knobs section. Implement the chosen timer
if it differs from the current 5-minute default.

## Acceptance Criteria

- [x] Timer tested at 3min in self-playtest
- [x] Decision recorded in `design/gdd/game-concept.md` Tuning Knobs section
- [x] Timer implemented in code if decision is not "keep 5min"

## Completion Notes
- Completed: 2026-06-15
- **Decision**: Graduated timer adopted — 3 min round 1, 2.5 min round 2, 2 min rounds 3+
- Rationale: Round 1 exploration needs extra time for new players; later rounds are faster-paced once mechanics are learned
- Implemented via `getRoundTimerMs(round)` utility (`src/Utils/GracePeriod.ts`)
- `useRoundTimer.ts` now calls `getRoundTimerMs(round)` instead of a fixed constant
- Decision logged in `design/gdd/game-concept.md` edge case #1 (Resolved 2026-06-14)
