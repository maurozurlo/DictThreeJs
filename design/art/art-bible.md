# Art Bible — Dict Three
**Version**: 2.0
**Last Updated**: 2026-06-17
**Status**: Complete — all 11 sections authored. Sections 1–4 reverse-documented from production code (2026-06-14); Sections 5–11 authored via /art-bible (2026-06-17, lean mode — AD-ART-BIBLE gate skipped).

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

All authoritative colors are tokenized as of 2026-06-14. Components reference these tokens, not raw hex.

**Text & accent**

| Token | Value | Usage |
|-------|-------|-------|
| `--text-color` | `#ffffff` | Primary text, headings, UI labels |
| `--text-body` | `#dfdfdf` | Body text, descriptions, secondary labels |
| `--accent-color` | `#fbee32` | Titles, active tab borders, call-to-action highlights, advance ring |
| `--accent-muted` | `#d1d37f` | h2/h3 headings, span elements, secondary accent |
| `--text-color-dark` | `#000000` | Text on light backgrounds (rare) |
| `--text-body-dark` | `#3f3f3f` | Body text on light backgrounds (rare) |

**HUD / panels**

| Token | Value | Usage |
|-------|-------|-------|
| `--hud-border-dark` | `#401d09` | HUD panel dividers, faction relation box borders |
| `--hud-panel-bg` | `#2b1807` | All HUD panel backgrounds (navbar, action panel, modals, tabs) |
| `--card-bg` | `#401d09` | Content card background |
| `--card-border` | `#5e2d0b` | Content card border |

**Interactive elements**

| Token | Value | Usage |
|-------|-------|-------|
| `--button-bg` | `brown` (CSS named) | Button and select background base |
| `--select-option-bg` | `#3a0000` | `<select>` option dropdown background |

**Semantic feedback**

| Token | Value | Usage |
|-------|-------|-------|
| `--income-green` | `#27ae60` | Positive money delta, income values |
| `--expense-red` | `#e74c3c` | Negative money delta, expense values, coup warning |
| `--warning-yellow` | `#f1c40f` | Rounds remaining warning |
| `--gold` | `#ffd700` | Advance-ring spin gradient, advance hint text |

**Overlays**

| Token | Value | Usage |
|-------|-------|-------|
| `--lose-overlay-bg` | `rgba(80, 0, 0, 0.88)` | End-screen overlay on defeat |
| `--victory-overlay-bg` | `rgba(0, 60, 20, 0.88)` | End-screen overlay on victory |
| `--scrim-bg` | `rgba(0, 0, 0, 0.85)` | Generic modal scrim |

### Residual hardcoded values (acceptable — not color identity)

