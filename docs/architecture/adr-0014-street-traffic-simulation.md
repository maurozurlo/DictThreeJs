# ADR-0014: Street Traffic Simulation — Road Plan, Lane Graph, Conflict Zones

## Status

Accepted

## Date

2026-11-12

## Last Verified

2026-11-12

## Decision Makers

Owner (picked the Avenida layout, zebra yield, slow-and-weave for road props) + Claude
(simulation, road generation, integration)

## Summary

The street's cars and pedestrians used to follow 3ds Max spline loops, each one avoiding
the others with its own proximity heuristics. Cars jammed for good at merges. Peds walked
through each other and through lamp posts. The two groups never saw each other. All of it
is replaced by one cosmetic simulation in `src/Traffic/`. It is fed by an authored **road
plan** that also generates the street floor, so the roads the player sees and the lanes the
traffic uses always match.

## Context

- Old system:
  - `Vehicles.tsx` steered each car straight at waypoints and snapped its heading per segment.
  - An OBB "soft hold" with a 3 s push-through timeout fought a hard body block. Two cars meeting
    at a merge blocked each other forever once their bodies touched.
  - Open inner car paths had an exit link but no entry, so they emptied after the first lap.
- Peds (`CitizenModels.tsx`):
  - A peds-only check paused a walker for anyone in a 35° cone, then pushed through after 2.5 s,
    walking straight through the other ped.
  - Lanes were fixed, and peds had no idea cars existed.
  - A single invisible global light froze every car for 9 s.
  - The ped check allocated about 700 `Vector3`s per frame.
- The roads themselves (Max splines plus the `env_roads` GLB) were partial and one-way, and
  props sat on them: streetlights 0.2 u from the ped loops, barricades on the ring road.
- Road planning (2026-11-12) proposed three layouts. The owner picked **Avenida**: a two-way
  grid with a planted boulevard behind the plaza, and a front street with 4-way junctions. The
  plaza stays where it was. Rotonda and Explanada are parked in `src/assets/data/road-plans/`.

## Decision

1. **Road plan as the single source.** `RoadPlan` (`src/Traffic/RoadPlan.ts`) defines:
   - road centrelines with lane counts, median, rank and speed;
   - blocks with kerb outline, sidewalk width and ped weight;
   - zebra crossings, walkways, buildings, props and zones;
   - the IPL ids it supersedes.

   `buildRoadNetwork` (`RoadBuilder.ts`) then derives everything else:
   - junctions (a road end on another road = T, two roads crossing = X);
   - lanes, using right-hand traffic;
   - Bezier junction connectors with lane-choice rules (right turn from the right lane,
     left turn from the left);
   - sidewalk loops, crossings linked to those loops, and medians;
   - road ribbons and markings;
   - validation of lanes against kerbs.

   `RoadSurface.tsx` meshes it in about 8 draw calls with world-space UVs; `env_roads` is retired.
2. **Cars:**
   - **1D lanes with IDM.** Cars move along lane arc length using the Intelligent Driver Model,
     so they cannot rear-end. Heading follows the rear-to-front axle chord, so turns are smooth.
   - **Spawn and despawn.** Cars spawn at the plan bounds (off camera) and despawn there.
   - **Conflict zones** (`Conflicts.ts`). Every place where two reference car footprints (SAT on
     oriented boxes) overlap on different paths becomes a zone, as does every car path through
     a zebra strip. A car must claim its side of a zone before its body enters.
   - **Claim rules:**
     - Claims are made a comfortable braking distance ahead.
     - All car zones from the approach lane's last 25 u, through the connector, to the exit
       lane's first 25 u are claimed **all-or-nothing**. No hold-and-wait means no deadlock.
     - A claim also needs exit-lane room (never block the box) and room past any zebra (never
       stop on the stripes).
   - **Priority** is road rank plus waiting time (aging), with a 2 s gap-acceptance window. A car
     waiting at the line counts as "arriving now", but only if its exit has room.
