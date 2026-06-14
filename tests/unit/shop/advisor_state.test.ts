/**
 * Story 5-10: Economy Advisor State & Shop Integration — unit tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../../../src/Stores/GameState';

vi.mock('../../../src/i18n', () => ({
    default: { t: (key: string) => key }
}));

import { vi } from 'vitest';

function startGame() {
    useGameStore.getState().gameManagement.setPhase('start', 'medium');
}

function setTreasury(amount: number) {
    useGameStore.setState(s => ({ budget: { ...s.budget, treasury: amount } }));
}

describe('advisorLevel — initial state', () => {
    beforeEach(() => startGame());

    it('test_advisor_initial_level_is_zero', () => {
        expect(useGameStore.getState().shop.advisorLevel).toBe(0);
    });

    it('test_advisor_resets_to_zero_on_new_game', () => {
        useGameStore.setState(s => ({ shop: { ...s.shop, advisorLevel: 2 } }));
        startGame();
        expect(useGameStore.getState().shop.advisorLevel).toBe(0);
    });
});

describe('advisorLevel — buying upgrades', () => {
    beforeEach(() => startGame());

    it('test_advisor_buy_level1_sets_level_and_deducts_treasury', () => {
        setTreasury(500);
        useGameStore.getState().shop.buy('advisor_1');
        expect(useGameStore.getState().shop.advisorLevel).toBe(1);
        expect(useGameStore.getState().budget.treasury).toBe(400);
    });

    it('test_advisor_buy_level2_sets_level_and_deducts_treasury', () => {
        setTreasury(500);
        useGameStore.getState().shop.buy('advisor_2');
        expect(useGameStore.getState().shop.advisorLevel).toBe(2);
        expect(useGameStore.getState().budget.treasury).toBe(350);
    });

    it('test_advisor_buy_level3_sets_level_and_deducts_treasury', () => {
        setTreasury(500);
        useGameStore.getState().shop.buy('advisor_3');
        expect(useGameStore.getState().shop.advisorLevel).toBe(3);
        expect(useGameStore.getState().budget.treasury).toBe(300);
    });

    it('test_advisor_cannot_downgrade_already_at_higher_level', () => {
        setTreasury(1000);
        useGameStore.getState().shop.buy('advisor_3');
        const treasuryBefore = useGameStore.getState().budget.treasury;
        useGameStore.getState().shop.buy('advisor_1');
        expect(useGameStore.getState().shop.advisorLevel).toBe(3);
        expect(useGameStore.getState().budget.treasury).toBe(treasuryBefore);
    });

    it('test_advisor_buy_blocked_when_insufficient_treasury', () => {
        setTreasury(50);
        useGameStore.getState().shop.buy('advisor_1');
        expect(useGameStore.getState().shop.advisorLevel).toBe(0);
        expect(useGameStore.getState().budget.treasury).toBe(50);
    });

    it('test_advisor_buy_exact_cost_succeeds', () => {
        setTreasury(100);
        useGameStore.getState().shop.buy('advisor_1');
        expect(useGameStore.getState().shop.advisorLevel).toBe(1);
        expect(useGameStore.getState().budget.treasury).toBe(0);
    });
});

describe('advisorLevel — loadGame fallback', () => {
    beforeEach(() => startGame());

    it('test_advisor_load_saves_with_advisor_level', () => {
        const savedData = {
            gameManagement: { round: 3, phase: 'start', difficulty: 'medium', charisma: { current: 0 }, activeRecurringEffects: [], meetCounts: { military: 0, business: 0, people: 0 } },
            budget: { treasury: 300, expenditures: { health: 5, infrastructure: 5, security: 5, education: 5 }, taxes: { peopleTaxes: 30, businessTaxes: 40 } },
            relations: { current: { military: 0, business: 0, people: 0 } },
            meet: {},
            shop: { statueCount: 0, frozenFactions: [], advisorLevel: 2 },
            stats: {},
        };
        useGameStore.getState().gameManagement.loadGame(savedData as Record<string, unknown>);
        expect(useGameStore.getState().shop.advisorLevel).toBe(2);
    });

    it('test_advisor_load_old_save_defaults_to_zero', () => {
        const savedData = {
            gameManagement: { round: 3, phase: 'start', difficulty: 'medium', charisma: { current: 0 }, activeRecurringEffects: [], meetCounts: { military: 0, business: 0, people: 0 } },
            budget: { treasury: 300, expenditures: { health: 5, infrastructure: 5, security: 5, education: 5 }, taxes: { peopleTaxes: 30, businessTaxes: 40 } },
            relations: { current: { military: 0, business: 0, people: 0 } },
            meet: {},
            shop: { statueCount: 0, frozenFactions: [] },
            stats: {},
        };
        useGameStore.getState().gameManagement.loadGame(savedData as Record<string, unknown>);
        expect(useGameStore.getState().shop.advisorLevel).toBe(0);
    });
});
