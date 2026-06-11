import type { StreetLayout } from '../types/StreetLayout';

/**
 * Static layout for the Street View scene.
 * All positions are relative to the street scene <group> origin in Scene.tsx.
 * Scale matches the rest of the diorama (~0.05–0.35 unit objects).
 *
 * Top-down (Y up):
 *   L1 L2  [plaza]  R1 R2
 *          <road>
 *   L3 L4           R3 R4
 *   -X=left  +X=right  -Z=back  +Z=front
 */
export const STREET_LAYOUT: StreetLayout = {
    buildings: [
        // Left side — back row
        { id: 'building-l1', position: { x: -0.30, y: 0, z: -0.20 }, scale: { x: 0.10, y: 0.20, z: 0.10 } },
        { id: 'building-l2', position: { x: -0.18, y: 0, z: -0.20 }, scale: { x: 0.08, y: 0.14, z: 0.10 } },
        // Left side — front row
        { id: 'building-l3', position: { x: -0.30, y: 0, z:  0.10 }, scale: { x: 0.10, y: 0.16, z: 0.10 } },
        { id: 'building-l4', position: { x: -0.18, y: 0, z:  0.10 }, scale: { x: 0.08, y: 0.12, z: 0.10 } },
        // Right side — back row
        { id: 'building-r1', position: { x:  0.18, y: 0, z: -0.20 }, scale: { x: 0.08, y: 0.18, z: 0.10 } },
        { id: 'building-r2', position: { x:  0.30, y: 0, z: -0.20 }, scale: { x: 0.10, y: 0.22, z: 0.10 } },
        // Right side — front row
        { id: 'building-r3', position: { x:  0.18, y: 0, z:  0.10 }, scale: { x: 0.08, y: 0.14, z: 0.10 } },
        { id: 'building-r4', position: { x:  0.30, y: 0, z:  0.10 }, scale: { x: 0.10, y: 0.16, z: 0.10 } },
    ],

    plaza: {
        position: { x: 0, y: 0, z: -0.05 },
        scale:    { x: 0.22, y: 0.02, z: 0.22 },
        statueSlots: [
            { x:  0.00, y: 0.02, z: -0.05 },
            { x: -0.06, y: 0.02, z:  0.02 },
            { x:  0.06, y: 0.02, z:  0.02 },
        ],
    },

    pedestrianPaths: [
        {
            id: 'sidewalk-left',
            waypoints: [
                { x: -0.10, y: 0, z: -0.35 },
                { x: -0.10, y: 0, z:  0.25 },
            ],
            loop: true,
        },
        {
            id: 'sidewalk-right',
            waypoints: [
                { x:  0.10, y: 0, z:  0.25 },
                { x:  0.10, y: 0, z: -0.35 },
            ],
            loop: true,
        },
    ],

    vehiclePaths: [
        {
            id: 'main-road',
            waypoints: [
                { x: 0, y: 0, z: -0.40 },
                { x: 0, y: 0, z:  0.30 },
            ],
            loop: true,
        },
    ],

    pedestrians: [
        { id: 'ped-0', pathId: 'sidewalk-left',  speed: 0.5 },
        { id: 'ped-1', pathId: 'sidewalk-right', speed: 0.4 },
        { id: 'ped-2', pathId: 'sidewalk-left',  speed: 0.6 },
    ],

    vehicles: [
        { id: 'car-0', pathId: 'main-road', speed: 1.2 },
    ],
};
