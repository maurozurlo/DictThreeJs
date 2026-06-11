# First-Run Tutorial Spec: Dictator Simulator
**Document:** `design/ux/tutorial-onboarding.md`
**Author:** ux-designer
**Status:** Final Draft
**Date:** 2026-06-11
**Dependencies:** `design/ux/hud.md`

---

## 1. Purpose and Scope

This document specifies the complete first-run tutorial experience for the dictator simulator. It is self-contained: a programmer can implement the full tutorial from this document alone without reference to any other design document.

The tutorial covers the player's first game session, from the moment they press Play to the moment they take their first round action. It does not cover mid-game hints or the advanced mechanic unlocks (Secret tab, periodic events).

---

## 2. Design Goals

**Primary goal:** Get the player to their first Meet action within 90 seconds without them needing to read the Help overlay.

**Secondary goals:**
- Teach the HUD's loss conditions before the player can act (so the stakes are understood)
- Establish the 3D scene as interactive, not decorative
- Never block the player for longer than necessary
- Respect the HUD Philosophy: never let tutorial chrome obscure the 3D scene permanently

**Non-goals:**
- Teaching Laws and Deals mechanics in the tutorial (the player will encounter them naturally and can consult the Help overlay)
- Covering edge cases, periodic events, or the Secret tab
- Replacing the Help overlay — the tutorial is a one-time guide, not a reference

---

## 3. Tutorial Architecture

### 3.1 Trigger Condition

The tutorial fires on the **first game session only**, determined by a `tutorialComplete` flag persisted in localStorage. Default value: `false`.

If `tutorialComplete === true`, skip all tutorial logic. The tutorial never replays automatically.

Implementation note: The flag is set to `true` at the end of Step 8 (tutorial complete). If the player closes the browser before finishing, it replays from the beginning next session — not from where they left off. This avoids partial-state complexity.

### 3.2 Tutorial Layer

All tutorial chrome (spotlight, tooltip cards, pulse indicators) renders in a dedicated overlay layer that sits **above** all game UI but uses `pointer-events: none` on non-interactive parts so the underlying game UI remains clickable when the tutorial does not require a specific target.

The game is live during the tutorial. The 3D scene renders. The round clock does not run — the tutorial holds the timer at round start.

### 3.3 Timer Behavior

The round timer does **not** start until Step 8 is complete and `tutorialComplete` is set. The tutorial system calls `pauseTimer()` on mount and `resumeTimer()` on completion. The game store timer must support a paused/unpaused flag.

### 3.4 Spotlight Primitive

The spotlight is a darkening overlay with a transparent cut-out over the target element. Two cut-out shapes:
- **Rectangular** — for UI panels, tab buttons, stat rows
- **Circular/soft-edged** — for 3D scene character models

Implementation: CSS box-shadow technique — a `position: fixed` full-viewport div with `box-shadow: 0 0 0 9999px rgba(0,0,0,0.75)` and a `border-radius` matching the target. Positioned via `getBoundingClientRect()`.

### 3.5 Tooltip Card

A small floating card anchored to the spotlighted element. Contains:
- Short instruction (max 20 words)
- Optional sub-note (max 15 words)
- "Got it" button — present only on steps that do not auto-advance

Positioning: appears on the side of the spotlight with the most available screen real estate, minimum 16px from any edge.

### 3.6 Pulse Indicator

A repeating scale animation on a specific interactive element communicating "click this." Under `prefers-reduced-motion`, replaced with a static colored ring. No flashing — pulse cycle is under 3Hz.

---

## 4. Tutorial Steps

### Overview

