# Story 3-6: Secret Room Action Panel Layout

## Header
- **Story ID**: 3-6
- **Sprint**: 3
- **Status**: Ready
- **Type**: UI
- **Layer**: Feature
- **TR-ID**: TR-rng-001
- **Governing ADR**: docs/architecture/adr-0002-state-management-pattern.md
- **Manifest Version**: N/A
- **Estimate**: 0.5 days
- **Last Updated**: 2026-06-13

## Summary

The SecretRoom action panel content (room title, description, and action button)
currently renders in the main screen area alongside Budget/Shop content rather than
in a dedicated action panel position. This story positions the SecretRoom card in
the action panel area as originally designed, so the secret ending flow uses the
same panel layout as other interactions (Meet, Laws, etc.).

Identified during story 3-3 close-out (AC4 partial pass).

## Acceptance Criteria

- [ ] Secret room card (title, description, action button) renders inside the action panel area — same layout region used by Meet, Law, and Deal panels
- [ ] Panel is only shown when the Secret tab is active and `specialEnding.available = true`
- [ ] No visual regression on Budget, Shop, Meet, Law, or Deal panels

## Out of Scope

- Changing the content of the SecretRoom card (handled in story 3-3)
- Changing the 3D camera behavior for the Secret tab (handled in story 3-3)
- New animations or transitions for the panel appearance

## Files to Create / Modify

```
src/components/Tabs/Secret.tsx (or equivalent Secret tab component)  — layout fix
src/components/Tabs/Tabs.module.css (if layout class needed)         — optional
```

## QA Test Cases

**Story Type**: UI — manual walkthrough required

| # | Scenario | How to verify |
|---|----------|---------------|
| 1 | Action panel position | Trigger special ending → click Secret tab → confirm title/description/button appear in action panel region (same position as Meet/Law panels) |
| 2 | Panel hides when not active | Without special ending active → click Secret tab → confirm no action panel shown |
| 3 | No regression on other panels | Click Meet, Laws, Deals tabs → confirm their panels are unaffected |

## Test Evidence

**Story Type**: UI
**Required evidence**: `production/qa/evidence/3-6-secret-room-action-panel-evidence.md` — ADVISORY
**Status**: [ ] Not yet created

## Dependencies

- Story 3-3 (Secret Room Rework) — Complete ✓

## Completion Notes
<!-- Filled in by /story-done -->
