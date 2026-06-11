import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyBudgetEffects, handleDecision, handleRelations } from './EffectHandler';
import type { GameState } from '../types/GameState';
import type { Deal } from '../types/Deal';
import type { Law } from '../types/Law';
import * as MathUtils from '../Utils/Math';

// Mock the math utilities — spread real module so rollChance/rollFloat remain functional
vi.mock('../Utils/Math', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../Utils/Math')>();
    return {
        ...actual,
        getRandomFromList: vi.fn((arr: string[]) => arr[0]),
    };
});

// Mock constants
vi.mock('../Constants/Power', () => ({
    Power: ['military', 'business', 'people']
}));

// Mock i18n — applyBudgetEffects emits translated log messages; return the key
vi.mock('../i18n', () => ({
    default: { t: (key: string) => key }
}));

describe('applyBudgetEffects', () => {
    /** Factory: budget with all expenditures neutral (no threshold effects). */
    const makeBudget = (overrides: Partial<Record<'health' | 'infrastructure' | 'security' | 'education', number>> = {}): GameState['budget'] => ({
        treasury: 500,
        expenditures: { health: 5, infrastructure: 5, security: 5, education: 5, ...overrides },
        taxes: { peopleTaxes: 20, businessTaxes: 30 },
    } as unknown as GameState['budget']);

    const neutralRelations = { military: 0, business: 0, people: 0 };

    it('neutral budget produces no relation changes and no messages', () => {
        const result = applyBudgetEffects(makeBudget(), neutralRelations);

        expect(result.newRelations).toEqual(neutralRelations);
        expect(result.logMessages).toHaveLength(0);
    });

    it('low security angers the military by 2', () => {
        const result = applyBudgetEffects(makeBudget({ security: 2 }), neutralRelations);

        expect(result.newRelations.military).toBe(-2);
        expect(result.logMessages).toContain('log.budget_military_low');
    });

    it('high security pleases the military by 1', () => {
        const result = applyBudgetEffects(makeBudget({ security: 8 }), neutralRelations);

        expect(result.newRelations.military).toBe(1);
        expect(result.logMessages).toContain('log.budget_military_high');
    });

    it('low health angers the people by 2', () => {
        const result = applyBudgetEffects(makeBudget({ health: 2 }), neutralRelations);

        expect(result.newRelations.people).toBe(-2);
        expect(result.logMessages).toContain('log.budget_health_low');
    });

    it('high health pleases the people by 1', () => {
        const result = applyBudgetEffects(makeBudget({ health: 8 }), neutralRelations);

        expect(result.newRelations.people).toBe(1);
        expect(result.logMessages).toContain('log.budget_health_high');
    });

    it('low infrastructure angers business and people by 1 each', () => {
        const result = applyBudgetEffects(makeBudget({ infrastructure: 2 }), neutralRelations);

        expect(result.newRelations.business).toBe(-1);
        expect(result.newRelations.people).toBe(-1);
        expect(result.logMessages).toContain('log.budget_infra_low');
    });

    it('high infrastructure pleases business and people by 1 each', () => {
        const result = applyBudgetEffects(makeBudget({ infrastructure: 8 }), neutralRelations);

        expect(result.newRelations.business).toBe(1);
        expect(result.newRelations.people).toBe(1);
        expect(result.logMessages).toContain('log.budget_infra_high');
    });

    it('clamps relation changes at the minimum bound', () => {
        const result = applyBudgetEffects(
            makeBudget({ security: 2 }),
            { military: -9, business: 0, people: 0 }
        );

        expect(result.newRelations.military).toBe(-10);
    });

    it('multiple thresholds stack (low security + low health + low infrastructure)', () => {
        const result = applyBudgetEffects(
            makeBudget({ security: 2, health: 2, infrastructure: 2 }),
            neutralRelations
        );

        expect(result.newRelations.military).toBe(-2);
        expect(result.newRelations.people).toBe(-3); // health −2, infra −1
        expect(result.newRelations.business).toBe(-1);
        expect(result.logMessages).toHaveLength(3);
    });

    it('does not mutate the input relations object', () => {
        const input = { military: 0, business: 0, people: 0 };
        applyBudgetEffects(makeBudget({ security: 2 }), input);

        expect(input.military).toBe(0);
    });
});

describe('handleRelations', () => {
    it('should add amount to current value and clamp within bounds', () => {
        const current = { military: 5, business: 0, people: -5 };

        const result = handleRelations({
            power: 'military',
            amount: 3,
            current: current.military
        });

        expect(result).toBe(8);
    });

    it('should clamp to maximum when exceeding upper bound', () => {
        const current = { military: 8, business: 0, people: 0 };

        const result = handleRelations({
            power: 'military',
            amount: 5,
            current: current.military
        });

        expect(result).toBe(10);
    });

    it('should clamp to minimum when exceeding lower bound', () => {
        const current = { military: -8, business: 0, people: 0 };

        const result = handleRelations({
            power: 'military',
            amount: -5,
            current: current.military
        });

        expect(result).toBe(-10);
    });

    it('should warn when reaching minimum', () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
        const current = { military: -8, business: 0, people: 0 };

        handleRelations({
            power: 'military',
            amount: -5,
            current: current.military
        });

        expect(consoleSpy).toHaveBeenCalledWith(
            'Relation with military reached minimum (-10).'
        );
        consoleSpy.mockRestore();
    });
});

