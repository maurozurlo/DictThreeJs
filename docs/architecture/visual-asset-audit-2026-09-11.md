# Visual Asset Audit — 2026-09-11

> Purpose: punch list for 2D/3D artist handoff. What's shipped, what's placeholder,
> what's missing entirely. Compiled by auditing GDDs vs. actual assets (`public/`)
> and rendering code.

## Shipped, solid — no action needed

- **Poor/Normal street environment**: roads, plaza, 5 building types × 2 tiers,
  streetlights, trees, billboards, security props (tank, cannon, gun nest, guard
  post, camera pole, searchlight, barricade) — all textured, GLB+PNG pairs match.
  `public/models/map/`, `public/textures/map/`.
- **Citizen simulation rendering**: faction/role/skin/outfit/body-type layering
  fully implemented (`src/3d/CitizenModels.tsx`, `src/Stores/CitizenHandler.ts`).
  Thief balaclava, protestor sign/megaphone props, clustering/pacing by role all
  work. The GDD's flagged `ped_special_man_protestor` asset is delivered as a
  composited prop layer (`protester_bits.png` + sign/megaphone GLB) rather than a
  dedicated model — confirm with artist this satisfies intent, but functionally
  it's not a gap.
- **Faction representative figures (Meet tab)**: `public/assets/3d/chars/`
  (elite/police/people FBX) — live, rendered in `src/Scene.tsx:38-40` via
  `<Elite/>`/`<People/>`/`<Military/>` (`src/3d/Elite.tsx`, `People.tsx`,
  `Military.tsx`), keyed on `repStatuses.{business,people,military}`. **Not dead
  legacy** — corrects an earlier pass of this audit.
- **Advisor portraits**: `public/assets/advisor_0.png`..`advisor_3.png` (4 files),
  referenced in `AdvisorFooter.tsx`. No gap found (advisor count not cross-checked
  against a GDD — none specifies a target count).
- **UI icons**: `icons.psd`/`icons.png` sprite, used via `Icon.module.css`
  background-image. No missing-icon references found.

## Gaps — punch list

| # | System | What's missing | Type | Notes |
|---|--------|-----------------|------|-------|
| 1 | **Rich-tier street environment** | Luxury tower, grand hotel, corporate HQ, luxury mall, government palace, palm trees, fountains, luxury streetlights/gardens, benches. Only Poor/Normal tiers exist; `StreetView.tsx`'s `paletteFor()` solid-color fallback is the safety net masking this gap. | 3D | Spec'd in `design/gdd/street-view.md` §3.2 — ready for artist to scope directly. |
| 2 | **Skybox / weather per wealth tier** | GDD specifies Overcast/Grey/Sunny skybox per poor/normal/rich tier (`street-view.md:44-50`); none implemented — Street tab has no skybox, Meet/Laws tabs use static ambient/point lights only. No general atmospheric system exists. | 3D/lighting | Same root cause as #1 (Rich tier unbuilt); Poor/Normal skybox also unconfirmed as built — verify. |
| 3 | **Statues** | Bronze/Silver/Gold dictator statues are placeholder gold boxes (`Statue.tsx`). No models exist for any of the 3 tiers. | 3D | |
| 4 | **Vehicles** | Only 1 car model (`car_junker.glb`). No variety for tier/traffic density. | 3D | |
| 5 | **Special ending rooms** (The Bunker / The Vault / The Zen Garden — per `secret.json`, not "Golden Pool/Escape Pod" as originally guessed; that naming doesn't exist in code or GDDs) | All 3 share one generic colored emissive cube (`src/3d/SecretRoom.tsx`), differentiated only by `FACTION_COLORS` (military=dark red, business=gold, people=green). No dedicated models/textures. Camera framing slots exist (`src/assets/secretRooms.ts`) but are placeholder-named. | 3D | Decide: build 3 distinct room models, or accept placeholder-cube as intentional stylized minimalism — needs a design call before speccing art. |
| 6 | **Weird laws / weird deals** | No unique icons/illustrations for any of the 14 weird laws or 10 weird deals — GDDs explicitly deferred this ("Sprint 5 visual pass", `weird-laws.md:34,84`, `weird-deals.md:37,51,65,205`). Surfaces via generic UI only. | 2D | Tied to `visualConsequences.ts` below. |
| 7 | **`visualConsequences.ts`** | Dormant scaffolding for building-decay-over-time consequences (per `docs/architecture/code-audit-2026-07-08.md` §D). Wired to nothing yet — data-only registry, no art exists against it. | 3D (decay variants + decals) | Needs a scope conversation before speccing — likely folds into #1 and #6. |

## Open questions before asset-spec pass

1. Is Poor/Normal skybox actually built, or is #2 a full gap across all tiers? (Not independently verified — flag for a quick code check.)
2. Ending rooms (#5): distinct models per room, or keep as stylized color-coded cubes?
3. `visualConsequences.ts` (#7) scope — what does "building decay" actually look like — texture swap, decal overlay, geometry swap?

## Next step

Once scope is confirmed on the open questions, run `/asset-spec` against #1, #3, #4
(clear 3D asset lists) to produce per-asset specs + AI-gen prompts and update the
asset manifest.
