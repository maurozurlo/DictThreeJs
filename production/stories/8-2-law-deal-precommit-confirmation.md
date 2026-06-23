# Story 8-2: Law/Deal Pre-Commit Confirmation

> **Epic**: Budget UX
> **Status**: In Progress
> **Layer**: Feature
> **Type**: UI
> **Estimate**: 1.0 days
> **Manifest Version**: 2026-06-13
> **Last Updated**: 2026-06-22

## Context

**GDD**: `design/gdd/laws.md`
**Requirement**: `TR-laws-001`
*(Requirement text lives in `docs/architecture/tr-registry.yaml`)*

**ADR Governing Implementation**: [ADR-0008: Timed Modifier Engine](docs/architecture/adr-0008-timed-modifier-engine.md)
**ADR Decision Summary**: `acceptMods`/`rejectMods` are the source of truth for what a law or deal will do. The confirmation preview reads these specs directly — no new store state. The pending-decision state is local component state; `actUponLaw`/`actUponDeal` only fires on the second (Confirm) tap.

**Secondary ADRs**:
- [ADR-0002](docs/architecture/adr-0002-state-management-pattern.md): No new store slices — pending confirmation is ephemeral UI state, not game state.
- [ADR-0003](docs/architecture/adr-0003-react-threejs-integration.md): No Three.js imports in UI components.

**Engine**: React 19 + TypeScript | **Risk**: LOW-MEDIUM — changes the accept/reject interaction flow in `Laws.tsx` and `Deals.tsx`; no store mutations introduced.
**Engine Notes**: Use `useState` for local pending state. Do not put pending decision in Zustand — it is not game state and does not need to survive a round.

**Control Manifest Rules (Feature layer)**:
- Required: All player-facing strings through `i18next`.
- Forbidden: Gameplay logic in components — consequence formatting reads `ModifierSpec[]` but does not compute derived game values (no `sumModifiers`, no store reads in the formatter).

---

## Acceptance Criteria

**Pre-commit confirmation — Laws:**
- [ ] **AC-1**: Clicking "Approve" or "Reject" on an undecided law does NOT immediately call `actUponLaw`. Instead it sets local state `pendingDecision: true | false` and transitions the law panel to a **confirmation view**.
- [ ] **AC-2**: The confirmation view shows a header indicating the chosen action ("You are about to approve / reject this law") and a consequence list built from `currentLaw.acceptMods` or `currentLaw.rejectMods` respectively (see consequence format in Implementation Notes).
- [ ] **AC-3**: The confirmation view has two buttons: **Confirm** (calls `actUponLaw(pendingDecision)`, clears local state) and **Back** (clears local state, returns to the law card).
- [ ] **AC-4**: After `actUponLaw` fires (`lawDecided === true`), the panel shows a **post-decision summary** replacing the old "You have acted upon this law already" placeholder. The summary shows the accepted/rejected action and the same consequence list (read from `currentLaw.acceptMods` or `currentLaw.rejectMods` based on `lastLawOutcome`).

**Pre-commit confirmation — Deals:**
- [ ] **AC-5**: Same two-step flow for deals: "Accept"/"Reject" → confirmation view → Confirm/Back.
- [ ] **AC-6**: Consequence list built from `currentDeal.acceptMods` or `currentDeal.rejectMods`.
- [ ] **AC-7**: After `actUponDeal` fires, the existing post-decision outcome text (from `lastDealOutcome`) is preserved. The consequence list is shown beneath it.

**Consequence list format:**
- [ ] **AC-8**: Each `ModifierSpec` in the chosen mods list renders as a single human-readable line with a timing label:
  - `time: 0` relation/charisma/budget-slider specs → **"permanent"** label
  - `time: 1` treasury spec → **"next round"** label
  - `time: 0` roundIncome/roundExpense spec → **"per round"** label
  - Unknown time values → no label (future-proof)
- [ ] **AC-9**: Amounts are signed and coloured (positive = green, negative = red). Stat names are translated via i18n (e.g., `stat.military`, `stat.treasury`).
- [ ] **AC-10**: Empty `acceptMods`/`rejectMods` (weird laws on reject path, some deal reject paths) render as "No immediate effects."
- [ ] **AC-11**: All strings are i18n keys (EN + ES).

**Regression:**
- [ ] **AC-12**: `tsc -b` exits 0.
- [ ] **AC-13**: `npx vitest run` — 0 new failures.

---

## Implementation Notes

### Local state shape

```tsx
// In Laws.tsx and Deals.tsx
const [pendingDecision, setPendingDecision] = useState<boolean | null>(null);
```

