---
name: project_dictator-simulator
description: Core mechanics, data model patterns, and established implementation conventions for Dictator Simulator
metadata:
  type: project
---

10-round browser political sim. React 19 / TypeScript / Three.js / Zustand. Single Zustand store at `src/Stores/GameState.ts`.

Key economics: income ~132/round at defaults (peopleTaxes=30, businessTaxes=40), expenses=200 at defaults (sliders all 5 × 10). Net −68/round from 500 treasury. Players must cut budget to survive.

State shape: `gameManagement.currentRoundExtraIncome` / `currentRoundExtraExpenses` accumulate within-round one-time effects (deals, events, challenges). Reset to 0 at nextRound(). DayEnded modal already reads these fields.

Law type at `src/types/Law.ts`: `{ id, power, acceptEffect: LawEffect, rejectEffect: LawEffect }`. LawEffect = Partial<Record<Power | 'treasury' | 'risk' | Taxes | Expenditures, number>>. No recurring-effect fields yet.

Deal type at `src/types/Deal.ts`: `{ id, text, acceptText, rejectText, acceptEffect: DealEffect, rejectEffect: DealEffect, riskText? }`. DealEffect = Partial<Record<Power | 'treasury' | 'risk', number>>. No recurring-effect fields yet.

Log tab (`src/components/Tabs/Log.tsx`) shows: mini challenges, newspaper headline, periodic events, and log history cards (reverse chronological). No law management UI yet.

Education ≤2 already breaks dialogue (always fails) AND garbles law/deal/challenge text via `dumbifyText()` — this is IMMEDIATE, not delayed.

Special ending: relation ≥ +10 at round 9 → faction-specific narrative at round 10. Charisma gates good vs bad outcome. These must not conflict with coup mechanic (coup triggers on HIGH relation + LOW charisma).

**Why:** Reference for sprint design decisions — avoids proposing things already implemented or contradicting existing patterns.
**How to apply:** Cross-check any new data fields against Law/Deal types and GameState before specifying them.
