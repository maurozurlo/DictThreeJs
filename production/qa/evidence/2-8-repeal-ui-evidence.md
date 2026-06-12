# QA Evidence: Story 2-8 — Repeal UI (Active Legislation in Log)

**Date**: 2026-06-12
**Verified by**: PENDING — user walkthrough required
**Status**: PENDING SIGN-OFF (implemented autonomously while user away; logic paths covered by `src/Stores/repeal.test.ts`, visual walkthrough outstanding)

## Manual Walkthrough Steps (AC-1 through AC-5)

Run `npm run dev`, start a new game, then:

- [ ] **AC-1 — Section appears**: In Laws tab accept "Legalize Gambling" (L-A). Open Log tab. Verify "Active Legislation" section is visible with a card showing the law name, "Active since round N", "+25m/round" in green, and a Repeal button.
- [ ] **AC-2 — Inline confirm flow**: Click Repeal. Verify the card expands inline (no modal) showing "Cost: 40 treasury + −3 Business relation" with Confirm/Cancel. Click Cancel → collapses with no effect. Click Repeal → Confirm → card disappears.
- [ ] **AC-3 — 1-per-round enforcement**: With two active laws, repeal one. Verify the other law's Repeal button is disabled with tooltip "Already repealed a law this round". Advance the round. Verify the button re-enables.
- [ ] **AC-4 — Disabled when broke**: Lower treasury below the tier cost (debug keys). Verify Repeal is disabled with tooltip "Insufficient funds to repeal".
- [ ] **AC-5 — Values update**: Note treasury and the source faction's relation. Confirm a repeal. Verify treasury dropped by the tier cost, relation dropped by the tier penalty, and the effect no longer appears in the next DayEnded breakdown.
- [ ] **ES locale**: Switch language to Spanish; verify section title "Legislación Activa" and all repeal strings render translated.

## Automated Coverage (already passing)

`src/Stores/repeal.test.ts` — 14 tests: successful repeal (treasury/relation/removal/flag), 1-per-round guard, insufficient funds no-op, unknown sourceId no-op, bankruptcy at treasury == cost (phase 'lose'), correct faction targeting, relation clamp at −10, flag reset via nextRound(), and getRepealTier boundaries (8/9/15/16, expense-driven, zero).

## Sign-off

| Role | Name | Date | Approval |
|------|------|------|----------|
| Developer/Owner | Mauro | | [ ] Approved |
