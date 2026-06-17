# Visual Entity & Screen Inventory

> **Generated**: 2026-06-17 (updated 2026-06-17)
> **Sources**: design/gdd/game-concept.md, design/gdd/lasting-effects-prd.md,
> design/gdd/early-game-grace-period.md, design/gdd/difficulty-levels.md,
> design/gdd/weird-laws.md, design/gdd/weird-deals.md, design/gdd/street-view.md,
> design/gdd/citizen-simulation.md, design/gdd/sound-music.md,
> design/art/art-bible.md
> **Total items**: ~197
> **Spec coverage**: 0 / 197 specced

---

## Characters

All character and ped models are FBX, Y-up, meter scale. Textures 64×64 PNG, 256-colour indexed palette. Smooth shading (`MeshStandardMaterial`). Animations use 3ds Max Biped (see art-bible §10.5).

| # | Name | Type | Description | Source | Status |
|---|------|------|-------------|--------|--------|
| C-001 | `char_military_rep_idle_01.FBX` | Character | The General — peaked cap, medals, Sam Browne belt; Meet tab close-up; static pose; 800–1200 tri; **2 mats: body + medal** | art-bible §6.2.1 | Needed |
| C-002 | `char_business_rep_idle_01.FBX` | Character | The Oligarch's Fixer — double-breasted suit, briefcase, pocket square; Meet tab close-up; static pose; 800–1200 tri; **2 mats: body + medal** | art-bible §6.2.2 | Needed |
| C-003 | `char_people_rep_idle_01.FBX` | Character | The Union Man — plain work trousers, collarless shirt, flat cap; Meet tab close-up; static pose; 800–1200 tri; **1 mat: body** | art-bible §6.2.3 | Needed |
| C-004 | `ped_man_slim_civilian_01.FBX` | Character-Crowd | Slim male civilian; people-faction `#6b5a40`; 200–350 tri; **3 mats: skin, torso, pants**; increases at low health; anims: idle, walk | art-bible §6.7.2; citizen-simulation §4.5 | Needed |
| C-005 | `ped_man_fit_civilian_01.FBX` | Character-Crowd | Fit male civilian; people-faction `#6b5a40`; 200–350 tri; **3 mats: skin, torso, pants**; baseline build; anims: idle, walk | art-bible §6.7.2; citizen-simulation §4.5 | Needed |
| C-006 | `ped_man_fat_civilian_01.FBX` | Character-Crowd | Fat male civilian; people-faction `#6b5a40`; 200–350 tri; **3 mats: skin, torso, pants**; increases at high health; anims: idle, walk | art-bible §6.7.2; citizen-simulation §4.5 | Needed |
| C-007 | `ped_man_slim_army_01.FBX` | Character-Crowd | Slim army ped; full-body olive-green/slate uniform `#3d4a1a`; 200–350 tri; **2 mats: skin, outfit**; anims: idle, walk | art-bible §6.7.2 | Needed |
| C-008 | `ped_man_fit_army_01.FBX` | Character-Crowd | Fit army ped; full-body olive-green/slate uniform `#3d4a1a`; 200–350 tri; **2 mats: skin, outfit**; anims: idle, walk | art-bible §6.7.2 | Needed |
| C-009 | `ped_man_fat_army_01.FBX` | Character-Crowd | Fat army ped; full-body olive-green/slate uniform `#3d4a1a`; 200–350 tri; **2 mats: skin, outfit**; anims: idle, walk | art-bible §6.7.2 | Needed |
| C-010 | `ped_man_slim_business_01.FBX` | Character-Crowd | Slim business ped; charcoal dark suit `#2a2a2a–#2a1e14`; 200–350 tri; **2 mats: skin, outfit**; anims: idle, walk | art-bible §6.7.2 | Needed |
| C-011 | `ped_man_fit_business_01.FBX` | Character-Crowd | Fit business ped; charcoal dark suit `#2a2a2a–#2a1e14`; 200–350 tri; **2 mats: skin, outfit**; anims: idle, walk | art-bible §6.7.2 | Needed |
| C-012 | `ped_man_fat_business_01.FBX` | Character-Crowd | Fat business ped; charcoal dark suit `#2a2a2a–#2a1e14`; 200–350 tri; **2 mats: skin, outfit**; anims: idle, walk | art-bible §6.7.2 | Needed |
| C-013 | `ped_man_slim_thief_01.FBX` | Character-Crowd | **NEW** Slim thief ped; dark neutral clothing (near-black `#1a1a14`); low forward-lean silhouette; 200–350 tri; **2 mats: skin, outfit**; anims: idle, thief_sneak_walk; all faction pools | citizen-simulation §3.2; art-bible §6.7.2 | Needed |
| C-014 | `ped_man_fit_thief_01.FBX` | Character-Crowd | **NEW** Fit thief ped; dark neutral clothing; 200–350 tri; **2 mats: skin, outfit**; anims: idle, thief_sneak_walk | citizen-simulation §3.2; art-bible §6.7.2 | Needed |
| C-015 | `ped_man_fat_thief_01.FBX` | Character-Crowd | **NEW** Fat thief ped; dark neutral clothing; 200–350 tri; **2 mats: skin, outfit**; anims: idle, thief_sneak_walk | citizen-simulation §3.2; art-bible §6.7.2 | Needed |
| C-016 | `ped_special_man_protestor.FBX` | Character-Crowd | Dedicated protestor; T-shape sign geometry (+40% height overhead); both arms raised; off-white sign face `#e8e0c0`; people-faction only; education ≥ 5 gate; **2 mats: skin, outfit**; anims: idle, protest | citizen-simulation §3.2, §4.3; art-bible §6.4 | Needed |

