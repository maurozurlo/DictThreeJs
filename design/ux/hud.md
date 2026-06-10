# HUD Design

> **Status**: In Review
> **Author**: Mauro Zurlo + ux-designer
> **Last Updated**: 2026-06-10
> **Template**: HUD Design

---

## HUD Philosophy

The UI provides only what's needed to make decisions. The world shows what those decisions actually did.

Critical status (relations, treasury) lives at the periphery — visible but not dominant. The center of the screen belongs to the 3D scene: the Street View and its camera positions are the game's consequence feedback layer, showing how the player's choices manifest in the world (army presence from security spend, statues from shop purchases, civilian density from welfare decisions). The HUD never competes with this.

**Design constraint this creates:** Loss-condition data earns always-visible status. Contextual and informational data lives at the edge. The 3D scene — including Street View when implemented — must remain unobstructed during active gameplay. Any element that would cover the scene center must justify that intrusion (e.g. event modals that lock tabs).

---

## Information Architecture

### Full Information Inventory

All information the game must communicate to the player, identified from source systems and GDD requirements.

| # | Item | Source System | Category | Notes |
|---|------|---|---|---|
| 1 | Relations — Military | Relations store | Must Show | –10 = game over (overthrow) |
| 2 | Relations — Business | Relations store | Must Show | –10 = game over (overthrow) |
| 3 | Relations — People | Relations store | Must Show | –10 = game over (overthrow) |
| 4 | Treasury | Budget store | Must Show | 0 = game over (bankruptcy) |
| 5 | Round timer | Timer hook | Must Show | Always visible during active round; expires without Meet action → faction penalty |
| 6 | Charisma | Game management | Must Show | –10 to +10; affects dialogue, eliminate backlash, special ending |
| 7 | Tab navigation | Tabs store | Must Show | Always visible during gameplay; shows disabled state when tabs locked |
| 8 | Pending action dots | Tabs + action stores | Must Show | Appear on tab buttons when Meet / Law / Deal / mini-challenge unresolved |
| 9 | Round counter | Game management | Contextual | Shown at round start/end transitions only |
| 10 | Secret tab | Special ending store | Contextual | Appears in tab bar + dialog announcement when a faction reaches +10 |
| 11 | Day-ended summary | Game management | Contextual | Auto-overlay when round resolves: income, expenses, net, continue button |
| 12 | Projected financials | Budget calculation | Contextual | Shown in skip flow when player triggers early round end |
| 13 | Daily event headline | Daily event store | Contextual | Log tab only; Log tab receives a pending dot when new event arrives |
| 14 | Tab lock state | Tabs store | Contextual | Communicated via disabled tab state during periodic events |
| 15 | Security figures in scene | 3D scene | Hidden | World communicates it — no HUD text or icons |
| 16 | Statues in scene | 3D scene | Hidden | World communicates it — no HUD text or icons |
| 17 | Street View consequences | 3D scene (planned) | Hidden | World communicates it — no HUD text or icons |
| 18 | Meet/Laws action panel | ActionPanel | Contextual | Appears inside ActionPanel when Meet or Laws tab is active |

### Categorization

| Category | Items |
|---|---|
| **Must Show** | Relations ×3, Treasury, Timer, Charisma, Tab nav, Pending dots |
| **Contextual** | Round counter, Secret tab, Day-ended overlay, Projected financials, Daily event, Tab lock, Meet/Laws panel |
| **On Demand** | *(none)* |
| **Hidden** | Security figures, Statues, Street View — 3D scene carries all visual consequence feedback |

> **Implementation gap:** Round counter is currently always visible in the Navbar. The agreed design intent is *Contextual — round start/end transitions only*. This diverges from the current implementation. Resolution deferred — not a blocker for this spec.

---

## Layout Zones

**Zone 1: Navigation Bar (top, full width)**
- Component: `Navbar`
- Contains: Game title (clickable → Menu during gameplay), tab buttons with pending dots, round counter (contextual)
- Height: Fixed header
- Behavior: Hidden when on Menu screen (`displayTabs = false`); always visible during active gameplay

