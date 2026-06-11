# Story 2-10: Balance Pass — Full Playthrough with Lasting Effects

## Header
- **Story ID**: 2-10
- **Sprint**: 2
- **Status**: Ready
- **Type**: Config/Data
- **Layer**: Feature
- **TR-ID**: TR-lasting-010
- **Governing ADR**: N/A — balance verification, no architectural pattern required
- **Manifest Version**: N/A (control manifest not yet created)
- **Estimate**: 0.5 days
- **Last Updated**: 2026-06-11

## Summary

Play 2–3 full 10-round games with Sprint 2 features active and verify:
1. Lasting income laws do not re-trivialize the treasury (balance guard from the Sprint 2 PRD risk register)
2. The coup mechanic is reachable through aggressive play but avoidable
3. The Budget tab forecast correctly reflects active effects
4. Repeal is a meaningful strategic decision, not obviously always correct or always wrong

Document findings in a balance notes file. Tune values in asset files if needed.
No code logic changes — only data tuning is in scope.

## Acceptance Criteria

- [ ] At least 2 full playthroughs completed and documented
- [ ] No playthrough trivializes the treasury by stacking income laws (verify pool weighting cap worked)
- [ ] At least 1 playthrough reaches a coup warning (yellow or red)
- [ ] Budget tab forecast "rounds left" matches actual bankruptcy round in at least 1 playthrough
- [ ] Repeal cost feels meaningful (player had to consider the treasury cost, not dismiss it)
- [ ] Balance notes written at `production/qa/balance-pass-sprint2.md`
- [ ] Any tuning changes (income/expense amounts, repeal costs) noted with before/after values and rationale

## Implementation Notes

### Playthroughs to run

**Playthrough 1 — Aggressive income stacking:**
- Accept every income law offered; use Legalize Gambling (L-A, +25/round) and at least two other income laws
- Track treasury per round; verify the cap at 3 income laws fired
- Goal: verify treasury doesn't become trivial (>500 after round 5 while spending freely is a warning sign)

**Playthrough 2 — Expense law stress test:**
- Accept Free Housing Program (L-B, −15/round), Military Contractor Deal (L-C, −15/round), and Public Works Program (L-F, −25/round)
- Track bankruptcy round; verify forecast matched actual
- Use repeal on one; note the treasury + relation cost felt appropriate
- Goal: verify high-expense stack is punishing but recoverable via repeal

**Playthrough 3 — Coup route (optional if time permits):**
- Aggressively eliminate / expropriate one faction to push charisma ≤ −3
- Simultaneously bribe that faction to push relation ≥ +6
- Note which round the yellow warning appeared; verify red warning timing; record if grace roll fired
- Goal: verify warnings are visible enough (< 30% "didn't see it coming" tolerance)

### Tuning reference

Tunable values are in asset files and constants:
- Law/deal amounts: `src/assets/laws.ts`, `src/assets/deals.ts` — change `recurringEffect.incomeBonus/expenseBonus`
- Repeal costs: `src/Constants/GameState.ts` → `GAMESTATE.REPEAL_COST`
- Coup thresholds: `GAMESTATE.COUP`

Tier boundaries (±8 Small, ±15 Medium, ±25 Large) are the PRD baselines.
The balance pass may adjust individual entries but should not change tier definitions.

### Balance notes template

```markdown
# Balance Pass — Sprint 2 (YYYY-MM-DD)

## Playthrough 1: Income Stacking
- Laws accepted: ...
- Round-by-round treasury: ...
- Cap fired at round X: ...
- Assessment: ...

## Playthrough 2: Expense Stress + Repeal
- Laws accepted: ...
- Forecast vs actual bankruptcy: ...
- Repeal used: which law, which round, cost felt: ...
- Assessment: ...

## Playthrough 3: Coup Route (if run)
- Faction targeted: ...
- Warning round: ...
- Grace roll result: ...
- Assessment: ...

## Tuning Changes Made
| Value | Before | After | Rationale |
|-------|--------|-------|-----------|
```

## Out of Scope

- Code logic changes — only `src/assets/` and `src/Constants/GameState.ts` data values
- Formal A/B testing
- Economy advisor balance (future sprint)

## QA Test Cases

*Story Type: Config/Data — smoke check is the required evidence.*

Smoke check documented in balance notes file.

Pass conditions:
- Treasury does not exceed ~400 by round 5 in the income-stacking playthrough
- Forecast within ±1 round of actual bankruptcy in the expense playthrough
- Coup warning appears before the coup fires in the coup playthrough
- No crashes, no undefined renders during any playthrough

## Test Evidence

**Story Type**: Config/Data
**Required evidence**: `production/qa/balance-pass-sprint2.md` — balance notes documenting at least 2 playthroughs with treasury data.

**Status**: [ ] Not yet created

## Dependencies

- Depends on: Stories 2-1 through 2-8 must be DONE (all features needed for a complete playthrough)
- Unlocks: Sprint 3 planning with confidence in the economic baseline
