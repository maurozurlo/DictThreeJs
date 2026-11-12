import {
    AMBULANCE_SPAWN_EVERY,
    AMBULANCE_SPAWN_OFFSET,
    JEEP_SPAWN_EVERY,
    JEEP_SPAWN_OFFSET,
    VEHICLE_POOR_MAX_INFRASTRUCTURE,
    VEHICLE_RICH_MIN_INFRASTRUCTURE,
    VEHICLE_TIER_POOL,
    type VehicleModelId,
    type VehicleTier,
} from '../Constants/Vehicles';

/**
 * Traffic tier for an infrastructure expenditure value (1–10).
 *
 * @param infrastructure - effective infrastructure slider value
 */
export function vehicleTierFor(infrastructure: number): VehicleTier {
    if (infrastructure <= VEHICLE_POOR_MAX_INFRASTRUCTURE) return 'poor';
    if (infrastructure >= VEHICLE_RICH_MIN_INFRASTRUCTURE) return 'rich';
    return 'normal';
}

/**
 * Model for the spawn at `index` (its stable position in the spawn list).
 *
 * Deterministic by index — not random — so a car keeps its model while the budget only moves
 * within a tier, and the mix is reproducible in tests. Service vehicles take precedence over the
 * tier pool (jeep first, then ambulance) on their every-Nth slots while their gate is on.
 *
 * @param index - spawn index (0-based, stable across renders)
 * @param tier - traffic tier from {@link vehicleTierFor}
 * @param jeepOn - security is high enough for military jeeps
 * @param ambulanceOn - health is high enough for ambulances
 */
export function vehicleModelForSpawn(
    index: number,
    tier: VehicleTier,
    jeepOn: boolean,
    ambulanceOn: boolean,
): VehicleModelId {
    if (jeepOn && index % JEEP_SPAWN_EVERY === JEEP_SPAWN_OFFSET) return 'jeep';
    if (ambulanceOn && index % AMBULANCE_SPAWN_EVERY === AMBULANCE_SPAWN_OFFSET) return 'ambulance';
    const pool = VEHICLE_TIER_POOL[tier];
    return pool[index % pool.length];
}
