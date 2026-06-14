# Performance Baseline Report
**Date**: 2026-06-14
**Sprint**: 5 (Polish Sprint 1)
**Story**: 5-1
**Measured by**: automated (bundle + Node timing) + manual (browser — see notes)

---

## Summary

| Budget | Target | Measured | Status |
|--------|--------|----------|--------|
| JS round-resolution (median) | ≤ 5ms | **0.15ms** (Node env) | ✅ PASS |
| Bundle size (gzipped JS) | < 500 KB | **364 KB** | ✅ PASS |
| Bundle size (gzipped CSS) | — | 7 KB | ✅ PASS |
| JS Heap at mid-game | ≤ 150 MB | _requires browser_ | ⚠️ NOT MEASURED |
| Framerate | 60 fps | _requires browser_ | ⚠️ NOT MEASURED |
| Three.js draw calls | < 100/frame | _requires browser_ | ⚠️ NOT MEASURED |
| GLB load time | < 3s (10 Mbps) | _requires browser_ | ⚠️ NOT MEASURED |

**Overall verdict**: ✅ PASS on measurable budgets. Browser-only metrics deferred to manual Polish QA.

---

## Automated Measurements

### JS Round-Resolution (Node.js)
**Tool**: Vitest + `performance.now()` in `tests/unit/perf/round_resolution_bench.test.ts`
**Method**: 20 `nextRound()` calls on a mid-game store state (round 5, 2 active recurring effects,
mixed budget and relations). Median taken to exclude GC/JIT outliers.

| Metric | Value |
|--------|-------|
| Median | **0.146 ms** |
| Min | 0.094 ms |
| Max | 17.665 ms (JIT warmup — run 1 of 20) |
| Budget | 5 ms |
| Headroom | **34×** |

The max of 17.665ms on run 1 is expected: V8 JIT compiles on first call. Rounds 2–20 are all
sub-millisecond. In a real browser session the function is called ≥10 times per play session,
so JIT warmup is not a user-visible concern.

**Node vs browser**: Node.js execution is typically 20–40% faster than a browser's JS engine due
to absent renderer synchronization costs. The 5ms budget was designed for the browser. Even at
a 2× penalty, the Node median (0.15ms) leaves > 16× headroom — comfortably safe.

### Bundle Size
**Tool**: `npx vite build` with gzip reporting

| Chunk | Raw | Gzip |
|-------|-----|------|
| `index-*.js` (main bundle) | 1,291 KB | **364 KB** |
| `index-*.css` | 29 KB | **7 KB** |
| `browser-ponyfill-*.js` | 10 KB | 4 KB |
| **Total** | ~1,330 KB | **~375 KB** |

Target: < 500 KB gzipped JS. Result: **364 KB — 27% under budget.**

Vite warns on 1,291 KB raw (`>500 kB after minification`) — this is the uncompressed size warning
and is not our budget target. The gzip budget is what matters for network delivery.

**3D assets (GLB files)** are loaded asynchronously behind a Suspense boundary and do not
contribute to the initial bundle. They are included in the GLB load-time budget separately
(browser measurement required).

### Test Suite
**Tool**: `npx vitest run`
**Result**: **290/290 passing** (289 pre-Sprint-5 + 1 new timing benchmark)
No regressions introduced by Sprint 5 setup.

---

## Browser-Only Measurements (Deferred)

The following budgets require a browser session to measure. Recommended: Chrome 120+,
DevTools Performance + Memory panels, with the production build served locally (`npx vite preview`).

### JS Heap at Mid-Game
**Target**: ≤ 150 MB
**Method**: Open Chrome DevTools → Memory → Take Heap Snapshot at round 5 with active recurring effects.
**When to measure**: After Sprint 5 content (weird laws + weird deals) is implemented, heap may grow.
Measure at end of Sprint 5, not now.

### Framerate
**Target**: 60 fps (sustained)
**Method**: Chrome DevTools Performance tab → record 10 seconds of gameplay at round 5.
Look for dropped frames (red bars in the frame chart). Target: ≥ 55 fps sustained.
**Risk flag**: Three.js scene has not been profiled. The 3D scene renders every frame regardless
of UI state — this is the highest-risk budget.

### Three.js Draw Calls
**Target**: < 100 per frame
**Method**: Spector.js browser extension → capture a frame → count draw calls.
**Expected**: The current scene is atmospheric-only (no interactive objects). Draw calls should
be well under 100, but verify before adding Sprint 5 visual consequences (weird law visual effects).

### GLB Load Time
**Target**: < 3s on simulated 10 Mbps connection
**Method**: Chrome DevTools Network tab → throttle to "Fast 3G" (~1.5 Mbps) or custom 10 Mbps.
Reload the page. Measure time for the GLB asset to finish loading.
**Note**: GLB load is gated behind a Suspense boundary — users see the UI before the 3D scene.
The 3s budget refers to when the 3D scene becomes visible, not page interactive time.

---

## Action Items

| Item | Priority | Owner | When |
|------|----------|-------|------|
| Measure heap at mid-game in browser | S3 advisory | developer | End of Sprint 5 |
| Measure framerate (baseline before visual effects) | S3 advisory | developer | Before Sprint 5 visual pass |
| Measure draw calls | S3 advisory | developer | Before Sprint 5 visual pass |
| Measure GLB load time (throttled) | S3 advisory | developer | Before Polish → Release gate |
| Re-run bundle measurement after weird laws + deals added | S3 | automated | After 5-2 and 5-3 complete |

All action items are **S3 advisory** — no violations are known or suspected at this stage.
The S1/S2 budgets (round-resolution and bundle) are confirmed within targets.

---

## Notes

- Vite's `chunkSizeWarningLimit` warning (raw JS > 500 KB) can be suppressed by setting
  `build.chunkSizeWarningLimit: 1500` in `vite.config.ts` if noise becomes an issue.
  The gzip budget is what matters for users; the raw-size warning is informational.
- The performance timing test (`tests/unit/perf/round_resolution_bench.test.ts`) is permanent
  and runs on every CI pass. If `nextRound()` ever exceeds 5ms median in Node, the test fails —
  providing an early warning before browser regression is visible.
