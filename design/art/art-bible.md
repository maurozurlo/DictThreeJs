# Art Bible — Dict Three
**Version**: 1.0 (reverse-documented from production code)
**Last Updated**: 2026-06-14
**Status**: Sections 1–4 complete (visual foundation, color, typography, layout)

---

## Section 1: Visual Identity Foundation

### One-Line Visual Rule
> **Retro pixel-art dictatorship — dark wood-panel warmth, amber glow, bureaucratic severity.**

### Visual Pillars

1. **Pixel-perfect at all scales.** All border-image assets use `image-rendering: pixelated`. No anti-aliasing, no sub-pixel rendering. If it blurs, it's wrong.
2. **Dark warmth, not darkness.** The background is not black — it's deep brown (`#2b1807`). The game feels like a wood-panelled war room at night, not a void.
3. **Amber as authority.** The accent color (`#fbee32`) is the dictator's color. It means "this matters." Use it for titles, active states, and calls to action. Do not scatter it.
4. **Pixel borders signal game UI.** The `hudbg.png` and `button.png` 9-slice assets define the game's UI language. Anything that uses these borders is "in the game world." Anything that doesn't (e.g., a plain div) is background or structural.
5. **Economy of color.** Only four text tones exist (`--text-color`, `--text-body`, `--accent-color`, `--accent-muted`). New UI elements must use one of these — not introduce new values.

### Tone
The visual language should feel like a government form designed by someone who wanted it to feel important. Clipped. Dense. Authoritative. Slightly oppressive. The humor comes from the gap between this severity and the absurdity of the content.

---

## Section 2: Color System

All colors below are the authoritative token set. Hardcoded hex values in components should be migrated to these tokens over time. Exceptions (semantic one-off colors like income green and expense red) are noted.

### CSS Custom Properties (defined in `src/index.css`)

| Token | Value | Usage |
|-------|-------|-------|
| `--text-color` | `#ffffff` | Primary text, headings, UI labels |
| `--text-body` | `#dfdfdf` | Body text, descriptions, secondary labels |
| `--accent-color` | `#fbee32` | Titles, active tab borders, call-to-action highlights, advance ring |
| `--accent-muted` | `#d1d37f` | h2/h3 headings, span elements, secondary accent |
| `--text-color-dark` | `#000000` | Text on light backgrounds (rare) |
| `--text-body-dark` | `#3f3f3f` | Body text on light backgrounds (rare) |
| `--hud-border-dark` | `#401d09` | HUD panel dividers, faction relation box borders |
| `--hud-panel-bg` | `#2b1807` | All HUD panel backgrounds (navbar, action panel, modals, tabs) |

### Semantic One-Off Colors (not tokenized — convert to tokens in future)

| Name | Value | Usage | Location |
|------|-------|-------|----------|
| income-green | `#27ae60` | Positive money delta, income values | Tabs.module.css, EndScreen.module.css, DayEnded.module.css |
| expense-red | `#e74c3c` | Negative money delta, expense values | Same files |
| warning-yellow | `#f1c40f` | Rounds remaining warning | Tabs.module.css |
| gold | `#ffd700` | Advance-ring spin gradient, advance hint text | Navbar.module.css |
| card-bg | `#401d09` | Content card background | Card.module.css |
| card-border | `#5e2d0b` | Content card border | Card.module.css |
| button-brown | `brown` (CSS named) | Button and select background base | Button.module.css, Tabs.module.css |
| option-bg | `#3a0000` | `<select>` option dropdown background | Tabs.module.css |
| lose-overlay | `rgba(80, 0, 0, 0.88)` | End-screen overlay on defeat | App.module.css |
| victory-overlay | `rgba(0, 60, 20, 0.88)` | End-screen overlay on victory | App.module.css |
| scrim | `rgba(0, 0, 0, 0.85)` | Generic modal scrim | App.module.css |
| tooltip-bg | `#111` | Hover tooltip background | Navbar.module.css |

### Proposed Future Tokens (migration targets)

```css
--income-green: #27ae60;
--expense-red: #e74c3c;
--warning-yellow: #f1c40f;
--gold: #ffd700;
--card-bg: #401d09;
--card-border: #5e2d0b;
--button-brown: #8b2500;   /* approximate — CSS "brown" = #a52a2a */
--scrim: rgba(0, 0, 0, 0.85);
```

---

## Section 3: Typography

### Font Families

| Font | File | Role | Usage |
|------|------|------|-------|
| `PressStart2P` | `/assets/fonts/PressStart2P.ttf` | **Primary** — all game UI text | Set on `html, body, #root` and `button`; dominates everything |
| `8-BIT WONDER` | `/assets/fonts/8-BIT WONDER.ttf` | Reserved / decorative | Loaded but not yet used in components |
| `Bitmgothic` | `/assets/fonts/Bitmgothic.ttf` | Reserved / alternate | Loaded but not yet used in components |

**Rule**: PressStart2P is the only active font. Do not introduce a new font without an ADR — pixel fonts render at specific px sizes and scale must be decided deliberately.

### Type Scale

| Selector / Class | Size | Color token | Usage |
|-----------------|------|-------------|-------|
| `h1` | `2rem` | `--text-color` | Screen titles |
| `h2` | inherited | `--accent-muted` | Section headings in tab content |
| `h3` | inherited | `--accent-muted` | Sub-section headings (underlined) |
| `p` | `1.25rem` | `--text-body` | Body copy |
| `span` | `1rem` | `--accent-muted` | Inline labels |
| HUD stats | `0.7rem` | `--text-color` | Action panel stat rows |
| Small UI | `0.55–0.65rem` | varies | End screen fine print, tooltip text, faction names |
| Section titles | `0.55rem` | `--accent-color` | End screen section headers (all-caps, letter-spacing 0.1em) |
| `.gameTitle` | `1rem` | `--text-color` | Navbar game title |

