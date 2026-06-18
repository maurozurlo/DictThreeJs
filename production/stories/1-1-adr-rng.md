# Story 1-1: ADR — RNG & Determinism Strategy

## Header
- **Story ID**: 1-1
- **Sprint**: 1
- **Status**: Complete
- **Type**: Config/Data
- **Layer**: Foundation
- **TR-ID**: TR-rng-001
- **Governing ADR**: docs/architecture/adr-0004-rng-determinism.md (to be created)
- **Manifest Version**: N/A
- **Estimate**: 0.5 days
- **Last Updated**: 2026-06-10

## Summary

Record the architectural decision governing randomness in Dictator Simulator.
The game uses `Math.random()` for probability mechanics but ADR-0002 claims
"deterministic" outputs. This ADR reconciles those claims and defines testability
rules for RNG-dependent code.

## Acceptance Criteria

- [ ] ADR-0004 created at `docs/architecture/adr-0004-rng-determinism.md`
- [ ] ADR status is Accepted
- [ ] TR-rng-001 updated in tr-registry.yaml

## Out of Scope

- Implementing seeded RNG
- Changing any existing RNG call sites

## Test Evidence

Config/Data story — no automated test required.

## Dependencies

None.
