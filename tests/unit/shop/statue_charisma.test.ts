/**
 * Statue charisma modifier — regression tests.
 *
 * Bug: buying a Giant Statue gave a one-time +1 to BASE charisma that was then
 * eroded by tax corrosion / the idle-timer penalty, contradicting the shop
 * description ("Permanently increases your Charisma by +1").
 *
 * Fix: a statue is a persistent modifier. Base charisma still fluctuates with
 * gameplay, but the statue's +1 is added on top in real time via
 * getEffectiveCharisma — so it can never be eroded.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../../src/i18n', () => ({
    default: { t: (key: string) => key }
}));

import { useGameStore } from '../../../src/Stores/GameState';
import { getEffectiveCharisma } from '../../../src/Utils/Modifiers';
import { GAMESTATE } from '../../../src/Constants/GameState';

function startGame() {
    useGameStore.getState().gameManagement.setPhase('start', 'medium');
}
function setTreasury(amount: number) {
    useGameStore.setState(s => ({ budget: { ...s.budget, treasury: amount } }));
}
function base() {
    return useGameStore.getState().gameManagement.charisma.current;
}
function effective() {
    const s = useGameStore.getState();
    return getEffectiveCharisma(s.gameManagement.charisma.current, s.gameManagement.modifiers);
}

describe('statue modifier — purchase', () => {
    beforeEach(() => startGame());

    it('test_statue_buy_adds_modifier_not_base_charisma', () => {
        // Arrange
        setTreasury(500);
        const baseBefore = base();
        // Act
        useGameStore.getState().shop.buy('statue');
        // Assert: base untouched, modifier added, effective +1
        expect(base()).toBe(baseBefore);
        expect(useGameStore.getState().gameManagement.modifiers).toEqual([
            { type: 'statue', mods: [{ stat: 'charisma', amount: 1 }] },
        ]);
        expect(effective()).toBe(baseBefore + 1);
    });

    it('test_two_statues_add_two_effective_charisma', () => {
        setTreasury(1000);
        useGameStore.getState().shop.buy('statue');
        useGameStore.getState().shop.buy('statue');
        expect(useGameStore.getState().gameManagement.modifiers.length).toBe(2);
        expect(effective()).toBe(base() + 2);
    });
});

describe('statue modifier — persistence through erosion', () => {
    beforeEach(() => startGame());

    it('test_statue_charisma_not_lost_when_base_eroded', () => {
        // Arrange: own a statue
        setTreasury(500);
        useGameStore.getState().shop.buy('statue');
        // Act: erode base charisma to its floor (the original bug path)
        useGameStore.getState().gameManagement.charisma.adjustCharisma(-10);
        // Assert: base bottoms out, but the statue's +1 is still contributed
        expect(base()).toBe(GAMESTATE.CHARISMA.MIN);
        expect(effective()).toBe(GAMESTATE.CHARISMA.MIN + 1);
    });

    it('test_effective_charisma_clamped_at_max', () => {
        setTreasury(500);
        useGameStore.getState().shop.buy('statue');
        useGameStore.getState().gameManagement.charisma.adjustCharisma(100); // base -> MAX
        expect(base()).toBe(GAMESTATE.CHARISMA.MAX);
        expect(effective()).toBe(GAMESTATE.CHARISMA.MAX); // +1 modifier clamped at ceiling
    });

    it('test_no_modifier_means_effective_equals_base', () => {
        useGameStore.getState().gameManagement.charisma.adjustCharisma(-3);
        expect(effective()).toBe(base());
        expect(effective()).toBe(-3);
    });
});

describe('statue modifier — lifecycle', () => {
    it('test_modifiers_reset_on_new_game', () => {
        startGame();
        setTreasury(500);
        useGameStore.getState().shop.buy('statue');
        expect(useGameStore.getState().gameManagement.modifiers.length).toBe(1);
        startGame();
        expect(useGameStore.getState().gameManagement.modifiers).toEqual([]);
    });
});
