# Story 1-3: ADR — Round Timer & Game Loop

## Header
- **Story ID**: 1-3
- **Sprint**: 1
- **Status**: Ready
- **Type**: Config/Data
- **Layer**: Foundation
- **TR-ID**: TR-timer-001
- **Governing ADR**: docs/architecture/adr-0006-round-timer-game-loop.md (to be created)
- **Manifest Version**: N/A
- **Estimate**: 0.5 days
- **Last Updated**: 2026-06-10

## Summary

Record the architectural decision governing the real-time per-round countdown:
wall-clock measurement, pause/resume semantics, expiry penalties, and the
game loop advancement sequence.

## Acceptance Criteria

- [ ] ADR-0006 created at `docs/architecture/adr-0006-round-timer-game-loop.md`
- [ ] ADR status is Accepted
- [ ] TR-timer-001 updated in tr-registry.yaml

## Out of Scope

- Implementing round acceleration
- Changing expiry penalty values

## Test Evidence

Config/Data story — no automated test required.

## Dependencies

None.