| Step | What player sees | Advance condition |
|------|-----------------|-------------------|
| 1 | Welcome tooltip (no spotlight) | Click "Got it" |
| 2 | Spotlight: ActionPanel (relations, treasury, clock) | Click "Got it" |
| 3 | Spotlight: pending dots on Meet / Laws / Deals tabs | Click "Got it" |
| 4a | Spotlight: Meet tab button | Player clicks Meet tab |
| 4b | Spotlight: 3D scene — three character models | Player clicks any character |
| 5 | Spotlight: Zone 2 action buttons | Click "Got it" |
| 6 | Spotlight: Budget tab | Click "Got it" |
| 7 | Spotlight: Shop tab | Click "Got it" |
| 8 | Spotlight: Street tab | Click "Got it" |
| 9 | Spotlight: Log tab | Click "Got it" |
| 10 | Spotlight: Skip / Next Round button | Click "Got it" |
| 11 | Toast: "You're in charge. Good luck." | Auto-dismiss (3s) → timer starts |

Total guided time at normal reading pace: **90–120 seconds**.

---

### Step 1 — Welcome

**Spotlight:** None. Full screen visible. Tooltip card centered.

**Copy:**
> "You are a dictator. Your job is to survive 10 days in power. Keep your factions loyal and your treasury solvent."

**Sub-note:** "This quick guide will show you the essentials."

**CTA:** "Got it"

**Advance:** Player clicks "Got it."

---

### Step 2 — The Stakes (HUD Status Panel)

**Spotlight:** Full ActionPanel (Zone 2) — relations rows, treasury display, clock.

**Callout position:** Left of the spotlight.

**Copy:**
> "These are your loss conditions. Any faction hitting the floor, or treasury at zero, ends your reign."

**Sub-note:** "Relations run -10 to +10. Treasury must stay above zero."

**CTA:** "Got it"

**Advance:** Player clicks "Got it."

---

### Step 3 — Pending Dots

**Spotlight:** Navbar — the Meet, Laws, and Deals tab buttons (wide rectangular cut-out spanning all three).

**Callout position:** Below the Navbar.

**Copy:**
> "Dots mean unfinished business. Take an action in Meet, Laws, and Deals before time runs out."

**Sub-note:** "You don't have to do them in order."

**CTA:** "Got it"

**Advance:** Player clicks "Got it."

---

### Step 4a — Meet Tab Navigation

**Spotlight:** Meet tab button only in the Navbar. Pulse indicator on the Meet button.

**Callout position:** Below the Meet button. No "Got it" — the card shows a waiting affordance (blinking arrow).

**Copy:**
> "Start here. Open the Meet tab to choose a faction to deal with today."

**Advance:** Player clicks the Meet tab. Auto-advances to Step 4b once `activeTab === Tabs.Meet`.

**Implementation note:** Meet tab must not be disabled during this step.

---

### Step 4b — The 3D Scene (Choose a Faction)

**Trigger:** Fires after the tab transition settles (~300ms after `activeTab === Tabs.Meet`).

**Spotlight:** 3D scene Canvas element. A single wide soft-edged oval cut-out encompasses all three character model positions.

**Callout position:** Bottom edge of the 3D scene (or left edge if bottom is obstructed by ActionPanel).

**Copy:**
> "These are your factions. Click a character to choose who to meet with today."

**Sub-note:** "Military, Business, or People — pick one."

**Pulse:** Three individual pulse rings over each character model, rendered as absolutely-positioned DOM elements whose screen coordinates are calculated by projecting world-space positions each frame.

**Character world-space positions for pulse placement:**
- Business (Elite): `[-1.435, 0.60, -0.19]`
- Military (Police): `[-1.335, 0.642, -0.19]`
- People: `[-1.242, 0.629, -0.15]`

**Advance:** Player clicks any character model → `selectedPower !== 'none'`. Auto-advances.

**Keyboard fallback:** If player presses Tab, three visually-hidden but accessible buttons appear in the overlay: "Meet: Military", "Meet: Business", "Meet: People". Each calls `setSelectedPower` for its faction.

---

### Step 5 — Action Buttons

**Trigger:** `selectedPower` changed from `'none'` to any faction.

**Spotlight:** Zone 2 ActionPanel — the four action buttons (Bribe, Eliminate, Expropriate, Dialogue) now visible.

**Callout position:** Left of ActionPanel.

