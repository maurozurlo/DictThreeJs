# Story 4-4: Difficulty Levels — Pre-Game Treasury Selection

## Header
- **Story ID**: 4-4
- **Sprint**: 4
- **Status**: Complete
- **Type**: Logic + UI
- **Layer**: Feature
- **TR-ID**: N/A
- **Governing ADR**: ADR-0002
- **Manifest Version**: 2026-06-13
- **Estimate**: 0.5 days
- **Last Updated**: 2026-06-13

## Summary

Add a difficulty selection screen that appears when the player clicks "New Game".
The player chooses Easy (1000), Medium (500), or Hard (150) starting treasury.
The selection is stored in save files and defaults to Medium for saves predating this story.

## Acceptance Criteria

- [x] Difficulty picker appears when clicking "New Game" (before game starts)
- [x] Easy = 1000, Medium = 500 (default), Hard = 150 starting treasury
- [x] Selected difficulty stored in `gameManagement.difficulty`
- [x] `setPhase('start')` with no difficulty argument defaults to Medium (500)
- [x] `loadGame` restores difficulty from save; defaults to 'medium' for old saves
- [x] `stats.peakTreasury` and `stats.lowestTreasury` reset to chosen starting treasury
- [x] Unit tests pass: `tests/unit/difficulty/difficulty-levels.test.ts` (15 tests)

## Implementation Notes

- `DIFFICULTY_TREASURY` constant added to `src/Constants/GameState.ts`
- `Difficulty` type exported from `src/Constants/GameState.ts`
- `gameManagement.difficulty: Difficulty` added to store type and initial state
- `setPhase(phase, difficulty?)` updated — when phase==='start', reads difficulty param
- `loadGame` adds `difficulty` with `?? 'medium'` backward-compat default
- `Menu.tsx` shows `showDifficultyPicker` local state; difficulty picker is inline
- i18n keys added to `en/menu.json` and `es/menu.json` under `difficulty.*`
- CSS `.difficultyPicker` added to `Tabs.module.css`

## Test Evidence

- **Test file**: `tests/unit/difficulty/difficulty-levels.test.ts`
- **Tests written**: 15
- **Result**: 267/267 passing (no regressions)

## Completion Notes
- Completed: 2026-06-13
- All ACs met. Manual QA needed to verify the difficulty picker renders correctly in-game.
