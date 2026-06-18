import type { StreetLayout } from '../types/StreetLayout';

/**
 * Metric-scale layout for the Street View scene. 1 unit = 1 metre.
 * See art-bible §10.0 for the full scale convention and reference dimensions.
 *
 * Top-down (Y up):
 *   L1 L2  [plaza]  R1 R2
 *          <road>
 *   L3 L4           R3 R4
 *
 *   X: −21 to +21 (road centred at x=0, 7 m wide)
 *   Z: +4 (south/front) to −20 (north/back)
 *   Y: 0 = ground level
 */
export const STREET_LAYOUT: StreetLayout = {
    buildings: [
        // Left side — back row
        { id: 'building-l1', position: { x: -9,  y: 0, z: -12 }, scale: { x: 6, y: 14, z: 8 } },
        { id: 'building-l2', position: { x: -15, y: 0, z: -12 }, scale: { x: 7, y: 10, z: 8 } },
        // Left side — front row
        { id: 'building-l3', position: { x: -9,  y: 0, z:   1 }, scale: { x: 6, y: 11, z: 6 } },
        { id: 'building-l4', position: { x: -15, y: 0, z:   1 }, scale: { x: 7, y:  9, z: 6 } },
        // Right side — back row
        { id: 'building-r1', position: { x:  9,  y: 0, z: -12 }, scale: { x: 6, y: 12, z: 8 } },
        { id: 'building-r2', position: { x:  15, y: 0, z: -12 }, scale: { x: 7, y: 16, z: 8 } },
        // Right side — front row
        { id: 'building-r3', position: { x:  9,  y: 0, z:   1 }, scale: { x: 6, y: 10, z: 6 } },
        { id: 'building-r4', position: { x:  15, y: 0, z:   1 }, scale: { x: 7, y: 13, z: 6 } },
    ],

    plaza: {
        position: { x: 0, y: 0, z: -9 },
        scale:    { x: 10, y: 0.2, z: 10 },
        statueSlots: [
            { x:  0, y: 0.2, z: -9 },
            { x: -3, y: 0.2, z: -7 },
            { x:  3, y: 0.2, z: -7 },
        ],
    },

    pedestrianPaths: [
        {
            id: 'sidewalk-right',
            // Loops clockwise (viewed top-down) along the right sidewalk (x ≈ 4.5)
            // then around the outside of the right building block.
            // ry = facing direction when leaving this waypoint toward the next.
            //   0        = facing −Z (north)
            //  −Math.PI/2 = facing +X (east)
            //   Math.PI  = facing +Z (south)
            //   Math.PI/2 = facing −X (west)
            waypoints: [
                { x:  4.5, y: 0, z:   3, ry: 0               },
                { x:  4.5, y: 0, z: -18, ry: -Math.PI / 2    },
                { x:  17,  y: 0, z: -18, ry: Math.PI         },
                { x:  17,  y: 0, z:   3, ry:  Math.PI / 2    },
            ],
            loop: true,
        },
        {
            id: 'sidewalk-left',
            // Loops counter-clockwise along the left sidewalk (x ≈ −4.5).
            waypoints: [
                { x: -4.5, y: 0, z:   3, ry: 0               },
                { x: -4.5, y: 0, z: -18, ry:  Math.PI / 2    },
                { x: -17,  y: 0, z: -18, ry: Math.PI         },
                { x: -17,  y: 0, z:   3, ry: -Math.PI / 2    },
            ],
            loop: true,
        },
    ],

    vehiclePaths: [
        {
            id: 'road-loop-a',
            // Tight road loop: left lane north, U-turn, right lane south.
            waypoints: [
                { x: -1.75, y: 0, z:   4, ry: 0               },
                { x: -1.75, y: 0, z: -19, ry: -Math.PI / 2    },
                { x:  1.75, y: 0, z: -19, ry: Math.PI         },
                { x:  1.75, y: 0, z:   4, ry:  Math.PI / 2    },
            ],
            loop: true,
        },
        {
            id: 'road-loop-b',
            // Wide loop around the right building block.
            waypoints: [
                { x:  4,  y: 0, z:   4, ry: 0               },
                { x:  4,  y: 0, z: -19, ry: -Math.PI / 2    },
                { x:  20, y: 0, z: -19, ry: Math.PI         },
                { x:  20, y: 0, z:   4, ry:  Math.PI / 2    },
            ],
            loop: true,
        },
    ],

    pedestrians: [
        { id: 'ped-0', pathId: 'sidewalk-right', speed: 1.5 },
        { id: 'ped-1', pathId: 'sidewalk-left',  speed: 1.5 },
    ],

    vehicles: [
        { id: 'car-0', pathId: 'road-loop-a', speed: 6.0 },
        { id: 'car-1', pathId: 'road-loop-b', speed: 6.0 },
    ],
};
