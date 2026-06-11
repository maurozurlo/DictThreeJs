# Story 1-2: ADR — Event Scheduling System

## Header
- **Story ID**: 1-2
- **Sprint**: 1
- **Status**: Ready
- **Type**: Config/Data
- **Layer**: Foundation
- **TR-ID**: TR-events-001
- **Governing ADR**: docs/architecture/adr-0005-event-scheduling.md (to be created)
- **Manifest Version**: N/A
- **Estimate**: 0.5 days
- **Last Updated**: 2026-06-10

## Summary

Record the architectural decision governing event scheduling: how daily events,
periodic events, and mini challenges are selected and surfaced each round.

## Acceptance Criteria

- [ ] ADR-0005 created at `docs/architecture/adr-0005-event-scheduling.md`
- [ ] ADR status is Accepted
- [ ] TR-events-001 updated in tr-registry.yaml

## Out of Scope

- Changing event selection logic
- Adding new event types

## Test Evidence

Config/Data story — no automated test required.

## Dependencies

1-1 (RNG strategy must be decided first).
