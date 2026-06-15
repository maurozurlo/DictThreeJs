# Story 5-10: Economy Advisor — State & Shop Integration

## Header
- **Story ID**: 5-10
- **Sprint**: 5
- **Status**: Complete
- **Type**: Logic
- **Layer**: Feature
- **TR-ID**: TR-advisor-001
- **Governing ADR**: docs/architecture/adr-0002-state-management-pattern.md
- **Manifest Version**: N/A
- **Estimate**: 0.5 days
- **Last Updated**: 2026-06-14

## Summary

Adds `advisorLevel: 0 | 1 | 2 | 3` to the shop slice of state. Level 0 is the
default (free, always included). Levels 1–3 are purchaseable one-time upgrades
in the Shop ($100M / $150M / $200M). The level is permanent for the run —
it cannot be downgraded. Save/load and new-game reset are handled.

This story is purely state + shop cards. No advisor UI or dialogue content
(those are 5-11 and 5-12).

## Acceptance Criteria

- [ ] `advisorLevel` initialises to `0` on new game
- [ ] Shop shows three advisor upgrade cards: "Hire Junior Analyst" ($100M → level 1), "Hire Senior Analyst" ($150M → level 2), "Hire Chief Advisor" ($200M → level 3)
- [ ] Each card is only visible when `advisorLevel < target level` (buying level 2 hides the level-1 card permanently)
- [ ] Buying a card deducts cost from treasury and sets `advisorLevel` to the card's level; no downgrade possible
- [ ] Cards are disabled when `!canBuy` (day ended) or `treasury < cost`
- [ ] `advisorLevel` persists through save/load; old saves default to `0`
- [ ] `advisorLevel` resets to `0` on `setPhase('start')`

## Out of Scope

- Advisor button, modal, or any visible advice UI (story 5-12)
- Dialogue content / i18n strings (story 5-11)
- Any gameplay effect beyond storing the level

## Files to Create / Modify

```
src/types/GameState.ts          — add advisorLevel to shop type
src/Stores/GameState.ts         — initial state, setPhase reset, buy() cases, loadGame fallback
src/components/Tabs/Shop.tsx    — three new advisor upgrade cards
public/locales/en/shop.json     — advisor card name/description strings
public/locales/es/shop.json     — ES translations
```

## QA Test Cases

**Story Type**: Logic — automated unit test required

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Initial state | `advisorLevel === 0` after `setPhase('start')` |
| 2 | Buy level 1 | Treasury decreases by 100, `advisorLevel === 1` |
| 3 | Cannot skip levels | Buying level-2 card when at level 0 sets level to 2 (cards represent target level, not +1) |
| 4 | Already at level → card hidden | At level 1, level-1 card no longer rendered |
| 5 | Insufficient treasury | Buy disabled when `treasury < cost` |
| 6 | Load old save | `advisorLevel` defaults to `0` when field absent in saved data |
| 7 | New game reset | `advisorLevel === 0` after starting a new game |

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/shop/advisor_state.test.ts` — BLOCKING

## Dependencies

- None (self-contained shop extension)
