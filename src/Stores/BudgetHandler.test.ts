import { describe, it, expect, vi } from 'vitest';
import { handelBudgetChange } from './BudgetHandler';
import { GAMESTATE } from '../Constants/GameState';
import type { GameState } from '../types/GameState';

describe('handelBudgetChange', () => {
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
            const result = handelBudgetChange({
                budget: mockBudget,
                id: 'health',
                amount: 2,
            });

            expect(result.expenditures.health).toBe(7);
            expect(result.taxes).toEqual(mockBudget.taxes);
        });

        it('should decrease expenditure value within bounds', () => {
            const result = handelBudgetChange({
                budget: mockBudget,
                id: 'security',
                amount: -3,
            });

            expect(result.expenditures.security).toBe(4);
            expect(result.taxes).toEqual(mockBudget.taxes);
        });

        it('should clamp expenditure to MAX when exceeding upper bound', () => {
            const result = handelBudgetChange({
                budget: mockBudget,
                id: 'health',
                amount: 100,
            });

            expect(result.expenditures.health).toBe(GAMESTATE.BUDGET.BOUNDS.EXPENDITURE.MAX);
        });

        it('should clamp expenditure to MIN when exceeding lower bound', () => {
            const result = handelBudgetChange({
                budget: mockBudget,
                id: 'education',
                amount: -100,
            });

            expect(result.expenditures.education).toBe(GAMESTATE.BUDGET.BOUNDS.EXPENDITURE.MIN);
        });

        it('should not modify other expenditures', () => {
            const result = handelBudgetChange({
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
            const result = handelBudgetChange({
                budget: mockBudget,
                id: 'peopleTaxes',
                amount: 5,
            });

            expect(result.taxes.peopleTaxes).toBe(25);
            expect(result.expenditures).toEqual(mockBudget.expenditures);
        });

        it('should decrease tax value within bounds', () => {
            const result = handelBudgetChange({
                budget: mockBudget,
                id: 'businessTaxes',
                amount: -10,
            });

            expect(result.taxes.businessTaxes).toBe(20);
            expect(result.expenditures).toEqual(mockBudget.expenditures);
        });

        it('should clamp tax to MAX when exceeding upper bound', () => {
            const result = handelBudgetChange({
                budget: mockBudget,
                id: 'peopleTaxes',
                amount: 100,
            });

            expect(result.taxes.peopleTaxes).toBe(GAMESTATE.BUDGET.BOUNDS.TAX.MAX);
        });

        it('should clamp tax to MIN when exceeding lower bound', () => {
            const result = handelBudgetChange({
                budget: mockBudget,
                id: 'businessTaxes',
                amount: -100,
            });

            expect(result.taxes.businessTaxes).toBe(GAMESTATE.BUDGET.BOUNDS.TAX.MIN);
        });

        it('should not modify other taxes', () => {
            const result = handelBudgetChange({
                budget: mockBudget,
                id: 'peopleTaxes',
                amount: 1,
            });

            expect(result.taxes.businessTaxes).toBe(mockBudget.taxes.businessTaxes);
        });
    });

    describe('edge cases', () => {
        it('should handle zero amount change', () => {
            const result = handelBudgetChange({
                budget: mockBudget,
                id: 'health',
                amount: 0,
            });

            expect(result.expenditures.health).toBe(mockBudget.expenditures.health);
        });

        it('should return unchanged budget for unknown id', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            const result = handelBudgetChange({
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

            handelBudgetChange({
                budget: mockBudget,
                id: 'health',
                amount: 3,
            });

            expect(mockBudget).toEqual(originalBudget);
        });
    });
});