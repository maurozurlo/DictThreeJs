# Story 9-4: Round 1 Opening — Inherited City State

> **Epic**: Round Loop & Street Reveal
> **Status**: Ready
> **Layer**: Feature
> **Type**: UI
> **Estimate**: 0.5 days
> **Manifest Version**: 2026-06-13
> **Last Updated**: 2026-07-08

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
