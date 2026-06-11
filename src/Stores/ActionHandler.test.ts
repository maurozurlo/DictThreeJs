import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleActionOutcome } from './ActionHandler';
import type { GameState } from '../types/GameState';

// Mock the effect handler
vi.mock('./EffectHandler', () => ({
    handleRelations: ({ amount, current }: { amount: number, current: number }) => {
        const newValue = current + amount;
        return Math.max(-10, Math.min(10, newValue));
    }
}));

// Mock constants
vi.mock('../Constants/GameState', () => ({
    GAMESTATE: {
        RELATIONS: {
            INITIAL: {
                military: 0,
                business: 0,
                people: 0
            },
            MIN: -10,
            MAX: 10
        },
        BUDGET: {
            BOUNDS: {
                EXPENDITURE: { MIN: 1 }
            }
        },
        MEET: {
            ACTIONS: {
                BRIBE: {
                    COSTS: {
                        military: 60,
                        business: 80,
                        people: 60
                    }
                },
                EXPROPRIATE: {
                    GAINS: {
                        military: 50,
                        business: 120,
                        people: 40
                    }
                },
                DIALOGUE: {
                    BASE_SUCCESS_RATE: {
                        military: 0.4,
                        business: 0.2,
                        people: 0.8
                    }
                }
            },
        }
    }
}));