---

## Environment Props — Street View

### Infrastructure — Shared Meshes

These assets use **one FBX mesh with three texture variants** swapped at runtime by infra tier. No separate mesh per tier.

| # | Name | Type | Description | Source | Status |
|---|------|------|-------------|--------|--------|
| E-SH1 | `env_skyline.FBX` | Skyline-Mesh | City skyline silhouette — one mesh, three texture variants: `env_skyline_poor.png` / `env_skyline_normal.png` / `env_skyline_rich.png` | street-view §3.2; art-bible §7.2.3 | Needed |
| E-SH2 | `env_plaza.FBX` | Ground-Mesh | Street plaza/ground plane — one mesh, three texture variants: `env_plaza_poor.png` (cracked, worn) / `env_plaza_normal.png` / `env_plaza_rich.png` (clean, freshly paved) | street-view §3.2; art-bible §7.2.3 | Needed |

### Infrastructure — All Tiers (5 Building Types × 3 Variants = 15 FBX Files)

Each building type has a poor, normal, and rich FBX. The same 5 building slots are visible in all tiers; the mesh (and thus silhouette) changes by tier. Naming: `env_bld_[type]_[tier].FBX`.

**Apartment type** (E-003/017/030):

| # | Name | Type | Description | Source | Status |
|---|------|------|-------------|--------|--------|
| E-003 | `env_bld_apartment_poor.FBX` | Building | Apartment — poor: crumbling stucco `#5a4c38`, missing tiles, visible cracks | street-view §3.2; art-bible §7.2.3 | Needed |
| E-017 | `env_bld_apartment_normal.FBX` | Building | Apartment — normal: faded warm buff `#8a7860`, intact tile row; tier variant of E-003 | street-view §3.2; art-bible §7.2.3 | Needed |
| E-030 | `env_bld_apartment_rich.FBX` | Building | Apartment — rich: freshly whitewashed `#c8c0a8`, sharp painted grilles; tier variant of E-003 | street-view §3.2; art-bible §7.2.3 | Needed |

**Residential type** (E-004/018/031):

| # | Name | Type | Description | Source | Status |
|---|------|------|-------------|--------|--------|
| E-004 | `env_bld_residential_poor.FBX` | Building | Residential — poor: listing two-storey house, patched stucco `#3a3028` | street-view §3.2; art-bible §7.2.3 | Needed |
| E-018 | `env_bld_residential_normal.FBX` | Building | Residential — normal: standard 2-storey `#8a7860`; tier variant of E-004 | street-view §3.2; art-bible §7.2.3 | Needed |
| E-031 | `env_bld_residential_rich.FBX` | Building | Residential — rich: grand hotel scale, cream `#c8c0a8`; tier variant of E-004 | street-view §3.2; art-bible §7.2.3 | Needed |

**Commercial type** (E-005/019/032):

| # | Name | Type | Description | Source | Status |
|---|------|------|-------------|--------|--------|
| E-005 | `env_bld_commercial_poor.FBX` | Building | Commercial — poor: improvised market, corrugated-metal awning `#6a6860` | street-view §3.2; art-bible §7.2.3 | Needed |
| E-019 | `env_bld_commercial_normal.FBX` | Building | Commercial — normal: open-fronted market `#8a7860`; tier variant of E-005 | street-view §3.2; art-bible §7.2.3 | Needed |
| E-032 | `env_bld_commercial_rich.FBX` | Building | Commercial — rich: luxury mall, wide decorative facade `#c8c0a8`; tier variant of E-005 | street-view §3.2; art-bible §7.2.3 | Needed |

**Mixed-use type** (E-006/020/033):

| # | Name | Type | Description | Source | Status |
|---|------|------|-------------|--------|--------|
| E-006 | `env_bld_mixeduse_poor.FBX` | Building | Mixed-use — poor: fire-damaged facade with graffiti, stucco `#3a3028` | street-view §3.2; art-bible §7.2.3 | Needed |
| E-020 | `env_bld_mixeduse_normal.FBX` | Building | Mixed-use — normal: ground-floor commerce, upper residential `#8a7860`; tier variant of E-006 | street-view §3.2; art-bible §7.2.3 | Needed |
| E-033 | `env_bld_mixeduse_rich.FBX` | Building | Mixed-use — rich: corporate HQ, imposing office block `#c8c0a8`; tier variant of E-006 | street-view §3.2; art-bible §7.2.3 | Needed |

**Civic type** (E-007/021/034):

| # | Name | Type | Description | Source | Status |
|---|------|------|-------------|--------|--------|
| E-007 | `env_bld_civic_poor.FBX` | Building | Civic — poor: rundown government structure, stucco `#5a4c38` | street-view §3.2; art-bible §7.2.3 | Needed |
| E-021 | `env_bld_civic_normal.FBX` | Building | Civic — normal: boxy government office `#8a7860`; tier variant of E-007 | street-view §3.2; art-bible §7.2.3 | Needed |
| E-034 | `env_bld_civic_rich.FBX` | Building | Civic — rich: monumental government palace dominating block `#c8c0a8`; tier variant of E-007 | street-view §3.2; art-bible §7.2.3 | Needed |

