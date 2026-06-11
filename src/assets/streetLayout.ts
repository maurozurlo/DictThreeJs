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
            id: 'square-loop-right',
            waypoints: [
                { x:  0.47,  y: 0.045, z:  0.101, ry:  0.02   },
                { x:  0.436, y: 0.045, z: -2.155, ry: -1.434  },
                { x:  2.262, y: 0.045, z: -2.187, ry: -2.884  },
                { x:  2.226, y: 0.045, z:  0.104, ry: -4.46   },
            ],
            loop: true,
        },
        {
            id: 'square-loop-left',
            waypoints: [
                { x: -0.426, y: 0.085, z: -0.002, ry:  0.1   },
                { x: -0.479, y: 0.085, z: -2.166, ry:  1.744 },
                { x: -1.994, y: 0.085, z: -2.079, ry:  3.346 },
                { x: -2.069, y: 0.085, z: -0.003, ry:  4.76  },
            ],
            loop: true,
        },
    ],

    vehiclePaths: [
        {
            id: 'car-loop-a',
            waypoints: [
                { x: -0.164, y: 0.105, z:  0.139, ry:  8.090 },
                { x: -2.162, y: 0.105, z:  0.222, ry:  6.624 },
                { x: -1.943, y: 0.105, z: -2.332, ry:  4.85  },
                { x: -0.136, y: 0.105, z: -2.239, ry:  3.214 },
            ],
            loop: true,
        },
        {
            id: 'car-loop-b',
            waypoints: [
                { x:  0.153, y: 0.024, z:  0.310, ry:  0.038  },
                { x:  0.356, y: 0.024, z: -2.373, ry: -1.54   },
                { x:  2.344, y: 0.024, z: -2.306, ry: -2.57   },
                { x:  2.408, y: 0.024, z:  0.562, ry: -4.714  },
            ],
            loop: true,
        },
        {
            id: 'car-loop-c',
            waypoints: [
                { x:  2.812, y: 0.024, z: -2.586, ry: -4.672  },
                { x: -2.482, y: 0.024, z: -2.602, ry: -4.706  },
                { x: -2.738, y: 0.024, z: -7.577, ry: -7.838  },
                { x:  4.541, y: 0.024, z: -7.785, ry: -9.114  },
            ],
            loop: true,
        },
    ],

    pedestrians: [
        { id: 'ped-0', pathId: 'square-loop-right', speed: 0.5 },
        { id: 'ped-1', pathId: 'square-loop-left',  speed: 0.5 },
    ],

    vehicles: [
        { id: 'car-0', pathId: 'car-loop-a', speed: 1.0 },
        { id: 'car-1', pathId: 'car-loop-b', speed: 1.0 },
        { id: 'car-2', pathId: 'car-loop-c', speed: 1.0 },
    ],
};