describe('handleDecision', () => {
    let mockState: Partial<GameState>;
    let mockGet: () => GameState;
    let mockSet: (p: Partial<GameState>) => void;

    beforeEach(() => {
        mockState = {
            budget: {
                treasury: 100,
                expenditures: { health: 1, infrastructure: 1, security: 1, education: 1 },
                taxes: { peopleTaxes: 20, businessTaxes: 30 }
            },
            relations: {
                current: { military: 0, business: 0, people: 0 }
            },
            gameManagement: {
                charisma: { current: 0 }
            },
            deals: {
                dealDecided: false,
                lastDealOutcome: null,
                lastDealAccepted: null,
                interactedWithDeals: new Set()
            },
            law: {
                lawDecided: false,
                lastLawOutcome: false,
                interactedWithLaws: new Set()
            }
        } as unknown as GameState;

        mockGet = vi.fn(() => mockState as GameState);
        mockSet = vi.fn((_: Partial<GameState>) => { });
    });

    describe('Law decisions', () => {
        it('should accept a law and apply effects', () => {
            const law: Law = {
                id: 1,

                power: 'military',
                acceptEffect: { treasury: -50, military: 2, business: -1 },
                rejectEffect: { military: -1 }
            };

            handleDecision({
                type: 'law',
                item: law,
                hasAccepted: true,
                get: mockGet,
                set: mockSet
            });

            expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
                budget: expect.objectContaining({ treasury: 50 }),
                relations: {
                    current: { military: 2, business: -1, people: 0 }
                },
                law: {
                    lawDecided: true,
                    lastLawOutcome: true,
                    interactedWithLaws: expect.any(Set)
                }
            }));
        });

        it('should reject a law and apply reject effects', () => {
            const law: Law = {
                id: 1,

                power: 'military',
                acceptEffect: { treasury: -50, military: 2 },
                rejectEffect: { military: -1, people: 1 }
            };

            handleDecision({
                type: 'law',
                item: law,
                hasAccepted: false,
                get: mockGet,
                set: mockSet
            });

            expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
                budget: expect.objectContaining({ treasury: 100 }),
                relations: {
                    current: { military: -1, business: 0, people: 1 }
                },
                law: {
                    lawDecided: true,
                    lastLawOutcome: false,
                    interactedWithLaws: expect.any(Set)
                }
            }));
        });
    });

    describe('Deal decisions', () => {
        it('should accept a deal with text outcome', () => {
            const deal: Deal = {
                id: 1,
                text: 'Test deal',
                acceptText: 'Deal accepted!',
                rejectText: 'Deal rejected!',
                acceptEffect: { treasury: 80, business: 2 },
                rejectEffect: { business: -1 }
            };

            handleDecision({
                type: 'deal',
                item: deal,
                hasAccepted: true,
                get: mockGet,
                set: mockSet
            });

            expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
                budget: expect.objectContaining({ treasury: 180 }),
                relations: {
                    current: { military: 0, business: 2, people: 0 }
                },
                deals: expect.objectContaining({
                    dealDecided: true,
                    lastDealOutcome: ['Deal accepted!'],
                    interactedWithDeals: expect.any(Set)
                })
            }));
        });

        it('should handle risky deal when risk triggers on rejection', () => {
            vi.spyOn(Math, 'random').mockReturnValue(0.1); // Will trigger 30% risk
            vi.mocked(MathUtils.getRandomFromList).mockReturnValue('business');

            const deal: Deal = {
                id: 2,
                text: 'Risky deal',
                acceptText: 'Accepted',
                rejectText: 'Rejected',
                acceptEffect: { treasury: 100 },
                rejectEffect: { risk: 0.3 },
                riskText: 'Things went wrong!'
            };

            handleDecision({
                type: 'deal',
                item: deal,
                hasAccepted: false,
                get: mockGet,
                set: mockSet
            });

            expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
                budget: expect.objectContaining({ treasury: 100 }),
                relations: {
                    current: { military: 0, business: -2, people: 0 }
                },
                deals: expect.objectContaining({
                    dealDecided: true,
                    lastDealOutcome: ['Rejected', 'Things went wrong!'],
                    interactedWithDeals: expect.any(Set)
                })
            }));

            vi.restoreAllMocks();
        });

        it('should not apply risk penalty when risk does not trigger', () => {
            vi.spyOn(Math, 'random').mockReturnValue(0.9); // Won't trigger 30% risk

            const deal: Deal = {
                id: 2,
                text: 'Risky deal',
                acceptText: 'Accepted',
                rejectText: 'Rejected',
                acceptEffect: { treasury: 100 },
                rejectEffect: { risk: 0.3 },
                riskText: 'Things went wrong!'
            };

            handleDecision({
                type: 'deal',
                item: deal,
                hasAccepted: false,
                get: mockGet,
                set: mockSet
            });

            expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
                budget: expect.objectContaining({ treasury: 100 }),
                relations: {
                    current: { military: 0, business: 0, people: 0 }
                },
                deals: expect.objectContaining({
                    dealDecided: true,
                    lastDealOutcome: ['Rejected'],
                    interactedWithDeals: expect.any(Set)
                })
            }));

            vi.restoreAllMocks();
        });

        it('should not apply risk penalty on acceptance', () => {
            vi.spyOn(Math, 'random').mockReturnValue(0.1); // Would trigger risk

            const deal: Deal = {
                id: 2,
                text: 'Risky deal',
                acceptText: 'Accepted',
                rejectText: 'Rejected',
                acceptEffect: { treasury: 100, risk: 0.3 },
                rejectEffect: {},
                riskText: 'Things went wrong!'
            };

            handleDecision({
                type: 'deal',
                item: deal,
                hasAccepted: true,
                get: mockGet,
                set: mockSet
            });

            // Should not have -2 penalty even though risk triggered
            expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
                budget: expect.objectContaining({ treasury: 200 }),
                relations: {
                    current: { military: 0, business: 0, people: 0 }
                },
                deals: expect.objectContaining({
                    dealDecided: true,
                    lastDealOutcome: ['Accepted', 'Things went wrong!'],
                    interactedWithDeals: expect.any(Set)
                })
            }));

            vi.restoreAllMocks();
        });
    });

    describe('Law budget effects (expenditures and taxes)', () => {
        it('applies expenditure deltas from a law, clamped to bounds', () => {
            const law: Law = {
                id: 3,
                power: 'people',
                acceptEffect: { education: 2, health: -5 },
                rejectEffect: {}
            };

            handleDecision({
                type: 'law',
                item: law,
                hasAccepted: true,
                get: mockGet,
                set: mockSet
            });

            const calledWith = (mockSet as any).mock.calls[0][0];
            expect(calledWith.budget.expenditures.education).toBe(3); // 1 + 2
            expect(calledWith.budget.expenditures.health).toBe(1);    // 1 - 5 clamped to MIN 1
        });

        it('applies tax deltas from a law, clamped to bounds', () => {
            const law: Law = {
                id: 4,
                power: 'business',
                acceptEffect: { peopleTaxes: 10, businessTaxes: 100 },
                rejectEffect: {}
            };

            handleDecision({
                type: 'law',
                item: law,
                hasAccepted: true,
                get: mockGet,
                set: mockSet
            });

            const calledWith = (mockSet as any).mock.calls[0][0];
            expect(calledWith.budget.taxes.peopleTaxes).toBe(30);    // 20 + 10
            expect(calledWith.budget.taxes.businessTaxes).toBe(50);  // 30 + 100 clamped to MAX 50
        });
    });

    describe('Charisma scoring on law decisions', () => {
        it('awards +1 charisma for rejecting when reject outcome is better', () => {
            const law: Law = {
                id: 5,
                power: 'military',
                acceptEffect: { military: -2 },
                rejectEffect: { military: 1 }
            };

            handleDecision({
                type: 'law',
                item: law,
                hasAccepted: false,
                get: mockGet,
                set: mockSet
            });

            const calledWith = (mockSet as any).mock.calls[0][0];
            expect(calledWith.gameManagement.charisma.current).toBe(1);
        });

        it('awards no charisma for rejecting when accept outcome was better', () => {
            const law: Law = {
                id: 6,
                power: 'military',
                acceptEffect: { military: 2 },
                rejectEffect: { military: -1 }
            };

            handleDecision({
                type: 'law',
                item: law,
                hasAccepted: false,
                get: mockGet,
                set: mockSet
            });

            const calledWith = (mockSet as any).mock.calls[0][0];
            expect(calledWith.gameManagement.charisma.current).toBe(0);
        });
    });

    describe('Relation clamping', () => {
        it('should clamp relations to maximum', () => {
            mockState.relations!.current.military = 9;

            const law: Law = {
                id: 1,

                power: 'military',
                acceptEffect: { military: 5 },
                rejectEffect: {}
            };

            handleDecision({
                type: 'law',
                item: law,
                hasAccepted: true,
                get: mockGet,
                set: mockSet
            });

            const calledWith = (mockSet as any).mock.calls[0][0];
            expect(calledWith.relations.current.military).toBe(10);
        });

        it('should clamp relations to minimum', () => {
            mockState.relations!.current.people = -9;

            const law: Law = {
                id: 1,

                power: 'people',
                acceptEffect: { people: -5 },
                rejectEffect: {}
            };

            handleDecision({
                type: 'law',
                item: law,
                hasAccepted: true,
                get: mockGet,
                set: mockSet
            });

            const calledWith = (mockSet as any).mock.calls[0][0];
            expect(calledWith.relations.current.people).toBe(-10);
        });
    });
});