/**
 * Street traffic mix (visual-gaps POC 2026-11-12, docs/architecture/visual-gaps-poc-2026-11-12.md).
 *
 * The base car follows the infrastructure tier (street-view.md §3.1: 1–3 poor, 4–7 normal,
 * 8–10 rich); service vehicles join the mix when their budget line is funded high.
 * Purely cosmetic — no gameplay reads these.
 */

/** Every street vehicle model the renderer can spawn. */
export type VehicleModelId = 'junker' | 'sedan' | 'limo' | 'jeep' | 'ambulance';

/** Infrastructure tier label used to pick the base traffic pool. */
export type VehicleTier = 'poor' | 'normal' | 'rich';

/** Highest infrastructure value that still reads as the poor traffic tier. */
export const VEHICLE_POOR_MAX_INFRASTRUCTURE = 3;

/** Lowest infrastructure value that reads as the rich traffic tier. */
export const VEHICLE_RICH_MIN_INFRASTRUCTURE = 8;

/**
 * Base model cycle per tier, assigned by spawn index (index % length): poor streets are all
 * junkers, normal streets mostly sedans with the odd junker, rich streets alternate sedans and
 * the leader's limousines.
 */
export const VEHICLE_TIER_POOL: Record<VehicleTier, readonly VehicleModelId[]> = {
    poor: ['junker'],
    normal: ['sedan', 'sedan', 'junker'],
    rich: ['sedan', 'limo'],
};

/** Security expenditure at or above which military jeeps patrol (the Militarised tier). */
export const JEEP_SECURITY_MIN = 8;

/** Health expenditure at or above which ambulances join the traffic. */
export const AMBULANCE_HEALTH_MIN = 8;

/** While jeeps are on, every JEEP_SPAWN_EVERY-th spawn (starting at JEEP_SPAWN_OFFSET) is a jeep. */
export const JEEP_SPAWN_EVERY = 4;
export const JEEP_SPAWN_OFFSET = 1;

/** While ambulances are on, every AMBULANCE_SPAWN_EVERY-th spawn (from the offset) is an ambulance. */
export const AMBULANCE_SPAWN_EVERY = 5;
export const AMBULANCE_SPAWN_OFFSET = 3;

/**
 * World units per metre for vehicles — the same 3.7× factor as the citizens' PED_WORLD_SCALE:
 * the env GLBs are drawn oversized, so cars are scaled to match.
 */
export const VEHICLE_WORLD_SCALE = 3.7;

/**
 * Junker length in metres (× VEHICLE_WORLD_SCALE at render). The junker GLB is boxier than the
 * POC cars (wider and taller per metre of length), so at sedan length (2.9 m) it read far bigger
 * than the rest of the traffic; 65% (1.9 m) read too small. 2.3 m puts its roof at sedan height.
 */
export const JUNKER_LENGTH_M = 2.3;

/** Junker GLB width ÷ length (raw bounds 0.0068573 / 0.0112278) — keeps the footprint honest. */
export const JUNKER_WIDTH_PER_LENGTH = 0.6107;

/**
 * Footprint half extents per model (world units) — what the traffic simulation uses for
 * following distances, conflict zones and collision checks. Junker derived from its render
 * length and GLB proportions; POC cars measured from their GLBs (tools/blender/vehicles.py).
 */
export const VEHICLE_FOOTPRINT: Record<VehicleModelId, { halfLength: number; halfWidth: number }> = {
    junker: {
        halfLength: (JUNKER_LENGTH_M * VEHICLE_WORLD_SCALE) / 2,
        halfWidth: (JUNKER_LENGTH_M * JUNKER_WIDTH_PER_LENGTH * VEHICLE_WORLD_SCALE) / 2,
    },
    sedan: { halfLength: 5.35, halfWidth: 2.2 },
    limo: { halfLength: 8.0, halfWidth: 2.4 },
    jeep: { halfLength: 5.2, halfWidth: 2.5 },
    ambulance: { halfLength: 6.0, halfWidth: 2.4 },
};
