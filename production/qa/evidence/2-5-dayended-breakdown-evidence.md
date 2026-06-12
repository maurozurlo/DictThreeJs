# Test Evidence — Story 2-5: DayEnded Breakdown (Recurring + One-Time Rows)

**Story**: production/stories/2-5-dayended-breakdown.md
**Type**: UI — manual walkthrough
**Build**: local dev
**Date**: 2026-06-12
**Tip**: enable debug mode — the DebugRecurringOverlay shows `last round +X / −Y` to cross-check the modal values; `M`/`L` adjust treasury, `O` swaps the offered law.

## Walkthrough Results

### AC-1: Legislation Income row appears
- Setup: Accept Legalize Gambling (law 39, +25/round); advance round
- Expected: green "Legislation income:" row showing +25
- Result: [ ] PASS / [ ] FAIL — notes:

### AC-2: Legislation Costs row appears
- Setup: Accept Free Housing Program (law 40, −15/round); advance round
- Expected: red "Legislation costs:" row showing −15
- Result: [ ] PASS / [ ] FAIL — notes:

### AC-3: Rows absent from DOM at zero
- Setup: New game, no recurring effects; advance round; inspect modal DOM
- Expected: no "Legislation income"/"Legislation costs" elements exist (not merely hidden)
- Result: [ ] PASS / [ ] FAIL — notes:

### AC-4: Net accuracy
- Setup: Note treasury before advancing; compare net row vs (treasury_after − treasury_before)
- Expected: exact match
- Result: [ ] PASS / [ ] FAIL — notes:

### AC-5: Display order
- Setup: Both recurring income and expense active; open DayEnded
- Expected: Tax income → Budget expenses → Legislation income → Legislation costs → (Bonus income/Extra expenses if any) → Net
- Result: [ ] PASS / [ ] FAIL — notes:

### i18n spot check
- Switch to ES: rows show "Ingresos legislativos:" / "Costos legislativos:"
- Result: [ ] PASS / [ ] FAIL — notes:

## Sign-off

| Role | Name | Date | Approval |
|------|------|------|----------|
| Developer | Mauro | | [ ] Approved |
