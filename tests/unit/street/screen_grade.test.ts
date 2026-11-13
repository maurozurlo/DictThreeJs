import { describe, expect, it } from 'vitest';
import { SCREEN_GRADE_BY_TIER, SCREEN_GRADE_FADE_SECONDS } from '../../../src/Constants/ScreenGrade';
import { vehicleTierFor } from '../../../src/Utils/VehiclePool';
import {
    lerpScreenGrade,
    retargetScreenGradeFade,
    sampleScreenGradeFade,
    screenGradeTierFor,
    settledFade,
} from '../../../src/Utils/ScreenGrade';

const { poor, normal, rich } = SCREEN_GRADE_BY_TIER;
const D = SCREEN_GRADE_FADE_SECONDS;

describe('screenGradeTierFor', () => {
    it('test_infrastructure_slider_maps_to_street_view_tiers', () => {
        expect(screenGradeTierFor(1)).toBe('poor');
        expect(screenGradeTierFor(3)).toBe('poor');
        expect(screenGradeTierFor(4)).toBe('normal');
        expect(screenGradeTierFor(7)).toBe('normal');
        expect(screenGradeTierFor(8)).toBe('rich');
        expect(screenGradeTierFor(10)).toBe('rich');
    });

    it('test_grade_tier_always_matches_traffic_tier', () => {
        for (let v = 0; v <= 11; v++) expect(screenGradeTierFor(v)).toBe(vehicleTierFor(v));
    });
});

describe('tier grades', () => {
    it('test_poor_is_desaturated_and_rich_is_saturated', () => {
        expect(poor.saturation).toBeLessThan(normal.saturation);
        expect(normal.saturation).toBeLessThan(1);
        expect(rich.saturation).toBeGreaterThan(1);
    });

    it('test_normal_tint_is_blue_and_rich_tint_is_yellow', () => {
        const [nr, , nb] = normal.tint;
        expect(nb).toBeGreaterThan(nr);
        const [rr, rg, rb] = rich.tint;
        expect(rr).toBeGreaterThan(rb);
        expect(rg).toBeGreaterThan(rb);
        expect(rich.highlightAmount).toBeGreaterThan(0);
    });
});

describe('lerpScreenGrade', () => {
    it('test_endpoints_return_inputs', () => {
        expect(lerpScreenGrade(poor, rich, 0)).toEqual(poor);
        expect(lerpScreenGrade(poor, rich, 1)).toEqual(rich);
    });

    it('test_t_is_clamped', () => {
        expect(lerpScreenGrade(poor, rich, -2)).toEqual(poor);
        expect(lerpScreenGrade(poor, rich, 5)).toEqual(rich);
    });

    it('test_midpoint_blends_every_field', () => {
        const mid = lerpScreenGrade(poor, rich, 0.5);
        expect(mid.saturation).toBeCloseTo((poor.saturation + rich.saturation) / 2);
        expect(mid.tint[2]).toBeCloseTo((poor.tint[2] + rich.tint[2]) / 2);
        expect(mid.highlightAmount).toBeCloseTo((poor.highlightAmount + rich.highlightAmount) / 2);
    });
});

describe('screen grade fade', () => {
    it('test_settled_fade_shows_its_grade_at_any_time', () => {
        const f = settledFade(normal);
        expect(sampleScreenGradeFade(f, D)).toEqual(normal);
        expect(sampleScreenGradeFade({ ...f, elapsed: 100 }, D)).toEqual(normal);
    });

    it('test_fade_starts_at_old_grade_and_ends_at_new', () => {
        const f = retargetScreenGradeFade(settledFade(poor), rich, D);
        expect(sampleScreenGradeFade(f, D)).toEqual(poor);
        expect(sampleScreenGradeFade({ ...f, elapsed: D }, D)).toEqual(rich);
        expect(sampleScreenGradeFade({ ...f, elapsed: D * 3 }, D)).toEqual(rich);
    });

    it('test_fade_is_monotonic', () => {
        const f = retargetScreenGradeFade(settledFade(poor), rich, D);
        let prev = -Infinity;
        for (let i = 0; i <= 20; i++) {
            const s = sampleScreenGradeFade({ ...f, elapsed: (D * i) / 20 }, D).saturation;
            expect(s).toBeGreaterThanOrEqual(prev);
            prev = s;
        }
    });

    it('test_retarget_mid_fade_does_not_pop', () => {
        const f = { ...retargetScreenGradeFade(settledFade(poor), rich, D), elapsed: D * 0.4 };
        const onScreen = sampleScreenGradeFade(f, D);
        const back = retargetScreenGradeFade(f, poor, D);
        expect(sampleScreenGradeFade(back, D)).toEqual(onScreen);
        expect(sampleScreenGradeFade({ ...back, elapsed: D }, D)).toEqual(poor);
    });

    it('test_zero_duration_snaps_to_target', () => {
        const f = retargetScreenGradeFade(settledFade(poor), normal, 0);
        expect(sampleScreenGradeFade(f, 0)).toEqual(normal);
    });
});
