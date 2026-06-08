import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleDecision, handleRelations } from './EffectHandler';
import type { GameState } from '../types/GameState';
import type { Deal } from '../types/Deal';
import type { Law } from '../types/Law';
import * as MathUtils from '../Utils/Math';

// Mock the math utilities
vi.mock('../Utils/Math', () => ({
    Clamp: (value: number, min: number, max: number) =>
        Math.max(min, Math.min(max, value)),
    getRandomFromList: vi.fn((arr: string[]) => arr[0])
}));

// Mock constants
vi.mock('../Constants/Power', () => ({
    Power: ['military', 'business', 'people']
}));

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
                lastDealOutcome: '',
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
                label: 'Test Law',
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
                label: 'Test Law',
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
                deals: {
                    dealDecided: true,
                    lastDealOutcome: 'Deal accepted!',
                    interactedWithDeals: expect.any(Set)
                }
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
                deals: {
                    dealDecided: true,
                    lastDealOutcome: 'Rejected Things went wrong!',
                    interactedWithDeals: expect.any(Set)
                }
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
                deals: {
                    dealDecided: true,
                    lastDealOutcome: 'Rejected',
                    interactedWithDeals: expect.any(Set)
                }
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
                deals: {
                    dealDecided: true,
                    lastDealOutcome: 'Accepted Things went wrong!',
                    interactedWithDeals: expect.any(Set)
                }
            }));

            vi.restoreAllMocks();
        });
    });

    describe('Relation clamping', () => {
        it('should clamp relations to maximum', () => {
            mockState.relations!.current.military = 9;

            const law: Law = {
                id: 1,
                label: 'Test Law',
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
                label: 'Test Law',
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