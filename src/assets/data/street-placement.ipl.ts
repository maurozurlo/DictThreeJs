import type { IPLFile } from '../../types/WorldLayout';

/**
 * Street scene world instance placements (IPL format, GTA-inspired).
 * pos = world position [x, y, z] in metres. rot = quaternion [x, y, z, w].
 * All models must have a pivot at their local origin (0, 0, 0) — bottom-centre for slabs/buildings.
 */
export const STREET_IPL: IPLFile = {
    version: 1,
    inst: [
        {
            id: 1,
            modelName: 'plaza_ref',
            pos: [0, 0, -9],
            rot: [0, 0, 0, 1],
        },
    ],
};
