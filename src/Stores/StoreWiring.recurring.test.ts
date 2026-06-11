import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGameStore } from './GameState';
import type { ActiveRecurringEffect } from '../types/GameState';
import type { Law } from '../types/Law';

/**
 * Story 2-3: Store wiring integration tests — recurring effect lifecycle.
 *
 * Exercises the REAL Zustand store: activation via actUponLaw/actUponDeal,
 * round resolution via nextRound, reset via setPhase('start'), and the
 * loadGame whitelist (save/load round-trip).
 */

// i18n is initialised with an http backend — return keys verbatim in node
vi.mock('../i18n', () => ({
    default: { t: (key: string) => key }
}));

/** Factory: a law carrying a recurring income effect. */
function makeRecurringLaw(overrides: Partial<Law> = {}): Law {
    return {
        id: 9001,
        power: 'business',
        acceptEffect: { business: 1 },
        rejectEffect: {},
        recurringEffect: { incomeBonus: 25, label: 'laws.recurring.test_income' },
        ...overrides,
    };
}

/** Seeds the store with a law as current and undecided, then decides it. */
function decideLaw(law: Law, accept: boolean): void {
    useGameStore.setState((s) => ({
        law: { ...s.law, current: law, lawDecided: false },
    }));
    useGameStore.getState().law.actUponLaw(accept);
}

/** Reads the active effects from the live store. */
function activeEffects(): ActiveRecurringEffect[] {
    return useGameStore.getState().gameManagement.activeRecurringEffects;
}