**Zone 2: Status & Action Panel (right, fixed width)**
- Component: `ActionPanel`
- Contains all Must Show status: Timer, Treasury, Relations ×3, Charisma
- Also contains Contextual: Meet action buttons, Laws action buttons (when those tabs are active)
- Rationale: Meet and Laws render here — not in the center area — so the 3D scene remains visible when the player is taking actions
- Height: Full viewport height minus navbar
- Behavior: Hidden during Menu screen; visible during all active gameplay states

**Zone 3: Tab Content Area (center)**
- Components: `TabManager` → Log, Budget, Deals, Shop, Secret, Menu
- Note: Meet and Laws do NOT render here — they render inside Zone 2
- The 3D scene (Zone 4) is visible through / behind this zone. Tab panels render as overlays above the scene.
- Behavior: Active tab panel is visible; others are mounted but hidden (`isActive` prop)

**Zone 4: 3D Scene (background, full viewport)**
- Component: `Scene`
- Always rendered; sits behind all UI zones
- The consequence feedback layer: security figures, statues, Street View changes (planned)
- Must remain partially visible in center during all gameplay states — core philosophy constraint

**Zone 5: Overlays (contextual, full viewport)**
- Components: Day-ended summary card, Skip confirmation (inline in Zone 2), EndScreen, DictatorHands (Laws tab animation)
- Overlays may cover Zones 3 and 4 during critical moments (round end, periodic events, game over)
- Never cover Zone 2 (status must remain readable during overlays)

```
┌──────────────────────────────────────────────────────────────────┐
│   ZONE 1: NAVBAR                                                  │
│   [Title][Log●][Meet●][Laws][Deals●][Budget][Shop][Street][???]  │
│                                                       [▶ End]    │
├────────────────────────────────────────┬─────────────────────────┤
│                                        │  ZONE 2: STATUS         │
│   ZONE 3: TAB CONTENT                  │  Timer                  │
│   (Log / Budget / Deals /              │  Treasury               │
│    Shop / Street / Secret)             │  Mil / Bus / Ppl        │
│                                        │  Charisma               │
│   ZONE 4: 3D SCENE (behind)            │  ───────────────        │
│   Visible when tab area                │  [Meet/Laws UI]         │
│   is not fully occupied                │                         │
├────────────────────────────────────────┴─────────────────────────┤
│   ZONE 5: OVERLAYS (contextual — round end, events, game over)   │
└──────────────────────────────────────────────────────────────────┘
```

### Visual Budget

Maximum simultaneous persistent UI elements: **9**

| Zone | Max elements | Screen area cap |
|---|---|---|
| Zone 1 (Navbar) | 1 bar | ≤ 10% viewport height |
| Zone 2 (Status panel) | 6 elements (Timer, Treasury, Relations ×3, Charisma) | ≤ 25% viewport width |
| Zone 3 + 4 (Content + scene) | — | ≥ 65% viewport width must remain available |
| Zone 5 (Overlays) | 1 overlay at a time | Up to 80% viewport when active |

Any proposed addition to Zone 1 or Zone 2 that would exceed these caps requires explicit design approval — it must either replace an existing element or justify an exception against the HUD Philosophy.

---

## HUD Elements

### Zone 1: Navigation Bar Elements

**Game Title**
- Zone: Zone 1
- Category: Must Show
- Display: Text — game title
- Behavior: Static during Menu. During active gameplay: clickable link back to Menu tab.
- Update: Static

**Tab Buttons**
- Zone: Zone 1
- Category: Must Show
- Display: Icon + label. Tab order: Log, Meet, Laws, Deals, Budget, Shop, Street. Secret tab: conditional (appears after all others when unlocked).
- Disabled state: Visually disabled during periodic events (tabs lock). Secret tab hidden until triggered.
- Pending dot: Visible on Log, Meet, Laws, Deals when actions are unresolved (phase = 'start')
- Update: On tab state change

