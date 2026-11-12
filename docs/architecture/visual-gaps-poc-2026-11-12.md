# Visual Gaps POC Batch — 2026-11-12

> Follow-up to [visual-asset-audit-2026-09-11.md](visual-asset-audit-2026-09-11.md). Procedural
> proof-of-concept models for the missing street tiers, built with the 3PS POC recipe
> (`E:\GameDev\3ps\docs\poc_3d_models.md`: layout contract → numpy texture script → headless Blender
> model script → previews). Meant to be painted over by hand. **Nothing is wired into `src/` yet.**

## Previews (gitignored, `build/visual_gaps/`)

| What | File |
|---|---|
| Whole street, today vs new, per tier (Street camera, game ambient light) | `street/street_today_vs_new.png` |
| Whole street, new models, poor / normal / rich full size | `street/street_evolution.png` |
| Rich buildings A (apartment tower, civic palace, mixed-use normal) | `bld_a/bld_a_tiers.png` |
| Rich buildings B (mall, corporate HQ, grand hotel) | `bld_b/bld_b_tiers.png` |
| Streetlights + benches poor / normal / rich | `street_furniture/street_furniture_tiers.png` |
| Trees (palm), planters, topiary bust | `greenery/greenery_tiers.png` |
| Burning trash can, fountains, scorch decal | `plaza_features/plaza_features_tiers.png` |
| Statues: empty / bronze / silver / gold | `statues/statues_tiers.png` |
| Cars: junker / sedan / limo | `vehicles/vehicles_tiers.png` |
| All five cars incl. jeep + ambulance | `vehicles/vehicles_service.png` |
| Street at security 9 with jeep + ambulance on the roads (`street_preview.py --service`) | `street/after/street_normal_service_ambient.png` |

## What was built

| Family | Models (`public/models/...`) | Tris | Scripts |
|---|---|---|---|
| bld_a | `map/env_bld_mixeduse_normal` (fixes the IDE loading the poor GLB for normal), `env_bld_apartment_rich` (luxury tower), `env_bld_civic_rich` (government palace) | 60 / 369 / 459 | `tools/{texgen,blender}/bld_a.py` |
| bld_b | `map/env_bld_commercial_rich` (mall), `env_bld_mixeduse_rich` (corporate HQ), `env_bld_residential_rich` (grand hotel) | 604 / 290 / 426 | `tools/{texgen,blender}/bld_b.py` |
| street_furniture | `map/env_streetlight_{poor,rich}`, `env_parkbench_{poor,rich}` | 95 / 296 / 51 / 124 | `tools/{texgen,blender}/street_furniture.py` |
| greenery | `map/env_tree_rich` (palm), `env_planter_{poor,normal,rich}`, `env_bush_rich` (topiary bust of the leader) | 298 / 141 / 92 / 330 / 245 | `tools/{texgen,blender}/greenery.py` |
| plaza_features | `map/env_trashcan_burning`, `env_fountain_{normal,rich}`, `env_burned_decal` | 110 / 170 / 658 / 2 | `tools/{texgen,blender}/plaza_features.py` |
| statues | `map/env_statue_{pedestal,bronze,silver,gold}` (each statue GLB includes its plinth) | 118 / 594 / 977 / 1690 | `tools/{texgen,blender}/statues.py` |
| vehicles | `vehicles/car_sedan` (grey body for the tint pool), `car_limo`; budget-gated `car_jeep_military` (security ≥ 8, olive drab, roll-bar MG, regime roundels), `car_ambulance` (health ≥ 8, cream box van, red band, blue six-armed medical star — deliberately no Red Cross emblem) | 350 / 402 / 386 / 346 | `tools/{texgen,blender}/vehicles.py` |

Contracts: `tools/texgen/<family>_layout.json`. Textures: `public/textures/map/` (cars:
`public/textures/vehicles/`), 32–128 px, prefixed per model. Every script is seeded and rebuilds its
family in one run (`--only` / a model name rebuilds one).

Shared tooling: `tools/blender/dt_common.py` (GLB export matching the Max exporter, slot frames),
`tier_preview.py` + `label_sheet.py` (lineups), `street_layout_dump.py` + `street_preview.py` (rebuild
the street from IDE/IPL through `STREET_CAMERA`; `--today` = exactly what the game loads),
`tools/texgen/texlib.py` (copied from 3PS).

## Pipeline facts learned (apply to any future street asset)