### Infrastructure — Poor Tier (Skybox + Tier-Specific Props)

| # | Name | Type | Description | Source | Status |
|---|------|------|-------------|--------|--------|
| E-008 | Skybox Overcast | Skybox | Grey-brown overcast sky; fog `#2a2018` | street-view §3.2; art-bible §5.4.1 | Needed |
| E-009 | Dead Tree | Prop-Vegetation | Bare dead tree; 2 instances in Poor tier | street-view §3.2 | Needed |
| E-010 | Streetlight (Poor) | Prop-Furniture | Single dim streetlight; dim warm tone | street-view §3.2 | Needed |
| E-011 | Billboard (Poor) | Prop-Signage | 2 billboard instances in Poor tier | street-view §3.2 | Needed |
| E-012 | Empty Statue Pedestal | Prop-Decoration | Square tapered stone base `#8a8878` ~0.8u tall; clickable "A pedestal awaits its destiny."; shared across all tiers | street-view §3.2; art-bible §7.2.5 | Needed |
| E-013 | Burned Decal | Prop-Decal | Surface fire-damage decal; 8 instances | street-view §3.2 | Needed |
| E-014 | Pothole Decal | Prop-Decal | Cracked asphalt `#0d0c09` with edge `#2a2420`; 10 instances | street-view §3.2; art-bible §7.2.3 | Needed |
| E-015 | `env_trash_can_burning_small.FBX` | Prop-VFX | Burning trash can; 4 instances; PointLight `#ff4400` i=0.8 d=3; UV-scroll fire plane attached (see §9.5 `ANIMATED_SPRITES` constant) | street-view §3.2; art-bible §7.2.3, §9.1, §9.5 | Needed |

### Infrastructure — Normal Tier (Skybox + Tier-Specific Props)

| # | Name | Type | Description | Source | Status |
|---|------|------|-------------|--------|--------|
| E-016 | Skybox Grey | Skybox | Overcast blue-grey sky; fog `#201810` | street-view §3.2; art-bible §5.4.2 | Needed |
| E-022 | Tree (Normal) | Prop-Vegetation | Low-poly geometric canopy `#4a5a28`; 4–6 irregular plane cuts; 10 instances | street-view §3.2; art-bible §7.2.3 | Needed |
| E-023 | Park Bench | Prop-Furniture | Timber slats `#5a3a1a`, cast-iron ends `#1a1612`; 6 instances in pairs | street-view §3.2; art-bible §7.2.3 | Needed |
| E-024 | Electric Pole | Prop-Infrastructure | Utility pole with cable; 6 instances alternating sides | street-view §3.2; art-bible §7.2.3 | Needed |
| E-025 | `env_streetlight_standard_medium.FBX` | Prop-Furniture | Dark iron pole `#2a2010`, amber lens `#c87820`; PointLight `#c87820` i=0.6 d=4; 4 instances | street-view §3.2; art-bible §7.2.3 | Needed |
| E-026 | Construction Site | Prop-Architecture | Construction site with scaffolding; 2 instances | street-view §3.2 | Needed |
| E-027 | Billboard (Normal) | Prop-Signage | 2 billboard instances in Normal tier | street-view §3.2 | Needed |

### Infrastructure — Rich Tier (Skybox + Tier-Specific Props)

| # | Name | Type | Description | Source | Status |
|---|------|------|-------------|--------|--------|
| E-028 | Skybox Sunny | Skybox | Clear blue sky `#5060a0`; fog `#302010` | street-view §3.2; art-bible §5.4.3 | Needed |
| E-035 | Palm Tree | Prop-Vegetation | Tapered trunk `#6a4820`, splayed fronds `#3a5020`; 10 instances replacing Trees | street-view §3.2; art-bible §7.2.3 | Needed |
| E-036 | Bush (Rich) | Prop-Vegetation | Sculpted ornamental bush; 5 instances | street-view §3.2 | Needed |
| E-037 | `env_streetlight_luxury_medium.FBX` | Prop-Furniture | Taller pole with decorative scroll `#c0a000`; PointLight `#c87820` i=0.7 d=4.5; 6 instances | street-view §3.2; art-bible §7.2.3 | Needed |
| E-038 | `env_fountain_large.FBX` | Prop-Decoration | Tiered stone basin; water plane `#4080a0` emissive `#204060`; PointLight `#4080c0` i=0.4 d=5; 2 instances | street-view §3.2; art-bible §7.2.3 | Needed |
| E-039 | Luxury Garden | Prop-Vegetation | Low bush geometry `#3a4a18` in stone border `#8a8070`; 2 instances | street-view §3.2; art-bible §7.2.3 | Needed |
| E-040 | Billboard (Rich) | Prop-Signage | 2 billboard instances in Rich tier | street-view §3.2 | Needed |

### Security — Controlled Tier

| # | Name | Type | Description | Source | Status |
|---|------|------|-------------|--------|--------|
| E-041 | `env_guard_post_small.FBX` | Prop-Security | Olive-grey `#505840` rectangular booth; no glass; 2 instances at block ends | street-view §3.2; art-bible §7.2.4 | Needed |
| E-042 | `env_camera_pole_medium.FBX` | Prop-Security | Thin pole with camera head angled 45° down; painted metal grey `#4a4a40`; 4 instances at facades | street-view §3.2; art-bible §7.2.4 | Needed |

### Security — Militarised Tier

