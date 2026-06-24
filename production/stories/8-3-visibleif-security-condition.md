# Story 8-3: Add `security` Condition to `visibleIf`

> **Epic**: Street View — Dynamic Assets
> **Status**: Backlog
> **Layer**: Foundation
> **Type**: Logic
> **Estimate**: 0.5 days
> **Manifest Version**: 2026-06-23
> **Last Updated**: 2026-06-23

## Context

**GDD**: `design/gdd/street-view.md §3.1–3.2`

Street props are split across two independent budget axes: **infrastructure** and **security**. The IDE's `visibleIf` type already supports `infrastructure: [min, max]` filtering in `useStreetLayout.ts`, but has no equivalent for the security slider.

Security-tier props (guard posts, tanks, cannons, gun nests, searchlights — Controlled and Militarised tiers) and disorder props (graffiti, barricades — Disorder tier) cannot be conditionally rendered without this field.

This story adds `security?: [number, number]` to the `visibleIf` type and wires the filter in the hook. Story 8-5 (prop wiring) depends on this landing first.

**Security tier thresholds** (from GDD §3.1):
- Disorder: 1–3
- Controlled: 4–7
- Militarised: 8–10

---

## Acceptance Criteria

- [ ] **AC-1**: `IDEObject.visibleIf` in `src/types/WorldLayout.ts` includes `security?: [number, number]` with a doc comment matching the `infrastructure` field's style ("budget.expenditures.security slider range [min, max] inclusive (1–10)")
- [ ] **AC-2**: `useStreetLayout.ts` subscribes to `s.budget.expenditures.security` alongside `infrastructure`
- [ ] **AC-3**: When an IDE entry has `visibleIf: { security: [8, 10] }` and the current security expenditure is 5, that entry's instances are excluded from the resolved placements
- [ ] **AC-4**: When an IDE entry has `visibleIf: { security: [8, 10] }` and the current security expenditure is 10, that entry's instances are included
- [ ] **AC-5**: `infrastructure` and `security` conditions compose as AND — an entry with both `infrastructure: [1, 3]` and `security: [1, 3]` is only visible when both conditions hold simultaneously
- [ ] **AC-6**: A unit test in `tests/unit/street/` covers AC-3, AC-4, and AC-5 by calling the hook with mocked store values
- [ ] **AC-7**: `npx vitest run` passes (all existing tests green)
- [ ] **AC-8**: `tsc --noEmit` passes with no new errors

---

## Implementation Notes

`useStreetLayout.ts` already follows the pattern for `infrastructure`. Add `security` to the `useMemo` dependency array and the filter block. The selector should follow the exact same pattern:

```ts
const security = useGameStore((s) => s.budget.expenditures.security);
// in filter:
if (v.security !== undefined) {
    const [min, max] = v.security;
    if (security < min || security > max) return [];
}
```

The WorldLayout.ts comment block should also update the doc note from "0–10" to "1–10" to match the actual `GAMESTATE.BUDGET.BOUNDS.EXPENDITURE.MIN` of 1.

---

## Test Evidence

- **Type**: Logic — automated unit test required (BLOCKING gate)
- **Location**: `tests/unit/street/visibleif_security.test.ts`
- **Scope**: Pure filter logic — mock `useGameStore` with test security values and assert resolved placement list