### Type Rules

- **No italic** in game UI — PressStart2P has no italic variant; CSS italic produces a faux slant. Exception: `.outcomeQuote` uses `font-style: italic` for narrative quotes only.
- **All-caps labels** use `text-transform: uppercase` + `letter-spacing: 0.05–0.1em` for legibility at small sizes.
- **Line height** for small pixel text must be at least `1.6–1.8` to prevent vertical collision between pixel rows.
- **`0.45rem` is the minimum** rendered text size in use (faction names on end screen). Below this, PressStart2P becomes illegible at 1× DPI. Do not go smaller.

---

## Section 4: Layout Zones and Spacing

### Screen Zones

The game UI is divided into three fixed vertical zones, plus a modal/overlay layer above all.

```
┌─────────────────────────────────┐  ← top: 0
│           NAVBAR                │  84px  (--navbar-height)
│  [title] [tabs] [advance btn]   │  z-index: 100
├─────────────────────────────────┤  ← top: 84px
│                                 │
│         TAB CONTENT             │  calc(100vh - 84px - 200px)
│  (laws / deals / meet / log /   │  z-index: 4–76
│    menu / street / secret)      │
│                                 │
├─────────────────────────────────┤  ← bottom: 200px
│         ACTION PANEL            │  200px  (--action-panel-height)
│  [treasury] [relations] [btns]  │  z-index: 75
└─────────────────────────────────┘  ← bottom: 0

MODAL / OVERLAY LAYER              z-index: 999+
  (DayEnded, EndScreen, Tutorial,
   HelpOverlay, FadeOverlay)
```

### Zone Specifications

| Zone | Height | Background | Border asset | z-index |
|------|--------|------------|--------------|---------|
| Navbar | 84px (`--navbar-height`) | `hudbg.png` 9-slice | `hudbg.png` | 100 |
| Tab content | fluid | `--hud-panel-bg` or `--tab-bg` | none / `hudbg.png` card variant | 4–76 |
| Action panel | 200px (`--action-panel-height`) | `hudbg.png` 9-slice | `hudbg.png` | 75 |
| Fade overlay | full screen | opacity-animated black | none | 50 |
| Modal scrim | full screen | `rgba(0,0,0,0.85)` + `backdrop-filter: blur(4px)` | none | 999 |
| Modal card | auto | `--hud-panel-bg` | `2px solid --accent-color` | 999 |
| Debug overlay | bottom-right corner | none | none | 99–100 |

### Action Panel Column Grid

The action panel uses a 3-column fixed grid:

```
240px           200px         1fr
[treasury/clock] [relations]  [action buttons / active tab]
```

Columns are separated by `4px solid --hud-border-dark` vertical rules (`.border-right`).

### Spacing Scale

Spacing follows a loose 0.25rem base unit. These values appear consistently across components:

| Name | Value | Usage |
|------|-------|-------|
| xs | `0.25rem` | Tight padding, small gaps |
| sm | `0.5rem` | Standard gap between related elements |
| md | `0.75rem` | Section padding, moderate gaps |
| base | `1rem` | Standard padding unit |
| lg | `1.25rem` | Modal/card internal gaps |
| xl | `1.5rem` | Section separation |
| 2xl | `2rem` | Page padding (tab content) |
| 3xl | `3rem` | Modal card padding |
| 4xl | `4rem` | Column separation in two-column layouts |

### Border Styles

| Style | Usage |
|-------|-------|
| `2px solid --accent-color` | Modal card borders, active legend borders |
| `3px solid --accent-color` | Left accent bar on repeal cards, records panel |
| `4px solid --hud-border-dark` | HUD dividers (action panel column separators) |
| `4px solid #5e2d0b` | Content card border |
| `1px solid rgba(255,255,255,0.1)` | Subtle section dividers inside dark panels |
| `border-image: hudbg.png 24 fill` | 9-slice frame for HUD panels (navbar, action panel, tab card variant) |
| `border-image: button.png 12 fill` | 9-slice frame for interactive button elements |

### Pixel Asset Inventory

| Asset | Path | Usage |
|-------|------|-------|
| HUD frame | `/assets/hudbg.png` | Navbar, action panel, tab page card variant — 9-slice, 24px slice, repeat: stretch |
| Button frame | `/assets/button.png` | All buttons, selects — 9-slice, 12px slice, repeat: stretch |
| Charisma slider | `/assets/respect.png` | Charisma bar background in action panel |

**9-slice rule**: All pixel border assets must use `image-rendering: pixelated` and `border-image-repeat: stretch` (not `round` or `repeat`) to preserve pixel corners at any container size.

---

## Open Questions (Sprint 5+)

- **Color tokenization**: ~8 hardcoded hex values in components should become CSS custom properties. Track in a dedicated story.
- **8-BIT WONDER and Bitmgothic**: Both fonts are loaded but unused. Decide use case or remove from bundle.
- **Dark-mode variant**: `--text-color-dark` and `--text-body-dark` exist but light-background UI is rare. Audit whether these are genuinely needed or dead tokens.
- **`--tab-bg`**: Referenced in `Tabs.module.css` but not defined in `index.css`. Currently falls back to inherited value. Define or remove.
