# Story 3-3: Secret Room Rework

## Header
- **Story ID**: 3-3
- **Sprint**: 3
- **Status**: Complete
- **Type**: Logic + UI
- **Layer**: Feature
- **TR-ID**: TR-rng-001
- **Governing ADR**: docs/architecture/adr-0002-state-management-pattern.md
- **Manifest Version**: N/A
- **Estimate**: 2.0 days
- **Last Updated**: 2026-06-13
- **Completed**: 2026-06-13

## Summary

Rework the secret room trigger threshold, narrative i18n, and room-index
determinism. The special ending now unlocks at relation ≥ 5 (down from the
current MAX of 10), making it reachable for most players. Hardcoded English
narrative strings are moved to the `secret` i18n namespace. The 3D room shown
when the Secret tab is clicked is locked to the triggering faction rather than
cycling per tab visit.

## Acceptance Criteria

- [ ] Secret tab accessible when ≥1 faction reaches relation ≥ 5 by round 9
- [ ] Both good and bad outcomes are reachable via charisma-weighted roll
- [ ] Charisma at max (+10) produces higher good-outcome probability than charisma at min (-10)
- [ ] Action panel renders: room title, description, and action button visible
- [ ] Post-action narrative (good/bad) rendered from i18n — no hardcoded English strings in store
- [ ] `endingsUnlocked` updated on outcome (via existing `recordGameEnd` call in EndScreen)
- [ ] 3D camera shows the triggering faction's room (not a cycling index)
- [ ] All secret room strings (title, description, button, outcomes) are in EN and ES locale files

## Implementation Notes

### Trigger threshold
In `nextRound()` step 8.5, change the filter from `>= GAMESTATE.RELATIONS.MAX`
to `>= GAMESTATE.SPECIAL_ENDING_THRESHOLD` (new constant = 5).

Add `SPECIAL_ENDING_THRESHOLD: number` to `GAME_STATE_CONSTANTS` interface in
`src/Constants/GameState.ts` and set it to 5 in the GAMESTATE object.

### Faction → room mapping
Add `FACTION_ROOM_INDEX: PowerKeys` constant: `{ military: 0, business: 1, people: 2 }`.

When `specialEndingFaction` is set in `nextRound()`, also pass
`secretRoomIndex: GAMESTATE.FACTION_ROOM_INDEX[specialEndingFaction]` in the
`tabs` slice of the `set()` call (both the periodic-event branch and the normal
branch use the same spread — compute `newSecretRoomIndex` before `set()`).

In `setActiveTab(Tabs.Secret)`: when `specialEnding.available && specialEnding.faction`,
use `GAMESTATE.FACTION_ROOM_INDEX[faction]` instead of cycling. Continue cycling
(+1 % 3) when no special ending is active.

### i18n narrative extraction
Remove the `narratives` object from `use()` in `specialEnding`. Do NOT set
`endReason` for special endings — pass `endReason: null` instead.

Add `outcome_good` and `outcome_bad` keys to each faction entry in
`public/locales/en/secret.json` and `public/locales/es/secret.json`.

In `EndScreen.tsx`:
- Add `const { t: secretT } = useTranslation('secret')`
- Add `const specialEndingFaction = useGameStore(s => s.specialEnding.faction)`
- Replace the existing `{endReason && <p>...}` block with:
  ```tsx
  {phase === 'special_ending' && specialEndingFaction && specialEndingOutcome && (
      <p className={styles.endReason}>{secretT(`${specialEndingFaction}.outcome_${specialEndingOutcome}`)}</p>
  )}
  {phase !== 'special_ending' && endReason && (
      <p className={styles.endReason}>{endReason}</p>
  )}
  ```

### ADR-0002 guidance
Store logic (threshold, roll, set) follows the existing handler pattern.
`use()` is a store action (not a pure handler) — it may call `get()`/`set()`.
No new handler file needed — the change is scoped to the existing `use()` action.

## Out of Scope

- Writing polished narrative text for secret room endings (placeholder text is fine)
- Changing the charisma probability formula (kept at 0.5 + (charisma/10) * 0.25)
- Adding more than 3 secret rooms
- Changing the visual appearance of the Secret tab card

## Files to Create / Modify

```
src/Constants/GameState.ts            — add SPECIAL_ENDING_THRESHOLD, FACTION_ROOM_INDEX
src/Stores/GameState.ts               — threshold change + faction-room index + narrative removal
src/components/EndScreen/EndScreen.tsx — i18n narrative rendering
public/locales/en/secret.json         — add outcome_good, outcome_bad per faction
public/locales/es/secret.json         — same in Spanish
tests/unit/secret/secret-room-rework.test.ts  — unit tests for threshold and roll logic
```

## QA Test Cases

**Story Type**: Logic + UI — unit tests required; action panel is manual

| # | Scenario | How to verify |
|---|----------|---------------|
| 1 | Threshold: faction at relation 5, round 9 → special ending unlocked | Unit test: seed relation=5, call nextRound from round 8 → `specialEnding.available = true` |
| 2 | Threshold: faction at relation 4, round 9 → NOT unlocked | Unit test: seed relation=4, call nextRound from round 8 → `specialEnding.available = false` |
| 3 | Good outcome: charisma = 10 (100% good chance) | Unit test: mock rollChance → always true → outcome = 'good' |
| 4 | Bad outcome: charisma = -10 (25% good chance) | Unit test: mock Math.random → 0.99 → outcome = 'bad' |
| 5 | Room index: military trigger → secretRoomIndex = 0 | Unit test: seed military=5, round=8 → nextRound → tabs.secretRoomIndex = 0 |
| 6 | Room index: business trigger → secretRoomIndex = 1 | Unit test: seed business=5, round=8 → nextRound → tabs.secretRoomIndex = 1 |
| 7 | Action panel renders | Manual: trigger special ending → click Secret tab → card with title/desc/button visible |
| 8 | EN outcome strings show | Manual: trigger + use → EndScreen shows outcome text in English |
| 9 | ES outcome strings show | Manual: switch locale to ES → EndScreen shows outcome text in Spanish |

## Test Evidence

**Story Type**: Logic + UI
**Required evidence**: `tests/unit/secret/secret-room-rework.test.ts` — BLOCKING
**Status**: [ ] Not yet created

## Dependencies

- None (no dependency on other sprint 3 stories)

## Completion Notes
**Completed**: 2026-06-13
**Criteria**: 7/8 passing (AC4 partial — content visible, positioning is a separate scope item)
**Deviations**: ADVISORY — SecretRoom action panel content renders in main screen area rather than a dedicated panel position. Pre-existing layout concern, not caused by 3-3 changes. Follow-up story created.
**Test Evidence**: Logic: `tests/unit/secret/secret-room-rework.test.ts` — 13/13 pass
**Code Review**: Complete — APPROVED WITH SUGGESTIONS (both suggestions applied before close)