| # | Name | Type | Description | Source | Status |
|---|------|------|-------------|--------|--------|
| E-043 | `env_tank_large.FBX` | Prop-Security | Dark olive `#2a3018` tank; 2 instances at opposing road ends pointing center | street-view §3.2; art-bible §7.2.4 | Needed |
| E-044 | `env_cannon_medium.FBX` | Prop-Security | Field artillery on sidewalk, barrel facing facades; 4 instances | street-view §3.2; art-bible §7.2.4 | Needed |
| E-045 | `env_gun_nest_medium.FBX` | Prop-Security | Sandbag U-shape `#7a6a50` at road center; 2 instances | street-view §3.2; art-bible §7.2.4 | Needed |
| E-046 | `env_searchlight_large.FBX` | Prop-Security | Drum-mount on tripod; animated PointLight `#d0e0ff` i=1.2 d=6; Y-rotation ~0.5 rad/s; 2 instances | street-view §3.2; art-bible §7.2.4, §5.4.4 | Needed |

### Security — Disorder Tier (decals)

| # | Name | Type | Description | Source | Status |
|---|------|------|-------------|--------|--------|
| E-047 | Graffiti Decal | Prop-Decal | Street graffiti; 10 instances; Disorder tier only; painted-over variant at Controlled/Militarised | street-view §3.2; art-bible §7.2.6 | Needed |
| E-048 | Barricade | Prop-Security | Street barricade; 2 instances; Disorder tier | street-view §3.2 | Needed |

### Statues (Buyable via Secret/Shop tab)

| # | Name | Type | Description | Source | Status |
|---|------|------|-------------|--------|--------|
| E-049 | `env_statue_bronze_standing_large.FBX` | Prop-Statue | Bronze dictator standing; `#7a5c28`; plaque "HE WAS PRESENT"; Shop tier 100 | street-view §3.2; art-bible §7.2.5 | Needed |
| E-050 | `env_statue_silver_equestrian_large.FBX` | Prop-Statue | Silver equestrian on horse; `#9090a0`; plaque "HE WAS PRESENT TWICE"; Shop tier 150 | street-view §3.2; art-bible §7.2.5 | Needed |
| E-051 | `env_statue_gold_triumph_large.FBX` | Prop-Statue | Golden horse + woman + crushed bureaucrats; `#c0a000` emissive `#6a5000`; plaque "HISTORY BEGAN ON HIS BIRTHDAY"; Shop tier 200 | street-view §3.2; art-bible §7.2.5 | Needed |

---

## Vehicles — Street View

Vehicles use a four-sub-mesh split. Wheel rotation is math-driven at runtime — no animation embedded in FBX. See art-bible §10.8 for full spec.

| # | Name | Type | Description | Source | Status |
|---|------|------|-------------|--------|--------|
| V-E-001 | `env_car_01_medium.FBX` | Vehicle | Car; sub-meshes: `body` (colour-swappable), `lights` (emissive toggle), `wheels_front`, `wheels_back` (math rotation); < 500 tri total | art-bible §10.8 | Needed |
| V-E-002 | `env_bike_01_medium.FBX` | Vehicle | Bike/motorbike; same four sub-mesh split as car; < 500 tri total | art-bible §10.8 | Needed |

---

## Environment Props — Governance Area

### Presidential Palace — Meet Tab

| # | Name | Type | Description | Source | Status |
|---|------|------|-------------|--------|--------|
| G-001 | Long Couch | Prop-Furniture | Wide low-poly sofa; dark burgundy `#5a1020` or deep gold `#6a4a0a`; Business rep seating | art-bible §7.1.2 | Existing |
| G-002 | Small Chair | Prop-Furniture | Simple upright wooden chair, narrow back, plain warm-brown; People rep seating (dragged in) | art-bible §7.1.2 | Existing |
| G-003 | Floor Plane | Prop-Surface | Dark parquet / polished stone `#3a2210`; single flat plane | art-bible §7.1.2 | Existing |
| G-004 | Framed Paintings (Wall) | Prop-Decoration | Low-poly frame + flat canvas; background wall art | art-bible §7.1.2 | Existing |
| G-005 | Blocky Chandelier | Prop-Lighting | Optional ceiling fixture; retain if already in scene | art-bible §7.1.2 | Existing |

### Laws Office — Laws Tab

| # | Name | Type | Description | Source | Status |
|---|------|------|-------------|--------|--------|
| G-006 | Paintings — Laws Office | Prop-Decoration | Excessive quantity of frames hung where shelves should be; varied sizes | art-bible §7.1.4 | Existing |
| G-007 | Paper / Folder Stacks | Prop-Furniture | Blocky geometry stacks on all surfaces; communicates administrative weight | art-bible §7.1.4 | Existing |
| G-008 | Country Map | Prop-Decoration | Wall map; optional; not confirmed as placed | art-bible §7.4 | Existing |

---

## Visual Consequence Stubs — Sprint 5

> These are design-named slots only. No FBX filenames assigned. Requires naming before pipeline intake.

