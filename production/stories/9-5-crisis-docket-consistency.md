# Story 9-5: Crisis Docket Consistency Check

> **Epic**: Round Loop & Street Reveal
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic (research spike, may be a no-op)
> **Estimate**: 0.5 days
> **Manifest Version**: 2026-06-13
> **Last Updated**: 2026-07-08

## Context

**Design source**: `ROUND_LOOP_STREET_REVEAL_0_1.md` — §5: *"The fixed events (Summit, Economic Crisis, Natural Disaster) now have to respect the work-day fiction. A mid-month disaster either waits for the desk or it interrupts and breaks our own rule."* Decision: present crises **at the work session, as part of the month's docket**.
**Requirement**: none yet — register a TR-ID only if a real code change is needed.

## Scope

1. Read `docs/architecture/adr-0005-event-scheduling.md` and the `DailyEventHandler` implementation to determine **when** Summit / Economic Crisis / Natural Disaster events currently fire relative to the round-start / round-timer lifecycle.
2. If they already fire at round start (before the timer begins, or as part of the same `nextRound()` transition that will now flip `dwelling: false`): **no code change needed** — close this story with a note confirming the invariant already holds, referencing the relevant code line.
3. If a gap is found (e.g. an event can fire mid-timer via some other trigger): scope the fix as a follow-up story rather than absorbing it here (per Sprint 9's Definition of Done — this story is timeboxed at 0.5d).

## Acceptance Criteria

- [ ] **AC-1**: Written finding (in this file's Completion Notes, or a new follow-up story if a gap exists) on whether scripted crisis events can currently fire outside the work-day-start docket.
- [ ] **AC-2**: If a gap exists, a follow-up story is created (not fixed inline) with a clear description of the fix scope.
- [ ] **AC-3**: If no gap exists, this story is closed with the invariant documented (file:line reference) so future work doesn't re-litigate it.

## Dependencies
- Depends on: None (independent research spike)
- Related: Stories 9-1/9-2/9-3 (the `dwelling` split gives this invariant more teeth — verify it still holds once Street is gated)
