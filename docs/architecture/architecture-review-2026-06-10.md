# Architecture Review Report

> Date: 2026-06-10
> Engine: Web Platform (browser)
> GDDs Reviewed: 1 · ADRs Reviewed: 3
> Verdict: **CONCERNS**

## Inputs

- GDD: `design/gdd/game-concept.md` (reverse-documented)
- ADRs: ADR-0001 (Tech Stack), ADR-0002 (State Management), ADR-0003 (React/Three.js Integration)
- `tr-registry.yaml`: empty prior to this review (first real run)
- Not present: `systems-index.md`, `architecture.md`, `consistency-failures.md`

## Traceability Matrix

| TR-ID | System | Requirement | ADR | Status |
|-------|--------|-------------|-----|--------|
| TR-platform-001 | Platform | Browser, no install, static build | ADR-0001 | ✅ |
| TR-platform-002 | Platform | i18n multi-language support | ADR-0001 | ⚠️ |
| TR-save-001 | Save | JSON export/import save & load | ADR-0001/0002 | ✅ |
| TR-save-002 | Save | `Set<>` types serialized to arrays | ADR-0002 | ✅ |
| TR-save-003 | Save | Relations history per round persisted for stats screen | — | ⚠️ |
| TR-state-001 | State | 15+ nested namespaces, atomic multi-slice updates | ADR-0002 | ✅ |
| TR-state-002 | State | Core formulas pure & unit-testable | ADR-0002 | ✅ |
| TR-state-003 | State | Round resolution deterministic | ADR-0002 | ⚠️ |
| TR-budget-001 | Budget | Income/expense/tax formulas | ADR-0002 | ✅ |
| TR-relations-001 | Relations | Relations −10..+10, overthrow trigger | ADR-0002 | ✅ |
| TR-charisma-001 | Charisma | Charisma −10..+10 meta-resource & effects | ADR-0002 | ✅ |
| TR-meet-001 | Meet | Click 3D faction rep to initiate interaction (raycast/click) | ADR-0003 | ⚠️ |
| TR-meet-002 | Meet | Meet action outcomes (probability dialogue, bribe, etc.) | ADR-0002 | ✅ |
| TR-rng-001 | RNG | Probability mechanics (dialogue, backlash, daily/mini events, ending) | — | ❌ |
| TR-events-001 | Events | Event scheduling: daily random, periodic fixed-round, mini 40% | — | ❌ |
| TR-timer-001 | Timer | Real-time per-round countdown + expiry penalties | — | ❌ |
| TR-scene-001 | Scene | Tab-linked camera positions with lerp | ADR-0003 | ✅ |
| TR-scene-002 | Scene | Statues visible, driven by `shop.statueCount` | ADR-0003 | ✅ |
| TR-scene-003 | Scene | Street View visualization (planned) | ADR-0003 | ⚠️ |
| TR-scene-004 | Scene | Debug free-camera (WASD/look) | ADR-0003 | ✅ |

**Totals:** 20 requirements — ✅ 13 covered · ⚠️ 4 partial · ❌ 3 gaps

## Coverage Gaps (no ADR)

- ❌ **TR-timer-001** — Real-time round timer / game-loop architecture. ADR-0001 mentions
  the manual `Date.now()` + React-hook timer as a *consequence*, but no ADR governs the
  design (expiry detection, pause during tab-lock, later-round acceleration).
  Suggested: `/architecture-decision Round Timer & Game Loop`. Domain: Timing. Engine risk: LOW.
- ❌ **TR-rng-001** — Randomness/determinism strategy. The GDD has many probability-driven
  mechanics, yet ADR-0002 asserts "identical outputs for identical inputs." No ADR
  reconciles RNG with that determinism/testability claim (seeded RNG? injected RNG source?).
  Suggested: `/architecture-decision RNG & Determinism Strategy`. Domain: Core logic. Engine risk: LOW.
- ❌ **TR-events-001** — Event scheduling architecture. `dailyEvent`/`periodicEvent`/`miniChallenge`
  namespaces exist but no ADR defines event selection, fixed-round scheduling, or tab-lock behaviour.
  Suggested: `/architecture-decision Event Scheduling System`. Domain: Core logic. Engine risk: LOW.

