# Story 10-6: Test Relocation — src/** Tests into tests/unit/

> **Epic**: Simplification & Debt (Sprint 10)
> **Status**: Complete
> **Layer**: Testing
> **Type**: Config/Data
> **Estimate**: 0.25 days
> **Last Updated**: 2026-07-08

## Context

**Source**: [Code Audit 2026-07-08](../../docs/architecture/code-audit-2026-07-08.md) §F.
`src/CLAUDE.md` mandates "Tests live in `tests/` — not in `src/`"; 16 test files
violate it. Moving (not amending the standard) — the split, not the location, is
the problem.

## Completion Notes

All 16 files moved via `git mv` into per-system folders (meet, budget [new], coup,
laws, modifiers, utils [new], street); only relative import paths rewritten, zero
test logic changes. Vitest's default include glob covers `tests/**` already — no
config change needed. Suite identical before/after: 738/738, 50 files. `src/` now
contains zero `*.test.*` files, matching the `src/CLAUDE.md` standard.

## Acceptance Criteria

- [ ] **AC-1**: All 16 `src/**` `*.test.ts(x)` files moved under `tests/unit/<system>/` (git mv, matching the existing per-system folder layout), import paths fixed.
- [ ] **AC-2**: Vitest include globs verified to cover the new locations; total test count unchanged (704 before Sprint 10 stories added more — assert same count as immediately prior to the move).
- [ ] **AC-3**: No test logic edited beyond import paths.

**Regression:**
- [ ] **AC-4**: `npx vitest run` — same pass count as before the move; `tsc -b` clean.

## Test Evidence
**Story Type**: Config/Data — suite run before/after with matching counts, recorded in commit message.
