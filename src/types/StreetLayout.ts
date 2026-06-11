export interface Vec3 {
    x: number;
    y: number;
    z: number;
}

export interface BuildingConfig {
    id: string;
    position: Vec3;
    /** Width (x), height (y), depth (z) */
    scale: Vec3;
}

export interface PlazaConfig {
    position: Vec3;
    /** Width (x) and depth (z) of the paved area; y is ignored (flat) */
    scale: Vec3;
    /** World positions for up to 3 statue pedestals */
    statueSlots: Vec3[];
}

export interface WaypointPath {
    id: string;
    waypoints: Vec3[];
    /** If true, entity returns to waypoint[0] after reaching the last */
    loop: boolean;
}

export interface PedestrianConfig {
    id: string;
    pathId: string;
    /** Movement speed in units per second */
    speed: number;
}

export interface VehicleConfig {
    id: string;
    pathId: string;
    speed: number;
}

export interface StreetLayout {
    buildings: BuildingConfig[];
    plaza: PlazaConfig;
    pedestrianPaths: WaypointPath[];
    vehiclePaths: WaypointPath[];
    pedestrians: PedestrianConfig[];
    vehicles: VehicleConfig[];
}
