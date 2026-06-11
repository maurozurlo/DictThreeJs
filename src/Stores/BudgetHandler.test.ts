import { describe, it, expect, vi } from 'vitest';
import { calculateRoundFinancials, handleBudgetChange } from './BudgetHandler';
import { GAMESTATE } from '../Constants/GameState';
import type { GameState } from '../types/GameState';

describe('handleBudgetChange', () => {
    const mockBudget: GameState['budget'] = {
        treasury: 100,
        expenditures: {
            health: 5,
            infrastructure: 3,
            security: 7,
            education: 2,
        },
        taxes: {
            peopleTaxes: 20,
            businessTaxes: 30,
        },
    } as unknown as GameState['budget'];

    describe('expenditures', () => {
        it('should increase expenditure value within bounds', () => {
            const result = handleBudgetChange({
                budget: mockBudget,
                id: 'health',
                amount: 2,
            });

            expect(result.expenditures.health).toBe(7);
            expect(result.taxes).toEqual(mockBudget.taxes);
        });

        it('should decrease expenditure value within bounds', () => {
            const result = handleBudgetChange({
                budget: mockBudget,
                id: 'security',
                amount: -3,
            });

            expect(result.expenditures.security).toBe(4);
            expect(result.taxes).toEqual(mockBudget.taxes);
        });

        it('should clamp expenditure to MAX when exceeding upper bound', () => {
            const result = handleBudgetChange({
                budget: mockBudget,
                id: 'health',
                amount: 100,
            });

            expect(result.expenditures.health).toBe(GAMESTATE.BUDGET.BOUNDS.EXPENDITURE.MAX);
        });

        it('should clamp expenditure to MIN when exceeding lower bound', () => {
            const result = handleBudgetChange({
                budget: mockBudget,
                id: 'education',
                amount: -100,
            });

            expect(result.expenditures.education).toBe(GAMESTATE.BUDGET.BOUNDS.EXPENDITURE.MIN);
        });

        it('should not modify other expenditures', () => {
            const result = handleBudgetChange({
                budget: mockBudget,
                id: 'health',
                amount: 1,
            });

            expect(result.expenditures.infrastructure).toBe(mockBudget.expenditures.infrastructure);
            expect(result.expenditures.security).toBe(mockBudget.expenditures.security);
            expect(result.expenditures.education).toBe(mockBudget.expenditures.education);
        });
    });

    describe('taxes', () => {
        it('should increase tax value within bounds', () => {
            const result = handleBudgetChange({
                budget: mockBudget,
                id: 'peopleTaxes',
                amount: 5,
            });

            expect(result.taxes.peopleTaxes).toBe(25);
            expect(result.expenditures).toEqual(mockBudget.expenditures);
        });

        it('should decrease tax value within bounds', () => {
            const result = handleBudgetChange({
                budget: mockBudget,
                id: 'businessTaxes',
                amount: -10,
            });

            expect(result.taxes.businessTaxes).toBe(20);
            expect(result.expenditures).toEqual(mockBudget.expenditures);
        });

        it('should clamp tax to MAX when exceeding upper bound', () => {
            const result = handleBudgetChange({
                budget: mockBudget,
                id: 'peopleTaxes',
                amount: 100,
            });

            expect(result.taxes.peopleTaxes).toBe(GAMESTATE.BUDGET.BOUNDS.TAX.MAX);
        });

        it('should clamp tax to MIN when exceeding lower bound', () => {
            const result = handleBudgetChange({
                budget: mockBudget,
                id: 'businessTaxes',
                amount: -100,
            });

            expect(result.taxes.businessTaxes).toBe(GAMESTATE.BUDGET.BOUNDS.TAX.MIN);
        });

        it('should not modify other taxes', () => {
            const result = handleBudgetChange({
                budget: mockBudget,
                id: 'peopleTaxes',
                amount: 1,
            });

            expect(result.taxes.businessTaxes).toBe(mockBudget.taxes.businessTaxes);
        });
    });

    describe('edge cases', () => {
        it('should handle zero amount change', () => {
            const result = handleBudgetChange({
                budget: mockBudget,
                id: 'health',
                amount: 0,
            });

            expect(result.expenditures.health).toBe(mockBudget.expenditures.health);
        });

        it('should return unchanged budget for unknown id', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            const result = handleBudgetChange({
                budget: mockBudget,
                id: 'unknownId' as any,
                amount: 5,
            });

            expect(result.taxes).toEqual(mockBudget.taxes);
            expect(result.expenditures).toEqual(mockBudget.expenditures);
            expect(consoleSpy).toHaveBeenCalledWith('Unknown id for budget', 'unknownId');

            consoleSpy.mockRestore();
        });
    });

    describe('immutability', () => {
        it('should not mutate original budget', () => {
            const originalBudget = JSON.parse(JSON.stringify(mockBudget));

            handleBudgetChange({
                budget: mockBudget,
                id: 'health',
                amount: 3,
            });

            expect(mockBudget).toEqual(originalBudget);
        });
    });
});

describe('calculateRoundFinancials — income modifiers', () => {
    /** Factory: neutral budget (no modifier thresholds hit) with overridable expenditures. */
    const makeBudget = (overrides: Partial<Record<'health' | 'infrastructure' | 'security' | 'education', number>> = {}): GameState['budget'] => ({
        treasury: 500,
        expenditures: { health: 5, infrastructure: 5, security: 5, education: 5, ...overrides },
        taxes: { peopleTaxes: 20, businessTaxes: 30 },
    } as unknown as GameState['budget']);

    // With PEOPLE_BASE 200 / BUSINESS_BASE 180 and taxes 20/30:
    // peopleIncome = floor(200 * 0.20) = 40, businessIncome = floor(180 * 0.30) = 54
    const baseline = () => calculateRoundFinancials(makeBudget());

    it('neutral budget applies no business income modifiers', () => {
        const result = baseline();

        expect(result.peopleIncome).toBe(40);
        expect(result.businessIncome).toBe(54);
        expect(result.totalIncome).toBe(94);
        expect(result.expenses).toBe(200); // (5+5+5+5) × 10
        expect(result.netChange).toBe(-106);
    });

    it('low infrastructure (<3) reduces business income by 30%', () => {
        const result = calculateRoundFinancials(makeBudget({ infrastructure: 2 }));

        expect(result.businessIncome).toBe(Math.floor(baseline().businessIncome * 0.7)); // 37
        expect(result.peopleIncome).toBe(baseline().peopleIncome); // unaffected
    });

    it('high infrastructure (>7) boosts business income by 10%', () => {
        const result = calculateRoundFinancials(makeBudget({ infrastructure: 8 }));

        expect(result.businessIncome).toBe(Math.floor(baseline().businessIncome * 1.1)); // 59
    });

    it('low education (<3) reduces business income by 15%', () => {
        const result = calculateRoundFinancials(makeBudget({ education: 2 }));

        expect(result.businessIncome).toBe(Math.floor(baseline().businessIncome * 0.85)); // 45
    });

    it('low infrastructure and low education modifiers compound', () => {
        const result = calculateRoundFinancials(makeBudget({ infrastructure: 2, education: 2 }));

        const afterInfra = Math.floor(baseline().businessIncome * 0.7); // 37
        expect(result.businessIncome).toBe(Math.floor(afterInfra * 0.85)); // 31
    });
});