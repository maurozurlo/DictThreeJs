# ADR-0013: Representative Execution Animations — Baked Max Take, Scrubbed per Slice

## Status

Accepted

## Date

2026-11-12

## Last Verified

2026-11-12

## Decision Makers

Owner (authored the Max props/timeline) + Claude (pipeline and integration)

## Summary

Eliminating a representative used to just unmount its figurine. Each one now gets
a goofy send-off in the Meet room: the couch spring yeets the business rep, a
trapdoor drops the military rep, a toy claw carries off the people's rep. The
props are animated in 3ds Max on one 30 fps timeline. The representatives' motion
is done in code, synchronised to that timeline.

## Context

- The office scene (`main interiors06.max`, Max 2023, Standard materials) replaces
  the old `main.FBX`. It drops the unused balcony and adds the three props.
- The representatives are separate FBX figurines placed in code. They are not in
  the Max scene, so their motion can't be keyed there.
- Max 2023's glTF exporter writes Standard materials as black fallback materials,
  drops UVs, and exports no animation. FBX works with all three.
- three's FBXLoader interpolates linearly between keys and ignores Bezier tangents.

## Decision

1. **Export as FBX with per-frame resampling.**
   `tools/maxscript/export_office_fbx.ms` exports with `BakeResampleAnimation`,
   converts mm to m with Y up, and saves and restores the exporter settings.
   Without resampling, in-between frames drift (the claw was 10 mm off at frame 50).
2. **Place the model with a fitted offset.** `OFFICE_MODEL_OFFSET` was fitted on the
   6,227 vertices shared with the old room, with a residual under 0.01 mm. Reps,
   lights and cameras keep their old coordinates. The old CameraStart dummies are
   now `OFFICE_CAMERA_POSITIONS`.
3. **One timeline, sliced per representative** (`REP_EXECUTIONS`): business 0-20
   (`Object002`, `Helix001`), military 20-35 (`Object001`), people 40-80
   (`Dummy001`, `Box072`-`Box074`). The slices share no nodes, so two executions
   can't fight over a prop. A slice's start frame is its rest pose.
4. **Scrub the clip instead of playing it.** `ClipPoser` evaluates the track
   interpolants at an exact frame for a given list of nodes. An AnimationMixer would
   need one action per slice, plus loop and clamp handling at the slice edges. It
   also skips writes for unchanged values, which made external offsets accumulate.
5. **Representative motion is pure maths.** `Utils/RepExecution.ts` holds that maths
   and the tuning lives in `Constants/Office.ts`. The business rep rides the plate,
   then flies a ballistic arc. The military rep hangs over the open trapdoor, then
   falls and is hidden. The people's rep is carried rigidly by the claw from the
   moment the fingers close.
6. **Director.** Each frame, `MainModel` poses the props and moves each rep's rig
   group. `useRepExecutions` starts a run when a rep goes `active` → `eliminated`
   while the room is on screen. It works this out during render, so the figurine
   is never unmounted for a frame. Game state is unchanged: the rep is eliminated
   immediately, and the animation is cosmetic.

## Consequences

- Re-timing or re-placing a prop in Max: re-run the export script, then update
  `REP_EXECUTIONS` or the tuning constants if the frame ranges or node names
  changed. `MainModel` logs a warning if a listed node isn't animated.
- The claw was moved in Max so that it's centred over the people's rep, at
  X −179.8 / Y −150.0 mm. It was also turned so two fingers come down at his front
  corners and the third goes behind him. An earlier version had the single front
  finger behind him, which made the claw read as going behind him from the game
  camera. Its fingers stop at contact, which is frame 62. A collision sampling pass
  checked every frame for fingers or body inside the rep or the armchair, and found
  none. Any pull, lift or sway added in code would undo that.
- Rest poses come from the clip, not from the FBX node defaults, so the Max time
  slider position at export doesn't matter.

## ADR Dependencies

- ADR-0003 (React / Three.js integration): everything lives in the Scene
  boundary. The store only tells the scene that a rep was eliminated.
- ADR-0002 (state management): no store changes. Execution runs are local React
  state in the scene.

## Engine Compatibility

- three r180 / @react-three/fiber 9 / React 19.
- `KeyframeTrack.createInterpolant` is set at runtime but missing from
  `@types/three`. `ClipPoser` narrows the type locally.

## GDD Requirements Addressed

None. This is presentation of an existing mechanic (the Meet "eliminate" action).
It has no gameplay effect.

## Verification

- `tests/unit/office/` covers transitions, frame maths, poses, the hook and `ClipPoser`.
- The baked clip was compared with Max world transforms at sampled frames, and
  they match exactly.
- Screenshot sequences at frozen frames: `build/rep_executions/final/` (gitignored).