**Next Round / Skip Button**
- Zone: Zone 1 — right end of tab bar, same visual level as tab buttons
- Category: Contextual — visible only during phase = 'start', before `dayEnded`
- Rationale: Belongs with navigation, not with the status panel. ActionPanel stays focused on status-only information.
- Two visual states — color-coded:
  - **All actions complete** → label "Next Round" — primary/positive color (green or accent), inviting
  - **Actions pending** → label "Skip" — warning color (orange or muted), communicates risk
- **Confirmation overlay (Skip state):** Full-screen overlay covering all zones including the 3D scene. Contains: warning message explaining the penalty, projected financials for the round, Confirm and Cancel buttons. Full-screen treatment communicates the gravity of advancing without completing actions.
- **Confirmation overlay (Next Round state):** Full-screen overlay shows projected financials only — no warning treatment. Player confirms before the round resolves.

**Round Counter**
- Zone: Zone 1
- Category: Contextual — round start/end transitions only
- Display: "Round N / 10"
- Behavior: Visible during round transition moments; not persistently displayed
- Implementation gap: Currently always visible in Navbar — deferred design decision

---

### Zone 2: Status & Action Panel Elements

**Timer**
- Zone: Zone 2
- Category: Must Show
- Display: Clock icon + countdown text (MM:SS)
- Update: Real-time (every second via `useRoundTimer`)
- Visibility: Active during phase = 'start', before `dayEnded`; hidden when round ends

**Treasury**
- Zone: Zone 2
- Category: Must Show
- Display: Label ("Treasury") + formatted currency value (e.g. $240M)
- Update: Event-driven — any action that modifies treasury

**Faction Relations — Military / Business / People**
- Zone: Zone 2
- Category: Must Show
- Display: Faction icon + numeric value + color coding
- Color rules:
  - Value ≤ –7: red — critical danger
  - Value –6 to –4: orange — warning
  - Value –3 to +3: neutral (default text color)
  - Value ≥ +4: green — favourable
- Update: Event-driven — any action that modifies relations
- Colorblind note: Color is supplementary — the numeric value is always visible. No information is conveyed by color alone.

**Charisma**
- Zone: Zone 2
- Category: Must Show
- Display: Label ("Charisma") + horizontal slider with needle indicator (–10 to +10 mapped to position)
- Update: Event-driven — any action that modifies charisma

**Meet / Laws Action Panel (contextual)**
- Zone: Zone 2
- Category: Contextual
- Display: Rendered inside Zone 2 when Meet or Laws tab is active
  - Meet: Selected faction name + action buttons (Bribe, Eliminate, Expropriate, Dialogue) or outcome text after action taken
  - Laws: Proposal text + Approve / Reject buttons, or acted-upon confirmation
- Visibility: Visible only when `activeTab === Tabs.Meet` or `activeTab === Tabs.Laws`

---

### Zone 5: Overlay Elements

**Day-Ended Summary Card**
- Category: Contextual
- Trigger: `dayEnded = true` during phase = 'start'
- Display: Card modal — Round N header, income, expenses, net (color-coded ±), Continue button
- Behavior: Player must press Continue to advance. Cannot be dismissed without proceeding.

**Round Confirmation Overlay (Next Round / Skip)**
- Category: Contextual
- Trigger: Player clicks the Next Round / Skip button in Zone 1
- Display: Full-screen overlay covering all zones (including 3D scene)
  - Skip variant: Warning message explaining the miss-action penalty + projected round financials + Confirm / Cancel
  - Next Round variant: Projected round financials only (no warning) + Confirm / Cancel
- Behavior: Cancel returns player to current game state. Confirm advances the round.

**Secret Tab Announcement Dialog** *(new pattern — flag for interaction pattern library)*
- Category: Contextual
- Trigger: A faction relation reaches +10 for the first time
- Display: Dialog announcing the secret ending is now accessible via the Secret tab
- Behavior: Dismissable. One-time per game session. Does not lock tabs.

---

## Dynamic Behaviors

**Phase-based HUD visibility**

