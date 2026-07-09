# Story 9-4: Round 1 Opening — Inherited City State

> **Epic**: Round Loop & Street Reveal
> **Status**: Complete
> **Layer**: Feature
> **Type**: UI
> **Estimate**: 0.5 days
> **Manifest Version**: 2026-06-13
> **Last Updated**: 2026-07-08

## Completion Notes

Implemented per user request during live playtesting (independently arrived at the same
design this story already scoped). `beginFirstWorkDay()` added as a new store action
(distinct from `nextRound()` — no round to resolve yet). `buildStartState` now opens on
`Tabs.Street` with `dwelling: true`, `timerStartedAt: null` (timer paused), and the
scene camera pre-set to `STREET_CAMERA` (see below). `DayEnded.tsx` branches on
`isIntro = !dayEnded` to show the `hinge.intro_headline` key and the "Begin Month 1"
label instead of the round-recap flow, reusing the exact same mandatory-reveal/dwell
component from Story 9-3.

**Bonus bug fix caught in the same pass**: the user reported the camera staying at
the last tab's position (e.g. Meet) after a round ended, only fixing itself once they
manually clicked the Street tab. Root cause: `expireTimer()` (Story 9-1) force-set
`tabs.activeTab: Tabs.Street` directly via `set()`, bypassing the camera-positioning
logic that normally only runs inside the `setActiveTab()` action. Fixed by extracting
the Street camera position/fov/rotation into a shared `STREET_CAMERA` constant
(`src/Constants/GameState.ts`) and applying it explicitly in both `expireTimer()`
branches and in `buildStartState`, not just `setActiveTab`.

Verified end-to-end via Puppeteer against the live dev server: new game opens
directly on the Street view with "A NEW ERA BEGINS"; navigated to Meet, forced a
round-end, and confirmed the camera correctly snapped back to Street (not stuck on
Meet) in the resulting screenshot. Automated: `tests/unit/roundloop/intro_dwell.test.ts`
(8 tests, includes a regression guard for the camera bug). Full suite 704/704, `tsc -b`
clean.

## Context

**Design source**: `ROUND_LOOP_STREET_REVEAL_0_1.md` — §3 engineering note: *"a single hinge means month 1 needs an opening / inherited city state before the player's first decision — the regime you take over already looks like something."*
**Requirement**: `TR-roundloop-001` (extension)

**ADR Governing Implementation**: [ADR-0012](docs/architecture/adr-0012-round-loop-phase-split.md) — Consequences / Neutral section flags this as a separate story.

**Engine**: React 19 + TypeScript | **Risk**: LOW — reuses the Story 9-3 dwell-stage component; only changes initial-state wiring.

## Acceptance Criteria

- [ ] **AC-1**: `StateFactory.buildStartState` initializes a brand-new game with `dwelling: true` and `tabs.activeTab: Tabs.Street` (instead of the current work-day-locked start) — the very first thing the player sees is the city they inherited, not a locked decision screen.
- [ ] **AC-2**: The intro dwell stage shows a distinct one-time headline (e.g. `hinge.intro_headline`, i18n EN/ES — "YOU HAVE SEIZED POWER" tone) instead of the round-financials headline, since there is no round 0 to report on.
- [ ] **AC-3**: The work-day timer does **not** start counting until the player dismisses the intro dwell (clicks the equivalent "Begin First Month" button) — reuses the Story 9-3 dwell-stage advance button, wired to a new store action (or `nextRound()`'s existing round-1 entry path, whichever is the smaller diff once 9-1/9-3 land).
- [ ] **AC-4**: Loading an existing save skips this entirely — `dwelling` restores from the save (never forced true on load).

## Out of Scope
- Any bespoke "inherited city" visual content beyond the headline swap (no new assets)

## Test Evidence
Manual walkthrough: new game → verify Street shown first, timer not running, dismiss → work day begins normally.

## Dependencies
- Depends on: Story 9-1, Story 9-3
