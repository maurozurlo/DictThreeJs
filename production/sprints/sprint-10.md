# Sprint 10 — 2026-07-08 to 2026-07-15

## "Simplification & Debt"

## Sprint Goal
Execute the code audit plan (`docs/architecture/code-audit-2026-07-08.md`):
collapse `GameState.ts`'s duplicated round-end/round-start/hinge code paths into
single sources of truth, move inline game logic into pure Handlers per ADR-0002,
remove verified dead code, and close the standards-reality gaps (test location,
ADR-0007 status). Every story is gameplay-behavior-preserving; save-file
compatibility is allowed to break (owner decision 2026-07-08).

## Ground Rules (owner decisions, 2026-07-08)
- Gameplay behavior preserved; saves may break.
- Only truly dead code removed — live features untouched.
- ADR conflicts arbitrated case by case.
- Full suite + `tsc -b` + `npm run build` green after every story; Puppeteer
  round-loop walkthrough after stories touching the round path (10-1..10-4).

## Governing Documents
- [Code Audit 2026-07-08](../../docs/architecture/code-audit-2026-07-08.md) — findings A1–F
- [ADR-0002](../../docs/architecture/adr-0002-state-management-pattern.md) — thin store / pure Handlers / atomic set()
- [ADR-0012](../../docs/architecture/adr-0012-round-loop-phase-split.md) — hinge invariants that must not regress

## Tasks

### Must Have (Critical Path)

| ID   | Task | Agent/Owner | Est. Days | Dependencies | Audit Ref |
|------|------|-------------|-----------|--------------|-----------|
| 10-1 | **`nextRound()` de-duplication.** Extract `buildGameOverPatch` + `buildRoundStartPatch` into `RoundResolver.ts`; `nextRound()` collapses to resolve → branch → one `set()`. | lead-programmer | 1.5 | None | A1 |
| 10-2 | **Hinge/tab/camera single paths.** Merge `expireTimer()` twin branches into one `set()`; data-driven `TAB_CAMERA` lookup in Constants; shared timer pause/resume helper used by `setActiveTab`/`pauseTimer`/`resumeTimer`. | lead-programmer | 1.0 | 10-1 | A2, A3 |
| 10-3 | **Handler extraction + atomicity.** `handleWeirdLaw`, shared `applyEventEffect` (periodic + miniChallenge), `handlePurchase`; `handleDecision` returns a patch so `actUponLaw`/`actUponDeal` issue a single `set()`. | lead-programmer | 1.0 | 10-1 | A4, E1 |
| 10-4 | **Picker unification.** `swapLaw` adopts canonical `pickNextLaw` with `allowWeird: false` (fixes rep-status drift bug); new `pickNextDeal` replaces 3 duplicated draw sites. | gameplay-programmer | 0.5 | 10-1 | B1, A5 |

**Must Have total: 4.0d**

### Should Have

| ID   | Task | Agent/Owner | Est. Days | Dependencies | Audit Ref |
|------|------|-------------|-----------|--------------|-----------|
| 10-5 | **Dead-code sweep.** Remove `LanguageSwitcher.tsx`, `getRandomDailyEventForPower`, `middleground/` (git), un-export/delete unused exports & types per audit table (respect documented knip false positives). | lead-programmer | 0.5 | None | C |
| 10-6 | **Test relocation.** Move 16 `src/**` test files into `tests/unit/`, fix import paths. | lead-programmer | 0.25 | 10-1..10-4 | F |
| 10-7 | **ADR hygiene.** ADR-0007 → Superseded by ADR-0008 (residual note); verify ADR-0004 file status section; link audit outcomes. | technical-director | 0.25 | None | B2, B3 |

**Should Have total: 1.0d**

## Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Patch-builder extraction subtly changes a `nextRound()` field reset on one branch | Medium | High | Keep the six-branch behavior table from the audit next to the builder; existing roundloop/coup/victory tests assert per-branch fields; add missing per-branch assertions before refactoring (test-first) |
| `handleDecision` signature change (set → returned patch) ripples into EffectHandler tests | Medium | Medium | Adapt tests in the same story; suite must be green before commit |
| swapLaw picker unification changes swap behavior beyond the intended rep-status fix | Low | Medium | `allowWeird: false` preserves "no weird laws on swap"; unit test pins both properties |
| Test-file moves break vitest config include globs | Low | Low | Check vitest config before moving; run suite after |

## Definition of Done for this Sprint
- [ ] All Must Have stories complete
- [ ] Full suite green, `tsc -b` clean, `npm run build` green after each story
- [ ] Puppeteer round-loop walkthrough passes after 10-1..10-4 (new game → intro dwell → work day → force round-end → hinge on Street → advance → next round; plus one game-over path)
- [ ] `GameState.ts` ≤ ~700 lines; knip reports no undocumented findings
- [ ] Audit doc updated with outcomes

> **Lean review mode** — autonomous sprint cadence per standing owner directive
> (implement → verify → commit → push → continue).
