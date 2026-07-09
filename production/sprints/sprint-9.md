# Sprint 9 — 2026-07-08 to 2026-07-15

## "One Day a Month"

## Sprint Goal
Implement the Round Loop / Street Reveal split from `ROUND_LOOP_STREET_REVEAL_0_1.md`:
split each round into a timed work day (Street View locked, decisions only)
and an untimed after-work hinge (Street View is the only reachable tab —
mandatory brief reveal, then optional unlimited dwell). Validate per the design
doc's own §8 test: after 3-4 months, does the player linger in the street or
mash past it?

## Prior Sprint Note
Epic 8 (Budget UX + Street View Dynamic Assets — stories 8-1 through 8-8) is
fully implemented and smoke-tested (`production/qa/smoke-2026-06-24.md`,
655/655 passing) but was never formally closed via `/story-done`; story files
still show Backlog/In Progress status. Left as-is per owner instruction —
revisit later if it matters, not blocking this sprint.

## Capacity
- Total days: 7
- Buffer (20%): 1.4 days reserved for unplanned work
- Available: 5.6 days
- Velocity note: planning at similar confidence to Sprint 7/8 (small, well-scoped stories)

## Governing ADR
[ADR-0012](../../docs/architecture/adr-0012-round-loop-phase-split.md) — Round Loop Phase Split (Accepted). Formalizes the design doc's decisions against the existing `expireTimer()`/`nextRound()`/`setActiveTab` architecture.

**Already satisfied, no action needed:** design doc §6 (seeded RNG + commit-on-roll) — shipped in Sprint 6 as ADR-0010.

## Tasks

### Must Have (Critical Path)

| ID  | Task | Agent/Owner | Est. Days | Dependencies | TR-ID |
|-----|------|-------------|-----------|--------------|-------|
| 9-1 | **`dwelling` state — work/hinge phase split.** Add `gameManagement.dwelling: boolean`. Wire `expireTimer()` (set `dwelling: true`, force `activeTab: Street`) and all 5 `nextRound()` branches (reset `dwelling: false`). | lead-programmer | 0.75 | ADR-0012 | TR-roundloop-001 |
| 9-2 | **Tab gating — Street lock / decision lock.** `setActiveTab` gate: block Meet/Laws/Deals/Budget when `dwelling`; block Street when `!dwelling` (during `phase==='start'`). `Navbar.tsx` disabled logic updated to match. Debug mode bypasses both. | lead-programmer | 0.5 | 9-1 | TR-roundloop-001 |
| 9-3 | **Street reveal + newsreel — mandatory reveal, optional dwell.** `DayEnded.tsx` two-stage render: blocking full scrim for a fixed minimum window (mandatory reveal, placeholder propaganda newsreel headline fused onto the existing financial breakdown), then non-blocking corner card (optional dwell) with the round-advance button; Street scene fully interactive underneath. | ui-programmer | 1.5 | 9-1, 9-2 | TR-roundloop-002 |

**Must Have total: 2.75d**

---

### Should Have

| ID  | Task | Agent/Owner | Est. Days | Dependencies | Notes |
|-----|------|-------------|-----------|--------------|-------|
| 9-4 | **Round 1 opening — inherited city state.** Game start (round 1) begins in a one-time dwell state ("the regime you inherited") with an intro headline instead of round-end financials, before the first work day's timer starts. | gameplay-programmer | 0.5 | 9-1, 9-3 | Design doc §3 engineering note |
| 9-5 | **Crisis docket consistency check.** Verify Summit/Economic Crisis/Natural Disaster scripted events present at work-day start (not mid-round); adjust `DailyEventHandler`/ADR-0005 wiring if a gap is found. | lead-programmer | 0.5 | None | Design doc §5 — research spike, may be a no-op |

**Should Have total: 1.0d**

---

## Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| `dwelling` fails to reset on an edge-case `nextRound()` branch, soft-locking decision tabs | Low | High | All 5 branches (coup/lose/victory/special-ending/normal) touched explicitly in 9-1; manual playtest of each end path in AC |
| `DayEnded` two-stage render (blocking→non-blocking) breaks existing pointer/z-index assumptions for ped click-to-inspect underneath | Medium | Medium | Reuse `Modal`'s scrim only for the mandatory stage; dwell stage renders as a plain positioned card with no full-viewport backdrop |
| 9-5 scope creep if `DailyEventHandler` needs real rework, not just verification | Medium | Low | Timeboxed as a 0.5d spike; if a real fix is needed, split into a follow-up story rather than absorbing into Sprint 9 |

---

## Dependencies on External Factors
None — pure state/UI work on top of already-shipped Street View, camera, and financial-breakdown systems.

---

## Definition of Done for this Sprint
- [ ] All Must Have tasks (9-1, 9-2, 9-3) completed
- [ ] Full suite green after each story's integration
- [ ] `tsc -b` clean
- [ ] Manual playtest: 3-4 rounds through the full work-day → hinge → work-day loop, all 5 `nextRound()` end branches spot-checked
- [ ] Design doc §8 validation question answered and logged: linger or mash?

> **PR-SPRINT gate skipped — lean review mode, per owner directive to move fast.**

> **Scope check:** This sprint touches `gameManagement` (new field), `setActiveTab`,
> `Navbar.tsx`, and `DayEnded.tsx` only. No new store slices, no new 3D assets,
> no camera changes — the Street scene itself is untouched.
