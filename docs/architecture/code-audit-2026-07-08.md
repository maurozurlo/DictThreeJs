# Code Audit & Simplification Plan — 2026-07-08

**Scope**: complexity reduction, dead code, superseded logic, single-responsibility,
ADR compliance. Requested after Sprint 9 with the observation that the game is
"supposed to be fairly simple" but the code has grown convoluted.

**Method**: full read of `src/Stores/GameState.ts` and `RoundResolver.ts`, knip scan
(unused files/exports/types), targeted greps for every forbidden pattern in
`.claude/docs/technical-preferences.md`, spot-reads of the components most likely to
hide game logic, ADR status review.

**Agreed ground rules** (user decisions, 2026-07-08):

- Gameplay behavior is preserved; **save-file compatibility may break**.
- Remove **only truly dead code** — live features stay even if vestigial.
- ADR conflicts are arbitrated **case by case** (code may win over the ADR).
- Executed as an audit-reviewed cleanup sprint, story by story.

---

## Verdict summary

The codebase is healthier than feared. The architecture's load-bearing walls hold:
UI components are clean of Three.js imports (ADR-0003 ✓), Handlers don't import the
store (ADR-0002 ✓), all `Math.random` uses fall under ADR-0010's cosmetic/seed
exceptions ✓, no `any` in Handlers or asset data ✓. Components sampled
(`Budget.tsx`, `RoundAdvanceController`, `useRoundTimer`, `DayEnded`) are thin views
over pure functions — **no SRP epidemic**.

The real problem is concentrated in **one file**: `src/Stores/GameState.ts`
(1,276 lines) has become a logic dumping ground in direct tension with ADR-0002's
"thin store, pure Handlers" contract. Roughly 600 of its lines are duplicated or
misplaced logic. Secondary findings: one superseded law-picker still live, a small
pile of genuinely dead code, a scratch folder committed to the repo, and two
documentation-reality gaps (ADR-0007 status, test file location).

---

## A. Complexity hotspots (all in `src/Stores/GameState.ts`)

### A1. `nextRound()` — five near-identical `set()` blobs (~275 lines) — **highest value**

`nextRound()` (lines 798–1074) has five terminal branches: coup, bankruptcy,
overthrown, victory, periodic-event, normal. The bankruptcy/overthrown/victory
blobs repeat a ~30-line `gameManagement` patch that differs **only** in
`phase`/`endReason`/`endCause`. The periodic-event and normal blobs repeat ~60
lines differing only in `periodicEvent`/`miniChallenge` slices and the tab lock.

**Fix**: extract two pure builders (likely into `RoundResolver.ts`, which already
owns the resolution prelude):

- `buildGameOverPatch(resolution, cause)` — shared by bankruptcy/overthrown/victory
- `buildRoundStartPatch(resolution, drawnContent)` — shared by periodic/normal,
  with the periodic/mini-challenge difference passed in

`nextRound()` collapses to: resolve → pick branch → one `set()`. Estimated
~150 lines saved and, more importantly, one place to touch when round-end changes.
This also de-risks the recurring bug class where a field reset (e.g. `dwelling`)
must be hand-copied into all six branches — exactly what Sprint 9 had to do.

### A2. `expireTimer()` — twin branches (~85 lines)

Two `set()` calls that duplicate the entire camera + financials + hinge patch,
differing only in the skipped-meeting penalty fields. Merge into one `set()` with a
conditional spread for the penalty (and its log event). ~40 lines saved, one hinge
code path instead of two.

### A3. `setActiveTab()` — three concerns in one action (~78 lines)

1. **Gating** (lock rules, ADR-0012 dwelling rules) — belongs here.
2. **Camera positioning** — an if/else chain per tab. Should be a data-driven
   `TAB_CAMERA` lookup in `src/Constants/` (per the "no hardcoded values" standard;
   `STREET_CAMERA` already started this pattern — finish it).
3. **Menu pause/resume** — reimplements `pauseTimer`/`resumeTimer` inline
   (lines 195–200). Extract a shared pure helper used by all three call sites.

### A4. Inline logic that belongs in Handlers (ADR-0002)

| Action | Lines | Fix |
|---|---|---|
| `actUponLaw` weird-law path | ~90 | Extract `handleWeirdLaw()` pure handler |
| `periodicEvent.resolve` + `miniChallenge.resolve` | ~115 | Near-duplicates of each other (apply treasury/relations effect + log + unlock). Extract one shared `applyEventEffect()` handler |
| `shop.buy` | ~70 | Extract `handlePurchase()` — three item-type branches with the same treasury-check/log/spend skeleton |
| `specialEnding.use` | ~12 | Borderline — fine to leave |

### A5. Deal-draw logic duplicated ×3

The "reset pool when exhausted + draw unique" dance appears in `swapDeal`,
`nextRound` periodic branch, and `nextRound` normal branch. Extract
`pickNextDeal(state)` next to `pickNextLaw` in `RoundResolver.ts`.

---

## B. Superseded / drifted logic

### B1. `swapLaw` uses an older law-picker than `nextRound` — **possible live bug**

`swapLaw` (GameState.ts:227) has an inline closure predating
`RoundResolver.pickNextLaw`. The canonical picker excludes laws from
sick/eliminated representatives and rolls the 10% weird-law chance; the swap-path
closure does **neither**. Consequence today: swapping a law can propose a law from
an eliminated faction's representative.

**Fix**: delete the closure, call `pickNextLaw` with a `{ allowWeird: false }`
option (weird laws probably shouldn't appear on a swap — flag this single behavior
question at implementation time; everything else is drift, not intent).