| # | Consequence ID | Type | Description | Source | Status |
|---|----------------|------|-------------|--------|--------|
| S-001 | `casino_sign` | Prop-Signage | Activates when gambling law (L-A) accepted | lasting-effects §5 | Stub |
| S-002 | `military-checkpoint` | Prop-Security | Activates when security ≥ 8 | lasting-effects §5 | Stub |
| S-003 | `dilapidated-buildings` | Prop-Building | Activates when infrastructure ≤ 2 | lasting-effects §5 | Stub |
| S-004 | `faction-coup-crown` | Prop-Badge | Activates when faction relation ≥ 6; doubles as coup warning badge | lasting-effects §5 | Stub |
| S-005 | `public-housing-blocks` | Prop-Building | Activates when housing law (L-B) accepted | lasting-effects §5 | Stub |
| S-006 | `weird_cemeteries` | Prop-Crowd | Zombie citizen variants wander streets | weird-laws §3 | Stub |
| S-007 | `weird_pigeon_hats` | Prop-Crowd | All pigeons wear tiny hats | weird-laws §3 | Stub |
| S-008 | `weird_night_sun` | Prop-VFX | Second sun appears in scene | weird-laws §3 | Stub |
| S-009 | `weird_skeletons` | Prop-Crowd | Skeleton figures on plaza | weird-laws §3 | Stub |
| S-010 | `weird_giraffes` | Prop-Crowd | Random giraffe props appear | weird-laws §3 | Stub |
| S-011 | `weird_idling` | Prop-Behavior | Citizens freeze in place (static pose override) | weird-laws §3 | Stub |
| S-012 | `weird_building_height` | Prop-Building | Building tier geometry normalized to uniform height | weird-laws §3 | Stub |
| S-013 | `weird_water_coolers` | Prop-Furniture | Water cooler props fill the Meet/governance room | weird-laws §3 | Stub |
| S-014 | `weird_backwards_walking` | Prop-Behavior | Subset of peds use reversed walk cycle | weird-laws §3 | Stub |
| S-015 | `weird_statues` | Prop-Decoration | 10 miniature dictator statue instances on plaza | weird-laws §3 | Stub |
| S-016 | `weird_left_traffic` | Prop-Traffic | Vehicle direction reversed | weird-laws §3 | Stub |
| S-017 | `weird_ghosts` | Prop-Crowd | Citizens rendered with transparency/ghost effect | weird-laws §3 | Stub |
| S-018 | Tiny Cows (Deal 19) | Prop-Crowd | Dog-sized cows wander parks and sidewalks | weird-deals §3 | Stub |
| S-019 | Giant Mouse Building (Deal 20) | Prop-Building | Giant computer-mouse-shaped landmark on plaza | weird-deals §3 | Stub |
| S-020 | Pigeons with Cameras (Deal 21) | Prop-Crowd | Pigeon props with camera accessories | weird-deals §3 | Stub |

---

## UI Screens

| # | Screen Name | Description | Source | Status |
|---|-------------|-------------|--------|--------|
| U-001 | Laws Tab | Pass or reject a law each round; camera shows Laws office scene | game-concept §3; art-bible §4 | Needed |
| U-002 | Deals Tab | Accept or reject a deal each round | game-concept §3; art-bible §4 | Needed |
| U-003 | Meet Tab | Click faction reps for Bribe / Dialogue / Expropriate / Eliminate; faces the three reps in palace | game-concept §6; art-bible §4 | Needed |
| U-004 | Log Tab | Round history; hosts Active Legislation repeal section | game-concept §3; lasting-effects §2; art-bible §4 | Needed |
| U-005 | Menu Tab | Budget sliders (taxes, expenditures) + settings | game-concept §3; art-bible §4 | Needed |
| U-006 | Street Tab | Street view of city; living state visualization; citizen click-to-inspect | game-concept §11; street-view §1; art-bible §4 | Needed |
| U-007 | Secret Tab | Shop (Media Coverage / Shielding / Blackout, Statues); special ending access; bypasses tab lock | game-concept §9; art-bible §4 | Needed |
| U-008 | DayEnded Modal | Round resolution: tax income, budget expenses, legislation, one-time deltas, net; coup warning row | lasting-effects §3; art-bible §5.6 | Needed |
| U-009 | EndScreen | Victory or loss; faction-specific narratives; green overlay (victory) / red overlay (loss) | game-concept §10; art-bible §5.7–5.9 | Needed |
| U-010 | Tutorial Overlay | Onboarding tutorial layer | art-bible §4 | Needed |
| U-011 | HelpOverlay | In-game help panel | art-bible §4 | Needed |
| U-012 | FadeOverlay | Full-screen black opacity-animated fade for scene transitions; z-index 50 | art-bible §4, §8.3 | Needed |
| U-013 | Pre-Game Difficulty Screen | Three-option screen (Easy / Medium / Hard) before run start; i18n required | difficulty-levels §3, §6 | Needed |
| U-014 | Active Legislation Section | Sub-section in Log Tab; one card per active recurring law with Repeal button | lasting-effects §2 | Needed |

---

## HUD Elements

