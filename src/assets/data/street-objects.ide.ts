import type { IDEFile } from '../../types/WorldLayout';

/**
 * Street scene object definitions (IDE format, GTA-inspired).
 * One entry per distinct model type. Asset paths are relative to public/.
 * visibleIf conditions are AND-ed — all must pass for the object to render.
 */
export const STREET_IDE: IDEFile = {
    version: 1,
    objs: [
        {
            id: 1001,
            modelName: 'plaza_ref',
            asset: 'models/plaza.obj',
            visibleIf: { tab: 'Street' },
        },
    ],
};