### B2. ADR-0007 status is stale fiction

Still reads "Proposed — deferred to Sprint 5 planning… decision before Sprint 6
begins." We're past Sprint 9; ADR-0008 absorbed most of its scope. Per the
case-by-case rule: recommend marking it **Superseded by ADR-0008** with a residual
note (non-stat one-shot delayed consequences remain undesigned — none exist in
content today), rather than leaving a permanently-"Proposed" ADR in the index.

### B3. ADR-0004 hygiene — minor

Already marked superseded by ADR-0010 in the index ✓. Just verify the file's own
Status section says so during the ADR-hygiene story.

---

## C. Dead code (verified truly dead — safe to remove)

| Item | Evidence |
|---|---|
| `src/components/LanguageSwitcher.tsx` | Zero imports anywhere (knip + grep) |
| `getRandomDailyEventForPower` in `DailyEventHandler.ts` | Zero callers |
| `middleground/` folder (git-tracked) | Raw 3ds Max dump scratch (MaxDump*.txt, dump.json, here.txt) plus stale duplicates of `street-objects.ide.ts` / `street-placement.ipl.ts` whose live versions are in `src/assets/data/`. Remove from repo; the conversion pipeline lives in `tools/ipl/` |
| ~10 unused value exports | `INITIAL_STATE` (GameState), `EXPENDITURE_MULTIPLIER`, 9 tuning constants in `CitizenHandler`, `TIME_MODIFIERS` (used internally — un-export, don't delete), `weirdLawModifierId`, `NUM_BUILDING_SLOTS`, `debugLog`, `testI18n` | 
| ~30 unused type exports | `Constants/GameState.ts` (20), `types/GameState.ts` (4), plus scattered — un-export or delete per case |

**Knip false positives — do NOT remove**: `src/global.d.ts` (ambient FBXLoader +
window types), `.claude/hooks/sync-sprint-status.mjs` (harness hook),
`tools/ipl/*.mjs` + `tools/generateSheetClasses.js` + `design/balance/balance_calc.js`
(manual pipeline/design tools), `prototypes/main.js` (isolated by design).

## D. Dormant by design — keep

`src/assets/visualConsequences.ts` (260 lines) is imported only by its own test,
**but** it is deliberate data-only scaffolding for the visual update
(TR-lasting-009, Story 2-9) — the next major milestone. Keep. One note for when
it's wired: reconcile with the `conditionStage`/`BuildingDegradation` system that
Story 8-7 shipped through a different mechanism, so we don't end up with two
visual-trigger registries.

## E. SRP & ADR-0002 atomicity

Components are in good shape (see Verdict). Two real items:

1. **Two `set()` calls per logical decision**: `actUponLaw` (normal path) and
   `actUponDeal` call `handleDecision(…)` — which `set()`s — then immediately
   `set()` again for stats/extras. ADR-0002 forbids multiple `set()`s per logical
   mutation (a render can observe the intermediate state). Fix naturally falls out
   of A4: have `handleDecision` return a patch instead of setting, merge once.
2. `useHoverGlow`/`MainModel` use `child: any` in FBX traversal — outside the
   forbidden-pattern scope (3D boundary, not Handlers/assets). Optional polish:
   type as `THREE.Object3D`. Not scheduled.

## F. Standards-reality gaps

**Test location**: `src/CLAUDE.md` says "Tests live in `tests/` — not in `src/`",
but 16 test files live in `src/` (vs 30 in `tests/`). Recommend **moving the 16
into `tests/unit/`** to match the majority and the written standard (pure file
moves + import-path fixes; zero logic risk). Alternative — amending the standard to
allow colocation — rejected because the split, not the location, is the problem.

---

## Proposed Sprint 10 — "Simplification & Debt"

Ordered by value; every story is gameplay-behavior-preserving; the full suite
(704), `tsc -b`, and `npm run build` must stay green per story. Stories 10-1
through 10-4 each end with a Puppeteer round-loop walkthrough since they touch the
round path.

| Story | Content | Size |
|---|---|---|
| **10-1** | `nextRound()` de-duplication via `buildGameOverPatch` / `buildRoundStartPatch` (A1) | L |
| **10-2** | Merge `expireTimer()` branches (A2); extract Menu pause/resume helper + `TAB_CAMERA` constant table, slim `setActiveTab` (A3) | M |
| **10-3** | Extract Handlers: `handleWeirdLaw`, shared `applyEventEffect`, `handlePurchase`; make `handleDecision` return a patch → single `set()` per decision (A4 + E1) | M |
| **10-4** | Unify pickers: `swapLaw` → canonical `pickNextLaw` (+ `allowWeird` option, one behavior question to arbitrate); extract `pickNextDeal`, use ×3 (B1 + A5) | S |
| **10-5** | Dead-code sweep: LanguageSwitcher, dead exports/types, `getRandomDailyEventForPower`, delete `middleground/` from repo (C) | S |
| **10-6** | Move 16 `src/**` test files to `tests/unit/` (F) | S |
| **10-7** | ADR hygiene: ADR-0007 → Superseded-with-residual-note; verify ADR-0004 status section; record this audit's outcomes (B2, B3) | S |

Expected outcome: `GameState.ts` from ~1,276 to roughly 600–700 lines, one code
path each for round-end, round-start, and the hinge, and zero knip findings that
aren't documented false positives.

**Not in scope** (explicitly deferred): advisor refactors (user preference),
visualConsequences wiring (visual update milestone), pedestrian avoidance phase 2,
`useHoverGlow` typing polish.
