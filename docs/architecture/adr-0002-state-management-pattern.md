# ADR-0002: State Management Pattern — Single Zustand Store + Handler Functions

## Status
Proposed

## Date
2026-06-10

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Web Platform (browser) |
| **Domain** | State Management |
| **Knowledge Risk** | LOW — Zustand 4/5 is within LLM training data |
| **References Consulted** | N/A |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | None |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0001 (Zustand chosen as state management library) |
| **Enables** | ADR-0003 (React/Three.js integration — needs to know how camera state is accessed) |
| **Blocks** | None |
| **Ordering Note** | All new game systems must follow the Handler pattern defined here. |

## Context

### Problem Statement
Dictator Simulator's game state is a single, deeply nested object spanning 15+
namespaces (gameManagement, budget, relations, law, deals, meet, shop,
specialEnding, stats, log, scene, tabs, debug, periodicEvent, miniChallenge).
Round resolution mutates 6–10 of these namespaces simultaneously. The core
challenge: how do we keep mutation logic testable and prevent re-render cascades
while keeping the state model coherent?

### Constraints
- Round resolution must be deterministic and unit-testable without React or a DOM
- Store mutations must not cause components to re-render on unrelated state changes
- Business logic (formulas, probability, effects) must be isolated from UI code
- State must be serializable for JSON save/load

### Requirements
- Must support fine-grained component subscriptions (components only re-render when
  their specific slice changes)
- Core game formulas (income calculation, relation effects, action outcomes) must be
  independently testable
- State shape must be fully TypeScript-typed
- Must support atomic multi-slice updates (round resolution updates budget +
  relations + charisma + log in a single `set()` call)

## Decision

Use a **single Zustand store** with namespaced slices and **extracted Handler
functions** for all mutation logic.

### Pattern: Single Store + Handler Functions

```
useGameStore (Zustand)
  ├── Namespaced state slices (data only)
  │     gameManagement, budget, relations, law, deals,
  │     meet, shop, specialEnding, stats, log, scene,
  │     tabs, debug, periodicEvent, miniChallenge, dailyEvent
  │
  └── Action methods (orchestrators — call Handlers, then set())
        ├── nextRound()        → calls BudgetHandler + EffectHandler, then set()
        ├── takeAction()       → calls ActionHandler, then set()
        ├── actUponLaw()       → calls EffectHandler.handleDecision, then set()
        ├── actUponDeal()      → calls EffectHandler.handleDecision, then set()
        └── ...

Handler files (pure functions — no store access)
  ├── BudgetHandler.ts
  │     calculateRoundFinancials(budget) → RoundFinancials
  │     handleBudgetChange({budget, id, amount}) → BudgetChangeResult
  │
  ├── ActionHandler.ts
  │     handleActionOutcome(power, action, state) → ActionResult
  │
  └── EffectHandler.ts
        applyBudgetEffects(budget, relations) → BudgetEffectResult
        handleDecision({type, item, hasAccepted, get, set}) → void
        handleRelations({power, amount, current}) → number
```

### The Handler Contract

Handler functions must satisfy all of:
1. **Pure inputs** — accept only plain data (no store references, no React hooks)
2. **Typed outputs** — return a typed result object; no void returns except `handleDecision`
3. **No side effects** — no `console.log` in production paths, no direct DOM access
4. **Independently importable** — can be imported and called in tests without
   instantiating the Zustand store

`handleDecision` is a partial exception: it receives `get` and `set` callbacks
from the store because it orchestrates a multi-slice atomic update. It is
considered an action handler (store-coupled) rather than a pure compute function.

### Why Single Store Over Multiple Stores

Round resolution requires atomic updates across 6–10 namespaces. With multiple
stores, maintaining atomicity requires either a store coordinator (complexity) or
accepting that a round resolution can be observed mid-update by subscribed
components (bugs). A single `set()` call in Zustand is atomic within a render cycle.

### INITIAL_STATE Pattern

The store is initialized via an `INITIAL_STATE` factory function that receives
`set` and `get` closures from Zustand:

```typescript
export const INITIAL_STATE = ({ set, get }) => ({
  // data slices
  budget: { treasury: 500, ... },
  // action methods (closures over set/get)
  gameManagement: {
    nextRound: () => {
      const state = get();
      const financials = calculateRoundFinancials(state.budget); // Handler call
      const { newRelations } = applyBudgetEffects(state.budget, state.relations.current); // Handler call
      set((s) => ({ budget: { ...s.budget, treasury: ... }, relations: { ... } }));
    }
  }
});
```

This pattern keeps the store definition readable while allowing action methods to
be tested by passing mock `set`/`get` stubs.

### Key Interfaces

- **Store access**: `useGameStore(selector)` — selector receives full state, returns slice
- **Handler call convention**: Handlers are called with typed arguments, never with
  the full store reference (exception: `handleDecision` which is store-coupled by design)
- **Atomic updates**: All multi-slice updates use a single `set((s) => ({...}))` call
- **State serialization**: All state slices must be JSON-serializable (no class instances,
  no functions in persisted slices). `Set<>` types are serialized to arrays in SaveLoad.ts.

### Architecture Diagram

```
Component                Store                         Handler
─────────────            ─────────────────────         ──────────────────
useGameStore(s           gameManagement.nextRound()
  => s.budget)           {
  .treasury       ──►      const fin = calculateRound  ──► BudgetHandler.ts
                           const rel = applyBudget     ──► EffectHandler.ts
                           set((s) => ({               ◄── (returns result)
                             budget: ...,
                             relations: ...,
                           }))
                         }
  ◄── re-renders only when budget.treasury changes
```

