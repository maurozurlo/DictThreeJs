/**
 * Story 8-7: advanceConditionStage — building degradation handler
 *
 * All 10 test cases from the story's acceptance criteria table (AC-6).
 * No mocking required — advanceConditionStage is a pure function.
 */

import { describe, it, expect } from 'vitest';
import { advanceConditionStage } from '../../../src/Utils/BuildingDegradation';
import {
    BUILDING_STAGE_MIN,
    BUILDING_STAGE_MAX,
    BUILDING_POOR_THRESHOLD,
    BUILDING_RICH_THRESHOLD,
    BUILDING_DEGRADE_RATE,
    BUILDING_RECOVER_RATE_RICH,
    BUILDING_RECOVER_RATE_POOR_REPAIR,
    BUILDING_RECOVER_RATE_RICH_DECAY,
} from '../../../src/Constants/BuildingDegradation';

describe('advanceConditionStage', () => {
    // --- Poor tier (infra ≤ BUILDING_POOR_THRESHOLD) ---

    it('poor tier mid-stage: degrades by BUILDING_DEGRADE_RATE', () => {
        // conditionStage=-2, infra=2 → -2 + (-2) = -4
        expect(advanceConditionStage(-2, 2)).toBe(-2 - BUILDING_DEGRADE_RATE);
    });

    it('poor tier at floor: clamps to BUILDING_STAGE_MIN', () => {
        // conditionStage=-5, infra=1 → would be -7, clamped to -5
        expect(advanceConditionStage(BUILDING_STAGE_MIN, 1)).toBe(BUILDING_STAGE_MIN);
    });

    // --- Rich tier (infra ≥ BUILDING_RICH_THRESHOLD) ---

    it('rich tier recovering from poor: gains BUILDING_RECOVER_RATE_RICH', () => {
        // conditionStage=-3, infra=9 → -3 + 1 = -2
        expect(advanceConditionStage(-3, 9)).toBe(-3 + BUILDING_RECOVER_RATE_RICH);
    });

    it('rich tier building from neutral: gains BUILDING_RECOVER_RATE_RICH', () => {
        // conditionStage=0, infra=9 → 0 + 1 = 1
        expect(advanceConditionStage(0, 9)).toBe(BUILDING_RECOVER_RATE_RICH);
    });

    it('rich tier at ceiling: clamps to BUILDING_STAGE_MAX', () => {
        // conditionStage=5, infra=10 → would be 6, clamped to 5
        expect(advanceConditionStage(BUILDING_STAGE_MAX, 10)).toBe(BUILDING_STAGE_MAX);
    });

    // --- Normal tier (POOR_THRESHOLD < infra < RICH_THRESHOLD) ---

    it('normal tier negative stage: repairs by BUILDING_RECOVER_RATE_POOR_REPAIR', () => {
        // conditionStage=-2, infra=5 → -2 + 1 = -1
        expect(advanceConditionStage(-2, 5)).toBe(-2 + BUILDING_RECOVER_RATE_POOR_REPAIR);
    });

    it('normal tier positive stage: luxury decay by BUILDING_RECOVER_RATE_RICH_DECAY', () => {
        // conditionStage=3, infra=6 → 3 - 1 = 2
        expect(advanceConditionStage(3, 6)).toBe(3 - BUILDING_RECOVER_RATE_RICH_DECAY);
    });

    it('normal tier neutral stage: no change', () => {
        // conditionStage=0, infra=5 → 0
        expect(advanceConditionStage(0, 5)).toBe(0);
    });

    // --- Boundary values ---

    it('poor→normal boundary (infra = POOR_THRESHOLD + 1): repairs when stage < 0', () => {
        // infra=4 is Normal; conditionStage=-1 → -1 + 1 = 0
        expect(advanceConditionStage(-1, BUILDING_POOR_THRESHOLD + 1)).toBe(0);
    });

    it('rich→normal boundary (infra = RICH_THRESHOLD - 1): luxury decay when stage > 0', () => {
        // infra=7 is Normal; conditionStage=2 → 2 - 1 = 1
        expect(advanceConditionStage(2, BUILDING_RICH_THRESHOLD - 1)).toBe(1);
    });
});