| Game phase | Zone 1 (Navbar) | Zone 2 (ActionPanel) | Zone 3 (Tab content) | Zone 5 (Overlays) |
|---|---|---|---|---|
| `idle` (Menu) | Title only, no tabs | Hidden | Menu tab | — |
| `start` (active round) | Full — tabs + End Round btn | Visible — all status | Active tab | Pending if day-ended |
| `lose` / `victory` / `special_ending` | Visible (behind overlay) | Visible (behind overlay) | Visible (behind overlay) | EndScreen covers all |

**Tab order**
Log · Meet · Laws · Deals · Budget · Shop · Street · [Secret — conditional]

**Tab lock (periodic events — rounds 3, 6, 9)**
- Trigger: `tabsLocked = true`
- Effect: Meet, Laws, Deals, Budget, Street tab buttons render disabled
- Log and Shop tabs remain accessible (Shop uses a secret bypass independent of tab lock)
- The Next Round / Skip button remains accessible — player can still end a round during an event

**Pending action dots**
- Appear on Meet, Laws, Deals, Log tab buttons when phase = 'start' and the corresponding action is unresolved
- Disappear as each action is taken; cleared fully at round end

**Secret tab reveal**
- Trigger: Any faction relation first reaches +10
- Sequence: Secret tab appears in tab bar → announcement dialog fires (new pattern — flag for pattern library) → player dismisses → Secret tab accessible for remaining rounds
- One-time per game session; persists once unlocked
- **Overlay priority rule:** If a periodic event is active when the secret ending unlocks, the periodic event takes priority. The announcement dialog is queued and fires immediately after the event is resolved and dismissed.

**Day-ended overlay sequence**
- Trigger: Round timer expires OR player confirms the round-end overlay
- Full-screen overlay; player cannot interact until Continue is pressed
- After Continue: relations update, events fire, round increments, new round begins

---

## Platform & Input Variants

Single target: Web browser, Keyboard/Mouse only. No gamepad or touch variants required.

**Viewport:** No mobile safe zones. Minimum supported viewport width: 1024px — narrower viewports would compress the right sidebar and tab bar unacceptably. Layout is not responsive below that threshold.

**Keyboard navigation:** Tab key must cycle through interactive elements in logical order within each zone. The Next Round / Skip button in Zone 1 must be reachable by keyboard without requiring mouse interaction.

---

## Accessibility

Accessibility tier: Not formally defined for this project (see Open Questions).

**Colorblind compliance:** Relations color coding (red/orange/green) uses color as supplementary signal only — numeric values are always present. No information is conveyed by color alone. This satisfies the minimum bar.

**Focus indicators:** All interactive elements (tab buttons, Next Round/Skip, action buttons in Zone 2) must have visible keyboard focus indicators.

**Screen reader:** Faction relation values and treasury must have accessible labels — not icon-only — so assistive tools can read them.

**Reduced motion:** The charisma needle, pending dot animations, and overlay transitions should respect `prefers-reduced-motion`.

---

## Open Questions

1. **Round counter display** — Currently always visible in Navbar. Design intent is contextual (round start/end only). Deferred; needs a decision before the next UI sprint.
2. **Accessibility tier** — No formal tier defined. Recommend WCAG-AA as a baseline. Run a contrast audit against current theme colors.
3. **Minimum viewport** — 1024px proposed. Validate against actual usage (browser analytics) before enforcing.
4. **Next Round / Skip button relocation** — Currently in ActionPanel (Zone 2). Spec moves it to Zone 1 Navbar. This is an implementation change that needs a dev story.
5. **Street View tab** — Tab is specified as always visible. Street View content is planned but not yet implemented. Decide whether to show the tab as disabled/placeholder until content ships, or hide it until the feature is complete.
6. **Secret tab announcement dialog** — New pattern not yet in the codebase. Needs to be added to the interaction pattern library before implementation.
7. **Player journey map** — Not yet created. Designing this spec without it means player arrival context for some states is assumed. Consider running `/ux-design` for the player journey after this spec is reviewed.