## Alternatives Considered

### Alternative A: MobX
- **Description**: Observable state with reactive derivations; mutations trigger
  fine-grained computed updates automatically.
- **Pros**: Powerful reactivity, less boilerplate for computed values
- **Cons**: Class-based model conflicts with TypeScript functional patterns;
  observable proxies make state serialization (save/load) complex; steeper
  learning curve than Zustand's simple `set()` API
- **Rejection Reason**: Serialization complexity and class-based model are poor
  fits for a data-driven game with JSON save/load requirements.

### Alternative B: Jotai / Recoil (Atomic State)
- **Description**: State split into small atoms; components subscribe to specific atoms.
- **Pros**: Extremely fine-grained subscriptions; derived state is clean
- **Cons**: Round resolution touching 8+ atoms simultaneously means 8+ separate
  set operations, each triggering a render cycle. Coordinating atomic cross-slice
  updates requires explicit transaction APIs or risks mid-update component renders.
- **Rejection Reason**: Atomic state is a poor fit for the game's dominant pattern
  of large, coordinated multi-slice updates at round boundaries.

### Alternative C: Redux Toolkit
- **Description**: Flux architecture with reducers, actions, and slices.
- **Pros**: Mature ecosystem, time-travel debugging, strict unidirectional flow
- **Cons**: Significant boilerplate (actions, reducers, selectors, store config)
  for a single-player game. Time-travel debugging has no use case here. The
  Handler pattern already captures Redux's "pure reducer" insight without the
  ceremony.
- **Rejection Reason**: Boilerplate overhead without proportional benefit for
  a solo-developed, single-player game.

### Alternative D: Inline Zustand Mutations (No Handler Extraction)
- **Description**: Write all mutation logic directly inside `set()` callbacks in
  the store file; no separate Handler files.
- **Pros**: Less file overhead; simpler import graph
- **Cons**: `nextRound()` alone touches 12+ state fields and calls 4 distinct
  calculation pipelines. Inlining this makes the store file 1000+ lines of
  untestable imperative code. Unit testing requires instantiating the store.
- **Rejection Reason**: Testability is non-negotiable for game formulas. The
  Handler extraction exists specifically so income calculations and relation
  effects can be tested without React or Zustand.

## Consequences

### Positive
- Core game formulas (income, relation effects, action outcomes) are fully
  unit-testable as pure TypeScript functions
- Components re-render only when their selected slice changes
- Single atomic `set()` per round boundary — no mid-update component renders
- State is serializable: JSON save/load is straightforward
- `INITIAL_STATE` factory makes the store reset (new game) a trivial `setPhase('start')`

### Negative
- Single store file (`GameState.ts`) is large (~980 lines). New systems increase
  it further unless deliberately split into slice files.
- `handleDecision` is partially store-coupled (takes `get`/`set`) — it is a
  hybrid between a pure handler and a store action, which can be confusing.
- Zustand's `immer` middleware is not used — all updates use spread operators,
  which is more verbose for deeply nested state.

### Risks
- **Store file growth**: As more systems are added, `GameState.ts` will grow.
  *Mitigation*: When the file exceeds ~1500 lines, split into slice files
  following Zustand's slice pattern (`createBudgetSlice`, etc.) and re-export
  from a combined `createStore`.
- **Handler coupling creep**: Over time, Handlers may accumulate store references.
  *Mitigation*: CI rule — Handler files must not import from `../Stores/GameState`.
- **Set<> serialization**: `Set<>` types in state (frozenFactions, interactedWithLaws,
  interactedWithDeals) require manual conversion in SaveLoad.ts.
  *Mitigation*: Already handled. Any new `Set<>` state must be added to the
  save/load serialization explicitly.

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|------------|-------------|--------------------------|
| game-concept.md | Save/Load: JSON export/import | State is a plain object; Handler functions never hold non-serializable data |
| game-concept.md | Core loop is deterministic across 10 rounds | Handler functions are pure; given the same inputs they produce the same outputs |

## Performance Implications
- **CPU**: Zustand's selector diffing is O(1) reference equality — negligible overhead
- **Memory**: Single store object (~50 fields); no duplication between stores
- **Re-renders**: Components subscribe to minimum required slice; round resolution
  triggers at most one render pass per subscribed component

## Migration Plan
If the store file grows beyond ~1500 lines, migrate to Zustand slice pattern:
1. Extract each namespace (`budget`, `relations`, etc.) into `createXSlice(set, get)` functions
2. Combine in `createStore`: `create<GameState>()((...a) => ({ ...createBudgetSlice(...a), ... }))`
3. No consumer code changes required — `useGameStore` interface is unchanged

## Validation Criteria
- All Handler unit tests pass headlessly (`npm test` with no browser)
- No Handler file imports from `../Stores/GameState` (checked by lint rule or grep)
- Round resolution produces identical outputs for identical inputs (determinism test)
- `useGameStore` is the only import path for store access in component files

## Related Decisions
- [ADR-0001: Tech Stack Choice](adr-0001-tech-stack-choice.md) — Zustand selected
- [ADR-0003: React / Three.js Integration](adr-0003-react-threejs-integration.md)
- [design/gdd/game-concept.md](../../design/gdd/game-concept.md)