3. **Peds:**
   - Peds keep a 1D arc length on sidewalk loops plus a lateral offset inside the sidewalk band.
   - A uniform spatial hash grid supplies neighbours. Peds keep right, sidestep oncoming walkers,
     overtake on the left, steer around furniture bases and follow when boxed in. After 2.5 s
     stuck they turn around.
   - A final pass pushes apart overlapping bodies, through the path frame only, so a push can
     never move a ped into the road.
4. **Zebra yield.** Cars give way to peds on the crossing, and to peds waiting at the kerb while
   the car can still stop comfortably (7 s patience). A ped steps off the kerb only when no car
   holds the zebra **and** no car body physically overlaps the strip.
5. **Road props weave.** Barricades bend the lanes they touch around their footprint:
   - the bend goes to the side that fits the carriageway, with eased ramps;
   - speed is capped at 9 u/s through the swerve;
   - conflict zones are recomputed on the bent geometry.

   A change in the set of road props rebuilds the network and the sim; walkers carry over.
   The security-tier searchlight moved off the road, because its 14 u base turned the boulevard
   into a single lane next to a junction.
6. **Runtime.**
   - One `StreetSim` singleton (`streetWorld.ts`), pre-warmed for 30 s, stepped in fixed
     1/30 s ticks by `StreetSimDriver` (`useFrame` priority -1). It pauses while the Street tab is
     unmounted.
   - Cars render from a fixed pool of `CAR_MAX` slots, each caching one clone per model.
   - Walkers read their ped by citizen id, and skip skinning and drawing outside the camera frustum.
   - The sim is seeded from `Math.random()` (cosmetic, never the gameplay cursor; ADR-0010).

## Consequences

- **Measured** (`tools/roadplan/soak.ts`, Avenida, 6 seeds × 10 simulated minutes):
  - 0 car-car and 0 ped-car body overlap.
  - Ped-ped overlap at most a shoulder brush (< 1 u of 2.2 u).
  - No gridlock.
  - About 0.1 ms per tick for 16 cars and 25 peds.
- **Remaining tail:** under full load (16 cars) a side-street car can wait 30–50 s at a busy
  junction. Tuning knobs live in `src/Constants/Traffic.ts`.
- **Map pipeline.** Roads, kerbs and block layout are no longer authored in Max. Changing them
  means editing the plan (`src/assets/data/road-plans/avenida.ts`) and re-running
  `node tools/roadplan/build.ts` for the plan SVG and stats. The IPL keeps the plaza and the
  props that did not move.
- **Removed:** `street-paths.ts`, `PathUtils.ts`, `TrafficLight.ts` (+ test), `types/StreetLayout.ts`,
  `tools/ipl/convert_paths.mjs`, `tools/maxscript/dump_paths.ms`, and per-component movement code.
- **No interactivity.** Peds never jaywalk, cars never leave lanes, and nothing reads traffic
  back into gameplay.

## ADR Dependencies

- ADR-0003 (Scene boundary): all Three.js stays in `src/3d`; `src/Traffic` is pure TypeScript.
- ADR-0010 (RNG): traffic owns a separate cosmetic mulberry32 stream.

## Engine Compatibility

Three.js r180 / R3F 9. Uses `THREE.ShapeUtils.triangulateShape` (earcut) for block fills. Node 24
type stripping runs `src/Traffic` headless in tools and tests.

## GDD Requirements Addressed

`design/gdd/street-view.md`: a living street whose citizens and traffic read clearly. Tier props
(trees, lamps, barricades) keep their visibility rules.

## Verification

- `tests/unit/traffic/` covers:
  - geometry: fillets, insets, offsets, slice wrap, turn signs, spatial grid;
  - the Avenida network: junctions, reachability, lane rules, plaza footprint, crossings,
    conflict coverage;
  - soaks: two seeds × 4 min with no overlaps or gridlock, determinism, crossing release on
    removal, the barricade weave, and the regression for a car stopped on a zebra.
- Screenshots at `build/traffic/` (normal tier, and security 2 with barricades).
