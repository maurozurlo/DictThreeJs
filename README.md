# Dictator Simulator

A browser-based political survival game. You are the new dictator. Keep the military loyal, the businesses productive, and the people from revolting — long enough to stay in power.

---

## Gameplay

Each round you manage a fragile balance of three factions:

- **People** — your tax base and legitimacy. Let happiness collapse and they protest, steal, or leave.
- **Military** — your grip on power. Let their loyalty slip and a coup becomes possible.
- **Business** — your revenue engine. Under-invest and income dries up.

You govern by passing laws, signing deals, and tuning infrastructure, health, education, and security spending. Every decision has costs, side effects, and delayed consequences. There is no winning position — only the next round.

The street below your office is populated by 25 citizens, each representing a slice of the population. Watch them go to work, turn to crime, or protest in real time as your policies take effect.

---

## Tech Stack

| | |
|---|---|
| Framework | React 19 + TypeScript (strict) |
| 3D Rendering | Three.js via `@react-three/fiber` + `@react-three/drei` |
| State | Zustand (Handler pattern) |
| Build | Vite |
| Tests | Vitest + React Testing Library |
| i18n | i18next (EN + ES) |

Runs entirely in the browser — no server required. Compatible with GitHub Pages.

---

## Development

```bash
npm install
npm run dev       # dev server at localhost:5173
npm run build     # production build → dist/
npx vitest run    # run tests
```

---

## Project Structure

```
src/               Game source (components, stores, handlers, constants, utils)
design/            Game design documents (GDDs, balance, notes, requirements)
docs/              Architecture decisions (ADRs) and technical docs
tests/             Unit and integration tests
assets/            Game data (laws, deals, events, entity definitions)
prototypes/        Throwaway HTML/JS spikes
production/        Sprint tracking, session state, QA evidence
tools/             One-off scripts (balance calculator, sheet utilities)
```

---

## License

MIT
