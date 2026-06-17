import { describe, it, expect, vi } from 'vitest';
import { Clamp, getRandomNumberInRange, getRandomUniqueItem, getRandomFromList, seedRng } from './Math';

describe('Math utilities', () => {
    describe('Clamp', () => {
        it('should return value when within range', () => {
            expect(Clamp(5, 0, 10)).toBe(5);
            expect(Clamp(0, -10, 10)).toBe(0);
            expect(Clamp(-5, -10, 10)).toBe(-5);
        });

        it('should clamp to min when value is below minimum', () => {
            expect(Clamp(-5, 0, 10)).toBe(0);
            expect(Clamp(-100, -10, 10)).toBe(-10);
            expect(Clamp(0, 1, 10)).toBe(1);
        });

        it('should clamp to max when value exceeds maximum', () => {
            expect(Clamp(15, 0, 10)).toBe(10);
            expect(Clamp(100, -10, 10)).toBe(10);
            expect(Clamp(50, 1, 10)).toBe(10);
        });

        it('should handle edge case when value equals min', () => {
            expect(Clamp(0, 0, 10)).toBe(0);
            expect(Clamp(-10, -10, 10)).toBe(-10);
        });

        it('should handle edge case when value equals max', () => {
            expect(Clamp(10, 0, 10)).toBe(10);
            expect(Clamp(100, 0, 100)).toBe(100);
        });

        it('should handle min equals max', () => {
            expect(Clamp(5, 10, 10)).toBe(10);
            expect(Clamp(15, 10, 10)).toBe(10);
            expect(Clamp(10, 10, 10)).toBe(10);
        });

        it('should handle negative ranges', () => {
            expect(Clamp(-5, -10, -1)).toBe(-5);
            expect(Clamp(-15, -10, -1)).toBe(-10);
            expect(Clamp(0, -10, -1)).toBe(-1);
        });

        it('should handle decimal values', () => {
            expect(Clamp(5.5, 0, 10)).toBe(5.5);
            expect(Clamp(-0.5, 0, 10)).toBe(0);
            expect(Clamp(10.5, 0, 10)).toBe(10);
        });
    });

    describe('getRandomNumberInRange', () => {
        it('should return number within range', () => {
            for (let i = 0; i < 100; i++) {
                const result = getRandomNumberInRange(1, 10);
                expect(result).toBeGreaterThanOrEqual(1);
                expect(result).toBeLessThanOrEqual(10);
            }
        });

        it('should return integer values only', () => {
            for (let i = 0; i < 50; i++) {
                const result = getRandomNumberInRange(1, 100);
                expect(Number.isInteger(result)).toBe(true);
            }
        });

        it('should handle single value range', () => {
            const result = getRandomNumberInRange(5, 5);
            expect(result).toBe(5);
        });

        it('should handle negative ranges', () => {
            for (let i = 0; i < 50; i++) {
                const result = getRandomNumberInRange(-10, -1);
                expect(result).toBeGreaterThanOrEqual(-10);
                expect(result).toBeLessThanOrEqual(-1);
            }
        });

        it('should include both min and max in possible results', () => {
            // Seeded stream (ADR-0010): both endpoints must be reachable and no draw
            // may fall outside [min, max]. Deterministic given the fixed seed.
            seedRng(12345);
            const seen = new Set<number>();
            for (let i = 0; i < 2000; i++) {
                const v = getRandomNumberInRange(1, 10);
                expect(v).toBeGreaterThanOrEqual(1);
                expect(v).toBeLessThanOrEqual(10);
                seen.add(v);
            }
            expect(seen.has(1)).toBe(true);
            expect(seen.has(10)).toBe(true);
        });
    });

    describe('getRandomUniqueItem', () => {
        it('should return item from list when nothing is used', () => {
            const list = ['a', 'b', 'c'];
            const used = new Set<string>();
            const result = getRandomUniqueItem(list, used);

            expect(list).toContain(result);
        });

        it('should not return used items', () => {
            const list = ['a', 'b', 'c', 'd'];
            const used = new Set(['a', 'b']);

            for (let i = 0; i < 20; i++) {
                const result = getRandomUniqueItem(list, used);
                expect(result).not.toBe('a');
                expect(result).not.toBe('b');
                expect(['c', 'd']).toContain(result);
            }
        });

        it('should return null for empty list', () => {
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
            const result = getRandomUniqueItem([], new Set());

            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith('⚠️ getRandomUniqueItem: list is empty.');

            consoleSpy.mockRestore();
        });

        it('should return null when all items are used', () => {
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
            const list = ['a', 'b', 'c'];
            const used = new Set(['a', 'b', 'c']);
            const result = getRandomUniqueItem(list, used);

            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith('⚠️ getRandomUniqueItem: all items have already been used.');

            consoleSpy.mockRestore();
        });

        it('should return last remaining item', () => {
            const list = ['a', 'b', 'c'];
            const used = new Set(['a', 'b']);
            const result = getRandomUniqueItem(list, used);

            expect(result).toBe('c');
        });

        it('should work with different data types', () => {
            const numbers = [1, 2, 3, 4, 5];
            const used = new Set([1, 2]);
            const result = getRandomUniqueItem(numbers, used);

            expect([3, 4, 5]).toContain(result);
        });

        it('should handle objects in list', () => {
            const obj1 = { id: 1 };
            const obj2 = { id: 2 };
            const obj3 = { id: 3 };
            const list = [obj1, obj2, obj3];
            const used = new Set([obj1]);
            const result = getRandomUniqueItem(list, used);

            expect([obj2, obj3]).toContain(result);
        });

        it('should not modify the original list or used set', () => {
            const list = ['a', 'b', 'c'];
            const used = new Set(['a']);
            const originalList = [...list];
            const originalUsed = new Set(used);

            getRandomUniqueItem(list, used);

            expect(list).toEqual(originalList);
            expect(used).toEqual(originalUsed);
        });
    });

    describe('getRandomFromList', () => {
        it('should return item from list', () => {
            const list = ['a', 'b', 'c'];
            const result = getRandomFromList(list);

            expect(list).toContain(result);
        });

        it('should throw error for empty list', () => {
            expect(() => getRandomFromList([])).toThrow('getRandomFromList: list is empty.');
        });

        it('should return only item for single-item list', () => {
            const result = getRandomFromList(['only']);
            expect(result).toBe('only');
        });

        it('should work with different data types', () => {
            const numbers = [1, 2, 3, 4, 5];
            const result = getRandomFromList(numbers);

            expect(numbers).toContain(result);
            expect(typeof result).toBe('number');
        });

        it('should work with objects', () => {
            const obj1 = { id: 1 };
            const obj2 = { id: 2 };
            const list = [obj1, obj2];
            const result = getRandomFromList(list);

            expect([obj1, obj2]).toContain(result);
        });

        it('should potentially return any item over multiple calls', () => {
            const list = ['a', 'b', 'c', 'd', 'e'];
            const results = new Set<string>();

            // Run enough times to likely get all items
            for (let i = 0; i < 100; i++) {
                results.add(getRandomFromList(list));
            }

            // Should have gotten multiple different items
            expect(results.size).toBeGreaterThan(1);
        });

        it('should not modify the original list', () => {
            const list = ['a', 'b', 'c'];
            const originalList = [...list];

            getRandomFromList(list);

            expect(list).toEqual(originalList);
        });

        it('should handle list with duplicate values', () => {
            const list = ['a', 'a', 'b'];
            const result = getRandomFromList(list);

            expect(['a', 'b']).toContain(result);
        });
    });
});