# Architecture Review Report

**Date**: 2026-06-15
**Engine**: Web Platform — React 19 + TypeScript (strict) + Three.js (R3F), pinned 2026-06-14
**GDDs Reviewed**: 9 · **ADRs Reviewed**: 8 (ADR-0001 → ADR-0008) + ADR-0009 (planned, unwritten)
**Mode**: full · **Trigger**: post ADR-0008 (Timed Modifier Engine) acceptance + Sprint 6 story creation

---

## Scope Note

This review was triggered by the acceptance of **ADR-0008 (Timed Modifier Engine)** and the
authoring of the Sprint 6 story set, which referenced `TR-MOD-???` / `TR-COUP-???` placeholders
because no registry entries existed for the modifier engine or coup-as-a-system.

Requirement extraction focused on the systems the recent ADRs touch: the modifier engine,
weird-deals Tier 2, coup telegraphing, and the Street View / Advisor modifier consumer. The
21 pre-existing registry TRs (platform, save, state, budget, relations, charisma, meet, rng,
events, timer, scene, lasting, meta) remain covered by ADR-0001–0006 and are unchanged.

**Engine specialist consultation: skipped by project rule.** `.claude/docs/technical-preferences.md`
Routing Notes state "Skip engine-specialist spawning for all story types" (web app, no
engine-specific specialist). All 8 ADRs carry LOW knowledge risk with no post-cutoff APIs.

---

## Traceability Summary

New/affected requirements (12; existing 21 unchanged and covered):

| TR-ID | GDD | Requirement (abbrev.) | ADR | Status |
|---|---|---|---|---|
| TR-mod-001 | lasting-effects, weird-deals | Unified `modifiers[]` — one mechanism + decision ledger; replaces `ActiveRecurringEffect` | ADR-0008 | ✅ |
| TR-mod-002 | weird-deals | Per-StatMod timing; resolved windows persisted, never timing ids | ADR-0008 | ✅ |
| TR-mod-003 | game-concept | Read-through summation chokepoint; effective = `Clamp(base + Σ, ±10)` | ADR-0008 | ✅ |
| TR-mod-004 | weird-deals | `onStart` fires once at trigger round; save/load guarded | ADR-0008 | ✅ |
| TR-mod-005 | game-concept | Persist resolved windows; one-way migration; `?? []` | ADR-0008 | ✅ |
| TR-mod-006 | weird-laws, lasting-effects | Type-keyed slot / pool-exclusion / repeal-by-state-flip / repeal-tier | ADR-0008 | ✅ |
| TR-deals-001 | weird-deals | Tier 1 (4 deals) on existing accept/reject system | existing | ✅ (shipped) |
| TR-deals-002 | weird-deals | Tier 2 recurring + windowed **stat** consequences | ADR-0008 | ✅ |
| TR-deals-003 | weird-deals | Tier 2 **probabilistic / non-stat** outcomes + bee pool | ADR-0007 | ⚠️ Partial |
| TR-coup-001 | lasting-effects | Coup/overthrow/special-ending read **effective** relations | ADR-0008 §6 | ✅ |
| TR-coup-002 | lasting-effects | Coup telegraphed ≥1 round; deterministic; risk readout | ADR-0009 | ❌ Gap |
| TR-street-001 | street-view | Street View + Advisor read one `getVisibleModifiers` projection | ADR-0008 / ADR-0003 | ✅ |

**Totals (new/affected): 9 Covered · 1 Partial · 1 Gap.**

---

## Coverage Gaps & Partials

### ❌ TR-coup-002 — Coup telegraphing & fairness (no ADR)
No ADR governs the coup warning contract (≥1-round telegraph, visible/deterministic inputs,
player risk readout). **Already tracked**: Sprint 6 story **6-5** authors ADR-0009; story **6-7**
implements the UI (provisional AC, to be finalised from the ADR). Engine risk: LOW.
**Suggested ADR**: `/architecture-decision coup-telegraphing-fairness` → ADR-0009.

