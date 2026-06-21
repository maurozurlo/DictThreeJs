# ADR-0011 — Structured Round Log (capture-on-action, translate-on-render)

- **Status**: Accepted (2026-06-21)
- **Supersedes / amends**: None (extends the logging behaviour of ADR-0006 round
  loop and ADR-0008 modifier engine)
- **Deciders**: lead-programmer, with product (Mauro)

## Context

The Log tab is the player's only record of *what happened and why their state
changed*. Until now each round's log was **reconstructed at round-resolution time**
in `RoundResolver.resolveRound()` from boolean decision flags (`law.lawDecided`,
`law.lastLawOutcome`, `deals.dealDecided`, `meet.actionTaken`). It could therefore
only state *that* a law passed or a faction was met — never the actual outcome or
its effect on relations / charisma / treasury.

Two problems made "just print the law's numbers" wrong:

1. **Grace dampening.** Relation deltas from rejected laws, weird laws and meet
   actions pass through `applyGraceDampening` (ADR), so the *applied* value differs
   from the authored value in the early rounds. Re-deriving from content would
   misreport the count.
2. **Read-through modifiers (ADR-0008).** An accepted law/deal applies no base
   mutation — its effect is an ongoing modifier contribution. The flag-based log
   had no access to it at all.

Several player-affecting events were also entirely absent from the log: meet-action
outcomes, the silent skipped-meeting timeout penalty, charisma changes, periodic
events, opportunities (mini-challenges) and shop purchases (advisor / statue / media).

## Decision

**Capture each happening as a structured `LogEvent` at the moment it is applied,
carrying the actual deltas; translate the events at render.**

- `LogEvent` (`src/types/GameState.ts`): a headline i18n `key` + `params` /
  `refParams` (menu-ns key values resolved at render, e.g. `power.military`) +
  optional cross-namespace `labelKey`/`labelNs` (+ `dumb` for daily-event
  dumbification) + `deltas` (one-time, actually applied) + `ongoing` (per-round
  modifier contribution, rendered with a "/round" tag).
- `gameManagement.pendingLog: LogEvent[]` is the per-round buffer. Every action
  handler (meet, law/deal decision, weird law, periodic event, mini-challenge,
  shop purchase, skipped-meeting penalty) pushes the events it produces, computing
  deltas by diffing state before/after — i.e. **post-dampening, source-of-truth**.
  - *Meetings* use the meet **result text** as the headline (`keyNs: 'meet'`) — it
    already names the faction and its relation/treasury effect and explains
    zero-delta outcomes (inconclusive dialogue); the effects line carries the
    charisma delta, which the result texts omit.
  - *Deals* carry a short per-deal `name` (`deals.<id>.name`) shown in the log;
    previously only the four lasting-effect deals had a label.
- `resolveRound()` drains `pendingLog` and appends the resolution-time events
  (budget→relation effects, tax penalties, financials, coup warnings, the day's
  news) into the round's `RoundLogEntry`. `nextRound()` resets the buffer.
- `RoundLogEntry` changes from `{ date, lines: string[] }` to `{ date, events:
  LogEvent[] }`. `src/Utils/RoundLog.ts` (`formatLogEvent`) renders each event as a
  headline line + an indented effects line; `Log.tsx` consumes it.

### Consequences

- The whole log re-localises on language switch (events are translated at render,
  not stored as strings).
- The vague "Charisma improving/dropping" line is removed — per-action charisma
  deltas are now explicit.
- Effects are reported as actually applied; no content re-derivation, so grace
  dampening and modifier-based effects are correct by construction.
- **Save format**: persisted log + `pendingLog` are plain serialisable data and
  survive save/load. Pre-ADR-0011 saves (which stored `{ lines }`) are **not**
  migrated — acceptable while the game is in beta (decision: product, 2026-06-21).

## Alternatives considered

- *Pre-translated strings (keep `lines: string[]`)*: smaller change but freezes
  each entry in the language it was written in. Rejected in favour of render-time
  translation.
- *Re-derive deltas in `resolveRound` from content*: cannot reproduce grace
  dampening or read-through modifier contributions. Rejected (the original bug).