These remain inline by design and do not need tokenizing:
- **Alpha-channel tints** — e.g. `rgba(255,255,255,.04)` ghost overlays, `rgba(39,174,96,0.1)` / `rgba(231,76,60,0.1)` (income/expense at 10% — commented in source). These are opacity variants of existing tokens; CSS custom properties don't compose with alpha cleanly without `color-mix()`.
- **Shape-math colors** — the conic-gradient mask in `Navbar.module.css` (`#000`/`#0000`) defines a pixel mask shape, not a visual color.
- **Tooltip chrome** — `#111` bg / `#555` border in `Navbar.module.css` (one-off dev-tooltip styling).
- **Newspaper palette** (`Newspaper.css`) — intentionally separate newsprint palette (#f0eddb, #616054, etc.), not part of the HUD identity.
- **Debug overlay** (`DebugRecurringOverlay.module.css`) — dev-only, not shipped UI.

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

---

## Section 5: Lighting & Atmosphere

> **Scope**: This section governs the Three.js scene only. The React UI overlay has its own color rules in Sections 1–2. All Three.js lighting must remain visually compatible with the warm-brown HUD panels visible at every screen edge.
>
> **Implementation primitives**: `AmbientLight`, `DirectionalLight`, `PointLight`, `HemisphereLight`, `Fog`. No post-processing passes. No particle systems. No custom GLSL. Mood is achieved exclusively through light color, intensity, and placement.
>
> **Fog notation**: All fog values use `THREE.Fog( color, near, far )`.

### 5.1 Design Principles

**Principle 1 — Warm floor, cool ceiling.**
The base ambient light in every state leans slightly warm (orange-amber) from below and slightly cooler (desaturated blue-grey) from above. This mimics indirect incandescent fill from below (desk lamp, floor lamp, wood-panel reflection) and the cool absence of sky above. It prevents the scene from reading as outdoors even in daylight states.

**Principle 2 — The UI is the ceiling.**
The HUD panels (navbar, action panel, tab content) are `#2b1807` deep brown with amber highlights. The 3D scene must complement this — never fight it. A cold blue scene behind warm brown panels creates a jarring border at the UI edge. Keep the scene's ambient floor warm at all times.

**Principle 3 — Pressure lifts color temperature.**
As gameplay pressure increases (timer pressure, defeat states), the scene loses warmth and shifts toward desaturated sickly tones (greenish florescent, cold white, or blood red). This mirrors the *Papers Please* institutional cold — the state doesn't care about your comfort.

**Principle 4 — Light direction depends on camera distance.**
The Meet tab uses close-up character views; lights must produce readable facial definition on character models (three-point setup logic). The Street View uses an angled overhead camera; character lighting is secondary — environment-level fill and directional sunlight angle dominate.

**Principle 5 — State transitions through light shifts, not cuts.**
When the tab changes or a modal opens, light color and fog density should lerp, not snap. The engineer should implement this as an animated uniform update over ~600ms. The art direction defines the start and end states; transition timing is ~600ms.

---

### 5.2 Standard Gameplay State
*Active tabs: Laws, Deals, Log, Menu, Secret*

**Primary emotion/mood target**: Procedural authority. The player is doing paperwork for a regime. Bureaucratically oppressive without active threat.

| Light | Type | Color (hex) | Intensity | Notes |
|-------|------|-------------|-----------|-------|
| Ambient base | `AmbientLight` | `#3d2010` | 0.6 | Deep warm brown — matches panel bg, creates floor warmth |
| Hemisphere sky | `HemisphereLight` sky | `#1a1208` | 0.4 | Near-black dark amber — no open sky |
| Hemisphere ground | `HemisphereLight` ground | `#4a2a0a` | 0.4 | Warm reflective ground |
| Key light | `DirectionalLight` | `#c87820` | 0.7 | Burnt amber; 45° above-left front (`pos: -1, 1.2, 0.8` normalized) |
| Fill light | `PointLight` | `#6b3d10` | 0.3 / decay 2 | Warm dark fill; positioned bottom-right of scene center |

**Fog**: `THREE.Fog( '#1a0d05', 12, 35 )` — dense near-black brown.

**Atmospheric descriptors**: Stifling, institutional, amber-tinged, claustrophobic, deliberate.

**Energy level**: Measured.

**Mood carrier**: The `HemisphereLight` ground color (`#4a2a0a`) bounces upward matching `--hud-panel-bg` exactly — the scene feels like an extension of the UI rather than a separate world behind glass.

---

### 5.3 Meet Tab
*Close-up view: three faction representative character models*

**Primary emotion/mood target**: Transactional menace. These people want something from you.

| Light | Type | Color (hex) | Intensity | Notes |
|-------|------|-------------|-----------|-------|
| Ambient base | `AmbientLight` | `#2a1508` | 0.45 | Darker than standard — room feels smaller |
| Key light | `DirectionalLight` | `#d4800a` | 0.9 | Hot amber key; 30° above-left, steep enough to cast under brow ridges (`pos: -0.6, 1.5, 0.5`) |
| Fill light | `PointLight` | `#1a0a02` | 0.2 / decay 1.5 | Near-black warm fill — intentionally weak to preserve shadow volume on faces |
| Rim light | `PointLight` | `#804010` | 0.5 / decay 2 | Positioned directly behind and above character group center; dark amber rim separates silhouettes from background |
| Background fill | `PointLight` | `#0d0804` | 0.15 / decay 3 | Positioned deep behind reps — ensures background doesn't go pure black |

**Fog**: `THREE.Fog( '#120900', 6, 18 )` — tighter than standard; meeting room feels enclosed.

**Atmospheric descriptors**: Conspiratorial, shadowed, amber-lit, intimate, pressured.

**Energy level**: Tense.

**Mood carrier**: The steep key light angle creates deep under-eye and under-cheek shadows on the character models, reading as inherently untrustworthy regardless of faction. The rim light prevents them from silhouetting to black while preserving shadow volume.

---

### 5.4 Street View Tab
*Angled overhead camera; 25 citizen peds, environment assets, statues, military props*

The Street View has three distinct sub-states tied to the **infrastructure tier** (per `design/gdd/street-view.md`). The security tier (Disorder / Controlled / Militarised) modifies within each infrastructure state.

#### 5.4.1 Infrastructure Poor (Skybox: Overcast)

**Primary emotion/mood target**: Civic neglect made visible. The sky has given up.

| Light | Type | Color (hex) | Intensity | Notes |
|-------|------|-------------|-----------|-------|
| Ambient base | `AmbientLight` | `#3a3028` | 0.55 | Desaturated warm-grey — the brown is bleached out |
| Sky hemisphere | `HemisphereLight` sky | `#4a4540` | 0.5 | Overcast white-grey-brown |
| Ground hemisphere | `HemisphereLight` ground | `#2a1e10` | 0.4 | Dirty warm ground |
| Sun (directional) | `DirectionalLight` | `#8a7860` | 0.4 | Muted, flat; overhead angle (`pos: 0.1, 1, 0.2`) — no dramatic shadows |
| Trash-can accent | `PointLight` | `#ff4400` | 0.8 / decay 3 | One per Burning Trash Can prop; hot orange-red point fill |

**Fog**: `THREE.Fog( '#2a2018', 15, 40 )` — grey-brown haze; city fades into smog.

**Atmospheric descriptors**: Ashen, bleak, diffuse, choking, hopeless.

**Energy level**: Oppressive.

**Mood carrier**: The Burning Trash Can PointLights (`#ff4400`) are the only saturated warm color in an otherwise grey scene. They are the only things lit — the city's light source now.

---

#### 5.4.2 Infrastructure Normal (Skybox: Grey)

**Primary emotion/mood target**: Functional authoritarianism. The state works; no one is happy about it.

| Light | Type | Color (hex) | Intensity | Notes |
|-------|------|-------------|-----------|-------|
| Ambient base | `AmbientLight` | `#382210` | 0.5 | Warm brown ambient — familiar from UI |
| Sky hemisphere | `HemisphereLight` sky | `#505060` | 0.45 | Overcast blue-grey — sky still not open |
| Ground hemisphere | `HemisphereLight` ground | `#3a2010` | 0.4 | Warm brown ground |
| Sun (directional) | `DirectionalLight` | `#b09060` | 0.6 | Warm-grey sun at 45° (`pos: -0.5, 1, 0.4`) |
| Streetlight accent | `PointLight` | `#c87820` | 0.6 / decay 4 | One per Streetlight prop; amber PointLight at prop position |

**Fog**: `THREE.Fog( '#201810', 18, 50 )` — moderate warm-brown haze.

**Atmospheric descriptors**: Functional, amber-washed, controlled, neutral, routine.

**Energy level**: Measured.

**Mood carrier**: Amber PointLights on Streetlight props echo `--accent-color` (`#fbee32`) from the UI — the dictator's color literally illuminates the streets in the normal state. Imposed order made visible.

---

#### 5.4.3 Infrastructure Rich (Skybox: Sunny)

**Primary emotion/mood target**: Performative prosperity. Everything is fine. The statues say so.

| Light | Type | Color (hex) | Intensity | Notes |
|-------|------|-------------|-----------|-------|
| Ambient base | `AmbientLight` | `#3d2808` | 0.5 | Warm amber base — the warmth starts feeling excessive |
| Sky hemisphere | `HemisphereLight` sky | `#5060a0` | 0.5 | Clear blue sky hemisphere |
| Ground hemisphere | `HemisphereLight` ground | `#4a3010` | 0.45 | Warm sandy ground |
| Sun (directional) | `DirectionalLight` | `#f0c050` | 1.1 | Bright warm gold; 60° above-right (`pos: 0.8, 1.4, -0.3`) |
| Fountain accent | `PointLight` | `#4080c0` | 0.4 / decay 5 | Positioned at Big Fountain props; cool blue-white pool reflection |

**Fog**: `THREE.Fog( '#302010', 25, 65 )` — distant warm haze; most open of the three states.

> **Statues**: Purchased statue props receive ambient + directional light — no individual PointLights (deferred enhancement; see Open Questions).

**Atmospheric descriptors**: Ostentatious, gold-drenched, sun-bleached, theatrical, hollow.

**Energy level**: Measured (with a note of forced cheerfulness).

**Mood carrier**: The `DirectionalLight` at intensity 1.1 — the strongest key light in the game — floods the square. The scene is staged for a performance; the player knows they paid for the stage.

---

#### 5.4.4 Security modifier — Militarised overlay

When security tier is **Militarised** (regardless of infrastructure tier), add:

| Light | Type | Color (hex) | Intensity | Notes |
|-------|------|-------------|-----------|-------|
| Searchlight sweep | `PointLight` | `#d0e0ff` | 1.2 / decay 6 | One per Searchlight prop; cold blue-white; position animates in a slow arc (rotate position vector around Y axis, ~0.5 rad/s) |

The searchlight PointLight is the only animated light in the game. Its cold blue-white (`#d0e0ff`) is the only explicitly cool light color in the game — it reads as surveillance, not warmth.

---

### 5.5 Active Pressure State
*Timer ≤ 30 seconds remaining*

**Primary emotion/mood target**: Morally claustrophobic. The room is tightening. The clock is a physical presence.

This state modifies whatever scene is currently active. Lerp the following delta values on top of the current lighting state over 600ms.

| Parameter | Delta |
|-----------|-------|
| `AmbientLight` color | Shift toward `#1a0802` (darker, redder) |
| `AmbientLight` intensity | −0.15 |
| `DirectionalLight` color | Shift toward `#8b1a00` (deep warning red) |
| `DirectionalLight` intensity | +0.2 (more contrast, harder shadows) |
| Fog color | Shift toward `#150500` (red-tinged near-black) |
| Fog near | −2 (fog closes in) |

**Do not add new lights.** Pressure is expressed through color shift and density increase of existing lights — not new sources.

**Atmospheric descriptors**: Suffocating, red-washed, contractile, urgent, airless.

**Energy level**: Frenetic.

**Mood carrier**: Fog near decreasing by 2 units means objects at mid-distance vanish slightly faster. The world is literally getting smaller.

---

### 5.6 DayEnded Modal
*Round resolution screen; appears over the active scene*

The modal uses `--scrim-bg` (`rgba(0,0,0,0.85)`) + `backdrop-filter: blur(4px)` (Section 4). This scrim substantially dims and blurs the 3D scene — scene lighting during DayEnded is low priority.

Maintain the current scene's ambient state at its current values. Do not add new scene lights for DayEnded.

**Exception — coup warning**: If the DayEnded resolves a round in which coup risk was elevated, shift the `DirectionalLight` toward `#5a0000` (deep red) at −0.3 intensity before the modal opens. This bleeds red through the blurred scrim, coloring the screen beneath the UI without any UI change.

**Atmospheric descriptors**: Suspended, dimmed, bureaucratic, pending.

**Energy level**: Contemplative.

**Mood carrier**: Whatever scene state was active (amber warmth, grey overcast, red pressure) bleeds through the blurred scrim as tinted ambiance. The modal sits on top of the world's current emotional color, not a neutral black.

---

### 5.7 Victory Screen
*Player survived 10 rounds*

**Primary emotion/mood target**: Hollow triumph. You made it. The game never decides if this was worth it.

| Light | Type | Color (hex) | Intensity | Notes |
|-------|------|-------------|-----------|-------|
| Ambient base | `AmbientLight` | `#2a2008` | 0.45 | Muted — do not make this celebratory |
| Key light | `DirectionalLight` | `#d4a020` | 0.8 | Warm gold; from above-center (`pos: 0, 1, 0.3`) |
| Victory accent | `PointLight` | `#ffd050` | 0.6 / decay 4 | Positioned at scene center-above; gold pool on ground |

**Fog**: `THREE.Fog( '#101008', 20, 45 )` — dark near-black with a slight warm tint.

**Note**: The UI overlay is `--victory-overlay-bg` (`rgba(0, 60, 20, 0.88)`) — dark green, not gold. Green is the survival color; gold is the dictator's color. These are different things.

**Atmospheric descriptors**: Gilded, hollowed, quiet, unresolved, muted.

**Energy level**: Contemplative.

**Mood carrier**: Scene light is gold but the UI overlay is dark green. First read: "green means survival." Second read: the light behind it is the dictator's gold. The city is not celebrating.

---

### 5.8 Defeat — Overthrow
*Faction relation reaches −10*

**Primary emotion/mood target**: Sudden institutional violence. Not horror — bureaucratic termination.

| Light | Type | Color (hex) | Intensity | Notes |
|-------|------|-------------|-----------|-------|
| Ambient base | `AmbientLight` | `#0a0000` | 0.3 | Near black — all warmth removed |
| Key light | `DirectionalLight` | `#3c0000` | 1.0 | Cold deep red; from directly above (`pos: 0, 1, 0`) — no warmth, no direction |
| Red wash | `PointLight` | `#8b0000` | 0.7 / decay 3 | Positioned at scene center, ground level — red bleeds upward |

**Fog**: `THREE.Fog( '#1a0000', 5, 15 )` — dense red-black fog; near distance very tight.

**Overlay**: `--lose-overlay-bg` (`rgba(80, 0, 0, 0.88)`) per Section 2.

**Atmospheric descriptors**: Terminal, red-washed, airless, cold, sudden.

**Energy level**: Oppressive.

**Mood carrier**: `DirectionalLight` from directly above (`pos: 0, 1, 0`) produces no lateral shadows — objects are lit with no fill from any direction. Interrogation-room overhead lighting. Nowhere to hide.

---

### 5.9 Defeat — Bankruptcy
*Treasury reaches 0*

**Primary emotion/mood target**: Institutional exhaustion. The state ran out of state. Not violent — just over.

| Light | Type | Color (hex) | Intensity | Notes |
|-------|------|-------------|-----------|-------|
| Ambient base | `AmbientLight` | `#181210` | 0.4 | Very dark desaturated warm — the lights are going off |
| Key light | `DirectionalLight` | `#504030` | 0.4 | Washed-out warm grey; flat overhead (`pos: 0.1, 1, 0.1`) — weak, dying |

**No fill lights, no accent lights.** Deliberate.

**Fog**: `THREE.Fog( '#0f0a08', 8, 20 )` — dense dark warm-grey fog; city disappears into nothing.

**Overlay**: `--lose-overlay-bg` (`rgba(80, 0, 0, 0.88)`) per Section 2 — same overlay as Overthrow, but the scene beneath is dying brown, not red. The overlay is the same; the cause is different.

**Atmospheric descriptors**: Exhausted, fading, dim, grey, depleted.

**Energy level**: Oppressive.

**Mood carrier**: The deliberate removal of all fill and accent lights means fewer light sources than any other state. What remains is weak and colourless. The world did not explode. It stopped being funded.

---

### 5.10 State Color Matrix

| State | Ambient hex | Key hex | Fog hex | Energy |
|-------|-------------|---------|---------|--------|
| Standard gameplay | `#3d2010` | `#c87820` | `#1a0d05` | Measured |
| Meet tab | `#2a1508` | `#d4800a` | `#120900` | Tense |
| Street — Poor | `#3a3028` | `#8a7860` | `#2a2018` | Oppressive |
| Street — Normal | `#382210` | `#b09060` | `#201810` | Measured |
| Street — Rich | `#3d2808` | `#f0c050` | `#302010` | Measured |
| Active pressure (+delta) | `#1a0802` | `#8b1a00` | `#150500` | Frenetic |
| DayEnded | hold current | hold current | hold current | Contemplative |
| Victory | `#2a2008` | `#d4a020` | `#101008` | Contemplative |
| Defeat — Overthrow | `#0a0000` | `#3c0000` | `#1a0000` | Oppressive |
| Defeat — Bankruptcy | `#181210` | `#504030` | `#0f0a08` | Oppressive |

### 5.11 Three.js Quick Reference

```ts
// Standard gameplay default
scene.fog = new THREE.Fog( 0x1a0d05, 12, 35 );
ambientLight.color.set( 0x3d2010 );
ambientLight.intensity = 0.6;
keyLight.color.set( 0xc87820 );
keyLight.intensity = 0.7;
keyLight.position.set( -1, 1.2, 0.8 ).normalize().multiplyScalar( 10 );

// Active pressure delta — lerp toward these over 600ms
// e.g. ambientLight.color.lerp( pressureTarget, alpha ) per frame
const pressureTarget = { ambient: 0x1a0802, key: 0x8b1a00, fog: 0x150500 };
// fog.near -= 2 (interpolated)
```

---

---

## Section 6: Character Art Direction

### 6.1 Silhouette Philosophy

The game presents characters in two radically different contexts: close-up framing in the Meet tab, and overhead crowd view in the Street View. Every character design decision must pass a two-distance test before it is considered resolved.

**Distance 1 — Meet tab (close-up, ~1–2 head-lengths from camera)**
Faction reps are the primary interactive characters. The player reads them at portrait distance during bribe, dialogue, expropriate, and eliminate actions. At this distance facial expression, costume texture, and specific props are all legible. The silhouette constraint at close-up is about recognizability in *thumbnail* — the three faction reps also appear as small portrait icons in the action panel. At thumbnail size (approximately 48×48 px equivalent), only the outermost silhouette shape reads. This is the harder constraint.

**Distance 2 — Street View (overhead, angled downward ~60–70 degrees)**
At overhead camera distance, individual face detail vanishes. A citizen ped reads as a shape roughly 12–16px tall on a 1920×1080 display. The only legible visual information is: faction color signal, body mass (fat/fit/slim), and motion posture (upright / skulking / stationary). Design must solve for this before anything else.

**Silhouette priority rule**: Every character archetype must be distinguishable from every other archetype using only a black filled silhouette against a white background. If two characters are not distinguishable as silhouettes, one of them must be redesigned before texture or color work begins.

**The retro signal is the era, not the execution.** Low-poly models read as retro through historical costume and MeshStandardMaterial smooth shading. The pixel aesthetic is the UI frame around them; the models inside that frame are low-poly but not intentionally degraded.

---

### 6.2 Faction Representative Design Direction

Faction reps are the three close-up 3D character models in the Meet tab. They are permanently stationed — the camera moves, they do not. All three are male in v1. They wear the face of their institution, not their own personality.

The lighting context (Section 5.3) produces a steep amber key from above-left with a dark fill. Costumes with horizontal banding (medals, belts, lapels) catch the key light and create readable shadow contrast. Smooth rounded surfaces produce no character in this lighting; faceted structure does.

#### 6.2.1 Military Representative

**Dominant archetype**: The General. Late-career, thick-necked, institutional. Projects the security apparatus — not a fighting soldier, a man who gives orders and receives resources.

**Silhouette feature**: The peaked military cap — a horizontal brim projecting beyond the skull line with a tall rigid crown. Nothing else in the character set produces this shape. Exaggerate the cap height by approximately 20% over realistic proportion to read clearly at thumbnail.

**Costume and prop elements**:
1. Full dress uniform in deep olive-green (`#3d4a1a`) or slate-blue-grey (`#2d3845`). A single flat material color — period dress uniform, not fatigues.
2. Chest medals — at least three, placed center-left chest. Model as flat disc-plus-ribbon geometry. At close-up they signal rank; at overhead they break up the silhouette.
3. Sam Browne belt — a diagonal strap from left shoulder to right hip creates a strong torso silhouette diagonal.

**Body language and pose**: Rigid. Weight on both feet equally, arms slightly away from the body. Not aggressive, not deferential. Evaluating. The camera should read him as immovable.

**Face**: Square jaw, deep-set eyes, neutral expression approaching contempt. No smile. Amber key light lands on brow and cheekbone; under-eye shadow reads as permanent skepticism.

---

#### 6.2.2 Business Representative

**Dominant archetype**: The Oligarch's Fixer. Late 40s, groomed, slightly soft around the middle. Gets what he wants by being indispensable, not by being feared.

**Silhouette feature**: The double-breasted suit with wide lapels — a distinctive V-shape at the upper chest. Squared, padded shoulders (classic wide-shouldered cut). The shoulder line is the silhouette identifier.

**Costume and prop elements**:
1. Double-breasted suit in charcoal or dark brown (`#2a1e14`) with visible button rows. Light-value necktie (cream or pale gold) — the only warm color in the ensemble, creating a vertical accent from throat to waist.
2. A slim leather briefcase in his dominant hand — adds asymmetry to the silhouette (one side weighted, the other free). At thumbnail this reads as the most distinctive shape difference from the other two reps.
3. A pocket square — a small triangle of white fabric at the chest pocket. Class signal visible at close-up.

**Body language and pose**: Slightly forward, weight on the front foot, chin slightly tucked — attentive but calculating. One hand holds the briefcase; the free hand is loose, available. A man waiting to extend it when the price is right.

**Face**: Rounded jaw, smooth, well-fed. Mild expression, slightly too pleasant. The amber key creates softer shadow on his face than the General's — less bone structure means less shadow drama. Intentional: he is harder to read.

---

#### 6.2.3 People Representative

**Dominant archetype**: The Union Man or Collective Voice. Working-age, thin or average build, slightly worn. Neither powerful nor threatening — the one in the room with the least leverage, and they know it.

**Silhouette feature**: The absence of a defining element is itself the signal. No hat brim, no padded shoulders, no briefcase. The People rep communicates faction through omission. To ensure the silhouette is not invisible, give them one compensating element: rolled sleeves (forearms visible) or a work jacket with the collar turned up.

**Costume and prop elements**:
1. Plain work trousers and collarless or open-collar shirt — mid-browns, dusty greens (`#4a3d28`), muted tones. Material absorbs the amber key light rather than catching it. He should look slightly dull in the lighting that makes the other two gleam.
2. A flat cap (not peaked) in a dark muted color, held in hand or on head. Must not approach the military's peaked cap silhouette — flat-topped with no brim projection above the crown.
3. Slight forward stoop — not exaggerated, but the spine is not straight. Anxiety, not injury.

**Body language and pose**: Tense at the shoulders, weight shifted slightly back — ready to yield ground if pressured but not yet doing so. Arms closer to body than the other two reps. The player should feel the power imbalance without any UI text naming it.

**Face**: Narrower jaw, more pronounced lines, weathered. Amber key light picks up worry lines — the texture of stress, not authority.

---

### 6.3 Citizen Ped Design Language

Citizen peds are low-poly crowd characters at overhead camera distance. The primary design constraint is faction readability at 12–16px effective height. Role state and body type are secondary and must not compromise faction legibility.

#### 6.3.1 Faction Color Coding at Overhead Distance

At overhead distance, color is the only reliable faction signal. Each faction is assigned a dominant hue on a high-coverage surface (torso minimum) that must be distinguishable under all three infrastructure lighting states (Section 5.4).

| Faction | Dominant Hue | Hex | High-coverage surface |
|---------|-------------|-----|----------------------|
| Army | Olive green / slate military | `#3d4a1a` | Full-body uniform (jacket + trousers) |
| Business | Charcoal dark suit | `#2a2a2a` to `#2a1e14` | Suit jacket and trousers |
| People / Civilian | Dusty warm mid-tone | `#6b5a40` to `#8a7050` | Shirt or jacket |

These three hues must be tested against all three lighting setups before approval. No two faction colors may be closer than 30 degrees apart in hue or 30% different in lightness without a secondary distinguishing element.

#### 6.3.2 Body Type Visual Language

Body type (fat / fit / slim) is a fixed identity attribute that makes individual citizens recognizable across rounds and makes the crowd's overall health visible without numbers.

- **Fat**: Wide hip-to-shoulder ratio, rounded belly geometry, shorter apparent neck. Increases in prevalence at high health (well-fed population).
- **Fit**: Standard proportions, slight shoulder-to-hip taper. The baseline civilian build.
- **Slim**: Narrow across shoulders and hips, slightly elongated. Increases in prevalence at low health. At overhead, a slim ped takes up less surface area, creating visible visual thinning of the crowd when the population is starving.

**Production**: Three distinct base mesh variants per outfit type. **Generic civilian peds** carry 3 material slots (skin, torso, pants). **Outfit peds** (army, business, thief, protestor) carry 2 material slots (skin, outfit). See §6.7.2 for material structure and §10.6 for full naming convention.

#### 6.3.3 Skin Tone Variation

Skin values 0–4 map to five distinct `MeshStandardMaterial` values on face/hand geometry only (torso is covered by faction outfit). Range runs from light warm-olive to deep brown, covering a broad human range. Validate all five values under Meet tab lighting (Section 5.3) to ensure legibility under the amber key before use in crowd.

---

### 6.4 Protestor Ped — `ped_special_man_protestor`

Dedicated asset for citizens with `role == protestor` (people-faction only, happiness ≤ 3, education ≥ 5). The `ped_special_man_protestor` asset is outfit-agnostic in `assets/entities.yaml` — the protest sign is the role signal, not faction color.

**Primary distinguishing feature: the protest sign.**
A flat rectangular sign geometry carried in both hands, held upright above the waist. At overhead camera this adds ~40% to the ped's apparent height and creates a T-shape or cross-shape that no other ped variant produces.

Sign geometry: flat rectangular plane (~0.3 × 0.4 units), attached to a thin handle rod. Sign face uses a light flat material (`#e8e0c0` — off-white/newsprint) that reads against the warm-tinted street environment under all three infrastructure lighting states. No text on sign face — text is illegible at overhead distance; the shape is the signal.

**Secondary signals**:
- Both arms raised to hold the sign — distinctive overhead shape.
- Head slightly forward — agitated lean versus upright content ped.
- The outfit underneath is the same civilian palette; the sign is the primary distinguisher.

**Clustering note**: Protestors are placed in a stationary cluster at runtime, not distributed. The player will see a visible dense cluster of T-shaped signs as an unmissable visual event. Design the sign scale to remain legible when five to eleven protestors are in close proximity.

---

### 6.5 Shape Language

**Vertical shapes = authority**
Peaked cap, erect posture, the General's rigid stance — vertical lines signal hierarchy and institutional power.

**Horizontal shapes = weight and resource**
The Business rep's padded shoulders, briefcase, button rows — horizontal lines signal economic mass.

**Absence of strong shape = vulnerability and fungibility**
The People rep and civilian peds have the fewest strong geometric features. The game's thesis is that individuals in the "People" category are most interchangeable to the dictator. The visual language reinforces this by giving them the least distinguishing geometry.

**Forbidden shape categories**:
1. **Round cartoon proportions are prohibited.** Heads must not exceed 1/7 of total body height. No chibi or exaggerated proportions. Realistic proportions must hold.
2. **Soft curved silhouettes on institutional characters are prohibited.** Military and Business reps must have at least three angular inflection points in their silhouette. Rounded shoulders on the General produce a friendly read that contradicts transactional menace.
3. **Symmetrical poses are permitted only for the Military rep.** The Business rep's briefcase asymmetry and the People rep's defensive posture must break symmetry. A fully symmetrical People rep reads as confident — wrong.
4. **Oversized accessories are prohibited.** Props must not exceed 15% of character total height from the primary camera angle. Exception: the protest sign (see §6.4).

---

### 6.6 Expression and Pose Range

Faction reps are static posed models — no expression animation, no idle movement. The static quality is intentional: these people were here before you arrived and will be here after.

| Rep | Expression | What it communicates |
|-----|-----------|---------------------|
| Military | Flat, neutral, assessing | "I am measuring whether you are still useful." |
| Business | Faintly pleasant, unrevealing | "I am in negotiation." |
| People | Tense, slightly exhausted | "I am here because I have to be." |

**"Bureaucratically severe" on low-poly geometry** — achieved through four specific choices:
1. **Downturned mouth corners** — even 3–4 extra polygons pulling corners below neutral produce a permanently dissatisfied read.
2. **Heavy brow** — a brow ridge that casts shadow over the eye socket under the steep ambient key (Section 5.3). A 2–3 polygon angular extrusion above the eye plane achieves this.
3. **No visible whites of the eyes** — recessed eye geometry reads as guarded; prominent eyes read as expressive.
4. **Closed mouth** — no open mouth, no parted lips. Closed, slightly pressed together is the bureaucratic resting state.

**Citizen ped posture by role** (overhead only — no face legible):

| Role | Posture signal |
|------|----------------|
| content | Spine vertical, smooth walk cycle, unhurried |
| neutral | Slight slouch, slower pace |
| thief | Torso forward, quick pace, path hugs walls |
| protestor | Arms up (holding sign), stationary, cluster |
| gone | Not rendered |

---

### 6.7 LOD and Production Standard

#### 6.7.1 Faction Representatives (Close-Up — Meet Tab)

**Polygon budget**: 800–1,200 triangles per faction rep. MeshStandardMaterial smooth shading.

**Material approach**: MeshStandardMaterial with a single material per character. Faction costume color encoded in material `color` property. Face and hands use a single skin-tone material. Medal geometry on the Military rep uses a separate material (gold: `#c0a000`) — this is the only additional draw call per character. Each faction rep: 2 draw calls maximum.

**Texture map policy**: Texture maps are optional (not required). If used, they must be **64×64 maximum** with a **256-color indexed palette** (PNG-8 or quantized PNG-24 to ≤256 colors). No photorealistic gradients, no normal maps, no roughness/metallic maps. The 3D models must not read as more detailed than the pixel-art UI frame around them. Handpainted flat-color diffuse textures at 64×64 are acceptable for face and costume detail that cannot be achieved with geometry alone.

**Face standard**: Faces use 4–6 flat material or painted zones: skin base, brow-shadow zone (handled by geometry), eye/iris (recessed dark), and lip line (slight darkening of skin base). All zones remain flat or mildly painted — no gradient bakes.

**Delivery format**: FBX, Y-up, meter scale. One file per faction rep. No embedded animations.

**Asset naming**:
- `char_military_rep_idle_01.FBX`
- `char_business_rep_idle_01.FBX`
- `char_people_rep_idle_01.FBX`

#### 6.7.2 Citizen Peds (Overhead — Street View)

**Polygon budget**: 200–350 triangles per ped mesh variant.

**Draw call budget**: 25 draw calls maximum for the entire 25-ped crowd, achieved by `InstancedMesh` grouping peds by body-type + outfit combination. Each instance group: 2 materials (outfit + skin) = 2 draw calls. With up to 12 active instance groups in a typical mid-game state: ~24 draw calls for the crowd.

**Material approach**: Material slot count differs by ped type:
- **Generic civilian peds** (`ped_man_[bodytype]_civilian`): 3 materials — skin, torso, pants. Allows independent colour variation per layer without separate mesh variants.
- **Outfit peds** (`ped_man_[bodytype]_army/business/thief`): 2 materials — skin, outfit. Outfit covers torso and pants in one unified faction signal.
- **Protestor ped** (`ped_special_man_protestor`): 2 materials — skin, outfit. Sign geometry uses the outfit material.

Skin tone variation via 5 skin material values applied to face/hand geometry only — no per-ped material swaps.

**Texture map policy**: Same as §6.7.1 — optional, 64×64 max, 256-color indexed palette, smooth-shaded only. For crowd peds viewed exclusively overhead, texture maps are rarely necessary; material color is sufficient.

**Minimum readable silhouette**: A citizen ped at overhead distance must resolve as a distinct shape of at least 8×12 pixels at 1920×1080.

**Walk cycle**: 4–6 frame bone animation. Minimal armature: 9 bones maximum (hips, two leg chains, two arm chains, spine, head). No facial bones. Protest sign attaches to a wrist bone.

**Asset naming examples**:
- `ped_man_fit_civilian_01.FBX`
- `ped_man_fat_army_01.FBX`
- `ped_man_slim_business_01.FBX`
- `ped_special_man_protestor.FBX`

---

---

## Section 7: Environment & Level Art Direction

### 7.1 Governance Area Design Direction

#### 7.1.1 Setting

The Governance Area is the interior of a **presidential palace** — the dictator's own house. Not a ministry, not a government office. Everything in it is expensive, slightly absurd, and maintained because someone has to maintain it.

The scene is low-poly and intentionally blocky. Textures, where used, are low-resolution — this is a deliberate aesthetic register, not a fidelity budget constraint. The blocky scale and lo-fi textures make the environment read as institutionally real while maintaining the game's position as a stylized artifact.

**Rule**: No surface in the Governance Area should require close inspection to read. Every prop communicates its identity from geometry alone; texture adds colour signal only. If a prop requires its texture to be understood, simplify the geometry.

#### 7.1.2 Meet Tab Scene — The Audience Room

Three faction representatives occupy fixed positions that communicate faction privilege through seating alone. The seating hierarchy is the environmental storytelling — no additional props are needed to establish power dynamics.

| Character | Seating | What it communicates |
|-----------|---------|---------------------|
| Business / Elite rep | Long couch, full length | Entitled comfort — this is someone who has always sat in the best seat |
| Military rep | Standing, permanent military salute | Cannot relax in the dictator's presence; trained to hold this position forever |
| People rep | Small chair | The worst seat in the room. Not a throne, not a couch — a chair brought in specifically for this meeting, from somewhere else |

**The couch**: Wide, low-poly sofa. Deep jewel colour — dark burgundy (`#5a1020`) or deep gold (`#6a4a0a`). Clearly expensive, clearly not chosen for utility. No detailed cushion geometry; the blocky form reads as "luxury" through proportion (wide, low, generous) rather than through detail.

**The small chair**: A simple upright chair. Functional, wooden, narrow back. Plain warm-brown material. In the same frame as the couch, the contrast is immediate.

**The floor**: Dark parquet or polished stone — a single flat plane, deep warm brown (`#3a2210`), no detail.

**Background and walls**: Warm off-white or pale gold flat planes. Any framed painting on the wall is low-poly frame geometry + flat canvas material (no handpainted detail; the painting reads as "A Painting" from its shape). Blocky chandeliers or ceiling fixtures may be present if already in scene — do not add them if not already there.

**Tone note**: This scene should feel slightly absurd. A military man at permanent salute while a businessman lounges on a full-length couch while a civilian sits on a chair that was dragged in — the visual composition *is* the joke, without ever pointing at itself. Paintings inspired by The Dark Paintings of Goya.

#### 7.1.3 Future — Elimination Animations

When the Eliminate action is implemented with scene animations, the environment will need three specific support structures. These are documented here as forward requirements, not current scope.

| Target | Animation | Environment support needed |
|--------|-----------|---------------------------|
| Military rep | Falls through trap door in floor | Trap door outline (seam in floor geometry) at his standing position |
| People rep | Cane hook from offscreen left — Looney Tunes exit | Nothing permanent; cane enters from scene left edge |
| Business rep | Toy crane lifts upward | Crane enters from above; ceiling must be absent or have a removable-geometry gap over the couch position |

For v1 (no animations), these impose no geometry changes.

#### 7.1.4 Laws Tab Scene — The Office

The Laws tab camera shows the dictator's working office within the palace. Already built and working; the spec below documents it for reference and constrains future additions.

**Existing elements (preserve)**:
- Expensive paintings on all walls — low-poly frames, flat canvas material, varied sizes. Quantity is the signal; there are too many, packed because this is what the dictator thought a palace should look like.
- Piles of paper / folders on all available surfaces — the administrative weight of running a country, materialized as blocky geometry stacks.

**Addition policy**: Do not add anything to the Laws office that competes with the paper and painting density. Any future prop must be at desk height or lower with a smaller footprint than the existing paper stacks.

**Environmental storytelling**: The paintings are hung where filing shelves should be. The papers are piled where the art display table should be. This government has resource (expensive art) and obligation (crushing administrative load) in the same room, with the priorities inverted.

---

### 7.2 City Street Design Direction

#### 7.2.1 Architectural Vocabulary

The buildings lining both sides of the street are **colonial vernacular**, inflected by mid-century institutional expansion. Original one-and-two-story street-facing structures appended upward with cheap concrete additions. The silhouette is irregular: the original ground floor (stucco over brick, low arched openings, tile roof overhang) topped by a mid-century concrete upper floor (flat roof, simple rectangular windows, no ornament).

**Required on all building variants regardless of infrastructure tier**:
- Stucco (smooth plaster) exterior surfaces — never glass, never steel cladding.
- Barred windows. Iron window grilles on all openings from ground to second floor. Vertical rhythmic lines across window openings.
- Tiled roof overhang on the original ground-floor volume — a short projecting eave in red-orange terracotta (`#8a4428`).
- Flat concrete roof on any upper floors. The contrast between the original tiled eave and the flat concrete addition is the primary visual signal of "colonial vernacular + mid-century cheap expansion."

**Absolutely forbidden on buildings**: Glass curtain walls or large horizontal window bands; metal panel cladding; contemporary proportions; US residential vernacular (pitched gable roofs, vinyl siding); European townhouse vernacular (mansard roofs, stone facades).

The player must read the setting's era and economic state from the building silhouettes alone.

#### 7.2.2 Base Street Layout — Permanent Features

| Feature | Description |
|---------|-------------|
| Road surface | Two lanes, dark asphalt (`#1a1612`). Center lane divider: faded off-white (`#c8c4b0`) at opacity 0.6. At Poor tier, opacity drops to 0.1 (paint has worn away). |
| Sidewalk | Single-width on both sides, light warm-grey concrete (`#8a8070`), flush pavers. Width ~1/4 of road width. |
| Curb | 0.1 units high, concrete grey (`#706860`). |
| Building setback | Zero — buildings sit directly on sidewalk edge. Street wall is continuous. |

Peds walk on the full sidewalk width on both sides only — not in the road.

#### 7.2.3 Infrastructure Tier Visual Escalation

**Building architecture**: The street features **5 building types**. Each type has **3 separate FBX variants** — one per infrastructure tier (poor/normal/rich) — swapped at runtime based on the infra level. This gives 15 building FBX files total (5 types × 3 tiers). The 5 types are: apartment block, low-rise residential, commercial/market, civic/government, office/mixed-use. Naming convention: `env_bld_[type]_[tier].FBX` (e.g., `env_bld_apartment_poor.FBX`).

**Skyline and Plaza**: Unlike buildings, the skyline silhouette and plaza/ground are **one FBX mesh each** with **three texture variants** (poor/normal/rich) swapped by infra level. This works because their geometry does not change between tiers — only the painted surface does.

Tier transition is cumulative: Normal inherits surviving elements from Poor and adds assets; Rich inherits from Normal and adds further.

**Poor Tier — "The city that stopped being maintained"**

Building stucco: grey-brown with visible patching (`#5a4c38` base, irregular darker patches `#3a3028`). Terracotta eave tiles: some absent (small dark gaps in tile row geometry).

Key assets:
- **Burning Trash Can** (`env_trash_can_burning_small.FBX`) — 4 instances along sidewalks, approximately one per building frontage. Fire is a 4-frame UV-scroll animated plane on a sprite sheet (no particle emitter — per no-particle-systems constraint in Section 5). Each carries a PointLight: color `#ff4400`, intensity 0.8, decay 3.
- **Pothole Decal** — 10 instances, flat decal planes in road surface (~0.3 × 0.4 units each), cracked asphalt `#0d0c09` with irregular lighter edge `#2a2420`. Scattered across both lanes, not symmetrically placed.
- **Improvised market awning** — corrugated-metal flat plane (`#6a6860`) at ground level on one building frontage.

**Normal Tier — "The city that is running, barely"**

Building stucco returns to faded warm buff (`#8a7860`). Tile row intact. Facade regularity restored.

Key assets added:
- **Streetlight** (`env_streetlight_standard_medium.FBX`) — 4 instances, evenly spaced on both sidewalks. Pole: dark painted iron (`#2a2010`). Lamp: amber lens (`#c87820` + emissive `#c87820` at 0.4). PointLight per lamp: color `#c87820`, intensity 0.6, decay 4. The dictator's amber — the same accent-color frequency, manifesting as literal street lighting.
- **Park Bench** — 6 instances in pairs, sidewalk against facades. Timber slats `#5a3a1a`, cast-iron ends `#1a1612`.
- **Electric Pole** — 6 instances, alternating sides with streetlights.
- **Tree** (replaces dead tree from Poor) — 10 instances. Simple geometric low-poly canopy (4–6 irregular plane cuts), warm dusty green (`#4a5a28`).

**Rich Tier — "The city as stage set"**

Building stucco freshly whitewashed (`#c8c0a8`) or pale government cream. The renovation is too uniform — clearly the result of a decree, not organic care. Window grilles freshly painted black, sharp geometric contrast against pale walls.

Key assets added:
- **Luxury Streetlight** (`env_streetlight_luxury_medium.FBX`) — 6 instances, replacing standard. Taller pole, decorative scroll (`#c0a000` accent). PointLight: color `#c87820`, intensity 0.7, decay 4.5.
- **Big Fountain** (`env_fountain_large.FBX`) — 2 instances at focal points. Tiered stone basin. Water plane: MeshStandardMaterial `#4080a0`, emissive `#204060` at 0.2. Fountain PointLight: color `#4080c0`, intensity 0.4, decay 5 — the only cool-toned light source in the game.
- **Palm Tree** — 10 instances, replacing standard Trees. Tapered trunk (`#6a4820`), splayed frond canopy planes (`#3a5020`).
- **Luxury Garden** — 2 instances. Low bush geometry (`#3a4a18`) inside stone border (`#8a8070`).
- **Statue Pedestals** (3, always present in all tiers) — see §7.2.5.

**Transition arc**: Poor → Normal: the lights come on. Burning Trash Can PointLights go out; amber Streetlight PointLights replace them. The city stops being illuminated by things on fire. Normal → Rich: more of the dictator's amber, plus the cold-blue fountain light punctuating it. The street gains verticality (Palm Trees, taller Luxury Streetlights).

#### 7.2.4 Security Tier Visual Escalation

Security props are an overlay layer — placed in addition to, never instead of, infrastructure props.

**Disorder Tier**: Empty. No security props. The visual signal is absence — the player's eye searches for authority and finds none.

**Controlled Tier**:
- **Guard Post** (`env_guard_post_small.FBX`) — 2 instances, anchoring both ends of the block. Olive-grey paint (`#505840`). A low rectangular booth with square window openings, no glass.
- **Security Camera Pole** (`env_camera_pole_medium.FBX`) — 4 instances at regular intervals along building facades at second-floor height. Thin pole, small camera head angled 45° downward. Painted metal grey (`#4a4a40`). Deliberately difficult to notice until the player looks — the player should feel watched before they consciously see the cameras.

**Militarised Tier**:
- **Tank** (`env_tank_large.FBX`) — 2 instances. Parked on road at opposing ends, pointing toward center. Dark olive (`#2a3018`). The tank's mass creates a shadow presence even under strong overhead lighting.
- **Cannon** (`env_cannon_medium.FBX`) — 4 instances. Field artillery on sidewalk, barrel pointing toward building facades — not toward the crowd, toward the buildings. Occupation directed at civilians.
- **Machine Gun Nest** (`env_gun_nest_medium.FBX`) — 2 instances. Sandbag U-shape at road center. Sandbag buff (`#7a6a50`).
- **Searchlight** (`env_searchlight_large.FBX`) — 2 instances. Drum-mount on tripod. Animated PointLight: position rotates around Y axis at ~0.5 rad/s, color `#d0e0ff`, intensity 1.2, decay 6. The only animated light and the only cool-toned light in this tier.

**Prop placement philosophy for security assets**: Security props are placed on a fixed grid — not scattered randomly. Guard Posts always anchor the ends. Cameras always occupy regular intervals. Tanks always face each other. The geometric regularity of military occupation contrasts with the scattered irregularity of Disorder-tier infrastructure props.

**Immediate visual read, Militarised**: When the player tabs to Street View in Militarised tier: (1) searchlight sweep across the ground, (2) tank silhouettes at street ends, (3) peds clustered away from center. The tanks block clear view end-to-end. The street is no longer a street; it is a controlled zone.

#### 7.2.5 Statue System

Three Empty Statue Pedestals are permanently placed at positions visible from overhead throughout all tier combinations. Pedestal: square tapered stone base, `#8a8878` material, ~0.8 units tall. When the player purchases a statue, the statue model replaces the empty pedestal at that position.

| Statue | Asset | Material |
|--------|-------|---------|
| Bronze (standing) | `env_statue_bronze_standing_large.FBX` | `#7a5c28` |
| Silver (equestrian) | `env_statue_silver_equestrian_large.FBX` | `#9090a0` |
| Golden (triumph) | `env_statue_gold_triumph_large.FBX` | `#c0a000`, emissive `#6a5000` at 0.15 |

Statue plaque at the base: flat stone geometry, facing camera. No text in scene — plaque text is rendered as UI in the click panel, not as scene geometry.

#### 7.2.6 Building Tier Variation

| Element | Poor | Normal | Rich |
|---------|------|--------|------|
| Stucco color | Grey-brown, patched (`#5a4c38`) | Faded warm buff (`#8a7860`) | Fresh cream-white (`#c8c0a8`) |
| Window grilles | Rusty, bent (`#4a3020`) | Intact, dark iron (`#2a2010`) | Freshly painted black (`#1a1a18`) |
| Roof tile eave | Missing tiles (gap geometry) | Intact | Intact |
| Facade regularity | Irregular, ad-hoc patched | Regular | Uniform (decree-maintained) |

**Graffiti decal**: Appears only at Disorder security tier (regardless of infrastructure). At Controlled or Militarised, graffiti has been painted over — visible as a slightly lighter rectangular patch at `#6a5840` on the wall plane. The cover-up is more visible than the graffiti it replaced.

#### 7.2.7 Boundary Treatment

**Longitudinal** (street ends): Fog handles the boundary. Buildings fade progressively at Section 5.4 fog distances. The street implies continuation — the player never sees the end of the city.

**Lateral** (building facades): Zero setback — buildings are the visual boundary. No alley gaps.

**Sky**: At Poor and Normal tier, skybox color matches fog base (`#4a4540` / `#505060`) — sky-to-fog transition is seamless. At Rich tier, the clear blue hemisphere (`#5060a0`) is the only tier in which a distinct sky is visible above building parapets. Only in the Rich tier does the city have weather good enough to distinguish sky from haze.

---

### 7.3 Environmental Storytelling Guidelines

**Governance Area — The Seating Arrangement**

No prop is needed to tell the player which faction has power. The military man cannot sit. The businessman takes the entire couch. The civilian got a chair that was dragged in from somewhere else. The room communicates three factions' relationships to power through the geometry of sitting, standing, and bringing furniture. No text. No dialogue. The player reads it the moment they open the Meet tab.

**Street at Low Infrastructure — The Trash Can Light**

At Poor infrastructure tier, Burning Trash Cans are the only warm-light sources on the street. The Streetlights are absent. The city's light comes from garbage that has been set on fire. When the player arrives at Street View after gutting the infrastructure budget, the visual read is immediate: the infrastructure for light has collapsed and been replaced, spontaneously, by fire. The orange-red PointLight glow (`#ff4400`) in a grey desaturated scene is the image of a city the state has stopped maintaining — and the people have invented their own survival.

**Street at High Infrastructure — The Statues**

If the player has purchased all three statues at Rich infrastructure tier, the golden triumph statue is surrounded by clean sidewalks, luxury streetlights, palm trees, and fountains. The scene is genuinely beautiful by its own visual logic. The plaque at the base — not scene geometry, but UI text in the click panel — completes the composition. The game does not tell you this is wrong. The fountain light catches the gold perfectly.

**Citizen density as population health signal**

When all 25 citizens are healthy and employed (role: content), the street reads as populated, active, varied — three body types at steady pace across both sidewalks, faction colors distributed, no clustering anomalies.

When the population is disrupted (8 thieves, 6 protestors, 4 dead), the street shows it in four simultaneous visual signals:
1. **Visible gaps**: 4 peds are gone. At 25 the street feels inhabited; at 15 it feels thin.
2. **Wall-hugging**: Thieves path along building facades. The sidewalk center empties.
3. **Static cluster**: 6 protestors with T-shaped signs are stationary and clustered — an unmissable focal point of arrested motion.
4. **Body type thinning**: If health budget is also low, slim peds outnumber fat peds. The crowd takes up less visual mass — the city is visibly smaller in person.

These four signals are read simultaneously, before any UI update, the moment the player tabs to Street View.

---

### 7.4 Material and Texture Philosophy

#### Environment vs. Character Material Parity

All environment assets use **MeshStandardMaterial**, identical in type to character art (Section 6). The exception already established in Section 6 applies equally: MeshStandardMaterial is acceptable for large flat ground planes (road surface, sidewalk) where overhead-angle toon-shading banding would be distracting rather than stylistic. These surfaces receive no specular highlight even in MeshStandardMaterial.

#### Texture Map Policy — Environment Assets

| Rule | Environment assets |
|------|--------------------|
| Maximum resolution | 64×64 per asset (same limit as characters) |
| Style | Flat-painted, no photorealistic gradients, no normal maps, no roughness/metallic maps |
| What texture maps solve | Surface irregularity not achievable with material color alone (patching, stains, graffiti decals, pothole decals) |
| Format | PNG with alpha channel where decal compositing is required |
| Naming | `env_[object]_[descriptor]_[size].png` |

Most environment geometry requires texture maps. Texture maps used also for: (1) decal overlays (graffiti, stains, potholes), (2) the protest sign face (off-white flat plane), and (3) the country map in the laws office if present.

#### Environment Color Palette Extension

Extension values beyond Section 2 UI tokens:

| Name | Hex | Usage |
|------|-----|-------|
| Road asphalt | `#1a1612` | Road surface |
| Sidewalk concrete | `#8a8070` | Sidewalk surface |
| Curb grey | `#706860` | Curb edge |
| Stucco Poor | `#5a4c38` | Poor-tier facades |
| Stucco Normal | `#8a7860` | Normal-tier facades |
| Stucco Rich | `#c8c0a8` | Rich-tier facades |
| Wood floor warm | `#3a2210` | Parquet / polished stone |
| Terracotta tile | `#8a4428` | Roof tile eave |
| Military olive prop | `#2a3018` | Tanks, gun emplacements |
| Sandbag buff | `#7a6a50` | Gun nest |
| Fountain water | `#4080a0` | Fountain water plane |
| Bronze statue | `#7a5c28` | Statue 1 |
| Silver statue | `#9090a0` | Statue 2 |
| Gold statue | `#c0a000` | Statue 3 |

---

### 7.5 Production Constraints

#### 7.5.1 Draw Call Budget

Scene total: < 100 draw calls. Crowd: ~24 draw calls (Section 6.7.2). Environment split:

**Governance Area**: 20 draw calls maximum.

| Asset group | Draw calls |
|------------|-----------|
| All architectural surfaces (merged per material) | 2–3 |
| Furniture (table/couch/chairs — merged per material) | 2 |
| Individual props (paintings, paper stacks, pedestal) | 1 each |
| Total | ≤ 10 |

**Street View**: 56 draw calls maximum.

| Asset category | Draw calls |
|---------------|-----------|
| Road + sidewalk planes | 2 |
| Building facades (instanced per tier variant) | 8 |
| Roof geometry (merged per tier) | 2 |
| Trees / Palm Trees (InstancedMesh) | 2 |
| Streetlight props (InstancedMesh per type) | 2 |
| Trash Can props (body + fire plane) | 2 |
| Statue + Pedestal | 3 |
| Bench + Electric Pole (InstancedMesh) | 2 |
| Decal planes (potholes, graffiti, stains — per type) | 3 |
| Security props (instanced per type) | 8 |
| Fountain props (basin + water plane) | 2 |
| Skybox | 1 |
| **Total** | **~37** (19 draw calls headroom) |

**Merge strategy**: All architectural surfaces sharing a material within one camera position are merged into one geometry. Props using multiple materials count 1 draw call per material. Instanced props use `THREE.InstancedMesh` (1 draw call per instance group regardless of count). Environment geometry not visible simultaneously (governance vs. street) does not compete for draw calls.

#### 7.5.2 Lighting Compatibility

Every environment asset must render correctly under all lighting states it will be seen under. Key validation tests:

- **Governance area assets**: Must read at Meet tab ambient `#2a1508` intensity 0.45 (darkest governance state). If a prop vanishes at this intensity, the base material is too dark.
- **Street view assets**: Must read at Poor tier lighting (desaturated grey ambient, muted directional). All materials must carry sufficient value contrast — not just hue contrast — to remain readable when the scene is nearly monochrome.

Before approval, render each environment asset at: (1) its governance or street lighting minimum state, (2) its maximum (Rich / Sunny or Meet key), (3) Rich + Militarised combined. Fail 2 of 3 = redesign.

#### 7.5.3 Camera Frustum Compliance

**Overhead Street View (~60–70° downward)**:
- Ground surface fully visible; all road/sidewalk decals must read from above.
- Prop height must not exceed 1.5 units or overhead perspective creates clutter. Exception: statues, palm trees, searchlights.
- Ped walkable area must be kept clear of props — benches and poles are set against facades, not in sidewalk center.

**Meet tab close-up (horizontal, ~1–2 head-lengths from subject)**:
- Only lower third of back wall reliably visible. Background props above ~2 units from floor risk exiting the camera frustum.
- No asset exceeds 2.5 units height in the Meet position.
- Intermediate zone (1.5–3 meters depth from camera, between characters and background) must remain empty. No props in this gap.

---

*Section 7 confirmed against: Section 5 lighting state matrix, Section 6 character art direction, street-view.md GDD prop manifest, citizen-simulation.md render data contract, and the < 100 draw call scene budget.*

---

---

## Section 8: UI Visual Language

> **References**: Typography rules are in Section 3. Layout zones, spacing scale, border styles, and pixel asset inventory are in Section 4. This section covers everything that Sections 3–4 do not: diegetic/screen-space decision, iconography, motion language, new HUD elements, and error/empty/loading states.

---

### 8.1 Diegetic vs. Screen-Space Decision

**The game UI is entirely screen-space. No diegetic UI exists or should be added without an explicit design decision.**

The three-zone layout (Navbar / Tab content / Action Panel — Section 4) is a permanent opaque overlay. It does not pretend to be part of the game world; it is a bureaucratic control panel. The `hudbg.png` 9-slice border is the visual idiom for "this surface is the interface."

**What is always screen-space**: All three layout zones and their contents; all modals (DayEnded, EndScreen, Tutorial, HelpOverlay, FadeOverlay); all tab screens; all buttons, stat displays, timers, and relation readouts; the click-to-inspect citizen panel (§8.5.3).

**Why not diegetic**: PressStart2P at any size below 0.55rem is illegible (Section 3). Billboard geometry in the Three.js scene cannot guarantee pixel-aligned rendering across display densities. Any "floating label over a clicked object" in 3D space must be a CSS absolutely-positioned element anchored to the screen-space coordinate of the click target — not scene geometry.

**When to add a new screen-space element**: Add screen-space UI whenever the content is text, an interactive control, or feedback that must be readable without the player scanning the 3D scene.

**What must not use `CSS2DRenderer`, `CSS3DRenderer`, or WebGL text**: The project has no post-processing pipeline (Section 5). Any in-world UI attempt requires a new rendering layer. The only non-UI "signals" in the 3D scene are: faction colors on peds, fire planes on trash cans, and searchlight sweeps — these are scene-space visual effects, not UI.

---

### 8.2 Iconography Style

**An icon sprite sheet already exists**: `assets/icons.png` — a pixel sprite sheet, 32×32 sprites on a grid. The `Icon` component (`src/components/Icon/`) renders icons via CSS `background-position` offsets.

**Active named icons** (as of 2026-06-17): budget, law, secret, opportunity, needle, reject, clock, minus, plus, approve, meet, news, street, shop, charisma, checked, unchecked, business, people, military, gun, bribe, takeover, danger, lightning, info, calendar, warning, caret, random, trophy, skull.

**Style rules — for the existing sheet and all future additions:**
- **Format**: Pixel sprite, flat-filled, no outline or stroke. The sprite is a positive shape, not a stroke over transparent. Matches the fill-based aesthetic of `hudbg.png` and `button.png`.
- **Grid size**: 32×32 pixels per icon, aligned to the sprite sheet grid. Do not introduce a different grid size — a new size requires a separate sheet and a new CSS component.
- **Color**: All icons are rendered in a single neutral near-white foreground tone. Color meaning is applied at the component level via CSS `filter` or by context — not per-icon. Do not paint colored icons into the sprite artwork.
- **Do not use `--accent-color` in sprite artwork**. Accent is reserved for active-state borders and labels at CSS level. For accent-colored icon states, apply `filter: brightness(2) sepia(1) saturate(3)` at the container level.
- **Size in use**: `Icon` component renders at 32×32. For smaller inline contexts, use `transform: scale(0.5); transform-origin: left center` at the container — do not add a new sprite sheet size. *(Note for UI programmer: the element still occupies 32×32 in flow; apply `width: 16px; height: 16px; overflow: hidden` alongside the scale.)*
- **Adding new icons**: Add to `assets/icons.png` on the existing grid, plus a corresponding `.icon-[name]` class in `Icon.module.css`. Current reserve slots: `.icon-i32` through `.icon-i63` — use these before expanding the sheet.

---

### 8.3 Animation Feel and Motion Language

**Governing tone: bureaucratic severity means deliberate, not frozen.**

UI motion in this game is institutional — it acknowledges that something changed, then gets out of the way. No bounce easing, no spring physics, no stagger sequences, no loading spinners engineered to delight. A regime does not entertain.

**Duration defaults:**

| Context | Duration | Easing | Notes |
|---------|----------|--------|-------|
| Hover / focus state | `0.25s` | `ease-in` | Already in `Button.module.css` |
| Tab switch | `0ms` (instant) | n/a | `display: none` toggle — no transition. The bureaucracy moves files, it does not animate them. |
| Modal entry / exit | `150ms` | `ease-out` in / `ease-in` out | `opacity: 0 → 1`. No slide. |
| FadeOverlay (scene transitions) | `100ms` | `ease-in-out` | Already implemented |
| Advance-ring spin | `3s` | `linear` | Already implemented; constant rotation signals urgency without acceleration |
| Advance-hint pulse | `1.8s` | `ease-in-out` | Already implemented; slow oxygen-level pulse |
| Coup badge danger pulse | `0.8s` | `ease-in-out` | Already implemented; fastest pulse — the only place agitation is permitted |
| Semantic stat value color change | `0.3s` | `ease` | `transition: color 0.3s ease` on stat values that change |

**What SHOULD animate**: Hover/active state shifts; the advance-round ring; modal opacity transitions; semantic color transitions on stat value changes.

**What MUST NOT animate**: Tab switches; layout zone sizes (fixed); text content (number updates are in-place, no roll-up effect); entrance animations on load; anything that loops without user interaction beyond the advance-ring and coup badge.

**The pixel rule for animation**: If a CSS animation causes a pixel border asset to sub-pixel render (producing blur), the animation must be removed. Use only `opacity`, `filter`, and `color` transitions on elements bearing pixel border assets — not `transform` properties that produce fractional pixel positions.

---

### 8.4 Color Update Required: Warning vs. Accent Yellow

**Decision (2026-06-17)**: `--warning-yellow` (#f1c40f) is being retired and replaced by `--attention-color` (#4dd9ec, pale cyan).

**Reason**: `--accent-color` (#fbee32) and `--warning-yellow` (#f1c40f) are both yellow and differ only in brightness (Lab ΔE ≈ 8). At PressStart2P sizes below 1rem — which includes all HUD stat text — these are indistinguishable to most users and fail for deuteranopes and protanopes.

**New token**:
```css
--attention-color: #4dd9ec;  /* pale cyan — replaces --warning-yellow for attention/caution states */
```

**Migration rule**:
- `--warning-yellow` was used for: Rounds remaining warning in the navbar.
- The navbar rounds-remaining warning is already in a large-enough context (close to the amber ring) where context distinguishes it from `--accent-color`. For this single existing use, either migrate to `--attention-color` or retain `--warning-yellow` by its original semantic (rounds remaining, navbar only) and use `--attention-color` for all new attention/caution uses.
- **All new UI elements** (Street View HUD, citizen panel, future mechanics) must use `--attention-color` (#4dd9ec) for caution/warning states.
- `--accent-color` (#fbee32) is reserved exclusively for call-to-action elements (the advance button, active tab borders, titles). It never appears as a caution color.

*(Implementation: update `src/index.css` — add `--attention-color`, retain `--warning-yellow` for navbar backward compatibility, migrate to `--attention-color` in new components.)*

---

### 8.5 New UI Elements — Street View Citizen Simulation HUD

The Street View tab renders the 3D citizen scene in the Tab content zone (fluid middle, above the Action Panel). All HUD elements here are screen-space CSS overlaid on that scene, using the visual language of Sections 1–4.

#### 8.5.1 Population Counter

Displays alive citizen count (of 25) and a derived displayed population (~5.9M × alive/25).

**Visual treatment**: A compact `hudbg.png` 9-slice panel, positioned top-left of the Street View tab zone. Maximum height 48px.

**Layout**:
```
POPULATION: 23/25    5,428,000
```

- Label `POPULATION:` — `--accent-color`, all-caps, `0.55rem`, `letter-spacing: 0.08em`
- Count `23/25` — `--text-color`, `0.7rem`
- Displayed population — `--text-body`, `0.55rem`, right-aligned
- Color thresholds: `alive ≥ 20` → `--text-color`; `alive < 20` → `--attention-color`; `alive < 10` → `--expense-red`
- No animation on counter. Numbers update between rounds only.

#### 8.5.2 Role Legend

A static reference panel showing which 3D posture/outfit corresponds to which citizen role. Positioned bottom-left of the Tab content zone, above the Action Panel.

**Layout** (vertical stack, 2-column):
```
[dot] CONTENT      [dot] NEUTRAL
[dot] THIEF        [dot] PROTESTOR
```

| Role | Dot color | Token |
|------|-----------|-------|
| Content | Income green | `--income-green` (`#27ae60`) |
| Neutral | Muted accent | `--accent-muted` (`#d1d37f`) |
| Thief | Attention cyan | `--attention-color` (`#4dd9ec`) |
| Protestor | Expense red | `--expense-red` (`#e74c3c`) |

- Dot: 6×6px filled square
- Labels: `--text-body`, `0.45rem`, uppercase, `letter-spacing: 0.06em`
- Count suffix: `THIEF (3)` — count in `--attention-color` when non-zero, `--text-body` at zero
- Panel: `--hud-panel-bg` at 90% opacity, `border: 1px solid rgba(255,255,255,0.1)` (no `hudbg.png` border — legend is secondary)

**Why no floating per-ped labels**: At 12–16px effective ped height, per-ped text is unreadable and visually cluttered. The legend teaches the role-to-visual mapping once; after that, 3D posture and clustering carry the information directly.

#### 8.5.3 Click-to-Inspect Citizen Panel

When the player clicks a citizen ped, a screen-space inspect panel opens. Fixed-size right-side panel, 240px wide, full Tab content zone height. Overlays the right edge of the scene — no scrim, no backdrop-filter. Panel stays open until the player clicks elsewhere or another citizen; content swaps in-place instantly (no open/close animation).

**Panel content** (NAME first — emotional hook over behavioral data):

```
[NAME]
[FACTION ICON] [FACTION LABEL]
────────────────────────────
NAME          [FIRSTNAME LASTNAME]
HAPPINESS     [0–10 value]
HEALTH        [status]
ROLE          [CONTENT / NEUTRAL / THIEF / PROTESTOR]
EMPLOYMENT    [EMPLOYED / DISPLACED]
────────────────────────────
[flavor line]
```

- Name header: `--text-color`, `0.7rem`, all-caps, prominent
- Faction icon: `Icon` component at `scale(0.5)` — `icon-military`, `icon-business`, or `icon-people`
- Faction label: `--accent-muted`, `0.55rem`, all-caps
- Stat labels: `--text-body`, `0.45rem`, all-caps, `letter-spacing: 0.08em`
- Stat values:
  - Happiness: `--income-green` at 7–10; `--text-color` at 4–6; `--attention-color` at 2–3; `--expense-red` at 0–1
  - Role: colored by role color (same as Role Legend dots above)
  - Employment: `EMPLOYED` in `--income-green`; `DISPLACED` in `--attention-color`
- Flavor line: one sentence, `--text-body`, `0.45rem`, `line-height: 1.8`. Not data — the narrative mirror.
- Section dividers: `1px solid rgba(255,255,255,0.1)` (Section 4 subtle divider)
- Panel padding: `1rem` (base spacing, Section 4)
- Panel border: `2px solid --accent-color` (modal card style, Section 4)

**The "gone" state**: Dead citizens cannot be clicked (not rendered in scene). If a citizen dies during a round where they are being inspected (round end), the panel shows `[NAME] — ABSENT` in `--text-body` at 60% opacity, no other fields.

#### 8.5.4 Consistency Check

All Street View HUD elements use only the four established text tokens plus `--attention-color` (new, §8.4) and the existing semantic colors. No new color values are introduced. The Population Counter uses `hudbg.png` 9-slice (primary panel). The Role Legend uses the subtle border (secondary reference element). The Inspect Panel uses the `2px solid --accent-color` modal card border (active inspect content). This three-tier panel hierarchy maps directly to information hierarchy.

---

### 8.6 Error, Empty, and Loading States

#### Empty States

**Empty tab (no laws available, no deals this round):**

```
[icon-info at 32×32, centered]
NO LAWS AVAILABLE
THIS ROUND.
```

- Icon: `icon-info`, full 32×32, centered
- Primary line: `--accent-muted`, `0.7rem`, all-caps, centered
- Sub-line (optional): `--text-body`, `0.55rem`, `line-height: 1.8`, centered
- No panel background. No animation. No skeleton placeholder. Empty is empty.

**Empty inspect panel (no citizen selected)**: Panel does not render until a citizen is clicked. No placeholder "click a citizen" panel — the scene is the affordance.

#### Disabled Button States

The disabled state for buttons with `button.png` pixel border:

```css
&:disabled {
  cursor: not-allowed;
  filter: brightness(0.5) saturate(0.2);
  opacity: 0.85;
}
```

**Why this combination**: `filter` applies to `border-image`, so `brightness(0.5) saturate(0.2)` desaturates and dims the pixel border alongside the button content — the button remains visibly present as an outline without reading as interactive. `opacity: 0.85` is kept high to prevent the button from disappearing entirely against `#2b1807`. The net result is a clearly grey, clearly inert button that does not vanish on the dark background.

**Disabled rule**: Never hide a button that will become available later. Disabled is always preferable to absent for time/resource-gated actions.

#### Loading States

The Three.js scene loads behind a React Suspense boundary. During load, the Tab content zone displays:

```
LOADING...
```

- `--accent-muted`, `0.55rem`, `letter-spacing: 0.1em`, all-caps, centered in the Tab content zone
- Animation: reuse the existing `hintPulse` `@keyframes` from `Navbar.module.css` (`1.8s ease-in-out infinite`, opacity 0.6 → 1). Do not define a new animation. *(Note for UI programmer: extract `hintPulse` to a shared `animations.css` so both modules can reference it without duplication.)*
- No progress bar, no percentage, no loading graphic.

---

### 8.7 UX Implementation Requirements

*(Engineering requirements surfaced during UX alignment review — not art direction, but scoped here for completeness.)*

| Flag | Severity | Owner | Requirement |
|------|----------|-------|-------------|
| Numeric value alignment | Low | UI Programmer | Right-align and pad all numeric HUD values to fixed character width to prevent digit cluster reflow under PressStart2P |
| Minimum functional text size | Medium | UI Programmer | No functional text (stat values, button labels) below `0.6rem`; audit any existing 0.45–0.55rem uses and confirm they are decorative only |
| Ped hit zone size | High | UI Programmer | Raycasting hit zone for clickable citizen peds must be a minimum 44×44px screen-space equivalent sphere/billboard around each ped — ped visual geometry alone will be too small |
| Ped clickability affordance | High | Art Director + UI Programmer | Confirm CSS `cursor: pointer` fires reliably on fast-moving 3D canvas targets via raycasting. If not, add a persistent "click a citizen" instruction label in the Street View tab content header |

---

---

## Section 9: VFX & Particle Style

**No particle emitters. No `THREE.Points`. No `THREE.ParticleSystem`. No Three.js built-in particle effects.** This constraint is absolute — particle systems violate the < 100 draw call budget and the 60 fps frame target at crowd-scale.

All visual effects in the game are achieved through three alternative approaches:

### 9.1 Animated UV-Scroll Planes (Fire)

**Used for**: Burning Trash Can fire (Section 7.2.3).

A flat rectangular plane mesh (`THREE.PlaneGeometry`) uses a `MeshStandardMaterial` with a sprite sheet `map` property. The UV coordinates scroll vertically at a fixed rate via `material.map.offset.y` updated each frame in the `useFrame` callback. A 4-frame fire sprite strip (256×1024 total, 4 frames at 256×256 each) creates the looping fire illusion.

- Frame duration: ~100ms per frame (10fps animation on a 60fps scene)
- UV scroll rate: `offset.y += 0.25` per frame (for a 4-frame strip at 60fps target: advance one frame every 6 render frames at 60fps ≈ 10fps animation rate)
- The fire plane is double-sided (`THREE.DoubleSide`) and billboard-oriented (faces camera or faces up — to be determined by engineer based on overhead vs. front visibility)
- Each fire plane instance shares the same `MeshStandardMaterial` — material is not cloned per instance. UV scroll is applied to the shared material (same fire rate on all trash cans, which is acceptable — identical fire behavior reinforces the impression of systemic failure)
- No PointLight is added per fire plane independently — the fire PointLight is on the `env_trash_can_burning_small.FBX` prop, not on the plane. Plane is purely visual.

### 9.2 Three.js Lighting Animations

**Used for**: Searchlight sweep (Section 5.4.4), pressure state lighting lerp (Section 5.5), scene state transitions (Section 5).

All scene-level "effects" are achieved through animated `PointLight` position/color and `AmbientLight` color lerps in the `useFrame` callback. No additional geometry or particle systems are required.

- Searchlight: `PointLight` position vector rotated around Y axis at ~0.5 rad/s
- State transition: ambient and directional light colors `lerp()` over 600ms
- Pressure state: ambient and fog values lerp toward target over 600ms (Section 5.5)

### 9.3 CSS Animations (UI)

All UI visual effects are CSS-only (Section 8.3). The advance-ring spin (`animation: spin 3s linear infinite`) and coup badge pulse (`animation: pulse 0.8s ease-in-out infinite`) are the only persistent animated effects in the game. Both are defined in existing CSS modules.

### 9.4 What Will Never Exist in This Game

- Particle emitters of any kind (Three.js or CSS)
- Shader-based effects requiring custom GLSL (no custom `ShaderMaterial`)
- Post-processing passes (no `EffectComposer`, no bloom, no blur, no tone mapping beyond Three.js defaults)
- Animated vertex displacement or morphTargets
- Screen-space effects (no lens flare, no god rays, no depth of field)

If a future feature requires effects that cannot be achieved with lighting + UV animation + CSS, it requires a draw call budget analysis and explicit architectural decision before implementation.

### 9.5 Animated Sprite Definition — `ANIMATED_SPRITES` Constant

For props that combine a static base mesh with a UV-animated sprite plane (e.g., `env_trash_can_burning_small.FBX` with its fire plane), animation parameters are centralised in `src/Constants/AnimatedSprites.ts`:

```ts
export const ANIMATED_SPRITES: Record<string, {
  meshName: string;   // sub-mesh name within the FBX that carries the animated texture
  textureX: number;   // pixel width of one animation frame
  textureY: number;   // pixel height of one animation frame
  frames: number;     // total frame count in the sprite strip
  frameRate: number;  // target animation speed (frames per second)
}[]> = {
  env_trash_can_burning_small: [{
    meshName: 'sprite',
    textureX: 256,
    textureY: 256,
    frames: 4,
    frameRate: 10,
  }],
  // register future animated props here
};
```

**Artist instruction**: The animated sprite plane sub-mesh within any FBX must be named exactly `"sprite"`. The runtime animation system resolves entries by FBX filename at load time. If an entry is missing, the sprite plane renders as a static texture.

**Sprite sheets are exempt from the 64×64 texture limit** (§10.3). The fire sprite sheet is 256×1024 (4 × 256×256 frames). Future animated sprite sheets should keep individual frame size ≤ 256×256.

---

## Section 10: Asset Standards

This section consolidates all technical production standards established across Sections 5–9 into a single reference. An outsourcing team should be able to follow this section without additional briefing.

### 10.0 World Scale Convention

**1 unit = 1 metre, everywhere in the scene.**

This is the canonical scale for all Three.js world coordinates and all FBX asset production. Model at real-world proportions in 3ds Max with system units set to metres; export FBX with unit scale metres. Assets import at `scale={1}` with no correction factor in code.

#### Reference Dimensions

| Object | Real-world size | Three.js units |
|--------|----------------|----------------|
| Adult human height | 1.7–1.9 m | 1.7–1.9 |
| Sidewalk curb height | 0.1 m | 0.1 |
| Road lane width | 3.5 m | 3.5 |
| Road total width (2 lanes) | 7 m | 7 |
| Building height — low-rise | 8–12 m | 8–12 |
| Building height — mid-rise | 12–18 m | 12–18 |
| Plaza slab thickness | 0.2 m | 0.2 |
| Pothole decal footprint | 0.3 × 0.4 m | 0.3 × 0.4 |
| Streetlight height | 4–6 m | 4–6 |
| Statue pedestal height | 0.8 m | 0.8 |
| Car (W × H × L) | 2.0 × 1.4 × 4.5 m | 2.0 × 1.4 × 4.5 |
| Pedestrian placeholder (W × H × D) | 0.6 × 1.8 × 0.6 m | 0.6 × 1.8 × 0.6 |

#### Street Scene Extent

| Axis | Range | Notes |
|------|-------|-------|
| X | −21 to +21 | 42 m total width; road centred at x=0 |
| Z | +4 (south) to −20 (north) | 24 m depth |
| Y | 0 = ground; geometry sits above 0 | plaza slab top at y=0.2 |

Street tab camera: `pos [0, 18, 14]`, rotation.x `−0.76 rad` (~43° down), FOV 50°.

#### 3ds Max Export Settings

Set 3ds Max **system units to Metres** before modelling. In the FBX export dialog:

| Setting | Value |
|---------|-------|
| Units | Metres |
| Axis conversion | Y-up |
| Scale factor | 1.0 |

After import via `FBXLoader`, the asset renders at `scale={1}` with no correction. The existing governance room assets (`people.FBX`, `elite.FBX`, `police.FBX`, `main.FBX`) were authored at this scale and confirm it: characters appear ~1.0–1.4 m tall at `scale={1}`.

---

### 10.1 File Formats and Delivery

| Asset type | Format | Notes |
|-----------|--------|-------|
| 3D models (characters, environment) | FBX (binary glTF 2.0) | Y-up coordinate system, meter scale. One file per asset. |
| Animations | Embedded in FBX | Walk cycles embedded in the ped FBX. Faction reps have no animation — idle pose only. |
| Texture maps | PNG | Power-of-2 dimensions. Alpha channel required for decal compositing. sRGB color space. |
| Icon sprites | PNG, single sheet | `assets/icons.png` — 32×32 sprites on a grid. New icons append to existing sheet. |
| UI border assets | PNG | `assets/hudbg.png` (9-slice, 24px), `assets/button.png` (9-slice, 12px). These are existing assets; do not replace or modify. |

### 10.2 Polygon Budgets

| Asset category | Triangle budget | Notes |
|---------------|----------------|-------|
| Faction representative (close-up) | 800–1,200 tri | One model per faction rep. No LOD — these are at a fixed close-up distance. |
| Citizen ped — base mesh | 200–350 tri | Per body type + outfit combination. Shared via `THREE.InstancedMesh`. |
| Citizen ped — protestor special | 200–350 tri (ped) + ~50 tri (sign) | Sign geometry adds ~50 tri. Combined mesh for instancing. |
| Environment asset — small prop | < 100 tri | Benches, trash cans, cameras, potholes. |
| Environment asset — medium prop | 100–300 tri | Streetlights, fountains, guard posts, tanks. |
| Environment asset — building section | 200–500 tri per facade segment | Buildings are instanced by tier variant. Merge all facade segments of the same material before delivery. |
| Statue | 300–500 tri | Three variants (bronze/silver/gold). Pedestal: 50 tri. |

**Hard upper limit**: No single asset file may exceed 1,500 triangles. If an asset approaches this limit, reduce detail or split into sub-components that share a material.

### 10.3 Texture Budgets

| Context | Maximum resolution | Color space | Notes |
|---------|-------------------|-------------|-------|
| All 3D asset diffuse textures (chars, environment) | 64×64 | sRGB | 256-color indexed palette (PNG-8 or quantized). Hard limit — larger textures are rejected. |
| Environment decal (graffiti, stains, potholes) | 64×64 | sRGB + alpha | Alpha channel required for compositing. 256-color indexed. |
| Sprite sheet (fire animation) | 256×1024 | sRGB | 4 frames at 256×256 each, vertical strip. Sprite animation sheets are exempt from the 64×64 limit. |
| Icon sprite sheet | 32×32 per icon | sRGB + alpha | `assets/icons.png` — existing grid. Not a 3D asset texture. |

**MeshStandardMaterial does not use PBR texture channels.** Do not deliver `_roughness`, `_metalness`, `_normal`, or `_AO` maps. Only `map` (diffuse/color) is consumed.

### 10.4 Material Standards

All 3D assets use `THREE.MeshStandardMaterial` with smooth shading — no flat shading, no toon shading, no `gradientMap`, no `MeshToonMaterial`. `MeshStandardMaterial` is the standard for all characters, crowd peds, and environment props.

**Material per-asset**: Each asset should have the minimum number of material slots necessary. Each material slot is one draw call when not instanced.
- Faction reps: 2 materials (body + medal)
- Generic civilian peds: 3 materials (skin + torso + pants)
- Outfit peds (army, business, thief, protestor): 2 materials (skin + outfit)
- All other assets: 1 material preferred; 2 materials if strictly necessary (e.g., lamp + pole on a streetlight)

**Color encoding**: Assign base colors via `MeshStandardMaterial.color`. Do not embed color in texture where `color` alone is sufficient — this simplifies material swapping for faction outfit variants.

### 10.5 Rigging and Animation Standards

| Parameter | Requirement |
|-----------|-------------|
| Rig system | **3ds Max Biped**; exported as bone-based armature in FBX. No blend shapes, no physics rigging, no cloth simulation. |
| Bone count (citizen peds) | ≤ 9 bones: hips, L/R upper leg, L/R lower leg, spine, head, L/R upper arm |
| Bone count (faction reps) | 0 bones (static pose, no animation) |
| Animation clips (citizen peds) | Four clips embedded in the ped FBX: `idle`, `walk`, `protest`, `thief_sneak_walk` |
| `idle` | 4–8 keyframes; looping subtle weight-shift. All ped types include this clip. |
| `walk` | 4–6 keyframes; looping seamlessly. All ped types include this clip. |
| `protest` | 12–16 keyframes; sign held up, slight sway. Protestor peds only; other ped types may omit. |
| `thief_sneak_walk` | 8–12 keyframes; torso forward, low centre of gravity, quick steps. Thief peds only; other ped types may omit. |
| Three.js retargeting | Three.js `AnimationMixer` with `THREE.AnimationClip` supports Biped FBX animation. Ensure Biped bone names export with standard names so clips can be retargeted across body-type variants of the same ped at runtime. |
| Sign bone | Protest sign attaches as a child bone of the right wrist; included in `protest` clip only. |

No physics-based rigging, no secondary motion, no cloth simulation. Rig complexity above the 9-bone budget requires architectural review.

### 10.6 Asset Naming Convention

| Asset category | Convention | Example |
|---------------|------------|---------|
| Faction representative | `char_[faction]_rep_idle_[version].FBX` | `char_military_rep_idle_01.FBX` |
| Citizen ped | `ped_[gender]_[bodytype]_[outfit]_[version].FBX` | `ped_man_fit_civilian_01.FBX` |
| Special citizen ped | `ped_special_[gender]_[role].FBX` | `ped_special_man_protestor.FBX` |
| Environment prop — small | `env_[object]_small.FBX` | `env_trash_can_burning_small.FBX` |
| Environment prop — medium | `env_[object]_medium.FBX` | `env_streetlight_standard_medium.FBX` |
| Environment prop — large | `env_[object]_large.FBX` | `env_tank_large.FBX` |
| Statue | `env_statue_[material]_[style]_large.FBX` | `env_statue_bronze_standing_large.FBX` |
| Environment texture / decal | `env_[object]_[descriptor]_[size].png` | `env_wall_stain_small.png` |
| Building mesh (tier variant) | `env_bld_[type]_[tier].FBX` | `env_bld_apartment_poor.FBX` |
| Skyline mesh | `env_skyline.FBX` | — one mesh, three texture variants |
| Skyline texture variant | `env_skyline_[tier].png` | `env_skyline_poor.png` |
| Plaza mesh | `env_plaza.FBX` | — one mesh, three texture variants |
| Plaza texture variant | `env_plaza_[tier].png` | `env_plaza_normal.png` |
| Vehicle | `env_[car\|bike]_[variant]_[size].FBX` | `env_car_01_medium.FBX` |

**Versioning**: Use `_01`, `_02` etc. for iteration. Retire old versions by removing from `assets/` — do not keep unused variants in the bundle.

### 10.7 Performance Validation Checklist

Before committing any 3D asset:

- [ ] Triangle count within budget for its category (§10.2)
- [ ] Texture resolution ≤ budget for its category (§10.3)
- [ ] Material slot count ≤ 2
- [ ] FBX is Y-up, meter scale
- [ ] Walk cycle (if applicable) loops seamlessly at frames 0–N
- [ ] Asset renders correctly under Standard Gameplay lighting (Section 5.2) AND its minimum scene lighting state (see Section 5.10 matrix)
- [ ] Scene draw call count with asset added: still ≤ 100 total

---

### 10.8 Vehicle Mesh Split

All car and bike FBX files are split into **four named sub-meshes** to support runtime colour variation and math-driven wheel rotation:

| Sub-mesh name | Purpose |
|---------------|---------|
| `body` | Main vehicle body — the only sub-mesh that accepts colour swaps for vehicle variation |
| `lights` | Headlights and taillights — separated to allow emissive material toggle at night / pressure states |
| `wheels_front` | Front wheel pair — rotation driven by a `useFrame` math function (`wheel.rotation.x += velocity / wheelRadius`), **not** by animation keyframes |
| `wheels_back` | Rear wheel pair — same approach as `wheels_front` |

**No wheel animation is embedded in the FBX.** The FBX contains only the static T-pose with all four sub-meshes named exactly as above. Wheel rotation is applied at runtime.

**Polygon budget**: Body + lights: < 300 tri total. Each wheel mesh: < 50 tri. Total per vehicle: < 500 tri.

**Naming convention**: `env_car_[variant]_[size].FBX`, `env_bike_[variant]_[size].FBX`

---

---

## Section 11: Style Prohibitions and Reference Direction

### 11.1 Reference Direction

Each reference contributes one specific, non-overlapping technique. References are additive — no two sources point in the same direction.

---

**Reference 1: *Papers Please* (Lucas Pope, 2013)**

*What to draw from:* The semantic use of color as institutional language, not decoration. In *Papers Please*, red means violation, green means approval — these are not design choices, they are bureaucratic facts the player internalizes as survival data. Apply this to the game's semantic color system: `--expense-red`, `--income-green`, and `--attention-color` are not expressive — they are reporting. The player reads them the way a clerk reads a stamp. Color exists before emotion does.

*What not to import:* The deliberate degradation of UI fidelity as a stylistic choice — the smeared stamps, the worn paper textures, the layered document grime. *Papers Please* uses physical document weight as a key aesthetic. This game's UI is a pixel-HUD frame, not a document surface. Worn paper textures do not belong on `hudbg.png` panels.

---

**Reference 2: *Reigns* (Nerial, 2016)**

*What to draw from:* The radical restraint of the information hierarchy. *Reigns* presents exactly one decision at a time and does not explain consequences in advance. Apply this to how stat information is surfaced in the Action Panel — the three-column grid (Section 4) presents treasury, faction relations, and action buttons simultaneously but without hierarchy competition. Each column is equal weight and complete in itself. Do not add infographics, trend graphs, or explanatory overlays. The player is meant to carry incomplete information.

*What not to import:* The card-flip as visual rhythm. *Reigns* is built entirely around the swipe gesture and the anticipation of card reveal. This game has no card metaphor — its interface is a government desk, not a deck. Avoid any animation language that mimics reveal, flip, slide, or deal. The advance button is the only "event" trigger; it does not animate like a card.

---

**Reference 3: *Tropico* series (Haemimont/Kalypso, 2001–2022)**

*What to draw from:* The specific calibration of political satire that makes itself felt through accumulation of mundane decisions, not through jokes. *Tropico* games do not satirize with irony — they satirize by taking the dictator's perspective completely seriously, in a world that is absurd. Apply this to the environmental storytelling (§7.3): the golden statues under luxury streetlights beside freshly whitewashed facades are not winking at the player. The city is genuinely beautiful by its own logic. The game never points at itself.

*What not to import:* The warm tropical color palette as a production value. *Tropico*'s art leans into lush Caribbean greens, bright blues, and saturated colonial pastels as visual appeal. This game's palette is deliberately muted, brown-dominant, and amber-tinted. Tropical saturation only appears in the Rich infrastructure tier, and there it reads as performative, not genuine. Outside of Rich tier, tropical brightness is prohibited.

---

**Reference 4: Jacques Tati (filmmaker — *Mon Oncle* 1958, *Playtime* 1967)**

*What to draw from:* The compositional technique of communicating character through spatial arrangement and architectural scale, with no dialogue or on-screen explanation. In *Playtime*, the building is the character. The joke is never explained. Apply this to the Meet tab seating arrangement (§7.1.2): the military man at permanent salute, the businessman on the full-length couch, the civilian on a dragged-in chair — no UI text labels this hierarchy. The player reads it from the spatial composition the moment the tab opens. Design scenes to be legible from composition alone, before any UI text is processed.

*What not to import:* The cool modernist palette of Tati's production design — blues, greys, aluminium, glass. Tati's visual world is the opposite of this game's warm brown palette. The reference is compositional logic only: how spatial arrangement carries narrative weight without explanation.

---

### 11.2 Style Prohibitions — Master List

Authoritative consolidated list. Each prohibition states what is forbidden and why.

---

#### A. 3D Characters

- **No cartoon or chibi proportions.** Heads must not exceed 1/7 of total body height. The game's institutional register requires credible human scale.
- **No rounded silhouettes on the Military or Business faction representatives.** Both must have at least three angular inflection points in their full-body silhouette. Rounded shoulders on the General read as friendly — contradicts transactional menace.
- **No symmetrical poses on the Business or People representatives.** Symmetrical People rep reads as confident — wrong.
- **No oversized accessories.** Props must not exceed 15% of character total height from the primary camera angle. Exception: the protest sign (`ped_special_man_protestor`).
- **No facial animation on faction representatives.** No idle blink, no talking cycle, no expression animation. Static quality is intentional.
- **No open mouths or visible teeth.** Closed or slightly pressed-together lips are the bureaucratic resting state.
- **No smiling on any faction representative.** The Business rep may appear faintly pleasant — not warm.
- **No per-ped text labels in the 3D scene.** At 12–16px effective ped height, text is unreadable. Citizen information belongs in the screen-space inspect panel.
- **No PBR texture channels on any character asset.** Deliver only a `map` (diffuse/color). `_roughness`, `_metalness`, `_normal`, and `_AO` maps are not consumed by `MeshStandardMaterial`.
- **No texture maps exceeding 64×64 for any 3D asset.** All character and environment diffuse textures: 64×64, 256-color indexed palette (PNG-8 or equivalent). Sprite animation sheets (fire, icons) are exempt from this limit.
- **No single asset file exceeding 1,500 triangles.**
- **No bone count above 9 for citizen peds.** No physics rigging, secondary motion, or cloth simulation.

---

#### B. Environment

- **No glass curtain walls, horizontal window bands, or steel cladding on buildings.** The city is colonial vernacular + mid-century concrete expansion.
- **No US residential vernacular.** Pitched gable roofs and vinyl siding are the wrong geography.
- **No European townhouse vernacular.** Mansard roofs and stone facade profiles belong elsewhere.
- **No additions to the Laws office that compete with the paper and painting density.** Future props must be at desk height or lower with a smaller footprint than existing paper stacks.
- **No individual PointLights on statue props (v1 scope).** Statues receive ambient and directional scene light only.
- **No asymmetric placement of security props.** Guard posts anchor both street ends symmetrically. Tanks face each other. The geometric regularity is the signal of occupation.
- **No props in the sidewalk center.** Benches, poles, and all props sit against building facades. The sidewalk center is the ped walkable zone.
- **No assets taller than 1.5 units in Street View** without explicit exception (statues, palm trees, searchlights).
- **No assets taller than 2.5 units in the Meet tab position.**
- **No props in the intermediate zone** (1.5–3 meters depth between faction reps and back wall).
- **No texture maps exceeding 64×64 for environment assets.** Same indexed-palette limit as characters.
- **No toon shading or flat shading on any asset.** All assets use `MeshStandardMaterial` smooth shading — no `MeshToonMaterial`, no `gradientMap`, no `flatShading: true`.

---

#### C. UI

- **No italic text in game UI.** PressStart2P has no italic variant; CSS italic produces a faux slant. Exception: `.outcomeQuote` narrative quotes only.
- **No text below 0.45rem.**
- **No new font families without an ADR.**
- **No raw hex values in component files.** New UI elements must use established CSS custom properties, except documented residual exceptions (alpha tints, shape-math, Newspaper palette, debug overlay).
- **No `--accent-color` used as a caution or warning color.** Accent (`#fbee32`) is reserved for call-to-action elements, active borders, and titles only. Caution states use `--attention-color` (`#4dd9ec`).
- **No colored icon artwork in sprite sheets.** Icons are near-white foreground tone only; color meaning is applied at the CSS container level.
- **No new sprite sheet grid sizes.** All new icons append to the 32×32 grid.
- **No `CSS2DRenderer`, `CSS3DRenderer`, or WebGL text.** All text is screen-space CSS.
- **No diegetic UI.**
- **No unstyled divs in the HUD zone.** Any new panel must visibly belong to either game UI (pixel border) or structural container (transparent/panel-bg).
- **No skeleton placeholders or loading graphics.** The loading state is `hintPulse` text `LOADING...` only.
- **No "click a citizen" placeholder panel before a citizen is selected.** The scene is the affordance.

---

#### D. Motion and Animation

- **No bounce easing, spring physics, or stagger sequences.**
- **No tab-switch transitions.** Instant `display: none` toggle only.
- **No slide, flip, or reveal animations.** Modal entry/exit is `opacity: 0 → 1` at 150ms only.
- **No entrance animations on page or section load.**
- **No animated loops beyond the advance-ring spin and coup badge pulse.** Additional looping animations require explicit design approval.
- **No `transform` transitions on elements bearing pixel border assets.** Use only `opacity`, `filter`, and `color` transitions on elements with `border-image` pixel assets.
- **No snap cuts between scene lighting states.** All scene state transitions lerp over ~600ms.
- **No new lights added during the Active Pressure state.** Pressure is expressed through color shift only.

---

#### E. General Visual

- **No cool ambient light as a base.** The ambient floor is always warm. The searchlight sweep (`#d0e0ff`) and fountain accent (`#4080c0`) are accent point sources, not ambient fills.
- **No particle emitters of any kind.** Fire is UV-scroll plane animation only.
- **No custom GLSL or `ShaderMaterial`.** All Three.js materials are `MeshStandardMaterial` (road/sidewalk only).
- **No post-processing passes.** No `EffectComposer`, bloom, depth of field, lens flare, god rays, or SSAO.
- **No animated vertex displacement or morphTargets.**
- **No HDR or custom tone mapping.** Three.js default tone mapping only.
- **No red used as an authoritative or heroic color.** Red is exclusively warning and defeat. The amber accent (`#fbee32`) carries all authority.
- **No tropical color saturation outside the Rich infrastructure tier.** Lush greens, cerulean skies, and bright colonial pastels only appear in Rich tier, where they read as performative, not genuine.
- **No scene geometry used to render text.** Plaque text, sign text, and any in-world labels are UI elements only.
- **No humor that points at itself.** The satirical register is cumulative and environmental. The game does not wink.

---

## Open Questions (Sprint 5+)

- **8-BIT WONDER and Bitmgothic**: 8-BIT WONDER removed. Bitmgothic is used. Check actual code before suggesting stupid shit.
- **Dark-mode variant**: `--text-color-dark` and `--text-body-dark` exist but light-background UI is rare. This is used for laws, it should never be removed.

### Resolved (2026-06-14)

- ~~**Color tokenization**~~: Done. All HUD-identity hex values are now CSS custom properties (see Section 2). Residual inline values are alpha tints / shape-math / non-shipped UI.
- ~~**`--tab-bg`**~~: Defined as `transparent` in `index.css` — tab content is intentionally transparent over the 3D scene (HUD zone 3/4).
