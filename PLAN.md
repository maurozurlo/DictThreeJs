# Dictator Simulator — Implementation Plan

A comprehensive set of gameplay, logic, and content improvements across the codebase.

---

## Resolved Questions

> [!NOTE]
> **Charisma formula:** Sum Power relation deltas (military/business/people only). Whichever outcome (accept/reject) has the higher total is "the charismatic choice". Choosing it → +1 charisma. Choosing the worse outcome → +0. Tie → no change. ✅ Confirmed.

> [!NOTE]
> **Tax corrosion / biased law proposals:** Pinned for a future iteration. Not included in this plan.

> [!NOTE]
> **Timer penalty:** If the player completes the **Meet** action (`actionTaken.taken === true`) before the timer expires, the idle penalty is cancelled for that round. If the timer runs out and no Meet action was taken, all three relations drop by the current round number, and charisma drops by 1. ✅ Confirmed.

> [!NOTE]
> **Daily events:** Draw at round start, store in state. Apply relation effect at **round end** alongside budget effects. Events should have real headline text (not just i18n keys). ✅ Confirmed.

> [!NOTE]
> **`selectedPower` reset on tab switch:** Keep the reset of `meet.selectedPower` to `'none'` inside `setActiveTab` — it correctly prevents stale selection when switching away from Meet. The fix is just to move it from `gameManagement` into the `meet` slice of the update. ✅ Confirmed.

> [!NOTE]
> **Clock display:** Shows 9:00 AM → 5:00 PM visually (mapped linearly to round timer progress), regardless of actual `TIME_LENGTH_MS` value. ✅ Confirmed.

---

## Proposed Changes

### A — Typo Fixes

#### [MODIFY] `src/Stores/BudgetHandler.ts`
- Rename `handelBudgetChange` → `handleBudgetChange` throughout.

#### [MODIFY] `src/Constants/GameState.ts`
- Rename `EXPROPIATE` → `EXPROPRIATE`, update the interface `Expropiate` → `Expropriate`.
- Fix `TIME_LENGHT_MS` → `TIME_LENGTH_MS`.

#### [MODIFY] All files referencing the above
- `Stores/GameState.ts`, `Stores/ActionHandler.ts`, `components/Tabs/Meet.tsx` — update all call sites.

---

### B — Law Budget Key Effects (issue #9)

Laws currently use keys like `security`, `health`, `infrastructure`, `education` as effect keys, but `handleDecision` only iterates over `Power` keys — silently dropping these.

#### [MODIFY] `src/Stores/EffectHandler.ts`
- In `handleDecision`, after applying Power relation changes, also apply `LawEffect` keys that are budget expenditure/tax keys (e.g. `security`, `health`, `infrastructure`, `education`, `businessTaxes`, `peopleTaxes`) by adjusting `budget.expenditures` or `budget.taxes` accordingly — clamped to the same min/max bounds.

---

### C — `selectedPower` Phantom Field (issue #4)

#### [MODIFY] `src/Stores/GameState.ts`
- In `setActiveTab`, the `selectedPower: 'none'` reset is correct in intent but is being applied under `gameManagement` in the state update instead of under `meet`. Move it into the `meet` slice of the same `set()` call: `meet: { ...state.meet, selectedPower: 'none' }`.

#### [MODIFY] `src/types/GameState.ts`
- No type change needed — the phantom field was only in the store update, not the type.

---

### D — Daily Events integrated into round (issue #1)

The `DailyEventHandler` is written but never called. Plan: draw one event at round start, store it in state, display its headline in the Newspaper, apply its relation effect at end-of-round.

#### [MODIFY] `src/types/DailyEvent.ts`
- Add a `headline` string field: the actual newspaper headline text shown to the player (e.g. `"Military officers demand better equipment"`). The `key` field remains for log references.

#### [MODIFY] `src/assets/dailyEvents.ts`
- Add `headline` to every event entry.

#### [MODIFY] `src/types/GameState.ts`
- Add `dailyEvent: { current: DailyEvent | null }` slice.

#### [MODIFY] `src/Stores/GameState.ts`
- Add `dailyEvent` to `INITIAL_STATE` (null).
- In `setPhase('start')` and `nextRound()`: draw a new event via `getRandomDailyEvent()`, store it.
- In `nextRound()`: apply the current event's `mod` to `relations[event.power]` at round end. Add it to the log.

#### [MODIFY] `src/components/Newspaper/Newspaper.tsx`
- Accept a `headline` prop (string).
- Display it in the center column as the main headline (replacing the static placeholder).
- Connect via `Log.tsx`: read `dailyEvent.current?.headline` from store.