`null` = no pending decision (show law/deal card or post-decision summary).
`true` = player clicked Accept, waiting for Confirm.
`false` = player clicked Reject, waiting for Confirm.

Reset to `null` after Confirm fires or on Back.

### Consequence formatter

Extract a shared pure function (or small component) — `formatConsequences(specs: ModifierSpec[], t): ConsequenceLine[]`. Keep it in a new file `src/Utils/formatConsequences.ts` so both Laws and Deals can import it without coupling the components together.

```ts
type ConsequenceLine = { label: string; amount: number; timing: string };

export function formatConsequences(specs: ModifierSpec[], t: TFunction): ConsequenceLine[] {
    return specs.map(s => ({
        label: t(`stat.${s.stat}`),
        amount: s.amount,
        timing: s.stat === 'treasury' && s.time === 1  ? t('consequence.next_round')
               : s.time === 0 && (s.stat === 'roundIncome' || s.stat === 'roundExpense') ? t('consequence.per_round')
               : s.time === 0                          ? t('consequence.permanent')
               : '',
    }));
}
```

### i18n keys to add

```json
// public/locales/en/menu.json
"consequence.next_round":    "next round",
"consequence.permanent":     "permanent",
"consequence.per_round":     "per round",
"consequence.none":          "No immediate effects.",
"consequence.confirm_approve": "You are about to approve this law.",
"consequence.confirm_reject":  "You are about to reject this law.",
"consequence.confirm_accept_deal": "You are about to accept this deal.",
"consequence.confirm_reject_deal": "You are about to reject this deal.",
"consequence.confirm":       "Confirm",
"consequence.back":          "Back",
"stat.military":             "Military relations",
"stat.business":             "Business relations",
"stat.people":               "People relations",
"stat.charisma":             "Charisma",
"stat.treasury":             "Treasury",
"stat.roundIncome":          "Income",
"stat.roundExpense":         "Expense",
"stat.securitySpend":        "Security budget",
"stat.educationSpend":       "Education budget",
"stat.healthSpend":          "Health budget",
"stat.infrastructureSpend":  "Infrastructure budget",
"stat.businessTaxes":        "Business tax rate",
"stat.peopleTaxes":          "People tax rate"
```

### Post-decision summary (AC-4)

Replace `t('acted_upon_law')` with:
- A heading: "Approved" or "Rejected" (based on `lastLawOutcome`)
- The consequence list from `acceptMods` or `rejectMods` (same formatter, no interaction needed)

For deals, the existing `outcome` text (flavour) stays at the top; the consequence list is appended beneath it.

### Weird laws

Weird laws have `rejectMods: []` by design. The confirmation still appears on Reject (showing "No immediate effects.") so the flow is consistent. On Accept, their `acceptMods` contain class-A one-time specs which display normally.

---

## Out of Scope

- Showing projected `netChange` inside the confirmation step (cross-reference with Budget tab — let the player check the Budget tab for that)
- Keyboard shortcuts for Confirm/Back
- Animated transitions between card → confirmation → post-decision views
- Any changes to `actUponLaw`/`actUponDeal` store logic
- `formatConsequences` covering all edge cases beyond current content (future stats forward-compatible via the fallback `timing: ''`)

---

## QA Test Cases

- **AC-1**: Click Approve on an undecided law → `actUponLaw` has NOT been called; law panel shows confirmation view.
- **AC-3 (Back)**: Click Back in confirmation view → law panel returns to original card; both buttons enabled.
- **AC-3 (Confirm)**: Click Confirm → `actUponLaw(true)` fires; `lawDecided` becomes true.
- **AC-4**: Post-decision view shows consequence list, no "acted_upon_law" text.
- **AC-8**: A law with `acceptMods: [{ stat:'treasury', amount:-50, time:1 }]` shows "Treasury −50 (next round)".
- **AC-8**: A law with `acceptMods: [{ stat:'military', amount:2, time:0 }]` shows "Military relations +2 (permanent)".
- **AC-10**: A law with `rejectMods: []` confirmation shows "No immediate effects."
- **AC-5–7**: Same flow verified for a deal.

---

## Test Evidence

**Story Type**: UI
**Required evidence**: Manual walkthrough doc at `production/qa/evidence/8-2-precommit-confirmation-evidence.md`
- Step through approve/reject/back/confirm for a law; confirm timing labels correct.
- Step through accept/reject/back/confirm for a deal; confirm flavour text + consequences both shown post-decision.
- Verify weird law reject path shows "No immediate effects."

---

## Dependencies

- Depends on: Story 8-1 DONE (budget projection gives context — player can consult Budget tab during the confirmation pause)
- Unlocks: Nothing — standalone UX story
