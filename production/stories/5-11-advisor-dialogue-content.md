# Story 5-11: Economy Advisor — Dialogue Content

## Header
- **Story ID**: 5-11
- **Sprint**: 5
- **Status**: Ready
- **Type**: Config/Data
- **Layer**: Feature
- **TR-ID**: TR-advisor-002
- **Governing ADR**: docs/architecture/adr-0002-state-management-pattern.md
- **Manifest Version**: N/A
- **Estimate**: 1.0 days
- **Last Updated**: 2026-06-14

## Summary

Writes all advisor dialogue as i18n content and a typed data asset. No logic or
UI — pure content. The data structure is consumed by the advisor logic in 5-12.

Lines are keyed to `(category × verdict × level)`:
- **category**: `'law' | 'deal' | 'budget' | 'dayended'`
- **verdict**: `'approve' | 'reject'` (for law/deal), `'warn' | 'ok'` (for budget/dayended)
- **level**: `0 | 1 | 2 | 3`

Each combination gets **3 generic template lines** (picked at random) so the
advisor doesn't feel repetitive. Additionally, **hand-written override lines**
exist for the ~10 highest-impact decisions (see below), 4 variants each at
every level.

### Level tone guide

| Level | Tone |
|-------|------|
| 0 | Confidently wrong — inverted advice, bullish on bad ideas |
| 1 | Uncertain and wishy-washy ("This might help… or not.") |
| 2 | Hedged but honest ("Probably a good call, but watch relations.") |
| 3 | Correct, specific, slightly pompous ("Per my analysis, the numbers support approval.") |

### Hand-written overrides (highest-impact decisions)

These law/deal IDs get custom lines (level 0 must be wrong; level 3 must cite real numbers):

| Trigger | Category |
|---------|----------|
| Coup warning visible | `dayended`, verdict `warn` |
| Any law with recurring income effect | `law` |
| Any law with recurring expense effect | `law` |
| Tax penalty threshold crossed | `budget`, verdict `warn` |
| Health expenditure < LOW (3) | `budget`, verdict `warn` |
| Security expenditure < LOW (3) | `budget`, verdict `warn` |
| Military expenditure < LOW (3) | `budget`, verdict `warn` |
| Infrastructure expenditure < LOW (3) | `budget`, verdict `warn` |
| Treasury < 100M | `dayended`, verdict `warn` |
| Treasury > 500M | `dayended`, verdict `ok` |

## Acceptance Criteria

- [ ] `src/assets/advisorDialogue.ts` exports `ADVISOR_LINES`: typed array of `AdvisorLine` objects
- [ ] `AdvisorLine` type: `{ category: Category, verdict: Verdict, level: 0|1|2|3, key: string }`
  where `key` is the i18n key in the `advisor` namespace
- [ ] Every `(category × verdict × level)` combination has at least 3 lines in the array
- [ ] All 10 hand-written override triggers have 4 variants per level (keys prefixed `advisor.override.*`)
- [ ] `public/locales/en/advisor.json` contains all keys — no missing keys
- [ ] `public/locales/es/advisor.json` contains all keys — no missing keys
- [ ] Level-0 generic lines are factually incorrect advice (tone: confident, wrong direction)
- [ ] Level-3 generic lines give directionally correct advice in a pompous tone
- [ ] Override lines at level 0 are wrong; at level 3 they cite the mechanic specifically
  (e.g. "Coup threshold is 8 — military is at 7, you are fine." when they are NOT fine)

## Out of Scope

- Any logic that selects which line to show (story 5-12)
- Any UI (story 5-12)
- Dialogue for the Street View tab (deferred)

## Files to Create / Modify

```
src/assets/advisorDialogue.ts           — typed line data (keys only, no raw strings)
src/types/Advisor.ts                    — AdvisorLine type, Category, Verdict types
public/locales/en/advisor.json          — all EN strings
public/locales/es/advisor.json          — all ES strings
```

## QA Test Cases

**Story Type**: Config/Data — smoke check (no automated test required)

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Coverage check | Every `(category × verdict × level)` combination has ≥ 3 entries in `ADVISOR_LINES` |
| 2 | No missing i18n keys | All `key` values in `ADVISOR_LINES` resolve to a non-empty string in EN locale |
| 3 | Level 0 wrong | Read 5 level-0 lines — all give incorrect advice direction |
| 4 | Level 3 quality | Read 5 level-3 lines — all give correct, specific advice |

## Test Evidence

**Story Type**: Config/Data
**Required evidence**: smoke check pass — ADVISORY

## Dependencies

- Story 5-10 (Advisor State) — must be done first so the level type is established