---

### E — Round Timer / Clock (issues #5 & #6)

The clock currently shows `12:34` hardcoded. It needs to show a working time that maps 9:00 AM → 5:00 PM over the course of the round, regardless of actual `TIME_LENGTH_MS`. When the timer expires without a Meet action, relations and charisma are penalised.

#### [MODIFY] `src/Constants/GameState.ts`
- Fix typo: `TIME_LENGHT_MS` → `TIME_LENGTH_MS`.

#### [MODIFY] `src/types/GameState.ts`
- Add to `gameManagement`: `timerStartedAt: number | null`.

#### [MODIFY] `src/Stores/GameState.ts`
- On `setPhase('start')` and at each `nextRound()` success: set `timerStartedAt = Date.now()`.
- Add `expireTimer()` action: if `actionTaken.taken === false` (no Meet action this round), apply penalty — all three relations drop by `round` points, charisma drops by 1 — then call `nextRound()`. If Meet was taken, just call `nextRound()` directly.

#### [NEW] `src/Hooks/useRoundTimer.ts`
- `useEffect` + `setInterval` (1s) while `phase === 'start'` and `!dayEnded`.
- Computes `elapsed = Date.now() - timerStartedAt`, `progress = elapsed / TIME_LENGTH_MS` (0→1).
- When `progress >= 1`: calls `expireTimer()`.
- Returns `{ progress, displayTime }` where `displayTime` maps progress linearly to 9:00 AM–5:00 PM (e.g. `progress=0 → "9:00 AM"`, `progress=0.5 → "1:00 PM"`, `progress=1 → "5:00 PM"`).

#### [MODIFY] `src/components/ActionPanel/ActionPanel.tsx`
- Call `useRoundTimer()`, replace `12:34` with `displayTime`.

---

### F — Charisma Mechanics (issue #7)

#### [MODIFY] `src/Stores/EffectHandler.ts`
- In `handleDecision` for `type === 'law'`:
  - Compute `acceptScore` = sum of all Power deltas in `acceptEffect`.
  - Compute `rejectScore` = sum of all Power deltas in `rejectEffect`.
  - If `hasAccepted` and `acceptScore > rejectScore` → player chose the charismatic option → `adjustCharisma(+1)`.
  - If `!hasAccepted` and `rejectScore > acceptScore` → player correctly chose the better outcome → `adjustCharisma(+1)`.
  - If scores are equal, or the player chose the worse option → no change.
  - Call `adjustCharisma` from within `handleDecision` (needs `get`/`set` passed in, already available).

#### [MODIFY] `src/Stores/ActionHandler.ts`
- In `handleBribe`, `handleEliminate`, `handleDialogue`: factor in `charisma` to adjust outcome probabilities.
  - Charisma ≥ 5: reduce backlash chance in `handleEliminate` by half; increase `dialogue` success chance.
  - Charisma ≤ -5: increase backlash chance; reduce dialogue success.

---

### G — Tax Charisma Corrosion (issue #18)

#### [MODIFY] `src/Stores/GameState.ts` — `nextRound()`
- After calculating tax penalties on relations (already done for `peopleTaxes > 30` and `businessTaxes > 45`), also:
  - If `peopleTaxes > TAX_PENALTY_PEOPLE_THRESHOLD`: `adjustCharisma(-1)`.
  - If `businessTaxes > TAX_PENALTY_BUSINESS_THRESHOLD`: `adjustCharisma(-1)`.
- Bias law selection: if people taxes are high, pick the next law from the `people` power pool. If business taxes are high, pick from `business` pool. Otherwise random as usual.

#### [NEW] `src/Utils/Laws.ts`
- `getRandomUniqueItemForPower(laws, usedLaws, power)`: filters by `power`, then picks a random unique item.

---

### H — More Deals (issue #8)

#### [MODIFY] `src/assets/deals.ts`
- Add 10 new deals across military, business, and people categories with varied effects and risk mechanics. Total → 15 deals.

---

### I — Better Mini Challenges (issue #13)

The current 5 mini challenges are near-copies of deals.

#### [MODIFY] `src/assets/miniChallenges.ts`
- Replace all 5 existing entries with unique, thematically distinct scenarios (propaganda campaigns, civil unrest, assassination plots, festival sponsorships, journalist silencing, etc.).
- Ensure each has meaningfully different accept/reject trade-offs from deals.

---

### J — Daily Events Balance (issue #15)

#### [MODIFY] `src/assets/dailyEvents.ts`
- Add at least 5 more positive events covering military and business (e.g. trade agreement, military parade, business boom, tech breakthrough).
- Adjust chances to better balance positive/negative ratio.

