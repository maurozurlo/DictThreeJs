# Story 6-6: Modifier Authoring Guide

## Header
- **Story ID**: 6-6
- **Sprint**: 6
- **Status**: Ready
- **Type**: Config/Data
- **Layer**: N/A
- **TR-ID**: N/A — documentation story
- **Governing ADR**: docs/architecture/adr-0008-timed-modifier-engine.md (enabling doc)
- **Manifest Version**: 2026-06-13
- **Estimate**: 0.5 days
- **Last Updated**: 2026-06-15

## Summary

Write a short practical guide for adding new timed content (deals, laws, structures) to
the modifier engine after P1. The guide's goal is: a developer who has not read ADR-0008
in full should be able to add a new timed deal in ≤30 minutes using the guide alone.
Centerpiece: the "Miniature Cattle" worked example from ADR-0008.

## Acceptance Criteria

- [ ] Guide written to `docs/modifier-authoring-guide.md` (or `design/modifier-authoring-guide.md`)
- [ ] Covers: the `TIME_MODIFIERS` registry (how to pick or add a timing), the `ResolvedStatMod` fields, how to push a `Modifier` on content acceptance, the no-content-in-engine rule
- [ ] Includes the Cattle worked example: content asset shape vs runtime modifier instance, table of round-by-round contributions
- [ ] Includes a "add a new timed deal in N steps" recipe (numbered, copy-paste ready)
- [ ] Includes a section on what NOT to put on the modifier (labels, headline keys, faction — all in the content asset)
- [ ] Reviewed by lead-programmer for accuracy post-P1

## Implementation Notes

*This story is write-only — no code changes.*

The guide is a companion to ADR-0008, not a replacement. It can be terser and more practical.
Key tone: "here is the pattern, copy it."

Suggested structure:
1. Quick reference: the 5 fields every Modifier needs at acquisition
2. Picking a timing: `TIME_MODIFIERS` table with common cases
3. Worked example: Cattle deal (content asset → runtime modifier → round table)
4. Recipe: "Add a timed deal" (numbered steps from asset definition to push)
5. Anti-patterns: what NOT to do (content in engine, re-resolving timing id, multiple `set()` calls)

## Out of Scope

- P2/P3 content authoring (wait until P1 + P2 are done before updating the guide)
- Repeal tier authoring — that is story 6-4's deliverable

## QA Test Cases

*Config/Data (doc) story — no automated test.*

- **Manual check — guide exists and covers all required topics**
  - Setup: after authoring
  - Verify: each AC item above is satisfied; guide can be followed without reading ADR-0008
  - Pass condition: lead-programmer review result = APPROVED

- **Manual check — Cattle example is correct**
  - Setup: cross-reference the worked example against ADR-0008 §4 Cattle example and the P1 implementation
  - Verify: round table values match `isWindowActive` and `sumModifiers` behaviour as implemented
  - Pass condition: no discrepancy between guide's table and actual engine output

## Test Evidence

- **Story Type**: Config/Data (doc)
- **Required evidence**: `docs/modifier-authoring-guide.md` exists; lead-programmer sign-off note in Completion Notes
- **Status**: [ ] Not yet created

## Completion Notes

*(Lead-programmer review outcome goes here)*

## Dependencies

- Depends on: 6-1 (P1 must be DONE — guide must reflect the actual implementation, not just the ADR)
- Unlocks: None
