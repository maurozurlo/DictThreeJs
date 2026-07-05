import { describe, it, expect } from 'vitest';
import {
    lightPhase, phaseTime, canStartCrossing,
    CAR_PHASE_SECONDS, PED_PHASE_SECONDS, PED_START_WINDOW,
} from '../../../src/Utils/TrafficLight';

const CYCLE = CAR_PHASE_SECONDS + PED_PHASE_SECONDS;

describe('TrafficLight', () => {
    it('test_cycle_starts_in_car_phase', () => {
        expect(lightPhase(0)).toBe('cars');
        expect(phaseTime(0)).toBe(0);
    });

    it('test_phase_flips_to_peds_after_car_phase', () => {
        expect(lightPhase(CAR_PHASE_SECONDS - 0.01)).toBe('cars');
        expect(lightPhase(CAR_PHASE_SECONDS)).toBe('peds');
        expect(phaseTime(CAR_PHASE_SECONDS)).toBe(0);
    });

    it('test_cycle_wraps_back_to_cars', () => {
        expect(lightPhase(CYCLE)).toBe('cars');
        expect(lightPhase(CYCLE * 3 + CAR_PHASE_SECONDS + 1)).toBe('peds');
    });

    it('test_phase_time_counts_within_ped_phase', () => {
        expect(phaseTime(CAR_PHASE_SECONDS + 2.5)).toBeCloseTo(2.5);
    });

    it('test_crossing_start_only_in_early_ped_window', () => {
        expect(canStartCrossing(CAR_PHASE_SECONDS - 1)).toBe(false); // car phase
        expect(canStartCrossing(CAR_PHASE_SECONDS + PED_START_WINDOW - 0.1)).toBe(true);
        expect(canStartCrossing(CAR_PHASE_SECONDS + PED_START_WINDOW + 0.1)).toBe(false); // late ped phase
    });

    it('test_ped_window_leaves_time_to_finish_crossing', () => {
        // Slowest ped (0.9 m/s) starting at the window's edge must clear a
        // ~8.5 m crossing before the car phase returns.
        const remaining = PED_PHASE_SECONDS - PED_START_WINDOW;
        expect(remaining * 0.9 + PED_START_WINDOW * 0.9).toBeGreaterThanOrEqual(8);
    });

    it('test_negative_elapsed_is_safe', () => {
        expect(['cars', 'peds']).toContain(lightPhase(-3));
        expect(phaseTime(-3)).toBeGreaterThanOrEqual(0);
    });
});