**Copy:**
> "These are your options. Dialogue is free. Bribe costs money. Expropriate and Eliminate have consequences."

**Sub-note:** "Pick one to resolve your Meet action for today."

**CTA:** "Got it"

**Advance:** Player clicks "Got it." The tutorial does **not** wait for the player to actually execute a Meet action — that follows naturally after dismissal.

---

### Step 6 — Budget Tab

**Spotlight:** Budget tab button in the Navbar.

**Callout position:** Below the Budget button.

**Copy:**
> "Your treasury is your lifeline. If it hits zero, you lose — instantly. Adjust taxes and spending in the Budget tab."

**Sub-note:** "Check it every few days. Costs add up."

**CTA:** "Got it"

**Advance:** Player clicks "Got it." Player does not need to open the Budget tab.

---

### Step 7 — Shop Tab

**Spotlight:** Shop tab button in the Navbar.

**Callout position:** Below the Shop button.

**Copy:**
> "The Shop has items that can shift the balance in your favor. Not every round needs it, but some will."

**Sub-note:** "Items cost money. Spend wisely."

**CTA:** "Got it"

**Advance:** Player clicks "Got it." Player does not need to open the Shop tab.

---

### Step 8 — Street Tab

**Spotlight:** Street tab button in the Navbar.

**Callout position:** Below the Street button.

**Copy:**
> "The Street shows your country as it is — not as you claim it to be. Watch it change as your decisions take effect."

**Sub-note:** "No actions here. Just look."

**CTA:** "Got it"

**Advance:** Player clicks "Got it."

---

### Step 9 — Log Tab

**Spotlight:** Log tab button in the Navbar.

**Callout position:** Below the Log button.

**Copy:**
> "Daily events appear in the Log tab. Check it for news that may affect your factions."

**CTA:** "Got it"

**Advance:** Player clicks "Got it." Player does not need to open the Log tab.

---

### Step 10 — Skip / Next Round Button

**Spotlight:** The Skip / Next Round button (wherever it renders in the current build — ActionPanel or Navbar).

**Callout position:** Above or left of the button.

**Copy:**
> "When all three actions are done, this ends the day early. Dots on tabs mean you're not done yet."

**Sub-note:** "Skipping with pending dots costs you a relations penalty."

**CTA:** "Got it"

**Advance:** Player clicks "Got it."

---

### Step 11 — Tutorial Complete

**Spotlight:** None. Full screen returns to normal brightness.

**Display:** Small toast notification at top-center. `role="status"`. Auto-dismisses after 3 seconds.

**Copy:** "You're in charge. Good luck."

**On display:**
1. Set `localStorage.setItem('dict_tutorial_seen', 'true')`
2. Call `resumeTimer()` — the round clock begins
3. Tutorial layer unmounts

---

## 5. Interaction Rules

### What the Player Can and Cannot Do During Tutorial

| Player action | Allowed? | Notes |
|---|---|---|
| Click spotlighted target | Yes — required to advance | Core mechanic of the tutorial |
| Click non-spotlighted tabs | No — soft-blocked | Spotlight already communicates where to go |
| Interact with Zone 2 (non-spotlight steps) | No | pointer-events blocked on scrim |
| Open the Help overlay | Yes, always | Help button is never blocked |
| Dismiss via Escape | No | Must use explicit Skip link |
| Resize window | Yes | Positions recalculated on resize |

### Soft Tab Block

During steps 1–7, clicking any tab other than the spotlighted one produces no navigation — `transitionTo` does not fire. No error is shown. Exception: the Help overlay button is never blocked.

### Overlay Priority

Tutorial does not fire while `dayEnded === true`. If a day-ended card is queued on game start (edge case), tutorial waits until that overlay is dismissed.

---

## 6. Skip / Dismiss Behaviour

A low-affordance "Skip Tutorial" text link (small, muted color, no button styling) appears in the bottom-right corner of every tooltip card from Step 1 onward.

