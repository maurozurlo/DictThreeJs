# Difficulty Levels

**Status**: Design approved — pending implementation
**Target sprint**: 4
**Source**: User design session 2026-06-13

---

## 1. Overview

A pre-game difficulty selection screen offers three starting treasury values: Easy (1000), Medium (500, current default), and Hard (150, deficit start). All other starting conditions remain unchanged. The selected difficulty is persisted in the save file for backward compatibility with saves that predate this feature.

---

## 2. Player Fantasy

Easy gives players room to experiment — they can make mistakes and recover. Medium is the designed experience, the economic knife-edge the game was balanced around. Hard drops the player into a deficit from round 1, demanding immediate economic discipline with no buffer. The selection feels like choosing a handicap, not choosing to win or lose.

---

## 3. Detailed Rules

- Difficulty is selected on a pre-game screen before starting a new run.
- Only `gameManagement.treasury` initial value changes. All other starting conditions are identical across difficulties: relations at 0, charisma at 0, round at 1, sliders at default positions.
- The selected difficulty is stored in the game state and persisted in the save file.
- Default is Medium — maintains current behaviour and backward compatibility.

| Difficulty | Starting Treasury | Description |
|---|---|---|
| Easy | 1,000 | Ample buffer for experimentation |
| Medium | 500 | Current default — the designed experience |
| Hard | 150 | Below round-1 expenditure floor; immediate deficit pressure |

Hard starts at 150 which is near or below the minimum round-1 expenditure depending on slider positions. This is intentional — Hard is for players who have already mastered Medium.

---

## 4. Formulas

```
startingTreasury = DIFFICULTY_TREASURY[selected]

DIFFICULTY_TREASURY = {
  easy:   1000,
  medium:  500,   // current hardcoded value
  hard:    150
}
```

Round 1 approximate expenditure range (depends on slider positions):
- All sliders at minimum (~1 each) → ~50–80 treasury/round
- All sliders at default → ~100–150 treasury/round

At Hard + default sliders, the player reaches treasury 0 by round 2 without any income deals or law bonuses. This is the intended Hard experience.

---

## 5. Edge Cases

- **Save file without `difficulty` field**: load defaults to `medium`. No regression for saves from before this feature.
- **Records panel / meta-progression**: does difficulty affect tier scoring? **Decision deferred** — simplest approach is no modifier (same thresholds regardless of difficulty). Flag for Sprint 4 story spec.
- **Hard mode bankruptcy by round 2**: intentional. Hard is for experienced players. No special handling needed.
- **Difficulty change mid-run**: not supported. Difficulty is locked when a run starts and cleared on game end / new game.

---

## 6. Dependencies

- **`src/types/GameState.ts`** — `Difficulty` type (`'easy' | 'medium' | 'hard'`)
- **`src/Constants/GameState.ts`** — `DIFFICULTY_TREASURY` constant object
- **`src/Stores/GameState.ts`** — initial state sets treasury from selected difficulty; `loadGame` whitelists the new field
- **`src/Utils/SaveLoad.ts`** — `difficulty` field included in save payload; missing field defaults to `'medium'` on import
- **Pre-game screen** (new UI component) — difficulty selection before run start; UX spec TBD
- **Meta-progression** (`src/types/MetaProgress.ts`, story 3-1) — TBD whether difficulty is recorded per run entry

---

## 7. Tuning Knobs

| Knob | Default | Safe Range | Affects |
|------|---------|-----------|---------|
| Easy starting treasury | 1,000 | 750–1,500 | Headroom for error in early rounds |
| Medium starting treasury | 500 | 400–600 | Baseline — change only with full balance review |
| Hard starting treasury | 150 | 50–250 | Severity of opening deficit pressure |

---

## 8. Acceptance Criteria

- [ ] Pre-game difficulty screen displays three options: Easy, Medium, Hard
- [ ] Selecting Easy starts a run with treasury 1,000
- [ ] Selecting Medium starts a run with treasury 500 (matches current default)
- [ ] Selecting Hard starts a run with treasury 150
- [ ] All other starting state is identical regardless of difficulty selection
- [ ] `gameManagement.difficulty` persisted in save file
- [ ] Saves without `difficulty` field load as Medium — no regression on existing saves
- [ ] Difficulty selection screen i18n'd (EN + ES)
- [ ] Unit test: each difficulty variant sets the correct initial treasury in GameState