## Partial Coverage Notes

- ⚠️ **TR-platform-002 (i18n)** — Enabled by the React stack (ADR-0001) and already implemented,
  but no dedicated ADR records the i18n architecture decision.
- ⚠️ **TR-save-003 (relations history)** — Serialization is covered by ADR-0002, but the
  per-round history schema for the stats screen is not explicitly governed.
- ⚠️ **TR-meet-001 (3D click)** — ADR-0003 covers 3D component composability, but the
  raycast/click-to-interact mechanism for faction representatives is not detailed.
- ⚠️ **TR-scene-003 (Street View)** — ADR-0003 reserves camera slot 2 and states the pattern
  supports it; feature itself is deferred/planned.
- ⚠️ **TR-state-003 (determinism)** — True only once an RNG strategy exists (see TR-rng-001).

## Cross-ADR Conflicts

No blocking conflicts. Two advisory items:

- **Pattern (advisory) — ADR-0001 vs ADR-0003:** ADR-0001 mandates narrow Zustand selectors;
  ADR-0003 documents `CameraController` subscribing to the full camera object. ADR-0003
  self-acknowledges this as a known violation to fix — tracked debt, not a contradiction.
- **State/determinism tension — ADR-0002 vs GDD:** ADR-0002's determinism validation criterion
  cannot hold for the GDD's RNG mechanics without a seeding strategy. Surfaced as gap TR-rng-001.

## ADR Dependency Order (topologically sorted)

```
Foundation:  1. ADR-0001  Tech Stack Choice (no deps)
Depends:     2. ADR-0002  State Management   (requires ADR-0001)
             3. ADR-0003  React/Three.js     (requires ADR-0001, ADR-0002)
```

Clean linear chain, no cycles.

⚠️ **Process flag:** All three ADRs are still `Proposed`. Per `docs/CLAUDE.md`, stories
referencing a `Proposed` ADR are auto-blocked, and ADR-0002/0003 depend on ADRs not yet
`Accepted`. Promote the chain to `Accepted` before implementing stories against them.

## GDD Revision Flags

None — no HIGH RISK engine findings; all GDD assumptions are consistent with the verified
web-stack reality.

## Engine Compatibility

- All 3 ADRs agree on "Web Platform (browser)", knowledge risk LOW, no post-cutoff or
  deprecated APIs. Internally consistent.
- ⚠️ **Config drift:** The project template is scaffolded for **Godot 4.6**
  (`CLAUDE.md`, `docs/engine-reference/godot/VERSION.md`), but the implementation and all
  ADRs are a React/Three.js web stack. `.claude/docs/technical-preferences.md` is still all
  `[TO BE CONFIGURED]`. The Godot engine-reference is not applicable to these ADRs and the
  technical-preferences file should be updated to reflect the web stack. No engine specialist
  is configured, so the Phase 5 specialist consultation was skipped.

## Architecture Document Coverage

- `docs/architecture/architecture.md` does not exist — Phase 6 skipped.
- `design/gdd/systems-index.md` does not exist (expected per `design/CLAUDE.md`).

## Verdict: CONCERNS

Foundation and core layers (stack, state management, rendering boundary) are well covered
with strong, well-justified ADRs. No Foundation-layer requirement is uncovered and no
blocking cross-ADR conflict exists, so this is not a FAIL. Concerns:

- 3 Feature/Core gaps (timer, RNG/determinism, event scheduling) — implemented in code but
  ungoverned by ADRs.
- All ADRs still `Proposed` — promote to `Accepted` to unblock story work.
- Determinism claim in ADR-0002 needs an RNG strategy to be true.
- Config drift: template says Godot, project is web.

### Required ADRs (priority order)

1. RNG & Determinism Strategy (unblocks ADR-0002's testability claim)
2. Event Scheduling System
3. Round Timer & Game Loop

## Pre-gate Checklist

- ❌ `tests/unit/` & `tests/integration/` — run `/test-setup`
- ❌ `.github/workflows/tests.yml` — run `/test-setup`
- ❌ `design/ux/accessibility-requirements.md` — run `/ux-design`
- ❌ `design/ux/interaction-patterns.md` — run `/ux-design`
