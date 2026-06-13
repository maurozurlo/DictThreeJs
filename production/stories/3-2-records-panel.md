# Story 3-2: Records Panel on Menu Tab

## Header
- **Story ID**: 3-2
- **Sprint**: 3
- **Status**: In Progress
- **Type**: UI
- **Layer**: Feature
- **TR-ID**: TR-meta-001
- **Governing ADR**: docs/architecture/adr-0002-state-management-pattern.md
- **Manifest Version**: N/A (control manifest not yet created)
- **Estimate**: 1.0 days
- **Last Updated**: 2026-06-12

## Summary

Add a Records panel to the Menu tab that displays the player's best-ever tier
badge and a grid of all 14 ending slots (locked / unlocked). Reads directly from
`loadMeta()` — no store coupling. This panel is always visible on the Menu tab,
even before the first game.

Depends on story 3-1 (meta-progression data layer) being complete.

## Acceptance Criteria

- [ ] Records panel visible on Menu tab at all times (before and after game)
- [ ] Best tier badge: shows `—` when `highestTier` is null; otherwise shows the tier letter (S/A/B/C/D/F)
- [ ] All 14 ending slots rendered in a grid — no more, no less
- [ ] Locked slots display as `?` (ending not yet unlocked)
- [ ] Unlocked slots display the ending's human-readable name (i18n key)
- [ ] Panel re-reads `loadMeta()` on every Menu tab render (no stale data after a game)
- [ ] All label text uses i18n keys — no hardcoded English strings in JSX
- [ ] Panel renders correctly in EN locale — no raw keys visible
- [ ] Panel renders correctly in ES locale — no raw keys visible

## Ending ID Reference

| Slot | EndingId | EN Label |
|------|----------|----------|
| 1 | `military` | Overthrown by Military |
| 2 | `business` | Overthrown by Elite |
| 3 | `people` | Overthrown by People |
| 4 | `bankruptcy` | Ran out of money |
| 5 | `military_coup` | Coup — Military |
| 6 | `business_coup` | Coup — Elite |
| 7 | `people_coup` | Coup — People |
| 8 | `victory` | Survived 10 Rounds |
| 9 | `secret_room_0_good` | The Observatory — Good |
| 10 | `secret_room_0_bad` | The Observatory — Bad |
| 11 | `secret_room_1_good` | The Vault — Good |
| 12 | `secret_room_1_bad` | The Vault — Bad |
| 13 | `secret_room_2_good` | The Greenhouse — Bad |
| 14 | `secret_room_2_bad` | The Greenhouse — Bad |

> Secret room labels are placeholder names — polish writing in a later sprint.

## Implementation Notes

### Data source

Do NOT use the Zustand store. Call `loadMeta()` from `src/Utils/MetaProgress.ts`
directly inside the component. Use a local `useState` + `useEffect` to read on mount:

```tsx
const [meta, setMeta] = useState<MetaProgress>(loadMeta);
```

Re-reading on every render of the Menu tab ensures fresh data after a game ends
and the player returns to the menu. `loadMeta()` is cheap (one localStorage.getItem).

### Locale namespace

Add keys to the existing `menu` namespace (`public/locales/en/menu.json` and
`public/locales/es/menu.json`). Do NOT create a new namespace.

Suggested key structure:
```json
"records": {
  "title": "Records",
  "bestTier": "Best Tier",
  "noTier": "—",
  "endings": "Endings",
  "locked": "?",
  "ending_military": "Overthrown by Military",
  "ending_business": "Overthrown by Elite",
  "ending_people": "Overthrown by People",
  "ending_bankruptcy": "Ran out of money",
  "ending_military_coup": "Coup — Military",
  "ending_business_coup": "Coup — Elite",
  "ending_people_coup": "Coup — People",
  "ending_victory": "Survived 10 Rounds",
  "ending_secret_room_0_good": "The Observatory — Good",
  "ending_secret_room_0_bad": "The Observatory — Bad",
  "ending_secret_room_1_good": "The Vault — Good",
  "ending_secret_room_1_bad": "The Vault — Bad",
  "ending_secret_room_2_good": "The Greenhouse — Good",
  "ending_secret_room_2_bad": "The Greenhouse — Bad"
}
```

### Placement in Menu.tsx

Insert the Records panel after the `<hr />` and before the `menuButtons` div.
The panel should use `Tabs.module.css` classes (add new ones as needed) and
follow the same visual language as the settings panel: compact, readable, with
`var(--accent-color)` for labels.

### ADR-0002 guidance

`MetaProgress` lives outside the Zustand store by design (ADR-0002). Components
that display meta-progress data call `loadMeta()` directly — they do not
subscribe to the store. This is correct behavior, not a deviation.

### No new component file required

Implement the Records panel inline in `Menu.tsx` as a JSX section. Only extract
to a separate component file if it exceeds ~80 lines of JSX — keep it simple.

## Out of Scope

- Writing `MetaProgress` / calling `recordGameEnd` — handled in 3-4
- Any animation or transition on the Records panel
- Sorting or filtering the endings grid
- Clickable ending slots (details view)

## Files to Create / Modify

```
src/components/Tabs/Menu.tsx              — add Records panel section
src/components/Tabs/Tabs.module.css       — add records panel CSS classes
public/locales/en/menu.json              — add records.* keys
public/locales/es/menu.json              — add records.* keys (Spanish)
```

## QA Test Cases

**Story Type**: UI — manual walkthrough required
**Evidence file**: `production/qa/evidence/3-2-records-panel-evidence.md`

| # | Scenario | How to verify |
|---|----------|---------------|
| 1 | Records panel visible before first game | Open Menu tab on fresh localStorage — panel must appear |
| 2 | All 14 slots rendered | Count slots in the grid — must be exactly 14 |
| 3 | All slots locked on fresh localStorage | All 14 slots show `?` |
| 4 | Best tier shows `—` on fresh localStorage | Tier badge shows `—` |
| 5 | After a bankruptcy game: bankruptcy slot unlocked | Play to bankruptcy — return to Menu — `bankruptcy` slot shows name |
| 6 | Best tier updates after first game | Tier badge shows whatever tier the ending gave |
| 7 | Tier badge never downgrades | Win S tier → play again for F → S still shown |
| 8 | EN locale renders correctly | No raw i18n keys visible in English |
| 9 | ES locale renders correctly | Switch to Español — all records text in Spanish, no raw keys |

## Test Evidence

**Story Type**: UI
**Required evidence**: `production/qa/evidence/3-2-records-panel-evidence.md` — manual walkthrough sign-off
**Status**: [ ] Not yet created

## Dependencies

- Story 3-1 (Meta-Progression Data Layer) — **Complete** — provides `loadMeta()`, `MetaProgress` type, `EndingId` type
