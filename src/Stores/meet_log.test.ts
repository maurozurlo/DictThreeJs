import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGameStore } from './GameState';

// i18n http backend → return keys verbatim in node.
vi.mock('../i18n', () => ({ default: { t: (key: string) => key } }));

/**
 * Meeting log capture (ADR-0011): the meet event uses the result text as its
 * headline (so the outcome — including charisma-less / zero-delta cases — is always
 * explained) and carries the charisma delta the meet result texts omit.
 */
describe('meeting log capture', () => {
    beforeEach(() => {
        useGameStore.getState().gameManagement.setPhase('start');
    });

    const lastEvent = () => useGameStore.getState().gameManagement.pendingLog.at(-1)!;

    it('bribe logs its result text as the headline with the faction ref', () => {
        useGameStore.getState().meet.takeAction('military', 'bribe');
        const ev = lastEvent();
        expect(ev.key).toBe('bribe_success');
        expect(ev.keyNs).toBe('meet');
        expect(ev.refParams?.power).toBe('power.military');
        expect(ev.params?.cost).toBeTypeOf('number');
        // Bribe costs no charisma → no effects line.
        expect(ev.deltas).toBeUndefined();
    });

    it('eliminate records the charisma cost on the effects line', () => {
        useGameStore.getState().meet.takeAction('business', 'eliminate');
        const ev = lastEvent();
        expect(ev.keyNs).toBe('meet');
        expect(ev.key).toMatch(/^eliminate_/);
        expect(ev.deltas).toEqual({ charisma: -2 });
    });
});
