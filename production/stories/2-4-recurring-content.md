# Story 2-4: Content — 9 Recurring-Effect Laws/Deals + i18n EN/ES

## Header
- **Story ID**: 2-4
- **Sprint**: 2
- **Status**: Ready
- **Type**: Config/Data
- **Layer**: Feature
- **TR-ID**: TR-lasting-004
- **Governing ADR**: N/A — data content, no architectural pattern required
- **Manifest Version**: N/A (control manifest not yet created)
- **Estimate**: 1.0 day
- **Last Updated**: 2026-06-11

## Summary

Add `recurringEffect` to 9 existing or new law/deal entries in the asset files,
implement pool-weighting so at most 3 lasting-income laws can appear per run,
and write EN + ES i18n strings for all recurring labels and law/deal names.

The 9 entries are fully specified in `design/gdd/lasting-effects-prd.md` Feature 1
Content section. Values are tier-snapped baselines; tune in the asset files, never
hardcode in logic.

## Acceptance Criteria

- [ ] All 9 specified entries (L-A through L-F laws, D-A through D-C deals) exist in the asset files with correct `recurringEffect` amounts matching the PRD tiers (±8 Small, ±15 Medium, ±25 Large)
- [ ] One-time effects (relation deltas, treasury on-accept) also match the PRD table
- [ ] Income laws L-A, L-D, L-E carry `opposingRelationPenalty: -2` (not the default −1) as specified in the no-cap mitigation
- [ ] Pool weighting: `getAvailableLaws()` (or equivalent sampling function) limits lasting-income laws to max 3 per run — if 3 are already active or have been accepted, remaining income laws are excluded from the pool
- [ ] `recurringEffect.label` for each entry is an i18n key (e.g. `'laws.recurring.gambling_income'`)
- [ ] EN locale file has translations for all 9 `recurringEffect.label` keys and law/deal names
- [ ] ES locale file has translations for all 9 keys
- [ ] All selectable in-game (no entry crashes or renders undefined)

## Implementation Notes

### Asset file locations

- Laws: `src/assets/laws.ts` (or wherever the law objects are defined)
- Deals: `src/assets/deals.ts`

### The 9 entries (from PRD)

| ID | Type | Name | Faction | One-time | Recurring |
|----|------|------|---------|----------|-----------|
| L-A | Law | Legalize Gambling | Business | business +1, people −2 | +25/round |
| L-B | Law | Free Housing Program | People | people +2, treasury −30 | −15/round |
| L-C | Law | Military Contractor Deal | Military | military +1, treasury −20 | −15/round |
| L-D | Law | State Media Monopoly | Military | military +1, people −2 | +15/round |
| L-E | Law | Export Tariff Reform | Business | business +1, people −2 | +15/round |
| L-F | Law | Public Works Program | People | people +1, business +1, treasury −30 | −25/round |
| D-A | Deal | Foreign Investment Contract | Business | treasury +40, business +1 | +15/round |
| D-B | Deal | Arms Supplier Contract | Military | military +2, treasury −30 | −15/round |
| D-C | Deal | Humanitarian Aid | People | people +2, business −1 | −8/round |

### No-cap mitigation — opposing relation penalty

For L-A, L-D, L-E (lasting income laws): set the opposing faction's relation
penalty to −2 rather than the default −1. In practice, this means:
- L-A (Business): `people` relation on accept = −2 (not −1)
- L-D (Military): `people` relation on accept = −2
- L-E (Business): `people` relation on accept = −2

### Pool weighting — max 3 lasting-income laws per run

In the law pool sampling logic, count how many `incomeBonus > 0` recurring laws
are in `activeRecurringEffects`. If ≥ 3, filter out any candidate laws where
`recurringEffect?.incomeBonus > 0`. This runs at pool-generation time, not at
render time.

### i18n key convention

Use nested keys under `laws.recurring.*` and `deals.recurring.*`:
```json
{
  "laws": {
    "recurring": {
      "gambling_income": "Casino Revenue",
      "housing_cost": "Housing Maintenance",
      ...
    }
  }
}
```

Alternatively follow the existing key convention in the project (check existing
law/deal i18n keys for the pattern). Be consistent.

### i18n files to update

- `public/locales/en/laws.json` (or whichever namespace laws use)
- `public/locales/es/laws.json`
- `public/locales/en/deals.json`
- `public/locales/es/deals.json`

## Out of Scope

- **Story 2-3**: The activation logic in `actUponLaw`/`actUponDeal`
- **Story 2-5**: The DayEnded display of recurring rows
- **Story 2-8**: The repeal UI

## QA Test Cases

*Story Type: Config/Data — smoke check is the required evidence.*

Manual smoke check during playtest:
1. Start a new game and advance to the Laws tab
2. Verify Legalize Gambling appears and shows the correct name/description
3. Accept it; advance a round; confirm treasury increased by 25
4. Check DayEnded (story 2-5 required) shows "Casino Revenue" row — or check
   `activeRecurringEffects[0].label` in the console
5. Repeat for at least one expense law (e.g. Free Housing Program) and one deal (Foreign Investment Contract)
6. With 3 income laws active, verify no 4th income law appears in the pool

## Test Evidence

**Story Type**: Config/Data
**Required evidence**: Smoke check pass — document in `production/qa/smoke-2026-06-XX.md` confirming all 9 entries are selectable and show correct effects.

**Status**: [ ] Not yet created

## Dependencies

- Depends on: Story 2-1 must be DONE (`recurringEffect` type exists on Law/Deal)
- Unlocks: Story 2-8 (repeal UI needs real law entries to work with)
