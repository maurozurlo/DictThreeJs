export interface Vec3 {
    x: number;
    y: number;
    z: number;
}

export interface Waypoint extends Vec3 {
    /** Yaw (camera.rotation.y) facing toward the next waypoint, recorded in debug mode */
    ry?: number;
    /** Car stop node: halt here while the named crossing is in its ped phase. */
    stopFor?: string;
    /**
     * Only meaningful on the LAST waypoint of a non-loop path: the nearest
     * point found on another car path at conversion time, within snap range.
     * On reaching this waypoint, the traveller continues onto that path/index
     * instead of stopping — an open path's equivalent of a loop's wraparound.
     * Absent means a genuine dead end (no path was close enough to link).
     */
    endLink?: CrossingLink;
}

export interface WaypointPath {
    id: string;
    waypoints: Waypoint[];
    /** If true, entity returns to waypoint[0] after reaching the last */
    loop: boolean;
}

/** A kerb anchor: the ped-loop waypoint a crossing endpoint snaps onto. */
export interface CrossingLink {
    pathId: string;
    waypointIdx: number;
}

/**
 * A street crossing (open polyline). Peds walk it kerb-to-kerb during the ped
 * light phase; car paths carry `stopFor` waypoints baked before each crossing.
 * links[0]/links[1] anchor the first/last crossing waypoint to a ped loop
 * (null if no loop knot was within snap range at conversion time).
 */
export interface Crossing {
    id: string;
    waypoints: Waypoint[];
    links: [CrossingLink | null, CrossingLink | null];
}

/** Axis-aligned ground zone (XZ bounds), e.g. the protest square. */
export interface PathZone {
    id: string;
    min: [number, number];
    max: [number, number];
}

/** Output shape of tools/ipl/convert_paths.mjs (generated street-paths.ts). */
export interface StreetPaths {
    pedPaths: WaypointPath[];
    carPaths: WaypointPath[];
    crossings: Crossing[];
    zones: PathZone[];
}

export interface VehicleConfig {
    id: string;
    pathId: string;
    /** Movement speed in units per second */
    speed: number;
}