| # | Element | Description | Source | Status |
|---|---------|-------------|--------|--------|
| H-001 | Navbar | 84px top zone; game title, tabs, advance button; `hudbg.png` 9-slice background; z-index 100 | art-bible §4 | Existing |
| H-002 | Action Panel | 200px bottom zone; 3-column grid: treasury/clock (240px) / relations (200px) / action buttons (1fr) | art-bible §4 | Existing |
| H-003 | Treasury Display | Current treasury value; `--income-green` positive / `--expense-red` negative | art-bible §4; game-concept §5 | Existing |
| H-004 | Timer / Countdown Ring | Circular advance-ring; `animation: spin 3s linear infinite`; `--gold` gradient; amber `--accent-color` | game-concept §3; art-bible §8.3 | Existing |
| H-005 | Advance-Hint Pulse | `1.8s ease-in-out` opacity pulse on advance button hint text | art-bible §8.3 | Existing |
| H-006 | Charisma Bar | Charisma readout in action panel; uses `assets/respect.png` background | art-bible §4; game-concept §7 | Existing |
| H-007 | Faction Relation Display — Military | Military faction relation −10 to +10 | game-concept §4; art-bible §4 | Existing |
| H-008 | Faction Relation Display — Business | Business faction relation −10 to +10 | game-concept §4; art-bible §4 | Existing |
| H-009 | Faction Relation Display — People | People faction relation −10 to +10 | game-concept §4; art-bible §4 | Existing |
| H-010 | Coup Badge | Danger badge on faction at relation ≥ +6; yellow warning / red armed states; `pulse 0.8s` animation | lasting-effects §4; art-bible §8.3 | Existing |
| H-011 | Action Buttons Column | Bribe / Dialogue / Expropriate / Eliminate; `button.png` 9-slice border | art-bible §4 | Existing |
| H-012 | Rounds Remaining Counter | Rounds left display; `--attention-color` (new cyan token) for caution state | art-bible §2, §8.4 | Existing |
| H-013 | Population Counter (Street View) | `hudbg.png` panel top-left of Street tab; alive/25 + displayedPopulation (~5.9M scale); color thresholds: ≥20 white, <20 cyan, <10 red | citizen-simulation §4.8; art-bible §8.5.1 | Needed |
| H-014 | Role Legend (Street View) | Bottom-left of Street tab; 2×2 dot grid: Content (green) / Neutral (muted) / Thief (cyan) / Protestor (red) with live counts | art-bible §8.5.2 | Needed |
| H-015 | Click-to-Inspect Citizen Panel | 240px right-side panel; name, faction icon+label, employed state, happiness bar, role, flavor line; opens on ped click | citizen-simulation §UI; art-bible §8.5.3 | Needed |
| H-016 | Budget Sliders (Menu Tab) | Expenditure sliders: health, infrastructure, security, education (1–10 each) | game-concept §5 | Existing |
| H-017 | Tax Sliders (Menu Tab) | People tax and business tax percentage sliders | game-concept §5 | Existing |
| H-018 | Budget Forecast Display | Net/round and rounds-left projection; uses updated recurring net | lasting-effects §1 | Needed |

---

## VFX / Animated Effects

| # | Effect Name | Type | Description | Source | Status |
|---|-------------|------|-------------|--------|--------|
| V-001 | Fire Plane (Burning Trash Can) | VFX-AnimatedUV | `THREE.PlaneGeometry`; UV-scroll `MeshStandardMaterial`; 4-frame vertical strip 256×1024; 10fps (`map.offset.y += 0.25`); double-sided; defined in `ANIMATED_SPRITES` constant (art-bible §9.5) | art-bible §9.1, §7.2.3, §9.5 | Needed |
| V-002 | Searchlight Sweep | VFX-LightAnimation | PointLight `#d0e0ff` i=1.2; position vector rotates ~0.5 rad/s around Y; one per `env_searchlight_large.FBX`; only animated light in game | art-bible §9.2, §5.4.4 | Needed |
| V-003 | Pressure State Lighting Lerp | VFX-LightAnimation | Ambient/directional/fog lerp toward red-tinted targets over 600ms when round timer ≤ 30s | art-bible §9.2, §5.5 | Needed |
| V-004 | Scene State Transition Lerp | VFX-LightAnimation | All ambient/directional/fog transitions lerp ~600ms on tab change | art-bible §9.2, §5 | Needed |
| V-005 | Advance-Ring Spin | VFX-CSS | `animation: spin 3s linear infinite`; conic-gradient mask; `--gold` color | art-bible §8.3, §9.3 | Existing |
| V-006 | Advance-Hint Pulse | VFX-CSS | `animation: hintPulse 1.8s ease-in-out infinite`; opacity 0.6→1 | art-bible §8.3, §9.3 | Existing |
| V-007 | Coup Badge Danger Pulse | VFX-CSS | `animation: pulse 0.8s ease-in-out infinite`; fastest animated loop in game | art-bible §8.3, §9.3 | Existing |
| V-008 | Trash-Can PointLight Fill | VFX-Light | PointLight `#ff4400` i=0.8 d=3 per `env_trash_can_burning_small.FBX`; ambient scene illumination at Poor tier | art-bible §5.4.1, §7.2.3 | Needed |
| V-009 | Standard Streetlight PointLight | VFX-Light | PointLight `#c87820` i=0.6 d=4 per `env_streetlight_standard_medium.FBX` | art-bible §5.4.2, §7.2.3 | Needed |
| V-010 | Luxury Streetlight PointLight | VFX-Light | PointLight `#c87820` i=0.7 d=4.5 per `env_streetlight_luxury_medium.FBX` | art-bible §7.2.3 | Needed |
| V-011 | Fountain PointLight | VFX-Light | PointLight `#4080c0` i=0.4 d=5; only cool-toned light in game | art-bible §5.4.3, §7.2.3 | Needed |
| V-012 | Coup Warning Red Shift | VFX-LightAnimation | DirectionalLight shifts toward `#5a0000` −0.3 intensity before DayEnded when coup risk elevated | art-bible §5.6 | Needed |
| V-013 | FadeOverlay Transition | VFX-CSS | Full-screen black `opacity: 0→1`; `100ms ease-in-out`; z-index 50 | art-bible §4, §8.3 | Existing |
| V-014 | Modal Entry/Exit Opacity | VFX-CSS | `opacity: 0→1` at `150ms ease-out` in / `ease-in` out | art-bible §8.3 | Existing |

