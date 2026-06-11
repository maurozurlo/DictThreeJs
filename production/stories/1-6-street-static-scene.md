# Story 1-6: Street View — Static Scene (Placeholder Cubes)

## Header
- **Story ID**: 1-6
- **Sprint**: 1
- **Status**: Complete
- **Type**: Visual/Feel
- **Layer**: Feature
- **TR-ID**: TR-scene-003
- **Governing ADR**: docs/architecture/adr-0003-react-threejs-integration.md
- **Manifest Version**: N/A
- **Estimate**: 1.0 days
- **Last Updated**: 2026-06-10

## Summary

Render the street scene as placeholder box geometry using `STREET_LAYOUT` from
story 1-5. Buildings, plaza, pedestrians, and a vehicle all appear as colored
cubes visible when the player switches to the Street tab.

## Acceptance Criteria

- [ ] Switching to the Street tab shows a street scene with placeholder cubes
- [ ] 8 building cubes visible, varied heights, in two rows flanking a central road
- [ ] Plaza cube visible at centre
- [ ] 3 pedestrian cubes and 1 vehicle cube visible at their starting waypoints
- [ ] The Navbar and ActionPanel remain unaffected
- [ ] No console errors

## Out of Scope

- State-driven visual changes (story 1-8)
- Animated movement (story 1-9)
- Real art assets

## Test Evidence

Visual/Feel — manual walkthrough. Evidence: run app, switch to Street tab,
confirm cubes appear.

## Dependencies

- 1-5 Complete (layout config)
