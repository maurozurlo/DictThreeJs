# Story 4-1: ADR Housekeeping — Promote ADR-0001/0007 to Accepted; Create control-manifest.md

## Header
- **Story ID**: 4-1
- **Sprint**: 4
- **Status**: Complete
- **Type**: Config/Data
- **Layer**: Foundation
- **TR-ID**: N/A
- **Governing ADR**: N/A
- **Manifest Version**: N/A
- **Estimate**: 0.5 days
- **Last Updated**: 2026-06-13

## Summary

Three ADR housekeeping tasks required before the Production → Polish gate can pass:

1. ADR-0001 (Tech Stack Choice) was `Proposed` despite the stack being in production since Sprint 1. Promote to `Accepted`.
2. ADR-0007 (Effect Timing) is `Proposed` but intentionally deferred — document the rationale so `/story-done` and `/gate-check` can distinguish "deferred with reason" from "forgotten".
3. `docs/architecture/control-manifest.md` does not exist. Create it from the accepted ADRs so `/dev-story` manifest version checks work.

## Acceptance Criteria

- [x] `docs/architecture/adr-0001-tech-stack-choice.md` status field is `Accepted`
- [x] `docs/architecture/adr-0007-effect-timing.md` has documented rationale for remaining `Proposed` (deferred to Sprint 5+ due to Tier 2 weird deals dependency)
- [x] `docs/architecture/control-manifest.md` exists with non-placeholder content covering Foundation and Feature layer rules and forbidden patterns

## Completion Notes
- Completed: 2026-06-13
- ADR-0001: Status changed Proposed → Accepted (2026-06-13). Stack has been in production since Sprint 1.
- ADR-0007: Status field updated with deferral rationale. Will be promoted to Accepted during Sprint 5/6 planning when Tier 2 weird deals are scoped. No current stories depend on it.
- control-manifest.md: Created with Foundation, Feature, and UI/Presentation layers. Rules derived from ADR-0001 through ADR-0006.