describe('handleActionOutcome', () => {
    let mockState: GameState;

    beforeEach(() => {
        mockState = {
            budget: {
                treasury: 200,
                expenditures: { health: 5, infrastructure: 5, security: 5, education: 5 },
            },
            relations: {
                current: {
                    military: 0,
                    business: 0,
                    people: 0
                }
            },
            gameManagement: {
                charisma: { current: 0 }
            }
        } as unknown as GameState;
    });

    describe('bribe action', () => {
        it('should successfully bribe when funds are sufficient', () => {
            const result = handleActionOutcome('military', 'bribe', mockState);
            expect(result.actionTaken).toBe(true);
            expect(result.treasuryUpdate).toBe(-60);
            expect(result.newRelations.military).toBe(3);
            expect(result.resultText).toStrictEqual({
                key: "bribe_success",
                params: {
                    cost: 60,
                    power: "military",
                },
            });
        });

        it('should fail bribe when funds are insufficient', () => {
            mockState.budget!.treasury = 50;

            const result = handleActionOutcome('military', 'bribe', mockState);

            expect(result.actionTaken).toBe(false);
            expect(result.treasuryUpdate).toBe(0);
            expect(result.newRelations.military).toBe(0);
            expect(result.resultText).toStrictEqual({
                key: "bribe_insufficient_funds",
            });
        });

        it('should use correct costs for different powers', () => {
            const militaryResult = handleActionOutcome('military', 'bribe', mockState);
            expect(militaryResult.treasuryUpdate).toBe(-60);

            const businessResult = handleActionOutcome('business', 'bribe', mockState);
            expect(businessResult.treasuryUpdate).toBe(-80);

            const peopleResult = handleActionOutcome('people', 'bribe', mockState);
            expect(peopleResult.treasuryUpdate).toBe(-60);
        });
    });

    describe('eliminate action', () => {
        it('should reset target power to neutral without backlash', () => {
            vi.spyOn(Math, 'random').mockReturnValue(0.5); // No backlash (>0.3)
            mockState.relations.current.military = 5;

            const result = handleActionOutcome('military', 'eliminate', mockState);

            expect(result.actionTaken).toBe(true);
            expect(result.treasuryUpdate).toBe(0);
            expect(result.newRelations.military).toBe(0);
            expect(result.newRelations.business).toBe(0);
            expect(result.newRelations.people).toBe(0);
            expect(result.resultText).toStrictEqual({
                key: "eliminate_success",
                params: {
                    power: "military",
                },
            });

            vi.restoreAllMocks();
        });

        it('should trigger backlash and anger another power', () => {
            vi.spyOn(Math, 'random')
                .mockReturnValueOnce(0.1) // Backlash triggers (0.1 < 0.3)
                .mockReturnValueOnce(0); // Select first other power

            mockState.relations.current.military = -5;
            mockState.relations.current.business = 2;

            const result = handleActionOutcome('military', 'eliminate', mockState);

            expect(result.actionTaken).toBe(true);
            expect(result.newRelations.military).toBe(0);
            expect(result.newRelations.business).toBe(0); // 2 - 2 = 0
            expect(result.resultText).toStrictEqual({
                key: "eliminate_backlash",
                params: {
                    angryPower: "business",
                    power: "military",
                },
            });

            vi.restoreAllMocks();
        });

        it('should not anger the eliminated power during backlash', () => {
            vi.spyOn(Math, 'random')
                .mockReturnValueOnce(0.1) // Backlash triggers
                .mockReturnValueOnce(0.5); // Random selection

            const result = handleActionOutcome('military', 'eliminate', mockState);

            expect(result.newRelations.military).toBe(0);
            // Either business or people should be -2, but not military
            const angryPowers = Object.entries(result.newRelations)
                .filter(([power, value]) => power !== 'military' && value === -2);
            expect(angryPowers.length).toBe(1);

            vi.restoreAllMocks();
        });
    });

    describe('expropriate action', () => {
        it('should expropriate assets and reduce relations', () => {
            const result = handleActionOutcome('business', 'expropriate', mockState);

            expect(result.actionTaken).toBe(true);
            expect(result.treasuryUpdate).toBe(120);
            expect(result.newRelations.business).toBe(-3);
            expect(result.resultText).toStrictEqual({
                key: "expropriate_success",
                params: {
                    gain: 120,
                    power: "business",
                },
            });
        });

        it('should use correct gains for different powers', () => {
            const militaryResult = handleActionOutcome('military', 'expropriate', mockState);
            expect(militaryResult.treasuryUpdate).toBe(50);

            const businessResult = handleActionOutcome('business', 'expropriate', mockState);
            expect(businessResult.treasuryUpdate).toBe(120);

            const peopleResult = handleActionOutcome('people', 'expropriate', mockState);
            expect(peopleResult.treasuryUpdate).toBe(40);
        });

        it('should clamp relations at minimum', () => {
            mockState.relations.current.people = -8;

            const result = handleActionOutcome('people', 'expropriate', mockState);

            expect(result.newRelations.people).toBe(-10); // Clamped at minimum
        });
    });

    describe('dialogue action', () => {
        it('should handle terrible dialogue outcome (fails based on baseSuccessRate)', () => {
            vi.spyOn(Math, 'random').mockReturnValue(0.01); // For people (0.8), fail < 0.02

            const result = handleActionOutcome('people', 'dialogue', mockState);

            expect(result.actionTaken).toBe(true);
            expect(result.treasuryUpdate).toBe(0);
            expect(result.newRelations.people).toBe(-1);
            expect(result.resultText).toStrictEqual({
                key: "dialogue_fail",
                params: {
                    power: "people",
                },
            });

            vi.restoreAllMocks();
        });

        it('should handle successful dialogue outcome (depends on baseSuccessRate)', () => {
            // For military (0.4), success if roll >= 0.06 and < 0.42
            vi.spyOn(Math, 'random').mockReturnValue(0.3);

            const result = handleActionOutcome('military', 'dialogue', mockState);

            expect(result.actionTaken).toBe(true);
            expect(result.treasuryUpdate).toBe(0);
            expect(result.newRelations.military).toBe(1);
            expect(result.resultText).toStrictEqual({
                key: "dialogue_success",
                params: {
                    power: "military",
                },
            });

            vi.restoreAllMocks();
        });

        it('should handle inconclusive dialogue outcome (above success threshold)', () => {
            // For business (0.2), inconclusive if roll >= 0.56
            vi.spyOn(Math, 'random').mockReturnValue(0.8);

            const result = handleActionOutcome('business', 'dialogue', mockState);

            expect(result.actionTaken).toBe(true);
            expect(result.treasuryUpdate).toBe(0);
            expect(result.newRelations.business).toBe(0);
            expect(result.resultText).toStrictEqual({
                key: "dialogue_neutral",
                params: {
                    power: "business",
                },
            });

            vi.restoreAllMocks();
        });

        it('should clamp relations at maximum', () => {
            // For people (0.8), success range ends at 0.14, so use 0.1
            vi.spyOn(Math, 'random').mockReturnValue(0.1);
            mockState.relations.current.people = 10;

            const result = handleActionOutcome('people', 'dialogue', mockState);

            expect(result.newRelations.people).toBe(10); // Already at max, stays there

            vi.restoreAllMocks();
        });
    });

    describe('relation preservation', () => {
        it('should not modify unaffected powers', () => {
            mockState.relations.current = {
                military: 3,
                business: -2,
                people: 5
            };

            const result = handleActionOutcome('military', 'bribe', mockState);

            expect(result.newRelations.business).toBe(-2);
            expect(result.newRelations.people).toBe(5);
        });

        it('should handle multiple actions preserving state', () => {
            // First action
            const result1 = handleActionOutcome('military', 'dialogue', mockState);

            // Update state with new relations
            mockState.relations.current = result1.newRelations;

            // Second action
            const result2 = handleActionOutcome('business', 'expropriate', mockState);

            // Military relation from first action should be preserved
            expect(result2.newRelations.military).toBe(result1.newRelations.military);
        });
    });
});