### ⚠️ TR-deals-003 — Tier 2 probabilistic / non-stat outcomes (ADR-0007 still Proposed)
ADR-0008 correctly carved out the *stat-contribution* portion of weird-deals Tier 2 (recurring
income, windowed relation/income deltas → modifiers). The remaining Tier 2 behaviour — binary
success/failure **treasury** hits (Deals 23/25/26) and the **bee-event sub-pool** (Deal 28) — are
non-stat one-shot delayed consequences that remain **ADR-0007 territory**, and ADR-0007 is still
`Proposed`. This does **not** block Sprint 6 (engine unification, not Tier 2 content). ADR-0007
must reach Accepted before Tier 2 deals with random outcomes ship.

---

## Cross-ADR Conflicts

**None.** The one candidate — ADR-0007 (effect queue) vs ADR-0008 (timed modifiers), both
addressing "delayed effects" — is already cleanly resolved: ADR-0008 supersedes the *stat*
portion of ADR-0007 (ADR-0008 §ADR-Dependencies), and ADR-0007's Status section (the
"Scope narrowed by ADR-0008" block) reflects the narrowing to non-stat one-shots. No
data-ownership, integration-contract, performance-budget, dependency-cycle, pattern, or
state-authority conflicts detected.

---

## ADR Dependency Order (topologically sorted)

```
Foundation (Accepted):
  1. ADR-0001 Tech Stack Choice
  2. ADR-0003 React / Three.js Integration
  3. ADR-0002 State Management Pattern        (req ADR-0001)
  4. ADR-0004 RNG & Determinism               (req ADR-0002)
  5. ADR-0006 Round Timer / Game Loop         (req ADR-0002)
Built on Foundation:
  6. ADR-0005 Event Scheduling                (req ADR-0002)
  7. ADR-0008 Timed Modifier Engine           (req ADR-0002, 0004, 0006) — all Accepted ✅
Open:
  •  ADR-0007 Effect Timing — PROPOSED         (blocks only TR-deals-003)
  •  ADR-0009 Coup Telegraphing — PLANNED/unwritten (blocks TR-coup-002 / story 6-7)
```

No dependency cycles. **ADR-0008 has every dependency Accepted — Sprint 6 P1 is safe to start now.**

---

## GDD Revision Flags

None — all GDD assumptions are consistent with verified engine behaviour and accepted ADRs.
`systems-index.md` still describes weird-deals Tier 2 as "blocked on ADR-0007"; this remains
accurate for the non-stat outcomes (TR-deals-003) even though the stat portion (TR-deals-002)
is now handled by ADR-0008. No index change required.

---

## Engine Compatibility

| Check | Result |
|---|---|
| Version consistency | ✅ All ADRs target the pinned web stack (2026-06-14) |
| ADRs with Engine Compatibility section | 8 / 8 |
| Post-cutoff API conflicts | None (no post-cutoff APIs used) |
| Deprecated API references | None |
| Stale version references | None |

ADR-0008 explicitly records Knowledge Risk = LOW, no engine-specific APIs. **No engine issues.**

---

## Verdict: CONCERNS

The architecture for the **Sprint 6 modifier-engine work is fully covered and unblocked**
(ADR-0008 Accepted; all dependencies Accepted; no conflicts; engine clean). Two known,
already-tracked gaps remain and are **advisory, not blocking** for Sprint 6:

1. **ADR-0009 (coup telegraphing)** — unwritten; tracked by Sprint 6 story 6-5. Blocks story 6-7 only.
2. **ADR-0007 finalisation** — Proposed; blocks Tier 2 random-outcome deals (TR-deals-003), which are not in Sprint 6 scope.

### Required ADRs (priority order)
1. **ADR-0009 — Coup Telegraphing & Fairness** (Sprint 6 story 6-5; unblocks 6-7).
2. **ADR-0007 — finalise/Accept** (before any future Tier 2 random-outcome deal sprint).

---

## Pre-Gate Checklist

| Item | Status |
|---|---|
| `tests/unit/` + `tests/integration/` | ✅ present |
| `.github/workflows/tests.yml` | (not re-verified this run — check before gate-check) |
| `design/ux/interaction-patterns.md` | ✅ present (story 5-5) |
| `design/accessibility-requirements.md` | (not re-verified this run) |

This review is the Technical Setup → Pre-Production gate input for the modifier-engine epic;
Sprint 6 itself is mid-Production tech-debt work, not a stage gate.
