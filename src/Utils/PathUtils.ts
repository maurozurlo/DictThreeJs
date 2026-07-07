import * as THREE from 'three';
import type { WaypointPath } from '../types/StreetLayout';

type PathLike = Pick<WaypointPath, 'waypoints' | 'loop'>;

/**
 * Euclidean length of a waypoint path (XZ plane only). A loop's closing
 * segment (last waypoint back to the first) counts; an open path's does not.
 */
export function pathTotalLength({ waypoints, loop }: PathLike): number {
    const segCount = loop ? waypoints.length : waypoints.length - 1;
    let total = 0;
    for (let i = 0; i < segCount; i++) {
        const a = waypoints[i];
        const b = waypoints[(i + 1) % waypoints.length];
        total += Math.sqrt((b.x - a.x) ** 2 + (b.z - a.z) ** 2);
    }
    return total;
}

/**
 * World position and next-waypoint index at arc-length `dist` along a path.
 * On a loop, `dist` wraps into [0, totalLength) so callers can pass any value.
 * On an open path, `dist` clamps to [0, totalLength] instead — there is no
 * wraparound to clamp into.
 */
export function positionAtPathDistance(
    path: PathLike,
    dist: number,
): { pos: THREE.Vector3; nextIdx: number } {
    const { waypoints, loop } = path;
    const total = pathTotalLength(path);
    let d = loop ? ((dist % total) + total) % total : Math.max(0, Math.min(dist, total));
    const segCount = loop ? waypoints.length : waypoints.length - 1;

    for (let i = 0; i < segCount; i++) {
        const a = waypoints[i];
        const b = waypoints[(i + 1) % waypoints.length];
        const segLen = Math.sqrt((b.x - a.x) ** 2 + (b.z - a.z) ** 2);
        if (d <= segLen || i === segCount - 1) {
            const t = segLen > 0 ? Math.min(1, d / segLen) : 0;
            return {
                pos: new THREE.Vector3(a.x + (b.x - a.x) * t, a.y, a.z + (b.z - a.z) * t),
                nextIdx: loop ? (i + 1) % waypoints.length : Math.min(i + 1, waypoints.length - 1),
            };
        }
        d -= segLen;
    }
    return { pos: new THREE.Vector3(waypoints[0].x, waypoints[0].y, waypoints[0].z), nextIdx: Math.min(1, waypoints.length - 1) };
}
