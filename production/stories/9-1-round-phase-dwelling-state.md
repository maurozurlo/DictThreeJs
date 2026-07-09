# Story 9-1: `dwelling` State — Work/Hinge Phase Split

> **Epic**: Round Loop & Street Reveal
> **Status**: Complete
> **Layer**: Core
> **Type**: Logic
> **Estimate**: 0.75 days
> **Manifest Version**: 2026-06-13
> **Last Updated**: 2026-07-08

## Completion Notes

Implemented as scoped. `dwelling` added to `types/GameState.ts`, `INITIAL_STATE`, both `expireTimer()` branches (with force-navigate to `Tabs.Street`), all 6 `nextRound()` branches (coup/bankruptcy/overthrown/victory/periodicEvent/normal — story estimated 5, actual count is 6; all covered), and `StateFactory` (buildStartState + buildLoadedState, load always forces `false`). Automated tests: `tests/unit/roundloop/dwelling_state.test.ts` (8 tests) covering expireTimer, normal/coup/victory nextRound branches, and load-state defaulting. Full suite 696/696 passing, `tsc -b` clean. End-to-end verified via Puppeteer walkthrough (see Story 9-3 notes) — confirmed working in the live game, not just unit tests.

## Context

**Design source**: `ROUND_LOOP_STREET_REVEAL_0_1.md` (repo root) — §2, §3
**Requirement**: `TR-roundloop-001`

**ADR Governing Implementation**: [ADR-0012: Round Loop Phase Split](docs/architecture/adr-0012-round-loop-phase-split.md)
**ADR Decision Summary**: Add `gameManagement.dwelling: boolean`. `expireTimer()` sets it `true` (and force-navigates to `Tabs.Street`) in the same atomic `set()` that already writes the round's financial snapshot. All 5 `nextRound()` resolution branches (coup / lose / victory / special-ending / normal) reset it to `false`.

**Secondary ADR**: [ADR-0002](docs/architecture/adr-0002-state-management-pattern.md) — one atomic `set()` per action; no new store slice.

**Engine**: React 19 + TypeScript + Zustand | **Risk**: LOW-MEDIUM — touches `expireTimer()` and all 5 `nextRound()` branches; must not regress the coup/lose/victory/special-ending paths.
**Engine Notes**: `expireTimer()` and `nextRound()` are both in `src/Stores/GameState.ts`. `nextRound()`'s 5 branches each already reset `dayEnded: false` — add `dwelling: false` alongside each occurrence, same pattern.

**Control Manifest Rules (Core layer)**:
- Required: single atomic `set()` per action (ADR-0002).
- Forbidden: reading `Date.now()` outside effects/actions (ADR-0006) — not applicable here, no new timer.

---

## Acceptance Criteria

- [ ] **AC-1**: `gameManagement.dwelling: boolean` added to `types/GameState.ts` and initialized `false` in `INITIAL_STATE` (`GameState.ts`) and in `StateFactory.buildStartState`/`buildLoadedState` (default `false` for pre-existing saves without the field).
- [ ] **AC-2**: `expireTimer()` sets `dwelling: true` in the same `set()` call that currently sets `dayEnded: true` and the financial snapshot fields (both the timeout branch and the normal branch, lines ~708-736 today).
- [ ] **AC-3**: `expireTimer()` also sets `tabs.activeTab: Tabs.Street` in that same call — the hinge always opens on the Street tab, never left to chance.
- [ ] **AC-4**: All 5 `nextRound()` resolution branches (coup, lose, victory, special-ending, normal-continue) set `dwelling: false` alongside their existing `dayEnded: false`.
- [ ] **AC-5**: `loadGame` whitelists `dwelling` for saves predating this field (defaults `false` — a loaded save always resumes mid-work-day, never mid-hinge, since the hinge itself is never persisted mid-flight in this MVP).
- [ ] **AC-6**: No existing test that asserts on `nextRound()`'s returned `gameManagement` shape breaks due to the new field (fixtures may need `dwelling: false` added where they do exact-shape assertions).

**Regression:**
- [ ] **AC-7**: `npx vitest run` — 0 new failures.
- [ ] **AC-8**: `tsc -b` exits 0.

---

## Implementation Notes

This story is state-only — no UI gating yet (that's 9-2) and no reveal/dwell UI (that's 9-3). After this story, `dwelling` flips correctly but nothing reads it yet; verify via a unit test on the store directly, not manual play.

```ts
// expireTimer(), both branches — add dwelling + activeTab alongside existing dayEnded write
set((s) => ({
    ...,
    tabs: { ...s.tabs, activeTab: Tabs.Street },
    gameManagement: {
        ...s.gameManagement,
        dwelling: true,
        dayEnded: true,
        // ...existing financial fields unchanged
    },
}));
```

```ts
// nextRound(), all 5 branches — add dwelling: false next to dayEnded: false
gameManagement: {
    ...s.gameManagement,
    dwelling: false,
    dayEnded: false,
    // ...existing fields unchanged
}
```

---

## Out of Scope

- Tab gating / disabling Meet/Laws/Deals/Budget/Street based on `dwelling` (Story 9-2)
- Any UI change to `DayEnded.tsx` (Story 9-3)
- Round 1 opening state (Story 9-4)

---

## QA Test Cases

- **AC-2/AC-3**: Call `expireTimer()` on a fresh store → assert `gameManagement.dwelling === true` and `tabs.activeTab === Tabs.Street`.
- **AC-4**: Drive each of the 5 `nextRound()` end conditions (mock thresholds as existing tests do for coup/lose/victory/special-ending) → assert `gameManagement.dwelling === false` in every case.
- **AC-5**: `buildLoadedState` with a save payload lacking `dwelling` → assert default `false`.

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: Automated unit test in `tests/unit/roundloop/dwelling_state.test.ts` — asserts AC-2 through AC-5 directly against the store.

---

## Dependencies

- Depends on: None (builds on existing `expireTimer`/`nextRound`)
- Unlocks: Story 9-2 (tab gating), Story 9-3 (reveal/dwell UI)
