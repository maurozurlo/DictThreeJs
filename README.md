# Dictator Simulator

A browser-based political strategy game. Survive 10 rounds as the head of a fictional authoritarian state by managing three rival power factions — the **Military**, the **Business** elite, and the **People** — while keeping the treasury solvent.

---

## How to run

```bash
npm install
npm run dev       # dev server at http://localhost:5173
npm test          # unit tests (Vitest)
npm run build     # production build
```

---

## Gameplay

Each round represents one working day. You must:

1. **Decide on a law** — accept or reject legislation that shifts faction relations and budget levers.
2. **Handle a deal** — accept or decline a proposal from a foreign or domestic actor.
3. **Take a Meet action** — interact with one faction (bribe, expropriate, dialogue, or eliminate).
4. **React to events** — periodic events lock the screen and demand a choice; mini-challenges appear randomly.

The day ends when all three actions are complete, or the round timer (5 minutes) expires. Letting the timer run out without a Meet action costs relations equal to the current round number and −1 charisma.

**Win**: survive 10 rounds without going bankrupt or losing a faction to −10 relations.

---

## Key systems

| System | Description |
|--------|-------------|
| **Relations** | Three factions track −10 → +10 trust. Hitting −10 ends the game. |
| **Budget** | Collect income from taxes; pay for four expenditure departments. Spending level affects faction relations each round. |
| **Charisma** | −10 → +10. Improved by choosing the charismatic law option (+1). Degraded by eliminations (−2), high taxes (−1/round), and idle rounds (−1). High charisma improves dialogue outcomes; low charisma raises eliminate backlash. |
| **Daily events** | One event per round applies a small relation modifier and produces a newspaper headline. |
| **Periodic events** | Scripted events at fixed rounds that lock the screen and offer two choices with lasting consequences. |
| **Mini-challenges** | Random 40%-chance events each round with political scenarios distinct from the deal pool. |
| **Round timer** | Displayed as a 9 AM → 5 PM clock. Expiry triggers idle penalties. |
| **Save / Load** | Export the current game state to a `.dict` file from the main menu; load it back to resume. |

---

## Architecture

```
src/
  assets/          — Static game data (laws, deals, dailyEvents, miniChallenges, periodicEvents)
  components/      — React UI components (ActionPanel, Tabs, Newspaper, etc.)
  Constants/       — Numeric constants and tuning values (GameState.ts, Budget.ts, Power.ts)
  Hooks/           — Custom hooks (useRoundTimer)
  Stores/          — Zustand store slices (GameState, ActionHandler, EffectHandler, BudgetHandler)
  types/           — TypeScript types for all domain objects
  Utils/           — Pure utility functions (Math, UI, GameDate, Laws, SaveLoad)
public/
  locales/en/      — English i18n strings
  locales/es/      — Spanish i18n strings
```

The entire game state lives in a single Zustand store (`src/Stores/GameState.ts`) initialised via `INITIAL_STATE`. All side-effecting logic (relation changes, budget effects, action outcomes) lives in dedicated handler modules imported by the store, keeping the store file itself as a wiring layer.
