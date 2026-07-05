import * as THREE from 'three';
import type { WaypointPath } from '../types/StreetLayout';

/** Euclidean length of a looping waypoint path (XZ plane only). */
export function pathTotalLength(waypoints: WaypointPath['waypoints']): number {
    let total = 0;
    for (let i = 0; i < waypoints.length; i++) {
        const a = waypoints[i];
        const b = waypoints[(i + 1) % waypoints.length];
        total += Math.sqrt((b.x - a.x) ** 2 + (b.z - a.z) ** 2);
    }
    return total;
}

/**
 * World position and next-waypoint index at arc-length `dist` along a looping path.
 * `dist` is wrapped into [0, totalLength) so callers can pass any value.
 */
export function positionAtPathDistance(
    waypoints: WaypointPath['waypoints'],
    dist: number,
): { pos: THREE.Vector3; nextIdx: number } {
    const total = pathTotalLength(waypoints);
    let d = ((dist % total) + total) % total;

    for (let i = 0; i < waypoints.length; i++) {
        const a = waypoints[i];
        const b = waypoints[(i + 1) % waypoints.length];
        const segLen = Math.sqrt((b.x - a.x) ** 2 + (b.z - a.z) ** 2);
        if (d <= segLen) {
            const t = segLen > 0 ? d / segLen : 0;
            return {
                pos: new THREE.Vector3(a.x + (b.x - a.x) * t, a.y, a.z + (b.z - a.z) * t),
                nextIdx: (i + 1) % waypoints.length,
            };
        }
        d -= segLen;
    }
    return { pos: new THREE.Vector3(waypoints[0].x, waypoints[0].y, waypoints[0].z), nextIdx: 1 };
}