**On skip:**
1. Tutorial overlay is immediately removed
2. `localStorage.setItem('dict_tutorial_seen', 'true')` is written
3. `resumeTimer()` is called — clock begins from where it was paused
4. Any game actions already taken during tutorial steps remain committed (not rolled back)
5. Player is left in whatever tab was active when they skipped
6. No confirmation dialog — one click skips

**Escape key does not dismiss the tutorial** — avoids accidental dismissal.

---

## 7. Replay Entry Point

A "Tutorial" button is added to the Menu tab button list, below Help:

```
New Game
Continue          (if in game)
Save Game         (if in game)
Load Game
Help              (existing — static reference overlay)
Tutorial          (new — replays the tutorial overlay)
Settings
Credits
```

**Replay behaviour:**
- Does NOT reset game state
- Replays the overlay from Step 1 on the current game state
- If `phase !== 'start'` (idle / menu), auto-starts a new game first, then begins the tutorial
- `localStorage.setItem('dict_tutorial_seen', 'true')` is set on replay entry so triggering replay from Menu and immediately closing does not re-trigger the auto-start next session

**Help vs Tutorial distinction:**

| | Help | Tutorial |
|---|---|---|
| What it is | Static reference card — all mechanics | Guided overlay — first-run essentials |
| When to use | Looking something up | Being walked through it |
| Blocks play | No | Yes — spotlights elements, pauses timer |
| Has step count | No | Yes (8 steps) |

---

## 8. localStorage Flag Specification

**Key:** `dict_tutorial_seen`
**Value:** `"true"` when written; absent = not seen

**Written when:**
- Player completes Step 8 (natural completion)
- Player clicks Skip at any step
- Player opens Tutorial from the Menu (replay entry)

**Read when:**
- `setGamePhase('start')` fires — if key is absent, trigger tutorial after phase transition settles (one frame delay)

---

## 9. Accessibility Checklist

- [ ] All "Got it" buttons focusable and activatable by Enter/Space; focus placed automatically on card appear
- [ ] Keyboard fallback buttons for Step 4b (3D scene interaction)
- [ ] No color-only information — spotlight is brightness/opacity, not color-coded
- [ ] Pulse cycle under 3Hz; replaced with static ring under `prefers-reduced-motion`
- [ ] Tooltip cards: `role="dialog"`, `aria-label` with step count (e.g. "Tutorial step 2 of 8"), focus trapped
- [ ] Toast in Step 8: `role="status"` (live region)
- [ ] Gamepad: not required — keyboard/mouse only platform

---

## 10. State Machine

```
IDLE
  | (phase → 'start' AND tutorialComplete === false)
  v
STEP_1_WELCOME
  | (player clicks "Got it")
  v
STEP_2_HUD_STATS
  | (player clicks "Got it")
  v
STEP_3_PENDING_DOTS
  | (player clicks "Got it")
  v
STEP_4A_MEET_TAB
  | (player clicks Meet tab → activeTab === Tabs.Meet)
  v
STEP_4B_SCENE_FACTIONS
  | (player clicks character → selectedPower !== 'none')
  v
STEP_5_ACTION_BUTTONS
  | (player clicks "Got it")
  v
STEP_6_BUDGET_TAB
  | (player clicks "Got it")
  v
STEP_7_SHOP_TAB
  | (player clicks "Got it")
  v
STEP_8_STREET_TAB
  | (player clicks "Got it")
  v
STEP_9_LOG_TAB
  | (player clicks "Got it")
  v
STEP_10_SKIP_BUTTON
  | (player clicks "Got it")
  v
STEP_11_COMPLETE
  | (3s elapsed → set flag, resumeTimer(), unmount)
  v
DONE
```

**Implementation notes:**
- Tutorial step state lives in a Zustand slice or React context, not localStorage (localStorage is only the completion flag)
- Each advance is a single `advanceTutorial()` call
- Tutorial subscribes to `activeTab` and `selectedPower` from game store for auto-advance detection in Steps 4a and 4b
- No `goToStep(n)` API — strictly linear
- If `debug.enabled === true`, show a "Skip Tutorial" dev button that sets the flag and calls `resumeTimer()` immediately