describe('recurring effect store wiring', () => {
    beforeEach(() => {
        // Full game reset before each test — also verifies the reset path repeatedly
        useGameStore.getState().gameManagement.setPhase('start');
    });

    describe('activation (AC-1, AC-2)', () => {
        it('accepting a law with recurringEffect adds exactly one entry', () => {
            decideLaw(makeRecurringLaw(), true);

            const effects = activeEffects();
            expect(effects).toHaveLength(1);
            expect(effects[0]).toMatchObject({
                sourceId: 'law-9001',
                sourceType: 'law',
                sourceFaction: 'business',
                label: 'laws.recurring.test_income',
                incomeBonus: 25,
                expenseBonus: 0,
            });
        });

        it('accepting the same law twice does not duplicate the entry (pool reset dedup)', () => {
            const law = makeRecurringLaw();
            decideLaw(law, true);
            decideLaw(law, true);

            expect(activeEffects()).toHaveLength(1);
        });

        it('rejecting a law never activates its effect', () => {
            decideLaw(makeRecurringLaw(), false);

            expect(activeEffects()).toHaveLength(0);
        });

        it('accepting a law without recurringEffect adds nothing', () => {
            decideLaw(makeRecurringLaw({ recurringEffect: undefined }), true);

            expect(activeEffects()).toHaveLength(0);
        });

        it('accepting a deal with recurringEffect adds an entry with sourceType deal', () => {
            useGameStore.setState((s) => ({
                deals: {
                    ...s.deals,
                    current: {
                        id: 9002,
                        text: 'test',
                        acceptText: 'ok',
                        rejectText: 'no',
                        acceptEffect: { treasury: 40 },
                        rejectEffect: {},
                        power: 'military',
                        recurringEffect: { expenseBonus: 15, label: 'deals.recurring.test_expense' },
                    },
                    dealDecided: false,
                },
            }));
            useGameStore.getState().deals.actUponDeal(true);

            const effects = activeEffects();
            expect(effects).toHaveLength(1);
            expect(effects[0]).toMatchObject({
                sourceId: 'deal-9002',
                sourceType: 'deal',
                sourceFaction: 'military',
                incomeBonus: 0,
                expenseBonus: 15,
            });
        });
    });

    describe('round resolution (AC-3, AC-4, AC-5)', () => {
        it('nextRound applies recurring income to the treasury', () => {
            decideLaw(makeRecurringLaw(), true);
            const treasuryBefore = useGameStore.getState().budget.treasury;

            useGameStore.getState().gameManagement.nextRound();

            const state = useGameStore.getState();
            const expectedNet =
                state.gameManagement.lastRoundIncome
                + state.gameManagement.lastRoundRecurringIncome
                - state.gameManagement.lastRoundExpenses
                - state.gameManagement.lastRoundRecurringExpenses;
            expect(state.budget.treasury).toBe(treasuryBefore + expectedNet);
            expect(state.gameManagement.lastRoundRecurringIncome).toBe(25);
            expect(state.gameManagement.lastRoundRecurringExpenses).toBe(0);
        });

        it('nextRound treasury delta differs by exactly the recurring amount', () => {
            // Baseline round without effects
            const baselineBefore = useGameStore.getState().budget.treasury;
            useGameStore.getState().gameManagement.nextRound();
            const baselineDelta = useGameStore.getState().budget.treasury - baselineBefore;

            // Fresh game with one +25 income law active
            useGameStore.getState().gameManagement.setPhase('start');
            decideLaw(makeRecurringLaw(), true);
            const before = useGameStore.getState().budget.treasury;
            useGameStore.getState().gameManagement.nextRound();
            const delta = useGameStore.getState().budget.treasury - before;

            expect(delta).toBe(baselineDelta + 25);
        });

        it('nextRound resets repealTakenThisRound', () => {
            useGameStore.setState((s) => ({
                gameManagement: { ...s.gameManagement, repealTakenThisRound: true },
            }));

            useGameStore.getState().gameManagement.nextRound();

            expect(useGameStore.getState().gameManagement.repealTakenThisRound).toBe(false);
        });

        it('effects persist across rounds (not cleared by nextRound)', () => {
            decideLaw(makeRecurringLaw(), true);

            useGameStore.getState().gameManagement.nextRound();
            useGameStore.getState().gameManagement.nextRound();

            expect(activeEffects()).toHaveLength(1);
        });
    });

    describe('reset (AC-6)', () => {
        it('setPhase(start) clears all recurring state', () => {
            decideLaw(makeRecurringLaw(), true);
            useGameStore.setState((s) => ({
                gameManagement: {
                    ...s.gameManagement,
                    repealTakenThisRound: true,
                    lastRoundRecurringIncome: 25,
                    lastRoundRecurringExpenses: 15,
                },
            }));

            useGameStore.getState().gameManagement.setPhase('start');

            const gm = useGameStore.getState().gameManagement;
            expect(gm.activeRecurringEffects).toHaveLength(0);
            expect(gm.repealTakenThisRound).toBe(false);
            expect(gm.lastRoundRecurringIncome).toBe(0);
            expect(gm.lastRoundRecurringExpenses).toBe(0);
        });
    });

    describe('save/load (AC-7)', () => {
        it('loadGame restores activeRecurringEffects from save data', () => {
            const savedEffect: ActiveRecurringEffect = {
                sourceId: 'law-9001',
                sourceType: 'law',
                sourceFaction: 'business',
                label: 'laws.recurring.test_income',
                incomeBonus: 25,
                expenseBonus: 0,
                roundActivated: 2,
            };

            useGameStore.getState().gameManagement.loadGame({
                gameManagement: {
                    round: 3,
                    phase: 'start',
                    activeRecurringEffects: [savedEffect],
                    repealTakenThisRound: true,
                    lastRoundRecurringIncome: 25,
                    lastRoundRecurringExpenses: 0,
                },
            });

            const gm = useGameStore.getState().gameManagement;
            expect(gm.activeRecurringEffects).toEqual([savedEffect]);
            expect(gm.repealTakenThisRound).toBe(true);
            expect(gm.lastRoundRecurringIncome).toBe(25);
        });

        it('loadGame defaults recurring fields for saves predating sprint 2', () => {
            // Seed non-default values, then load an old save without the fields
            decideLaw(makeRecurringLaw(), true);

            useGameStore.getState().gameManagement.loadGame({
                gameManagement: { round: 5, phase: 'start' },
            });

            const gm = useGameStore.getState().gameManagement;
            expect(gm.activeRecurringEffects).toEqual([]);
            expect(gm.repealTakenThisRound).toBe(false);
            expect(gm.lastRoundRecurringIncome).toBe(0);
            expect(gm.lastRoundRecurringExpenses).toBe(0);
        });
    });
});
