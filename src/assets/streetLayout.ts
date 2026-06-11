import type { StreetLayout } from '../types/StreetLayout';

/**
 * Static layout for the Street View scene.
 * All positions are relative to the street scene group origin.
 * Calibrate the group's world-space position against CameraStart002 in MainModel.tsx.
 *
 * Top-down layout (looking down Y):
 *
 *   B1  B2  [plaza]  B3  B4
 *        <-- road -->
 *   B5  B6           B7  B8
 *
 *  -Z = back / +Z = front / -X = left / +X = right
 */
export const STREET_LAYOUT: StreetLayout = {
    buildings: [
        // Left side — back row
        { id: 'building-l1', position: { x: -2.2, y: 0, z: -1.5 }, scale: { x: 0.7, y: 1.2, z: 0.7 } },
        { id: 'building-l2', position: { x: -1.3, y: 0, z: -1.5 }, scale: { x: 0.6, y: 0.9, z: 0.7 } },
        // Left side — front row
        { id: 'building-l3', position: { x: -2.2, y: 0, z:  0.8 }, scale: { x: 0.7, y: 1.0, z: 0.7 } },
        { id: 'building-l4', position: { x: -1.3, y: 0, z:  0.8 }, scale: { x: 0.6, y: 0.8, z: 0.7 } },
        // Right side — back row
        { id: 'building-r1', position: { x:  1.3, y: 0, z: -1.5 }, scale: { x: 0.6, y: 1.1, z: 0.7 } },
        { id: 'building-r2', position: { x:  2.2, y: 0, z: -1.5 }, scale: { x: 0.7, y: 1.3, z: 0.7 } },
        // Right side — front row
        { id: 'building-r3', position: { x:  1.3, y: 0, z:  0.8 }, scale: { x: 0.6, y: 0.9, z: 0.7 } },
        { id: 'building-r4', position: { x:  2.2, y: 0, z:  0.8 }, scale: { x: 0.7, y: 1.0, z: 0.7 } },
    ],

    plaza: {
        position: { x: 0, y: 0, z: -0.4 },
        scale:    { x: 1.6, y: 0.05, z: 1.6 },
        statueSlots: [
            { x:  0.0, y: 0.05, z: -0.4 },
            { x: -0.5, y: 0.05, z:  0.1 },
            { x:  0.5, y: 0.05, z:  0.1 },
        ],
    },

    pedestrianPaths: [
        {
            id: 'sidewalk-left',
            waypoints: [
                { x: -0.7, y: 0, z: -2.0 },
                { x: -0.7, y: 0, z:  1.5 },
            ],
            loop: true,
        },
        {
            id: 'sidewalk-right',
            waypoints: [
                { x:  0.7, y: 0, z:  1.5 },
                { x:  0.7, y: 0, z: -2.0 },
            ],
            loop: true,
        },
    ],

    vehiclePaths: [
        {
            id: 'main-road',
            waypoints: [
                { x:  0.0, y: 0, z: -2.5 },
                { x:  0.0, y: 0, z:  2.0 },
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