- Street GLBs keep vertices in game units with a stray 0.001 node scale (StreetView's `GLB_UNIT_FIX`).
  Props pivot at the bbox centre; a tier swap must keep the normal prop's pivot and ground z.
- A citizen is 6.66 units; Blender −Y faces the Street camera.
- The Street is lit by **one `ambientLight`** and StreetView **ignores vertex colours**: every face shows
  flat albedo, so all form is painted into the textures (the agents used per-face shade bands/ramps).
- Workbench (Blender 5.1) ignores texture alpha; cut-out previews need EEVEE (`street_preview.py`
  default) — the agents' wrappers are in `build/visual_gaps/*/scratch/`.
- RGB PNGs must not have their alpha linked (Blender reports 4 channels) or glTF exports alphaMode
  BLEND; `dt_common.material` now checks `img.depth` and routes real alpha through a ROUND node (MASK).

## Integration checklist (when wanted)

1. **Texture wrap.** StreetView loads IDE textures with `TextureLoader` and never sets wrap, so they
   clamp. The new buildings and statues use U-repeating strips (fine while their embedded textures are
   used; broken once listed in the IDE). Set `tex.wrapS = tex.wrapT = THREE.RepeatWrapping` in
   `PlacedObjects` — it is also likely why `env_roads`'s `concrete_buildings_base` (UVs −12..13) smears today.
2. **Buildings** — `useStreetLayout.ts` `BUILDING_SLOTS`: `rich: 'env_bld_<slot>_rich'` for all five;
   IDE line 2001 → `asset: 'models/map/env_bld_mixeduse_normal.glb'`, texture `building4.png`; add one
   IDE entry per rich building (`visibleIf: { tab: 'Street' }`). Flag `bld_a_rich_trim.png` and
   `bld_b_rich_cutout.png` `transparent: true` (balustrades, flags).
3. **Tier swaps of existing props** (same IPL positions): narrow `env_tree_medium`,
   `env_streetlight_standard_medium`, `env_parkbench_medium` from `[4, 10]` to `[4, 7]`; add
   `env_tree_rich`, `env_streetlight_rich`, `env_parkbench_rich` at `[8, 10]` and
   `env_streetlight_poor`, `env_parkbench_poor` at `[1, 3]`, each with IPL rows copied from the normal
   prop's (streetlights 10, 54–58; benches 19, 46–52; trees 12–18). Cut-out textures:
   `env_streetlight_rich`, `env_parkbench_{poor,rich}`, `env_tree_rich_fronds`, `greenery_gold`.
4. **New prop types** (trash cans + scorch decals `[1, 3]`; planters per tier; fountains `[4, 7]` /
   `[8, 10]`; bushes `[8, 10]`) need IPL placements. `EXTRAS` in `street_preview.py` is a starting layout
   (fountain at the plaza centre-front, planters at the front corners, statue row at z −18).
5. **Statues** — `Statue.tsx` draws palace-scale boxes; the GDD wants three street pedestals. Per slot:
   `env_statue_pedestal` until bought, then bronze / silver / gold in purchase order (each GLB carries its
   plinth). Footprints: 6×6, 13×6, 15.4×7 (gold's wings overhang 5.4 on −X) — centres ≥ 22 apart.
   `visibleIf` cannot express the purchase count; gate in the component. Keep metalness 0 (ambient-only
   light renders metal black).
6. **Cars** — root `car_sedan` / `car_limo` (0.001 scale, +90° Y turn) with `body`, `wheel_fl/fr/rl/rr`
   (origins on hubs; `wheel.rotation.x += spin` works). `modelScale = 1000`, do **not** length-normalise
   the limo (16 long). Per-model footprints: sedan half 5.35 × 2.2, limo 8.0 × 2.4 (also its stop
   setback). Tint only `car_sedan_body`. Which car spawns per tier is gameplay logic. Jeep (half 5.2 ×
   2.5, wheel r 1.0) and ambulance (half 6.0 × 2.4, wheel r 0.82) are fixed-colour; gate them with two
   primitive selectors (`budget.expenditures.security`, `.health`) turned into `>= 8` booleans before the
   spawn `useMemo` (never an object-returning selector — see the Zustand footgun), and pick per spawn id
   with a stable hash or cosmetic `Math.random`, not the seeded RNG (ADR-0010). Note the new cars
   are slimmer/lower than the junker (10.7 × 5.7 × 5.2) — bulk them up in the contract if they read small.

## Not in this batch

- **Sky per tier** (Overcast / Grey / Sunny, GDD street-view §3.2): `env_skybox.glb` exists but is not
  in the IDE; tier skies are texture work. Skylines per tier likewise.
- **Ending rooms** (audit #5): still needs the design call (distinct rooms vs stylised cubes).
- **Weird law/deal 2D art** (audit #6) and building decay (`visualConsequences.ts`, audit #7).

## Paint-over priorities (from the agents' reports)

The leader's likeness everywhere (banners, medallions, bust, statue faces: 20–32 px, moustache barely
reads); the gold statue's clerk heap and Victory's flat wings; repeating storey strips on the tower and
hotel; plain hood/roof tops on the cars (what the 25° camera sees most); fountain fish read as lumps;
velvet tufting reads as a checker.