---

## 11. Implementation Checklist

- [ ] Add `dict_tutorial_seen` read/write to localStorage util
- [ ] Add `tutorial.step` state to Zustand store (or separate React context)
- [ ] Add `pauseTimer()` / `resumeTimer()` to game store timer system
- [ ] Build spotlight overlay component (rectangular and soft-oval cut-out variants)
- [ ] Build tooltip card component (`role="dialog"`, focus trap, keyboard "Got it")
- [ ] Build toast notification component (`role="status"`, auto-dismiss 3s)
- [ ] Build pulse indicator (DOM rings over character models; reduced-motion static ring fallback)
- [ ] Implement keyboard fallback buttons for Step 4b
- [ ] Subscribe tutorial system to `activeTab` and `selectedPower` for auto-advance
- [ ] Add debug bypass button gated on `debug.enabled`
- [ ] Add localization keys to `en` and `es` i18n files (Section 12)
- [ ] Validate tutorial does not fire when `dayEnded === true`
- [ ] Validate Help overlay is always openable during tutorial

---

## 12. Copy Reference (for i18n)

| Key | English |
|---|---|
| `tutorial.step1.body` | "You are a dictator. Your job is to survive 10 days in power. Keep your factions loyal and your treasury solvent." |
| `tutorial.step1.subnote` | "This quick guide will show you the essentials." |
| `tutorial.step1.cta` | "Got it" |
| `tutorial.step2.body` | "These are your loss conditions. Any faction hitting the floor, or treasury at zero, ends your reign." |
| `tutorial.step2.subnote` | "Relations run -10 to +10. Treasury must stay above zero." |
| `tutorial.step2.cta` | "Got it" |
| `tutorial.step3.body` | "Dots mean unfinished business. Take an action in Meet, Laws, and Deals before time runs out." |
| `tutorial.step3.subnote` | "You don't have to do them in order." |
| `tutorial.step3.cta` | "Got it" |
| `tutorial.step4a.body` | "Start here. Open the Meet tab to choose a faction to deal with today." |
| `tutorial.step4b.body` | "These are your factions. Click a character to choose who to meet with today." |
| `tutorial.step4b.subnote` | "Military, Business, or People — pick one." |
| `tutorial.step5.body` | "These are your options. Dialogue is free. Bribe costs money. Expropriate and Eliminate have consequences." |
| `tutorial.step5.subnote` | "Pick one to resolve your Meet action for today." |
| `tutorial.step5.cta` | "Got it" |
| `tutorial.step6.body` | "Your treasury is your lifeline. If it hits zero, you lose — instantly. Adjust taxes and spending in the Budget tab." |
| `tutorial.step6.subnote` | "Check it every few days. Costs add up." |
| `tutorial.step6.cta` | "Got it" |
| `tutorial.step7.body` | "The Shop has items that can shift the balance in your favor. Not every round needs it, but some will." |
| `tutorial.step7.subnote` | "Items cost money. Spend wisely." |
| `tutorial.step7.cta` | "Got it" |
| `tutorial.step8.body` | "The Street shows your country as it is — not as you claim it to be. Watch it change as your decisions take effect." |
| `tutorial.step8.subnote` | "No actions here. Just look." |
| `tutorial.step8.cta` | "Got it" |
| `tutorial.step9.body` | "Daily events appear in the Log tab. Check it for news that may affect your factions." |
| `tutorial.step9.cta` | "Got it" |
| `tutorial.step10.body` | "When all three actions are done, this ends the day early. Dots on tabs mean you're not done yet." |
| `tutorial.step10.subnote` | "Skipping with pending dots costs you a relations penalty." |
| `tutorial.step10.cta` | "Got it" |
| `tutorial.step11.toast` | "You're in charge. Good luck." |
| `tutorial.skip` | "Skip Tutorial" |
