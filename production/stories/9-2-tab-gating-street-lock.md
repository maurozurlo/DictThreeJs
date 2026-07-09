# Story 9-2: Tab Gating — Street Lock / Decision Lock

> **Epic**: Round Loop & Street Reveal
> **Status**: Complete
> **Layer**: Feature
> **Type**: Logic
> **Estimate**: 0.5 days
> **Manifest Version**: 2026-06-13
> **Last Updated**: 2026-07-08

## Completion Notes

Implemented as scoped. `setActiveTab` gate added in `src/Stores/GameState.ts` (decision tabs blocked when `dwelling`, Street blocked when `!dwelling && phase==='start'`, debug bypasses both). `Navbar.tsx` disabled logic updated to match. Automated tests: `tests/unit/roundloop/tab_gating.test.ts` (9 tests). End-to-end verified via Puppeteer walkthrough (Story 9-3 notes) — live game confirms Meet/Laws/Deals/Budget disable and Street enables during the hinge, and the inverse during the work day. Full suite 696/696, `tsc -b` clean.

## Context

**Design source**: `ROUND_LOOP_STREET_REVEAL_0_1.md` — §2
**Requirement**: `TR-roundloop-001`

**ADR Governing Implementation**: [ADR-0012: Round Loop Phase Split](docs/architecture/adr-0012-round-loop-phase-split.md)
**ADR Decision Summary**: `setActiveTab` gains a `dwelling`-aware gate symmetrical to the existing `tabsLocked` gate: block Meet/Laws/Deals/Budget when `dwelling === true`; block Street when `dwelling === false && phase === 'start'`. `Navbar.tsx`'s `tabConfig` disabled logic mirrors the same rule so locked buttons render disabled, not just inert.

**Secondary ADR**: [ADR-0002](docs/architecture/adr-0002-state-management-pattern.md)

**Engine**: React 19 + TypeScript | **Risk**: LOW — additive gate, does not touch `tabsLocked` (orthogonal, used for event/dialog blocking).
**Engine Notes**: `setActiveTab` lives in `src/Stores/GameState.ts` (~line 143). `Navbar.tsx` builds `tabConfig` with per-tab `disabled`. Debug mode (`s.debug.enabled`) must bypass both gates, consistent with the existing Secret-tab precedent (`secretAvailable || debugEnabled`).

**Control Manifest Rules (Feature layer)**:
- Required: read `dwelling` via a minimal Zustand selector.
- Forbidden: gameplay logic in components — the gate itself lives in the store action (`setActiveTab`); `Navbar.tsx` only reflects it for the disabled prop.

---

## Acceptance Criteria

- [ ] **AC-1**: `setActiveTab(tab)` returns early (no-op) when `get().gameManagement.dwelling === true`, `tab` is one of `[Meet, Laws, Deals, Budget]`, and `!debugEnabled`.
- [ ] **AC-2**: `setActiveTab(tab)` returns early when `get().gameManagement.dwelling === false`, `tab === Tabs.Street`, `get().gameManagement.phase === 'start'`, and `!debugEnabled`.
- [ ] **AC-3**: `Navbar.tsx`'s `tabConfig` disables Meet/Laws/Deals/Budget when `dwelling` (in addition to the existing `tabsLocked` condition — `disabled: tabsLocked || dwelling`).
- [ ] **AC-4**: `Navbar.tsx`'s `tabConfig` disables Street when `!dwelling` (new — Street was previously never disabled).
- [ ] **AC-5**: Debug mode (`debugEnabled`) bypasses both the store-level gate and the Navbar disabled state — all tabs remain clickable for testing/free-cam workflows.
- [ ] **AC-6**: Shop, Log, Menu, Secret tabs are unaffected by `dwelling` (out of scope — same as today).

**Regression:**
- [ ] **AC-7**: `npx vitest run` — 0 new failures.
- [ ] **AC-8**: `tsc -b` exits 0.

---

## Implementation Notes

```ts
// setActiveTab, near the existing tabsLocked check
setActiveTab: (tab: Tabs) => {
    const s0 = get();
    const debugEnabled = s0.debug.enabled;
    if (s0.tabs.tabsLocked && tab !== Tabs.Secret && tab !== Tabs.Shop && tab !== Tabs.Menu) return;

    const decisionTabs: Tabs[] = [Tabs.Meet, Tabs.Laws, Tabs.Deals, Tabs.Budget];
    if (s0.gameManagement.dwelling && decisionTabs.includes(tab) && !debugEnabled) return;
    if (!s0.gameManagement.dwelling && tab === Tabs.Street && s0.gameManagement.phase === 'start' && !debugEnabled) return;

    // ...existing camera-position logic unchanged
}
```

```tsx
// Navbar.tsx tabConfig
const dwelling = useGameStore(s => s.gameManagement.dwelling)
...
{ tab: Tabs.Meet,   disabled: (tabsLocked || dwelling) && !debugEnabled },
{ tab: Tabs.Laws,   disabled: (tabsLocked || dwelling) && !debugEnabled },
{ tab: Tabs.Deals,  disabled: (tabsLocked || dwelling) && !debugEnabled },
{ tab: Tabs.Budget, disabled: (tabsLocked || dwelling) && !debugEnabled },
{ tab: Tabs.Street, disabled: !dwelling && !debugEnabled },
```

Note `phase === 'start'` guard on the Street block in the store gate — outside an active round (idle/menu, end screens) there's no work day to lock Street against; the Navbar-level `!dwelling` disabled check is intentionally simpler (Street tab isn't even rendered outside `phase === 'start'` gameplay per `displayTabs`).

---

## Out of Scope

- The reveal/dwell UI itself (Story 9-3) — this story only makes the *tabs* correctly locked/unlocked, it does not yet force the player into a mandatory viewing experience.
- Round 1 special-case (Story 9-4).

---

## QA Test Cases

- **AC-1**: Set `dwelling: true`, call `setActiveTab(Tabs.Laws)` → `activeTab` unchanged.
- **AC-2**: Set `dwelling: false`, `phase: 'start'`, call `setActiveTab(Tabs.Street)` → `activeTab` unchanged.
- **AC-5**: Same as AC-1/AC-2 but with `debug.enabled: true` → tab switch succeeds both times.
- **AC-3/AC-4 (manual)**: In dwelling state, Meet/Laws/Deals/Budget buttons render visually disabled and Street enabled; inverse during work day.

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: Automated unit test in `tests/unit/roundloop/tab_gating.test.ts` covering AC-1, AC-2, AC-5. Manual walkthrough for AC-3/AC-4 visual state, noted in Sprint 9 smoke check.

---

## Dependencies

- Depends on: Story 9-1 (`dwelling` field must exist)
- Unlocks: Story 9-3 (reveal/dwell UI can now assume tabs are correctly locked)
