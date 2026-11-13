/**
 * Debug placement editor (debug mode, Street tab): click a placed object, drag the gizmo,
 * press D to download the edits as JSON.
 */

/**
 * Models the editor never picks: backdrop and ground slabs that cover the whole view
 * (clicking "empty" street would otherwise grab them).
 */
export const DEBUG_EDIT_EXCLUDED_PREFIXES: readonly string[] = ['env_skyline', 'env_roads', 'env_plaza'];

/** Rotate-mode snap (radians) — 5° steps. */
export const DEBUG_EDIT_ROTATION_SNAP = Math.PI / 36;

/** Emissive tint on every visible model of the source spot under the gizmo. */
export const DEBUG_EDIT_SELECTED_EMISSIVE = 0x2a5a8a;

/** Emissive tint on placements whose transform has been edited this session. */
export const DEBUG_EDIT_MOVED_EMISSIVE = 0x1a3a1a;
