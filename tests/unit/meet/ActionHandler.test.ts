import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleActionOutcome } from '../../../src/Stores/ActionHandler';
import * as MathUtils from '../../../src/Utils/Math';
import type { GameState } from '../../../src/types/GameState';

// Seeded RNG (ADR-0010): control randomness by mocking the named Utils/Math
// functions, never Math.random. Defaults below = "no backlash, mid dialogue roll";
// each test overrides as needed. For threshold tests, rollChance is mocked with an
// implementation that compares a fixed rolled value against the real probability
// `p` that ActionHandler computes — so charisma's effect on the threshold is still
// exercised, exactly as `next() < p` would behave.
vi.mock('../../../src/Utils/Math', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../src/Utils/Math')>();
    return {
        ...actual,
        rollChance: vi.fn((_p: number) => false),
        rollFloat: vi.fn(() => 0.5),
        getRandomFromList: vi.fn((arr: unknown[]) => arr[0]),
    };
});

// Mock the effect handler
vi.mock('../../../src/Stores/EffectHandler', () => ({
    handleRelations: ({ amount, current }: { amount: number, current: number }) => {
        const newValue = current + amount;
        return Math.max(-10, Math.min(10, newValue));
    }
}));

// Mock constants
vi.mock('../../../src/Constants/GameState', () => ({
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
        CHARISMA: {
            INITIAL: 0,
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
        // Reset RNG mocks to defaults before each test (ADR-0010 contract).
        vi.mocked(MathUtils.rollChance).mockReset().mockImplementation((_p: number) => false);
        vi.mocked(MathUtils.rollFloat).mockReset().mockReturnValue(0.5);
        vi.mocked(MathUtils.getRandomFromList).mockReset().mockImplementation((arr: readonly unknown[]) => arr[0]);

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
                charisma: { current: 0 },
                round: 3,
                modifiers: [],
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
            vi.mocked(MathUtils.rollChance).mockReturnValue(false); // No backlash
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
        });

        it('should trigger backlash and anger another power', () => {
            vi.mocked(MathUtils.rollChance).mockReturnValue(true); // Backlash triggers
            // getRandomFromList default selects the first other power (business)

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
                    backlashDelta: -2,
                },
            });
        });

        it('should not anger the eliminated power during backlash', () => {
            vi.mocked(MathUtils.rollChance).mockReturnValue(true); // Backlash triggers

            const result = handleActionOutcome('military', 'eliminate', mockState);

            expect(result.newRelations.military).toBe(0);
            // Either business or people should be -2, but not military
            const angryPowers = Object.entries(result.newRelations)
                .filter(([power, value]) => power !== 'military' && value === -2);
            expect(angryPowers.length).toBe(1);
        });

        it('should raise backlash chance to 45% at low charisma', () => {
            // Rolled value 0.4: below the low-charisma threshold (0.45) but above the
            // base (0.3). Backlash fires ONLY because charisma <= -5 raised `p` to 0.45.
            vi.mocked(MathUtils.rollChance).mockImplementation((p: number) => 0.4 < p);
            mockState.gameManagement.charisma.current = -5;

            const result = handleActionOutcome('military', 'eliminate', mockState);

            expect(result.resultText.key).toBe('eliminate_backlash');
        });

        it('should lower backlash chance to 15% at high charisma', () => {
            // Rolled value 0.2: above the high-charisma threshold (0.15) but below the
            // base (0.3). Backlash is avoided ONLY because charisma >= 5 lowered `p` to 0.15.
            vi.mocked(MathUtils.rollChance).mockImplementation((p: number) => 0.2 < p);
            mockState.gameManagement.charisma.current = 5;

            const result = handleActionOutcome('military', 'eliminate', mockState);

            expect(result.resultText.key).toBe('eliminate_success');
        });
    });

    describe('expropriate action', () => {
        it('should expropriate assets and reduce relations', () => {
            const result = handleActionOutcome('business', 'expropriate', mockState);

            expect(result.actionTaken).toBe(true);
            expect(result.treasuryUpdate).toBe(120);
            expect(result.charismaDelta).toBe(-2); // priced same as eliminate
            expect(result.newRelations.business).toBe(-3);
            expect(result.resultText).toStrictEqual({
                key: "expropriate_success",
                params: {
                    gain: 120,
                    power: "business",
                    relationDelta: -3,
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
        it('should always fail when education budget is at or below 2', () => {
            mockState.budget.expenditures.education = 2;
            mockState.relations.current.people = 3;

            const result = handleActionOutcome('people', 'dialogue', mockState);

            expect(result.actionTaken).toBe(true);
            expect(result.charismaDelta).toBe(-1);
            expect(result.newRelations.people).toBe(2); // -1 relation
            expect(result.resultText).toStrictEqual({
                key: 'dialogue_fail',
                params: { power: 'people', relationDelta: -1 },
            });
        });

        it('should handle terrible dialogue outcome (fails based on baseSuccessRate)', () => {
            vi.mocked(MathUtils.rollFloat).mockReturnValue(0.01); // For people (0.8), fail < 0.02

            const result = handleActionOutcome('people', 'dialogue', mockState);

            expect(result.actionTaken).toBe(true);
            expect(result.treasuryUpdate).toBe(0);
            expect(result.charismaDelta).toBe(0); // roll-fail is free — random, not player-controlled
            expect(result.newRelations.people).toBe(-1);
            expect(result.resultText).toStrictEqual({
                key: "dialogue_fail",
                params: {
                    power: "people",
                    relationDelta: -1,
                },
            });
        });

        it('should handle successful dialogue outcome (depends on baseSuccessRate)', () => {
            // For military (0.4), success if roll >= 0.06 and < 0.42
            vi.mocked(MathUtils.rollFloat).mockReturnValue(0.3);

            const result = handleActionOutcome('military', 'dialogue', mockState);

            expect(result.actionTaken).toBe(true);
            expect(result.treasuryUpdate).toBe(0);
            expect(result.charismaDelta).toBe(1); // dialogue success is the charisma recovery loop
            expect(result.newRelations.military).toBe(1);
            expect(result.resultText).toStrictEqual({
                key: "dialogue_success",
                params: {
                    power: "military",
                },
            });
        });

        it('should handle inconclusive dialogue outcome (above success threshold)', () => {
            // For business (0.2), inconclusive if roll >= 0.56
            vi.mocked(MathUtils.rollFloat).mockReturnValue(0.8);

            const result = handleActionOutcome('business', 'dialogue', mockState);

            expect(result.actionTaken).toBe(true);
            expect(result.treasuryUpdate).toBe(0);
            expect(result.charismaDelta).toBe(0);
            expect(result.newRelations.business).toBe(0);
            expect(result.resultText).toStrictEqual({
                key: "dialogue_neutral",
                params: {
                    power: "business",
                },
            });
        });

        it('should clamp relations at maximum', () => {
            // For people (0.8), success range ends at 0.14, so use 0.1
            vi.mocked(MathUtils.rollFloat).mockReturnValue(0.1);
            mockState.relations.current.people = 10;

            const result = handleActionOutcome('people', 'dialogue', mockState);

            expect(result.newRelations.people).toBe(10); // Already at max, stays there
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
