/**
 * Story 9-3: Street reveal + newsreel — headline pool picker (ADR-0012)
 */

import { describe, it, expect } from 'vitest';
import { buildRevealHeadline } from '../../../src/Utils/RevealHeadline';

const t = (key: string) => key;

describe('buildRevealHeadline', () => {
    it('test_round0_and_round5_return_same_headline_pool_wraps', () => {
        expect(buildRevealHeadline(0, t)).toBe(buildRevealHeadline(5, t));
    });

    it('test_round1_returns_hinge_headline_1_key', () => {
        expect(buildRevealHeadline(1, t)).toBe('hinge.headline.1');
    });

    it('test_is_deterministic_for_same_round', () => {
        expect(buildRevealHeadline(3, t)).toBe(buildRevealHeadline(3, t));
    });
});
