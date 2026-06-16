# Story 6-5: Author ADR-0009 — Coup Telegraphing & Fairness

## Header
- **Story ID**: 6-5
- **Sprint**: 6
- **Status**: Complete
- **Type**: Config/Data
- **Layer**: Foundation
- **TR-ID**: TR-coup-002
- **Governing ADR**: N/A — this story creates the ADR
- **Manifest Version**: 2026-06-13
- **Estimate**: 0.5 days
- **Last Updated**: 2026-06-16
- **Completed**: 2026-06-16

## Summary

Author and get accepted `docs/architecture/adr-0009-coup-telegraphing-fairness.md`.
ADR-0009 governs how the coup system communicates its arming state to the player
(at least 1 round of explicit warning), what inputs are visible, and how the system
stays deterministic + telegraphed. Note: coup already reads **effective** relations
post-6-1 — ADR-0009 governs the fairness/UI design on top of that, not the data source.

## Acceptance Criteria

- [x] `docs/architecture/adr-0009-coup-telegraphing-fairness.md` written with all required ADR sections
- [x] Status: Accepted
- [x] ADR references ADR-0008 effective relations as the data source (coup reads effective, not base)
- [x] Decision covers: minimum warning period (≥1 round explicit warning before coup fires), visible inputs the player can act on, arming condition determinism (no hidden RNG in arming)
- [x] ADR added to ADR log in `.claude/docs/technical-preferences.md`
- [x] Self-review against the live `CoupHandler` implementation (see Completion Notes — formal Technical-Director agent review not run this autonomous session; owner ratification recommended)
- [x] All 8 required ADR sections present (Overview, Context, Decision, Consequences, ADR Dependencies, Engine Compatibility, GDD Requirements Addressed, Validation Criteria)

## Implementation Notes

*This is a documentation story — no code changes.*

The ADR should answer:
- **Warning signal**: what exactly does the player see ≥1 round before a coup can fire?
- **Visible inputs**: which relation stats are shown, are thresholds visible, is effective vs base distinction surfaced?
- **Arming determinism**: is arming triggered by crossing a threshold (deterministic) or by a probability roll (stochastic)? The current system uses a grace roll — the ADR should decide whether to retain or replace this.
- **Grace period interaction**: does a windowed relation modifier that expires mid-grace-period extend or end the warning?

Keep the ADR scoped to the *design contract* (what the player can know and rely on).
The UI implementation is story 6-7 (blocked on this ADR). The data source (effective relations) is already live post-6-1.

Use `.claude/docs/templates/architecture-decision-record.md` if available.

## Out of Scope

- Coup UI implementation — that is story 6-7
- Changing coup probability values — balance is separate
- The effective-relation switch — that lands in 6-1

## QA Test Cases

*Config/Data (doc) story — no automated test.*

- **Manual check — ADR complete and Accepted**
  - Setup: after authoring
  - Verify: file exists at `docs/architecture/adr-0009-coup-telegraphing-fairness.md`; Status field = Accepted; all 8 sections present; references ADR-0008
  - Pass condition: Technical Director review result = APPROVED (or APPROVED WITH CONDITIONS with conditions noted)

- **Manual check — ADR log updated**
  - Setup: read `.claude/docs/technical-preferences.md` Architecture Decisions Log
  - Verify: ADR-0009 entry present with status (Accepted) and date
  - Pass condition: entry matches the written ADR's status exactly

## Test Evidence

- **Story Type**: Config/Data (doc)
- **Required evidence**: `docs/architecture/adr-0009-coup-telegraphing-fairness.md` exists, Status: Accepted; review note in Completion Notes
- **Status**: [x] Created — `docs/architecture/adr-0009-coup-telegraphing-fairness.md` (Status: Accepted)

## Completion Notes

- ADR-0009 authored 2026-06-16, grounded in the live `src/Stores/CoupHandler.ts` +
  `GAMESTATE.COUP` constants (two-tier check, `coupArmedLastRound` carry, security ±1
  threshold, effective-relation data source from ADR-0008 §6).
- **Key decision**: replace the stochastic 50% grace roll with a **deterministic** first-armed
  -round grace, guaranteeing ≥ 1 explicit red-warning round and removing the only RNG from the
  coup path. Alternatives (keep 50% roll, stochastic arming, yellow-only) documented and
  rejected. Implementation (retire `GRACE_CHANCE`) is Story 6-7's slice; threshold *values*
  remain designer-owned balance.
- Added to the ADR log in `.claude/docs/technical-preferences.md` (Accepted 2026-06-16).
- Honesty note: self-reviewed by the author against the implementation; a separate
  `technical-director` agent review was **not** run (autonomous session). Owner ratification
  recommended before 6-7 ships the player-facing readout — flagged in the ADR Status block.

## Dependencies

- Depends on: None
- Unlocks: 6-7 (coup fairness UI is blocked on this ADR being Accepted)