---

## Sprites / 2D Art

### Icon Sprite Sheet (`assets/icons.png`)

> 32×32 px per sprite; single neutral near-white foreground; flat-filled.

| # | Icon Name | Type | Source | Status |
|---|-----------|------|--------|--------|
| SP-001 | `budget` | Sprite-Icon | art-bible §8.2 | Existing |
| SP-002 | `law` | Sprite-Icon | art-bible §8.2 | Existing |
| SP-003 | `secret` | Sprite-Icon | art-bible §8.2 | Existing |
| SP-004 | `opportunity` | Sprite-Icon | art-bible §8.2 | Existing |
| SP-005 | `needle` | Sprite-Icon | art-bible §8.2 | Existing |
| SP-006 | `reject` | Sprite-Icon | art-bible §8.2 | Existing |
| SP-007 | `clock` | Sprite-Icon | art-bible §8.2 | Existing |
| SP-008 | `minus` | Sprite-Icon | art-bible §8.2 | Existing |
| SP-009 | `plus` | Sprite-Icon | art-bible §8.2 | Existing |
| SP-010 | `approve` | Sprite-Icon | art-bible §8.2 | Existing |
| SP-011 | `meet` | Sprite-Icon | art-bible §8.2 | Existing |
| SP-012 | `news` | Sprite-Icon | art-bible §8.2 | Existing |
| SP-013 | `street` | Sprite-Icon | art-bible §8.2 | Existing |
| SP-014 | `shop` | Sprite-Icon | art-bible §8.2 | Existing |
| SP-015 | `charisma` | Sprite-Icon | art-bible §8.2 | Existing |
| SP-016 | `checked` | Sprite-Icon | art-bible §8.2 | Existing |
| SP-017 | `unchecked` | Sprite-Icon | art-bible §8.2 | Existing |
| SP-018 | `business` | Sprite-Icon | art-bible §8.2 | Existing |
| SP-019 | `people` | Sprite-Icon | art-bible §8.2 | Existing |
| SP-020 | `military` | Sprite-Icon | art-bible §8.2 | Existing |
| SP-021 | `gun` | Sprite-Icon | art-bible §8.2 | Existing |
| SP-022 | `bribe` | Sprite-Icon | art-bible §8.2 | Existing |
| SP-023 | `takeover` | Sprite-Icon | art-bible §8.2 | Existing |
| SP-024 | `danger` | Sprite-Icon | art-bible §8.2 | Existing |
| SP-025 | `lightning` | Sprite-Icon | art-bible §8.2 | Existing |
| SP-026 | `info` | Sprite-Icon | art-bible §8.2 | Existing |
| SP-027 | `calendar` | Sprite-Icon | art-bible §8.2 | Existing |
| SP-028 | `warning` | Sprite-Icon | art-bible §8.2 | Existing |
| SP-029 | `caret` | Sprite-Icon | art-bible §8.2 | Existing |
| SP-030 | `random` | Sprite-Icon | art-bible §8.2 | Existing |
| SP-031 | `trophy` | Sprite-Icon | art-bible §8.2 | Existing |
| SP-032 | `skull` | Sprite-Icon | art-bible §8.2 | Existing |
| SP-033 | Icon reserve slots i32–i63 | Sprite-Icon | art-bible §8.2 | Reserved |

### Pixel Border / UI Assets

| # | Asset Path | Type | Description | Source | Status |
|---|------------|------|-------------|--------|--------|
| SP-034 | `assets/hudbg.png` | Sprite-UIBorder | HUD frame; 9-slice 24px; `image-rendering: pixelated`; navbar, action panel, tab cards, Population Counter | art-bible §4, §10.1 | Existing |
| SP-035 | `assets/button.png` | Sprite-UIBorder | Button frame; 9-slice 12px; `image-rendering: pixelated`; all buttons and selects | art-bible §4, §10.1 | Existing |
| SP-036 | `assets/respect.png` | Sprite-UIElement | Charisma bar background in action panel | art-bible §4 | Existing |

### Fire Animation

| # | Asset Name | Type | Description | Source | Status |
|---|------------|------|-------------|--------|--------|
| SP-037 | `env_fire_trash_strip_256x1024.png` | Sprite-AnimSheet | 256×1024 total; 4 frames at 256×256; vertical strip; sRGB; UV-scroll map for trash-can fire plane; exempt from 64×64 texture limit | art-bible §9.1, §9.5, §10.3 | Needed |

### Fonts

| # | Asset Path | Type | Description | Source | Status |
|---|------------|------|-------------|--------|--------|
| SP-038 | `assets/fonts/PressStart2P.ttf` | Font | Primary active font for all game UI text | art-bible §3 | Existing |
| SP-039 | `assets/fonts/8-BIT WONDER.ttf` | Font | Loaded but not yet in use; reserved/decorative | art-bible §3 | Existing |
| SP-040 | `assets/fonts/Bitmgothic.ttf` | Font | In use for some UI elements; not a replacement for PressStart2P | art-bible §3 | Existing |

---

## Audio — SFX

