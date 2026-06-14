# Story 5-12: Economy Advisor — UI & Selection Logic

## Header
- **Story ID**: 5-12
- **Sprint**: 5
- **Status**: Ready
- **Type**: UI
- **Layer**: Feature
- **TR-ID**: TR-advisor-003
- **Governing ADR**: docs/architecture/adr-0002-state-management-pattern.md
- **Manifest Version**: N/A
- **Estimate**: 1.0 days
- **Last Updated**: 2026-06-14

## Summary

Adds the `(i)` advisor button and modal to four panels (Laws, Deals, Budget,
DayEnded). Implements the line-selection logic: determines category, verdict,
and any applicable override trigger, then picks a random matching line from
`ADVISOR_LINES` at the player's current `advisorLevel`.

**Accuracy by level is faked via line content, not probability.** Level-0 lines
are written to be wrong; level-3 lines are written to be right. No random
coin-flip in code — the text itself carries the accuracy illusion. This keeps
the system deterministic and testable.

### Selection algorithm

```
1. Determine category from context (which panel opened the modal)
2. Determine verdict:
   - Laws/Deals: based on net treasury + relation effect of the item
     (positive net → 'approve', negative net → 'reject')
   - Budget: scan expenditures for any < LOW threshold → 'warn', else 'ok'
   - DayEnded: coup warning active OR treasury < 100 → 'warn', else 'ok'
3. Check for override triggers (ordered priority, first match wins):
   - Coup warning visible → use override key 'coup_warning'
   - Any expenditure < LOW → use override key 'budget_low_{expenditure}'
   - Law/deal has recurringEffect → use override key 'recurring_{income|expense}'
   - Treasury < 100 → use override key 'treasury_low'
   - Treasury > 500 → use override key 'treasury_high'
4. Filter ADVISOR_LINES by { category, verdict, level } (+ override key if matched)
5. Pick one at random from the filtered set
```

Level 0 always uses category/verdict/level filter only (no overrides — the
level-0 advisor doesn't know about special cases).

### UI spec

- Small `(i)` button, rendered inline near the panel header or action row
- Opens a modal/tooltip overlay (not full-screen): dark card, ≤2 lines of text,
  a small "×" close button, advisor name by level:
  - Level 0: "Your Nephew (Economics Dropout)"
  - Level 1: "Junior Analyst"
  - Level 2: "Senior Analyst"
  - Level 3: "Chief Economic Advisor"
- Modal is dismissible by clicking `×` or clicking outside it
- Only one modal open at a time; opening a new one closes the previous

## Acceptance Criteria

- [ ] `(i)` button visible on Laws tab when a law is present
- [ ] `(i)` button visible on Deals tab when a deal is present
- [ ] `(i)` button visible on Budget tab at all times during a round
- [ ] `(i)` button visible on DayEnded panel
- [ ] Clicking `(i)` opens the advisor modal with one line of dialogue
- [ ] Modal header shows the advisor name appropriate to current `advisorLevel`
- [ ] Modal can be closed with `×` or clicking the backdrop
- [ ] Line selected matches `(category × verdict × level)` of the current context
- [ ] Override triggers fire correctly: coup warning → override line; normal state → generic line
- [ ] Level-0 advisor gives inverted advice (verifiable by reading the level-0 lines)
- [ ] No crash when `ADVISOR_LINES` filter returns empty (fallback: show "No advice available.")
- [ ] Button and modal do not appear in `phase !== 'start'` (idle/end-game screens)

## Out of Scope

- Advisor dialogue for the Meet tab (future)
- Advisor dialogue for the Street View tab (deferred)
- Any visual polish / animations on the modal (Polish sprint)
- Audio for the advisor (Audio sprint)

## Files to Create / Modify

```
src/components/Advisor/AdvisorButton.tsx        — (i) button component
src/components/Advisor/AdvisorButton.module.css — button styles
src/components/Advisor/AdvisorModal.tsx         — modal overlay component
src/components/Advisor/AdvisorModal.module.css  — modal styles
src/Utils/Advisor.ts                            — getAdvisorLine(context, advisorLevel, law?) → string
src/components/Tabs/Laws.tsx                    — add AdvisorButton
src/components/Tabs/Deals.tsx                   — add AdvisorButton
src/components/Tabs/Budget.tsx (or ActionPanel) — add AdvisorButton
src/components/ActionPanel/DayEnded.tsx         — add AdvisorButton (or equivalent DayEnded location)
```

## QA Test Cases

**Story Type**: UI — manual walkthrough required; unit test for selection logic

| # | Scenario | How to verify |
|---|----------|---------------|
| 1 | Button appears | Laws tab with a law present → `(i)` visible |
| 2 | Button absent | Laws tab with no law → no `(i)` |
| 3 | Modal opens | Click `(i)` on Laws → modal appears with text |
| 4 | Correct advisor name | At level 0 → "Your Nephew (Economics Dropout)" in modal header |
| 5 | Level 3 name | At level 3 → "Chief Economic Advisor" |
| 6 | Close by × | Click × → modal dismissed |
| 7 | Close by backdrop | Click outside modal → modal dismissed |
| 8 | Budget warns | All expenditures at LOW-1 → `(i)` on Budget → modal gives warning line |
| 9 | Coup override | Coup warning active → DayEnded `(i)` → coup-specific override line |
| 10 | No regression | Existing Laws, Deals, Budget panels function normally with button added |

**Unit test** — `tests/unit/advisor/advisor_selection.test.ts`:
- `getAdvisorLine({ category: 'law', verdict: 'approve', level: 3 })` returns a string
- Override trigger active → returns override-keyed line
- Empty filter set → returns fallback string

## Test Evidence

**Story Type**: UI
**Required evidence**: `production/qa/evidence/5-12-advisor-ui-evidence.md` — ADVISORY
**Unit test**: `tests/unit/advisor/advisor_selection.test.ts` — BLOCKING

## Dependencies

- Story 5-10 (Advisor State + Shop) — `advisorLevel` must be in store
- Story 5-11 (Adviser Dialogue Content) — `ADVISOR_LINES` and i18n keys must exist
