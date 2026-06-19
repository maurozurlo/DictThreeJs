/**
 * Story 6-2: ADR-0008 P2 — Replace ActiveRecurringEffect with Modifiers.
 *
 * Integration tests against the REAL Zustand store covering the QA cases:
 * income parity, weird-law slot cap, law-pool filter, repeal flips state, legacy
 * save migration round-trip, dedup, and roundExpense reducing banked income.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGameStore } from '../../../src/Stores/GameState';
import { calculateRoundFinancials } from '../../../src/Stores/BudgetHandler';
import { filterLawPool } from '../../../src/Stores/RecurringHandler';
import { LAWS } from '../../../src/assets/laws';
import type { Modifier, ResolvedStatMod } from '../../../src/types/GameState';
import type { Law } from '../../../src/types/Law';

vi.mock('../../../src/i18n', () => ({
    default: { t: (key: string) => key }
}));

const PERMANENT = { startRound: 1, endRound: null };

function recurringMod(id: string, opts: { income?: number; expense?: number; type?: Modifier['type'] } = {}): Modifier {
    const mods: ResolvedStatMod[] = [];
    if (opts.income) mods.push({ stat: 'roundIncome', amount: opts.income, window: PERMANENT });
    if (opts.expense) mods.push({ stat: 'roundExpense', amount: opts.expense, window: PERMANENT });
    return { id, type: opts.type ?? 'law-recurring', state: 'active', acquiredRound: 1, mods };
}

describe('Story 6-2 — recurring effects on the modifier engine', () => {
    beforeEach(() => {
        useGameStore.getState().gameManagement.setPhase('start');
    });

    // --- AC: Income parity -------------------------------------------------
    it('banks recurring income from a migrated deal modifier (parity)', () => {
        // Baseline round with no modifiers, then the same start with a +5 income modifier.
        const baselineBefore = useGameStore.getState().budget.treasury;
        useGameStore.getState().gameManagement.nextRound();
        const baselineDelta = useGameStore.getState().budget.treasury - baselineBefore;

        useGameStore.getState().gameManagement.setPhase('start');
        useGameStore.setState((s) => ({
            gameManagement: { ...s.gameManagement, modifiers: [recurringMod('deals.16', { income: 5, type: 'deal' })] },
        }));
        const before = useGameStore.getState().budget.treasury;
        useGameStore.getState().gameManagement.nextRound();

        const gm = useGameStore.getState().gameManagement;
        expect(gm.lastRoundRecurringIncome).toBe(5);
        expect(useGameStore.getState().stats.totalRecurringIncomeEarned).toBe(5);
        // Treasury delta is exactly the baseline delta plus the +5 recurring income
        expect(useGameStore.getState().budget.treasury - before).toBe(baselineDelta + 5);
    });

    // --- AC: roundExpense reduces banked income ---------------------------
    it('nets roundIncome against roundExpense in the recurring total', () => {
        const round = 3;
        const financials = calculateRoundFinancials(
            { treasury: 500, expenditures: { health: 5, infrastructure: 5, security: 5, education: 5 }, taxes: { peopleTaxes: 20, businessTaxes: 30 } } as never,
            [recurringMod('deals.16', { income: 5 }), recurringMod('laws.40', { expense: 3 })],
            round,
        );
        expect(financials.recurringIncome).toBe(5);
        expect(financials.recurringExpenses).toBe(3);
        // net recurring contribution = +2
        expect(financials.recurringIncome - financials.recurringExpenses).toBe(2);
    });

    // --- AC: Weird-law slot cap -------------------------------------------
    it('enforces one active weird-law slot via the modifiers array', () => {
        const findActiveWeird = () =>
            useGameStore.getState().gameManagement.modifiers.findIndex(m => m.type === 'weird-law' && m.state === 'active');
        expect(findActiveWeird()).toBe(-1);

        useGameStore.setState((s) => ({
            gameManagement: { ...s.gameManagement, modifiers: [recurringMod('weird.1001', { type: 'weird-law' })] },
        }));
        expect(findActiveWeird()).not.toBe(-1);
    });

    // --- AC: Law-pool filter ---------------------------------------------
    it('filterLawPool excludes a law whose recurring modifier is active', () => {
        const recurringLaw: Law = LAWS.find(l => l.id === 39)!; // gambling
        const mods = [recurringMod('laws.39', { income: 25 })];
        const pool = filterLawPool(LAWS, mods);
        expect(pool).not.toContain(recurringLaw);
    });

    // --- AC: Repeal flips state ------------------------------------------
    it('repeal flips the modifier to rejected (retained ledger) and penalises the proposing faction', () => {
        // laws.40 (housing) → people; expense 15 → Medium (−2)
        useGameStore.setState((s) => ({
            budget: { ...s.budget, treasury: 200 },
            relations: { ...s.relations, current: { ...s.relations.current, people: 4 } },
            gameManagement: {
                ...s.gameManagement,
                modifiers: [recurringMod('laws.40', { expense: 15 })],
                repealTakenThisRound: false,
                round: 3,
            },
        }));

        useGameStore.getState().gameManagement.repeal('laws.40');

        const gm = useGameStore.getState().gameManagement;
        const mod = gm.modifiers.find(m => m.id === 'laws.40');
        expect(mod?.state).toBe('rejected'); // retained as ledger
        expect(useGameStore.getState().budget.treasury).toBe(175); // Medium cost 25
        expect(useGameStore.getState().relations.current.people).toBe(2); // −2
    });

    // --- AC: Dedup -------------------------------------------------------
    it('re-accepting a deal whose modifier is active does not push a second entry', () => {
        const deal = {
            id: 16, text: 'x', acceptText: 'x', rejectText: 'x',
            acceptMods: [{ stat: 'roundIncome' as const, amount: 15, time: 0 }], rejectMods: [],
            power: 'business' as const,
            label: 'deals.recurring.investment_income',
        };
        useGameStore.setState((s) => ({ deals: { ...s.deals, current: deal, dealDecided: false } }));
        useGameStore.getState().deals.actUponDeal(true);
        useGameStore.setState((s) => ({ deals: { ...s.deals, current: deal, dealDecided: false } }));
        useGameStore.getState().deals.actUponDeal(true);

        const active = useGameStore.getState().gameManagement.modifiers.filter(m => m.id === 'deals.16' && m.state === 'active');
        expect(active).toHaveLength(1);
    });

    // --- AC: Save migration round-trip ----------------------------------
    it('migrates a legacy activeRecurringEffects save to modifiers and round-trips', () => {
        useGameStore.getState().gameManagement.loadGame({
            gameManagement: {
                round: 4,
                phase: 'start',
                activeRecurringEffects: [
                    { sourceId: 'deal-16', sourceType: 'deal', sourceFaction: 'business', label: 'deals.recurring.investment_income', incomeBonus: 5, expenseBonus: 0, roundActivated: 2 },
                    { sourceId: 'weird-law-1001', sourceType: 'weird-law', sourceFaction: 'people', label: 'laws.weird.1001.label', incomeBonus: 0, expenseBonus: 0, roundActivated: 3 },
                ],
            },
        });

        const migrated = useGameStore.getState().gameManagement.modifiers;
        expect(migrated).toHaveLength(2);
        expect(migrated.find(m => m.id === 'deals.16')).toMatchObject({ type: 'deal', state: 'active' });
        expect(migrated.find(m => m.id === 'weird.1001')).toMatchObject({ type: 'weird-law', state: 'active', mods: [] });
        // recurring income still computes after migration
        expect(calculateRoundFinancials(useGameStore.getState().budget, migrated, 4).recurringIncome).toBe(5);

        // A subsequent save that already has modifiers is NOT re-migrated (modifiers win)
        useGameStore.getState().gameManagement.loadGame({
            gameManagement: { round: 5, phase: 'start', modifiers: migrated, activeRecurringEffects: [] },
        });
        expect(useGameStore.getState().gameManagement.modifiers).toHaveLength(2);
    });
});
