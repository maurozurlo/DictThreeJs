import { describe, it, expect } from 'vitest';
import { getCharismaLeft } from '../../../src/Utils/UI';
import { GAMESTATE } from '../../../src/Constants/GameState';

describe('getCharismaLeft', () => {
    // Based on GAMESTATE.CHARISMA: MIN: -10, MAX: 10
    const minCharisma = GAMESTATE.CHARISMA.MIN; // -10
    const maxCharisma = GAMESTATE.CHARISMA.MAX; // 10

    describe('boundary values', () => {
        it('should return -10 (minLeft) when charisma is at minimum', () => {
            const result = getCharismaLeft(minCharisma);
            expect(result).toBe(-10);
        });

        it('should return 90 (maxLeft) when charisma is at maximum', () => {
            const result = getCharismaLeft(maxCharisma);
            expect(result).toBe(90);
        });
    });

    describe('middle values', () => {
        it('should return 40 when charisma is at 0 (midpoint)', () => {
            const result = getCharismaLeft(0);
            expect(result).toBe(40);
        });

        it('should return 15 when charisma is at -5', () => {
            const result = getCharismaLeft(-5);
            expect(result).toBe(15);
        });

        it('should return 65 when charisma is at 5', () => {
            const result = getCharismaLeft(5);
            expect(result).toBe(65);
        });
    });

    describe('linear interpolation', () => {
        it('should scale linearly across the range', () => {
            // Each unit of charisma should move the position by 5 units
            // (100 total range / 20 charisma range = 5)
            const step = (90 - (-10)) / (maxCharisma - minCharisma);
            expect(step).toBe(5);

            expect(getCharismaLeft(-10)).toBe(-10);
            expect(getCharismaLeft(-9)).toBe(-5);
            expect(getCharismaLeft(-8)).toBe(0);
            expect(getCharismaLeft(-7)).toBe(5);
            // ... and so on
            expect(getCharismaLeft(9)).toBe(85);
            expect(getCharismaLeft(10)).toBe(90);
        });

        it('should maintain consistent differences between values', () => {
            const diff1 = getCharismaLeft(-5) - getCharismaLeft(-10);
            const diff2 = getCharismaLeft(0) - getCharismaLeft(-5);
            const diff3 = getCharismaLeft(5) - getCharismaLeft(0);
            const diff4 = getCharismaLeft(10) - getCharismaLeft(5);

            expect(diff1).toBe(25);
            expect(diff2).toBe(25);
            expect(diff3).toBe(25);
            expect(diff4).toBe(25);
        });
    });

    describe('decimal values', () => {
        it('should handle decimal charisma values', () => {
            const result = getCharismaLeft(2.5);
            expect(result).toBe(52.5);
        });

        it('should handle negative decimal values', () => {
            const result = getCharismaLeft(-7.5);
            expect(result).toBe(2.5);
        });

        it('should handle very precise decimals', () => {
            const result = getCharismaLeft(3.333);
            expect(result).toBeCloseTo(56.665, 2);
        });
    });

    describe('edge cases and out of bounds', () => {
        it('should handle values below minimum charisma', () => {
            const result = getCharismaLeft(-15);
            expect(result).toBe(-35);
        });

        it('should handle values above maximum charisma', () => {
            const result = getCharismaLeft(15);
            expect(result).toBe(115);
        });

        it('should handle zero charisma when min is negative', () => {
            const result = getCharismaLeft(0);
            expect(result).toBe(40);
        });
    });

    describe('formula verification', () => {
        it('should match the mathematical formula', () => {
            const charisma = 3;
            const minChar = GAMESTATE.CHARISMA.MIN;
            const maxChar = GAMESTATE.CHARISMA.MAX;
            const minLeft = -10;
            const maxLeft = 90;

            const expected = minLeft + ((charisma - minChar) / (maxChar - minChar)) * (maxLeft - minLeft);
            const result = getCharismaLeft(charisma);

            expect(result).toBe(expected);
        });

        it('should calculate percentage correctly', () => {
            // At charisma 0, we should be 50% through the range
            const midpoint = (maxCharisma + minCharisma) / 2;
            const result = getCharismaLeft(midpoint);
            const expectedMidpoint = (-10 + 90) / 2;

            expect(result).toBe(expectedMidpoint);
        });
    });

    describe('all integer values in range', () => {
        it('should produce expected outputs for all valid integer charisma values', () => {
            const expectedMapping = {
                '-10': -10,
                '-9': -5,
                '-8': 0,
                '-7': 5,
                '-6': 10,
                '-5': 15,
                '-4': 20,
                '-3': 25,
                '-2': 30,
                '-1': 35,
                '0': 40,
                '1': 45,
                '2': 50,
                '3': 55,
                '4': 60,
                '5': 65,
                '6': 70,
                '7': 75,
                '8': 80,
                '9': 85,
                '10': 90,
            };

            for (let charisma = minCharisma; charisma <= maxCharisma; charisma++) {
                const result = getCharismaLeft(charisma);
                const key = charisma.toString() as keyof typeof expectedMapping;
                expect(result).toBeCloseTo(expectedMapping[key]);
            }
        });
    });
});