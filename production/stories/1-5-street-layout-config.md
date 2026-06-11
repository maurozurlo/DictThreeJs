# Story 1-5: Street View — Layout Config + Types

## Header
- **Story ID**: 1-5
- **Sprint**: 1
- **Status**: Complete
- **Type**: Config/Data
- **Layer**: Feature
- **TR-ID**: TR-scene-003
- **Governing ADR**: docs/architecture/adr-0003-react-threejs-integration.md
- **Manifest Version**: N/A
- **Estimate**: 0.5 days
- **Last Updated**: 2026-06-10

## Summary

Define the TypeScript types and static data that describe the street scene layout:
buildings, plaza (with statue slots), pedestrian waypoint paths, and vehicle
waypoint paths. No Three.js rendering yet — pure data that story 1-6 will consume.

## Acceptance Criteria

- [ ] `src/types/StreetLayout.ts` exports all street layout types
- [ ] `src/assets/streetLayout.ts` exports a typed `STREET_LAYOUT` constant
- [ ] Layout includes: 4+ buildings, 1 plaza with 3 statue slots, 2 pedestrian paths, 1 vehicle path
- [ ] All paths have at least 2 waypoints and a `loop` flag
- [ ] File compiles with no TypeScript errors

## Out of Scope

- Any Three.js rendering (story 1-6)
- State-driven visual variations (story 1-8)
- Animated movement (story 1-9)

## Test Evidence

Config/Data story — no automated test required.

## Dependencies

None.