---

### K — Save / Load (issue #11)

#### [NEW] `src/Utils/SaveLoad.ts`
- `exportSave(state: GameState): void` — strips all function properties from state, serializes to JSON, base64-encodes, triggers a browser file download with a `.dict` extension.
- `importSave(file: File): Promise<SerializableGameState>` — reads the uploaded `.dict` file, base64-decodes, JSON-parses, returns the data shape.

#### [MODIFY] `src/types/GameState.ts`
- Add `SerializableGameState` type: same as `GameState` but with all function fields stripped (data-only). Used for save/load safety.

#### [MODIFY] `src/Stores/GameState.ts`
- Add `saveGame()` action: calls `exportSave(get())`.
- Add `loadGame(data: SerializableGameState)` action: merges data into state, rehydrating function fields from `INITIAL_STATE`.

#### [MODIFY] `src/components/Tabs/Menu.tsx`
- Wire Save Game to `saveGame()` action.
- Wire Load Game to a hidden `<input type="file" accept=".dict">` trigger, calling `importSave` then `loadGame`.

---

### L — Detailed Activity Log (new)

Currently the log only stores terse financial summaries. Each round should produce a rich, dated log entry the player can read back. The date shown is `current real-world date − 70 years` to match the game's totalitarian aesthetic.

#### [NEW] `src/Utils/GameDate.ts`
- `getGameDate(round: number): string` — returns a formatted date string: takes today's real date, subtracts 70 years, then adds `(round - 1)` days. Format: `"Monday, November 24th, 1955"`.

#### [MODIFY] `src/types/GameState.ts`
- Change `log: string[][]` to `log: RoundLogEntry[]`.
- Add `RoundLogEntry` type:
  ```ts
  type RoundLogEntry = {
      date: string;      // formatted game date
      lines: string[];   // individual log lines, these should be prepared for i18n
  }
  ```

#### [MODIFY] `src/Stores/GameState.ts` — `nextRound()`
- Build a `lines: string[]` array for the round log entry. Include:
  - **Law**: `"Accepted Law: {label}"` / `"Rejected Law: {label}"` — only if decided.
  - **Deal**: `"Accepted deal"` / `"Declined deal"` with the deal text key — only if decided.
  - **Meet action**: `"Met with {power}: {action taken}"` — only if `actionTaken.taken`.
  - **Worked hours**: `"Worked from 9:00 AM to {displayTime}"` — using the timer progress at time of completion.
  - **Daily event**: `"{event.headline}"` — the newspaper headline for the day.
  - **Charisma change**: `"Charisma improving"` / `"Charisma dropping"` / `"Charisma stable"` — based on net charisma delta for the round.
  - **Financial summary**: `"Collected $Xm, Paid $Ym"` — already exists.
  - **Budget/relation warnings**: already exists.
  - **Timer expired warning**: `"An idle day — the people noticed your absence."` if penalty was triggered.
- Store `timerProgressAtCompletion` in state (set when `dayEnded` or `expireTimer` fires) so the log can reference the displayed clock time.

#### [MODIFY] `src/components/Tabs/Log.tsx`
- Update to consume `RoundLogEntry[]` instead of `string[][]`.
- Render each entry as a `<Card>` with the **date as the card heading** and lines below.
- The Newspaper component above the log should show the **current round's** daily event headline.

---

### M — README Update (issue #20)

#### [MODIFY] `README.md`
- Replace Vite boilerplate with actual project documentation: game concept, how to run, architecture overview (`Stores/`, `Features/`, `components/`, `assets/`), key systems summary.

---

## Verification Plan

### Automated Tests
- Run existing tests: `npm test` — ensure `ActionHandler.test.ts`, `BudgetHandler.test.ts`, `EffectHandler.test.ts` still pass after refactors.
- Add test for `handleBudgetChange` (renamed from `handelBudgetChange`).
- Add test for charisma scoring logic in `handleDecision`.
- Add test for `getRandomUniqueItemForPower`.

### Manual Verification
- **Law budget effects:** Approve a law with a `security` effect → verify expenditure value changes in budget.
- **Charisma:** Approve a law where rejecting would've scored higher → verify no charisma gain.
- **Timer:** Let round expire without taking a Meet action → verify all relations drop by round number.
- **Daily event:** Verify headline appears in Newspaper on Log tab each round.
- **Save/load:** Export save, refresh page, import → verify game state is fully restored.
- **Log:** Complete a round → verify log card shows date, law, deal, meet, and financial lines.
