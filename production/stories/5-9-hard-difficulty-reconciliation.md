# Story 5-9: Hard Difficulty Playtest Reconciliation

## Header
- **Story ID**: 5-9
- **Sprint**: 6 (carryover from Sprint 5 — never started)
- **Status**: Ready
- **Type**: Config/Data
- **Layer**: N/A
- **TR-ID**: N/A
- **Governing ADR**: N/A
- **Manifest Version**: 2026-06-13
- **Estimate**: 0.25 days
- **Last Updated**: 2026-06-15

## Summary

Update `design/difficulty-curve.md` (or equivalent) Hard row with observed playthrough data.
The Hard difficulty settings were tuned theoretically; this story reconciles them against
actual session outcomes. No code changes unless a critical balance break is discovered.

## Acceptance Criteria

- [ ] At least one Hard difficulty session played (developer-led is acceptable for this story)
- [ ] `design/difficulty-curve.md` Hard row updated: treasury start, income multiplier, coup thresholds, grace period — any value that diverges from the observed session
- [ ] Divergences annotated with reason (too easy / too hard / felt fair)
- [ ] No S1/S2 balance break discovered, OR a follow-up story created if one is found

## Implementation Notes

If `design/difficulty-curve.md` does not exist, create it with entries for Easy / Medium / Hard
and fill in known current values before adding the observed data.

Key things to observe on Hard:
- Can the player survive to round 10?
- Does a coup feel avoidable with skill, or inevitable?
- Is the treasury deficit manageable without recurring income?

## Out of Scope

- Implementing Hard difficulty changes — document only; queue any tuning as a separate story
- Medium difficulty — that is story 5-8

## QA Test Cases

*Config/Data story — no automated test.*

- **Manual check — doc exists and is updated**
  - Setup: after a Hard session
  - Verify: `design/difficulty-curve.md` Hard row exists and reflects observed starting conditions + outcome
  - Pass condition: file contains at least one annotation of the form "[observed: X, adjusted from Y]"

## Test Evidence

- **Story Type**: Config/Data
- **Required evidence**: Smoke check — `design/difficulty-curve.md` exists and Hard row is populated
- **Status**: [ ] Not yet created

## Completion Notes

*(Fill in when done)*

## Dependencies

- Depends on: None
- Unlocks: None
