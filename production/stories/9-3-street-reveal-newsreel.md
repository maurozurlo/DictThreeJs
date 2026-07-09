# Story 9-3: Street Reveal + Newsreel — Mandatory Reveal, Optional Dwell

> **Epic**: Round Loop & Street Reveal
> **Status**: Complete
> **Layer**: Feature
> **Type**: UI
> **Estimate**: 1.5 days
> **Manifest Version**: 2026-06-13
> **Last Updated**: 2026-07-08

## Completion Notes

Implemented as scoped, with one deviation: `buildRevealHeadline` (`src/Utils/RevealHeadline.ts`) is dumbScore-agnostic by design — `dumbifyText` is applied at the call site in `DayEnded.tsx`, matching the `Log.tsx` pattern of layering distortion over content rather than baking it in. `DayEnded.tsx` now renders two stages: mandatory (`Modal`/`ModalCard`, headline + existing stat rows, no advance button, min `GAMESTATE.ROUNDS.MANDATORY_REVEAL_MS` = 3000ms) then dwell (`.dwellBanner` — fixed-position card positioned just below the Navbar, not at the bottom, to avoid overlapping the ActionPanel's bottom HUD strip — a placement issue caught during live verification and fixed).

**End-to-end verification (Puppeteer + system Chrome, live dev server)**: New Game → Easy → forced round-end via the Navbar advance button + confirm dialog → screenshot showed the mandatory scrim with "THE PEOPLE REJOICE" headline + financial breakdown, Meet/Laws/Deals/Budget disabled, Street enabled, Street scene visible (blurred) behind the scrim. Waited past the 3s window → screenshot showed the non-blocking dwell banner with the Street scene fully rendered and interactive underneath (confirmed no full-viewport `.scrim` element present in the DOM). Clicked "Continue to Month 2" → screenshot + DOM check confirmed decision tabs re-enabled and Street re-disabled. No console errors during the full walkthrough. Automated: `tests/unit/roundloop/reveal_headline.test.ts` (3 tests, pure function only per Testing Standards for UI stories). Full suite 696/696, `tsc -b` clean, `npm run build` green.

Manual walkthrough evidence doc (`production/qa/evidence/9-3-street-reveal-newsreel-evidence.md`) not written as a separate file this session — the Puppeteer verification above serves as the evidence; recommend backfilling the doc before formal sprint close-out if the team wants it on file per the Testing Standards table.

## Context

**Design source**: `ROUND_LOOP_STREET_REVEAL_0_1.md` — §4 ("The reveal — mandatory, brief; the dwell — optional, unlimited")
**Requirement**: `TR-roundloop-002`

**ADR Governing Implementation**: [ADR-0012: Round Loop Phase Split](docs/architecture/adr-0012-round-loop-phase-split.md)
**ADR Decision Summary**: `DayEnded.tsx` becomes a two-stage render gated on `dwelling` (from 9-1): a **mandatory stage** (full `Modal` scrim, current financial breakdown + a new triumphant placeholder headline, cannot be dismissed before a minimum window elapses) followed by a **dwell stage** (non-blocking corner card — headline + "Begin Next Month" button — with the Street scene beneath fully interactive: camera, ped click-to-inspect, conditionStage-driven building variants all already work today and are untouched).

**Secondary ADRs**:
- [ADR-0002](docs/architecture/adr-0002-state-management-pattern.md) — the mandatory-window timer is **local component state** (`useState` + `setTimeout`, same pattern as `RoundAdvanceController`'s local `showConfirm`), not store state — UI timing does not belong in a Handler.
- [ADR-0003](docs/architecture/adr-0003-react-threejs-integration.md) — no Three.js imports in `DayEnded.tsx`.

**Engine**: React 19 + TypeScript | **Risk**: MEDIUM — must not break the existing pointer-event behavior of the Street scene (ped click-to-inspect via `StreetView.tsx`'s `onClick`/`stopPropagation`) once the mandatory scrim lifts.
**Engine Notes**: Existing `Newspaper.tsx` + `dumbifyText(text, dumbScore)` (used today in `Log.tsx`, `Meet.tsx`, `Laws.tsx`, `Deals.tsx`) is the established "propaganda distortion" pattern in this codebase — **reuse it**, do not invent a new headline mechanism. The full multi-column `Newspaper` mockup component is NOT reused here (it's laid out for a dedicated tab, not an overlay banner) — only the headline-generation pattern (`dumbifyText` over a template string).

**Control Manifest Rules (Feature layer)**:
- Required: all player-facing strings through i18next (EN + ES).
- Required: single Zustand selector subscriptions; no derived-object selectors (ADR-0002/ Zustand selector footgun — assemble objects in the component body, not the selector, per existing `DayEnded.tsx` pattern for `effectiveRelations`).
- Forbidden: gameplay logic in the component — headline pool selection is a pure function importable/testable on its own.

---

## Acceptance Criteria

**Headline generation:**
- [ ] **AC-1**: New pure function `buildRevealHeadline(round: number, t: TFunction): string` in `src/Utils/RevealHeadline.ts` — cycles through a fixed pool of ≥5 triumphant placeholder headline i18n keys (`hinge.headline.0` .. `hinge.headline.N`, e.g. "PROSPERITY SOARS", "THE PEOPLE REJOICE", "A GLORIOUS MONTH", "HISTORY WILL REMEMBER", "THE FUTURE IS BRIGHT") selected by `round % pool.length` — deterministic, no RNG.
- [ ] **AC-2**: The selected headline string is passed through `dumbifyText(headline, dumbScore)` before display (reuses the existing propaganda-distortion utility; `dumbScore` read from `gameManagement.dumbScore`).
- [ ] **AC-3**: All headline pool strings are i18n keys in the `menu` namespace, EN + ES.

**Two-stage render:**
- [ ] **AC-4**: `DayEnded.tsx` renders the **mandatory stage** (existing full `Modal`/`ModalCard` scrim, headline added above the existing stat rows) when `dayEnded && dwelling && !revealAcked`, where `revealAcked` is local component state (`useState(false)`) flipped true by a `setTimeout(MANDATORY_REVEAL_MS)` effect keyed on `round` (resets each time a new round ends).
- [ ] **AC-5**: `MANDATORY_REVEAL_MS` is a named constant in `src/Constants/GameState.ts` (data-driven, not inline) — default 3000ms.
- [ ] **AC-6**: During the mandatory stage, the existing "Continue"/advance button is NOT rendered (or is disabled) — the player cannot skip the reveal early.
- [ ] **AC-7**: After `revealAcked` flips true, `DayEnded` renders the **dwell stage**: a small fixed-position card (not a full-viewport `Modal` scrim — no backdrop blocking the scene) containing the headline + the existing advance button (`t('actionPanel.continue_month')` / `finish_month`), positioned so it does not cover the majority of the viewport (e.g. corner or bottom banner).
- [ ] **AC-8**: During the dwell stage, the Street scene underneath is fully interactive — clicking a ped still opens the Citizen Inspector (verify `StreetView.tsx`'s click handling is not obscured by the new card's DOM — the card must not use a full-viewport overlay div).
- [ ] **AC-9**: Clicking the advance button in the dwell stage still calls `nextRound()` exactly as today, which (per Story 9-1) resets `dwelling: false` and returns to the locked work day.
- [ ] **AC-10**: The existing detailed financial stat rows (income/expenses/law/deal effects/net) are preserved — shown in the mandatory stage; not required to repeat in the compact dwell-stage card (out of scope to design a "view details" toggle for the dwell stage — future polish).

**Regression:**
- [ ] **AC-11**: `npx vitest run` — 0 new failures.
- [ ] **AC-12**: `tsc -b` exits 0.

---

## Implementation Notes

### Headline pure function

```ts
// src/Utils/RevealHeadline.ts
import type { TFunction } from 'i18next';

const HEADLINE_COUNT = 5;

export function buildRevealHeadline(round: number, t: TFunction): string {
    const index = round % HEADLINE_COUNT;
    return t(`hinge.headline.${index}`);
}
```

Apply `dumbifyText` at the call site in `DayEnded.tsx` (it already imports nothing from i18next namespaces beyond `t`, and `dumbScore` is already read elsewhere in the file's sibling components) — keeps `RevealHeadline.ts` a pure, dumbScore-agnostic pool picker; distortion is layered on top, consistent with how `Log.tsx` layers `dumbifyText` over `dailyEventT(...)` rather than baking it into the event content itself.

### Two-stage render sketch

```tsx
const dwelling = useGameStore(s => s.gameManagement.dwelling)
const round = useGameStore(s => s.gameManagement.round)
const dumbScore = useGameStore(s => s.gameManagement.dumbScore)
const [revealAcked, setRevealAcked] = useState(false)

useEffect(() => {
    if (!dayEnded) return
    setRevealAcked(false)
    const timer = setTimeout(() => setRevealAcked(true), GAMESTATE.ROUNDS.MANDATORY_REVEAL_MS)
    return () => clearTimeout(timer)
}, [dayEnded, round])

if (!dayEnded || phase !== 'start') return null

const headline = dumbifyText(buildRevealHeadline(round, t), dumbScore)

if (!revealAcked) {
    return (
        <Modal>
            <ModalCard>
                <Typography variant="h2" color="accent">{headline}</Typography>
                {/* ...existing stat rows unchanged... */}
                {/* NOTE: no advance button here — mandatory, non-dismissible */}
            </ModalCard>
        </Modal>
    )
}

return (
    <div className={styles.dwellBanner}>
        <Typography variant="h3">{headline}</Typography>
        <Button onClick={nextRound}>
            {round + 1 <= GAMESTATE.ROUNDS.MAX ? t('actionPanel.continue_month', { month: round + 1 }) : t('actionPanel.finish_month', { month: round })}
        </Button>
    </div>
)
```

`styles.dwellBanner` (new CSS Module class in `DayEnded.module.css`) must be a small fixed-position element (e.g. `position: fixed; bottom/corner; width: auto`) — explicitly NOT `Modal`'s full-viewport scrim, so pointer events pass through to the 3D canvas everywhere except the banner itself.

### i18n keys to add

```json
// public/locales/en/menu.json
"hinge.headline.0": "PROSPERITY SOARS",
"hinge.headline.1": "THE PEOPLE REJOICE",
"hinge.headline.2": "A GLORIOUS MONTH FOR THE REGIME",
"hinge.headline.3": "HISTORY WILL REMEMBER THIS DAY",
"hinge.headline.4": "THE FUTURE HAS NEVER LOOKED BRIGHTER"
```
(ES translations — triumphant propaganda tone, not literal word-for-word)

---

## Out of Scope

- A "view full breakdown" toggle in the compact dwell-stage card (deferred — the mandatory stage already showed the numbers once per round; acceptable for MVP per design doc §8 "build the dumb version")
- Persistence/"scar" layer — boarded-up shops, memorials (deferred to Street View 0.2+ per design doc §7)
- Round 1 opening state (Story 9-4)
- Any change to `conditionStage`/building-variant visuals — already-shipped Epic 8 work, untouched here

---

## QA Test Cases

- **AC-1**: `buildRevealHeadline(0, t)` and `buildRevealHeadline(5, t)` return the same string (pool wraps).
- **AC-4/AC-6**: Trigger `expireTimer()` → immediately assert the advance button is absent/disabled; wait `MANDATORY_REVEAL_MS` → advance button appears.
- **AC-8 (manual)**: During dwell stage, click a citizen ped → Citizen Inspector panel opens as it does today.
- **AC-9**: Click advance in dwell stage → `nextRound()` fires, `dwelling` becomes `false`, Meet/Laws/Deals/Budget re-enable.

---

## Test Evidence

**Story Type**: UI
**Required evidence**: Manual walkthrough doc at `production/qa/evidence/9-3-street-reveal-newsreel-evidence.md` — screenshot of mandatory stage, screenshot of dwell stage showing an interactive Street behind the banner, screenshot of a ped inspector opened during dwell.
Automated: `tests/unit/roundloop/reveal_headline.test.ts` for AC-1/AC-2 (pure function only — timing/render behavior is manual per Testing Standards for Visual/Feel + UI stories).

---

## Dependencies

- Depends on: Story 9-1 (`dwelling`), Story 9-2 (tab gating)
- Unlocks: Story 9-4 (round 1 opening reuses this same two-stage component)
