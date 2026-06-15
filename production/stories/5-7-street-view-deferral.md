# Story 5-7: Street View Deferral Decision + Tutorial Audit

## Header
- **Story ID**: 5-7
- **Sprint**: 5
- **Status**: Complete
- **Type**: Config/Data (Documentation)
- **Layer**: Polish
- **TR-ID**: N/A
- **Governing ADR**: N/A
- **Manifest Version**: 2026-06-14
- **Estimate**: 0.25 days
- **Last Updated**: 2026-06-15

## Summary

Update `design/gdd/systems-index.md` Street View row to reflect the deferral
decision. Audit the tutorial to verify it does not present Street View as a
functional feature; update copy if needed.

## Acceptance Criteria

- [x] `systems-index.md` Street View row updated to "Deferred — visual-update sprint"
- [x] Tutorial contains no reference to Street View as a functional feature
- [x] If tutorial references Street View, copy is updated to reflect deferred status

## Verification

- `design/gdd/systems-index.md` Street View entry: `Deferred — visual-update sprint | Sprint 6+` ✅
- Tutorial step 8 (`public/locales/en/tutorial.json`): "The Street is a view of the city scene. Visual changes based on your decisions are coming in a future update." ✅
- Tutorial step 8 subnote: "No actions here." ✅

## Completion Notes
- Completed: 2026-06-15
- Both systems-index and tutorial already reflect the deferral — no file changes required
- Story serves as a formal audit record
