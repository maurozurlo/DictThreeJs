/**
 * Street traffic mix (src/Utils/VehiclePool.ts, src/Constants/Vehicles.ts).
 * Base car by infrastructure tier; military jeeps (security >= 8) and ambulances
 * (health >= 8) take their every-Nth spawn slots, jeep first.
 */

import { describe, it, expect } from 'vitest';
import { vehicleModelForSpawn, vehicleTierFor } from '../../../src/Utils/VehiclePool';
import {
    AMBULANCE_SPAWN_EVERY,
    AMBULANCE_SPAWN_OFFSET,
    JEEP_SPAWN_EVERY,
    JEEP_SPAWN_OFFSET,
    VEHICLE_TIER_POOL,
} from '../../../src/Constants/Vehicles';

const SPAWNS = 20;

describe('vehicleTierFor', () => {
    it.each([
        [1, 'poor'], [3, 'poor'], [4, 'normal'], [7, 'normal'], [8, 'rich'], [10, 'rich'],
    ] as const)('test_vehicle_tier_infrastructure_%d_is_%s', (infra, tier) => {
        expect(vehicleTierFor(infra)).toBe(tier);
    });
});

describe('vehicleModelForSpawn', () => {
    it('test_vehicle_pool_poor_without_gates_all_junkers', () => {
        // Arrange / Act
        const models = Array.from({ length: SPAWNS }, (_, i) => vehicleModelForSpawn(i, 'poor', false, false));
        // Assert
        expect(new Set(models)).toEqual(new Set(['junker']));
    });

    it.each(['normal', 'rich'] as const)('test_vehicle_pool_%s_cycles_its_tier_pool', (tier) => {
        // Arrange
        const pool = VEHICLE_TIER_POOL[tier];
        // Act
        const models = Array.from({ length: SPAWNS }, (_, i) => vehicleModelForSpawn(i, tier, false, false));
        // Assert
        models.forEach((m, i) => expect(m).toBe(pool[i % pool.length]));
    });

    it('test_vehicle_pool_rich_includes_limos', () => {
        const models = Array.from({ length: SPAWNS }, (_, i) => vehicleModelForSpawn(i, 'rich', false, false));
        expect(models).toContain('limo');
    });

    it('test_vehicle_pool_jeep_on_takes_every_nth_slot', () => {
        // Act
        const models = Array.from({ length: SPAWNS }, (_, i) => vehicleModelForSpawn(i, 'normal', true, false));
        // Assert
        models.forEach((m, i) => {
            expect(m === 'jeep').toBe(i % JEEP_SPAWN_EVERY === JEEP_SPAWN_OFFSET);
        });
    });

    it('test_vehicle_pool_ambulance_on_takes_every_nth_slot', () => {
        // Act
        const models = Array.from({ length: SPAWNS }, (_, i) => vehicleModelForSpawn(i, 'poor', false, true));
        // Assert
        models.forEach((m, i) => {
            expect(m === 'ambulance').toBe(i % AMBULANCE_SPAWN_EVERY === AMBULANCE_SPAWN_OFFSET);
        });
    });

    it('test_vehicle_pool_both_gates_jeep_wins_shared_slot', () => {
        // Arrange — first index that is both a jeep slot and an ambulance slot
        const shared = Array.from({ length: 100 }, (_, i) => i).find(
            (i) => i % JEEP_SPAWN_EVERY === JEEP_SPAWN_OFFSET && i % AMBULANCE_SPAWN_EVERY === AMBULANCE_SPAWN_OFFSET,
        )!;
        // Act / Assert
        expect(vehicleModelForSpawn(shared, 'rich', true, true)).toBe('jeep');
    });

    it('test_vehicle_pool_gates_off_no_service_vehicles', () => {
        for (const tier of ['poor', 'normal', 'rich'] as const) {
            const models = Array.from({ length: SPAWNS }, (_, i) => vehicleModelForSpawn(i, tier, false, false));
            expect(models).not.toContain('jeep');
            expect(models).not.toContain('ambulance');
        }
    });
});
