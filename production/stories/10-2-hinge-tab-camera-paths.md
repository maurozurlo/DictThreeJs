# Story 10-2: Hinge/Tab/Camera Single Paths — expireTimer Merge, TAB_CAMERA, Timer Helper

> **Epic**: Simplification & Debt (Sprint 10)
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Estimate**: 1.0 days
> **Last Updated**: 2026-07-08

## Context

**Source**: [Code Audit 2026-07-08](../../docs/architecture/code-audit-2026-07-08.md) §A2, §A3
**ADRs**: ADR-0002 (atomic set), ADR-0006 (round timer), ADR-0012 (hinge invariants).

`expireTimer()` has two `set()` branches duplicating the camera + financials +
hinge patch, differing only in the skipped-meeting penalty. `setActiveTab()` mixes
gating (keep), an if/else camera chain (make data-driven), and an inline
reimplementation of pause/resume (extract).

## Acceptance Criteria

- [ ] **AC-1**: `expireTimer()` is a single `set()`; the skipped-meeting penalty (relations, charisma, timeout log event) applied via conditional spread. Behavior identical in both cases.
- [ ] **AC-2**: Per-tab camera config lives in a `TAB_CAMERA` lookup in `src/Constants/` (Street entry reuses `STREET_CAMERA`; Meet/Laws entries express "positions[i] from scene scan"; Secret handled with its room-index logic). `setActiveTab`'s camera if/else chain replaced by the lookup.
- [ ] **AC-3**: Pure timer helpers (pause/resume arithmetic on `timerStartedAt`/`timerPausedAt`) extracted and used by `pauseTimer`, `resumeTimer`, and `setActiveTab`'s Menu enter/leave logic — one implementation of the pause math.
- [ ] **AC-4**: Tab gating rules (lock bypass set, ADR-0012 dwelling gates, debug bypass) unchanged — existing `tab_gating.test.ts` passes unmodified.

**Regression:**
- [ ] **AC-5**: `npx vitest run` 0 failures; `tsc -b` clean; build green.
- [ ] **AC-6**: Puppeteer: round-end lands on Street with correct camera (regression guard for the Sprint 9 camera bug); Menu pause/resume still works.

## Out of Scope
`nextRound` internals (10-1), camera store slice redesign, free-cam/debug camera.

## Test Evidence
**Story Type**: Logic — extend `tests/unit/roundloop/dwelling_state.test.ts` + new timer-helper unit tests.
