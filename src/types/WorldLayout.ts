/**
 * GTA IDE/IPL-inspired world layout format.
 * IDE = object definitions (one per model type, with metadata).
 * IPL = item placement (one per world instance).
 * 1 unit = 1 metre. Y-up. Pivots at object origin (bottom-centre for buildings/slabs).
 */

/** IDE objs entry — metadata for one model type. */
export interface IDEObject {
    /** Unique integer ID. */
    id: number;
    /** Logical name — matched by IPLInstance.modelName. */
    modelName: string;
    /** Path to asset file relative to public/ (e.g. "models/plaza.obj"). null = no renderable asset. */
    asset: string | null;
    /** All specified conditions must pass for this object's instances to render. Omit = always visible. */
    visibleIf?: {
        /** Game tab that must be active. Matches Tabs const values (e.g. "Street"). */
        tab?: string;
        /** budget.expenditures.infrastructure slider range [min, max] inclusive (0–10). */
        infrastructure?: [number, number];
        /** Modifier ID (e.g. "laws.5") that must be currently active. */
        modifier?: string;
        /** Minimum round number. */
        minRound?: number;
    };
}

export interface IDEFile {
    version: number;
    objs: IDEObject[];
}

/** IPL inst entry — one world instance of a model. */
export interface IPLInstance {
    /** Unique integer instance ID. */
    id: number;
    /** References IDEObject.modelName. */
    modelName: string;
    /** World position [x, y, z] in metres. */
    pos: [number, number, number];
    /** Quaternion rotation [x, y, z, w]. Identity = [0, 0, 0, 1]. */
    rot: [number, number, number, number];
    /** Per-axis scale. Default [1, 1, 1]. */
    scale?: [number, number, number];
}

export interface IPLFile {
    version: number;
    inst: IPLInstance[];
}

/** Merged, game-state-filtered placement ready for the renderer. */
export interface ResolvedPlacement {
    instanceId: number;
    modelName: string;
    asset: string | null;
    pos: [number, number, number];
    rot: [number, number, number, number];
    scale: [number, number, number];
}