| # | Name | Type | Description | Source | Status |
|---|------|------|-------------|--------|--------|
| A-001 | `sfx_law_accept` | Audio-SFX | Heavy rubber stamp impact; law acceptance | sound-music §3.2 | Needed |
| A-002 | `sfx_law_reject` | Audio-SFX | Stamp thud pitched slightly down; law rejection | sound-music §3.2 | Needed |
| A-003 | `sfx_deal_accept` | Audio-SFX | Pen-on-paper scratch + brief click; deal signing | sound-music §3.2 | Needed |
| A-004 | `sfx_deal_reject` | Audio-SFX | Single dismissive table knock; deal rejection | sound-music §3.2 | Needed |
| A-005 | `sfx_eliminate` | Audio-SFX | Gunshot + Wilhelm scream; comical death; music ducks on gunshot | sound-music §3.2 | Needed |
| A-006 | `sfx_bribe` | Audio-SFX | Coins/cash rustle; money changing hands | sound-music §3.2 | Needed |
| A-007 | `sfx_expropriate` | Audio-SFX | Safe door slam or heavy lock; assets seized | sound-music §3.2 | Needed |
| A-008 | `sfx_dialogue_success` | Audio-SFX | Polite applause or single chime; not sarcastic | sound-music §3.2 | Needed |
| A-009 | `sfx_dialogue_fail` | Audio-SFX | Sad trombone or two-note descending; both fail states | sound-music §3.2 | Needed |
| A-010 | `sfx_dialogue_neutral` | Audio-SFX | Single neutral button-press click | sound-music §3.2 | Needed |
| A-011 | `sfx_round_end` | Audio-SFX | Clock bell or gavel strike; round close signal | sound-music §3.2 | Needed |
| A-012 | `sfx_bankruptcy` | Audio-SFX | Cash register empty click; bankruptcy game-over trigger | sound-music §3.2 | Needed |
| A-013 | `sfx_overthrow` | Audio-SFX | Distant crowd roar + door slam; music ducks on roar | sound-music §3.2 | Needed |
| A-014 | `sfx_purchase` | Audio-SFX | Cash register ding; any shop purchase | sound-music §3.2 | Needed |
| A-015 | `sfx_round_advance` | Audio-SFX | Single soft bell; player-triggered advance confirmation | sound-music §3.2 | Needed |

---

## Audio — Music

| # | Name | Type | Description | Source | Status |
|---|------|------|-------------|--------|--------|
| A-016 | `ambient_jazz_1` | Audio-Music | Ambient jazz loop 1; pool of 5; no same-track repeat across rounds | sound-music §3.1 | Needed |
| A-017 | `ambient_jazz_2` | Audio-Music | Ambient jazz loop 2 | sound-music §3.1 | Needed |
| A-018 | `ambient_jazz_3` | Audio-Music | Ambient jazz loop 3 | sound-music §3.1 | Needed |
| A-019 | `ambient_jazz_4` | Audio-Music | Ambient jazz loop 4 | sound-music §3.1 | Needed |
| A-020 | `ambient_jazz_5` | Audio-Music | Ambient jazz loop 5 | sound-music §3.1 | Needed |
| A-021 | `tense_1` | Audio-Music | Tense variant; replaces ambient when relation ≤ −6 OR treasury ≤ 30; 1–2s crossfade | sound-music §3.1 | Needed |
| A-022 | `menu_theme` | Audio-Music | Menu theme; plays from load until run starts; resumes after ending themes | sound-music §3.1 | Needed |
| A-023 | `ending_good` | Audio-Music | Good ending theme; plays once on victory + positive special endings | sound-music §3.1 | Needed |
| A-024 | `ending_bad` | Audio-Music | Bad ending theme; plays once on any loss (bankruptcy, overthrow, negative endings) | sound-music §3.1 | Needed |

---

## Audio — Ambient

| # | Name | Type | Description | Source | Status |
|---|------|------|-------------|--------|--------|
| A-025 | Street Murmur Base | Audio-Ambient | Base crowd murmur density tracks `aliveCount`; thins toward silence as population falls | citizen-simulation §Visual/Audio | Needed |
| A-026 | Protest Chant Layer | Audio-Ambient | Fades in when `protestorCount ≥ PROTEST_DIVISOR` (≥ 3); scales with cluster size; no per-ped voices | citizen-simulation §Visual/Audio | Needed |

---

## Open Questions

1. **Fire sprite filename** — `env_fire_trash_strip_256x1024.png` is assigned here for pipeline purposes; confirm before production.
2. **Weird Law/Deal props (S-006 — S-020)** — All Sprint 5 stubs; need FBX names and visual briefs before `/asset-spec` can generate specs for them.
3. **Thief outfit colour** — Dark neutral `#1a1a14` proposed; confirm against all three infrastructure lighting states before locking.
4. **Vehicle count and placement** — Car/bike entries (V-E-001, V-E-002) are placeholders. Scene placement, instance count, and traffic animation strategy not yet designed.
5. **Animation retargeting verification** — Three.js Biped FBX retargeting between body-type variants (slim/fit/fat) must be prototyped before full animation production begins. Confirm bone name export from 3ds Max is compatible.
6. **Skin tone material variants** — 5 skin tone values per citizen ped are material-level only (no separate meshes). Confirmed not separate inventory entries.
7. **Elimination animation props** (trap door, cane, crane) — Forward requirements documented in art-bible §7.1.3; not Sprint 5 scope. Not included as active inventory items.
