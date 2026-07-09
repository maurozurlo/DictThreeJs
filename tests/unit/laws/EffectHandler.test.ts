import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyBudgetEffects, handleDecision, handleRelations } from '../../../src/Stores/EffectHandler';
import type { GameState } from '../../../src/types/GameState';
import type { Deal } from '../../../src/types/Deal';
import type { Law } from '../../../src/types/Law';
import * as MathUtils from '../../../src/Utils/Math';

// Mock the math utilities — spread the real module, then override the draws we
// need to control. Randomness is controlled through these named functions, never
// via Math.random (ADR-0010). rollChance defaults to "risk never triggers".
vi.mock('../../../src/Utils/Math', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../src/Utils/Math')>();
    return {
        ...actual,
        getRandomFromList: vi.fn((arr: string[]) => arr[0]),
        rollChance: vi.fn((_p: number) => false),
    };
});

// Mock constants
vi.mock('../../../src/Constants/Power', () => ({
    Power: ['military', 'business', 'people']
}));

// Mock i18n — applyBudgetEffects emits translated log messages; return the key
vi.mock('../../../src/i18n', () => ({
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
        expect(result.logEvents).toHaveLength(0);
    });

    it('low security has no effect on military relations', () => {
        const result = applyBudgetEffects(makeBudget({ security: 2 }), neutralRelations);

        expect(result.newRelations.military).toBe(0);
        expect(result.logEvents.map(e => e.key)).not.toContain('log.budget_military_low');
    });

    it('high security pleases the military by 1', () => {
        const result = applyBudgetEffects(makeBudget({ security: 8 }), neutralRelations);

        expect(result.newRelations.military).toBe(1);
        expect(result.logEvents.map(e => e.key)).toContain('log.budget_military_high');
    });

    it('low health has no effect on people relations', () => {
        const result = applyBudgetEffects(makeBudget({ health: 2 }), neutralRelations);

        expect(result.newRelations.people).toBe(0);
        expect(result.logEvents.map(e => e.key)).not.toContain('log.budget_health_low');
    });

    it('high health pleases the people by 1', () => {
        const result = applyBudgetEffects(makeBudget({ health: 8 }), neutralRelations);

        expect(result.newRelations.people).toBe(1);
        expect(result.logEvents.map(e => e.key)).toContain('log.budget_health_high');
    });

    it('low infrastructure has no effect on business or people relations', () => {
        const result = applyBudgetEffects(makeBudget({ infrastructure: 2 }), neutralRelations);

        expect(result.newRelations.business).toBe(0);
        expect(result.newRelations.people).toBe(0);
        expect(result.logEvents.map(e => e.key)).not.toContain('log.budget_infra_low');
    });

    it('high infrastructure pleases business and people by 1 each', () => {
        const result = applyBudgetEffects(makeBudget({ infrastructure: 8 }), neutralRelations);

        expect(result.newRelations.business).toBe(1);
        expect(result.newRelations.people).toBe(1);
        expect(result.logEvents.map(e => e.key)).toContain('log.budget_infra_high');
    });

    it('low budget leaves relations unchanged even at near-minimum', () => {
        const result = applyBudgetEffects(
            makeBudget({ security: 2 }),
            { military: -9, business: 0, people: 0 }
        );

        expect(result.newRelations.military).toBe(-9);
    });

    it('multiple low thresholds produce no relation changes or log messages', () => {
        const result = applyBudgetEffects(
            makeBudget({ security: 2, health: 2, infrastructure: 2 }),
            neutralRelations
        );

        expect(result.newRelations).toEqual(neutralRelations);
        expect(result.logEvents).toHaveLength(0);
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
    let mockSet: (p: Partial<GameState>) => void;

    // handleDecision now RETURNS the patch (Story 10-3); tests feed it through
    // mockSet so the original single-set() assertions read unchanged.
    const lastSetArg = () => (mockSet as any).mock.calls[0][0];
    // Amount of a stat on a built modifier's resolved mods.
    const modAmount = (mod: any, stat: string): number | undefined =>
        mod.mods.find((m: any) => m.stat === stat)?.amount;
    const findMod = (arg: any, id: string) =>
        arg.gameManagement.modifiers.find((m: any) => m.id === id);

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
                charisma: { current: 0 },
                modifiers: [],
                round: 3, // past the grace window — reject base mutations are un-dampened
                currentRoundExtraIncome: 0,
                currentRoundExtraExpenses: 0,
            },
            stats: {
                lawsPassed: 0,
                lawsRejected: 0,
                dealsAccepted: 0,
                dealsRejected: 0,
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

        mockSet = vi.fn((_: Partial<GameState>) => { });
    });

    // ADR-0008 Amendment 2026-06-18: accept builds ONE read-through modifier from
    // acceptMods (base treasury/relations untouched); reject applies rejectMods as
    // base mutations (no modifier). Effective relations/treasury are summed on read
    // or in nextRound — covered by timed_modifiers + the modifier_application suite.
    describe('Law decisions', () => {
        it('accept builds a law-recurring modifier from acceptMods; base untouched', () => {
            const law: Law = {
                id: 1,
                power: 'military',
                acceptMods: [
                    { stat: 'treasury', amount: -50, time: 1 },
                    { stat: 'military', amount: 2, time: 0 },
                    { stat: 'business', amount: -1, time: 0 },
                ],
                rejectMods: [{ stat: 'military', amount: -1, time: 1 }],
            };

            mockSet(handleDecision({ type: 'law', item: law, hasAccepted: true, state: mockState as GameState }));

            const arg = lastSetArg();
            // Treasury + relations are NOT mutated on accept — they live in the modifier.
            expect(arg.budget.treasury).toBe(100);
            expect(arg.relations.current).toEqual({ military: 0, business: 0, people: 0 });
            const mod = findMod(arg, 'laws.1');
            expect(mod.type).toBe('law-recurring');
            expect(modAmount(mod, 'treasury')).toBe(-50);
            expect(modAmount(mod, 'military')).toBe(2);
            expect(modAmount(mod, 'business')).toBe(-1);
            // Chose-better-option reward: accept relation sum (+1) > reject (-1) → +1 charisma.
            expect(arg.gameManagement.charisma.current).toBe(1);
            expect(arg.law.lastLawOutcome).toBe(true);
        });

        it('reject applies rejectMods as base mutations; no modifier created', () => {
            const law: Law = {
                id: 1,
                power: 'military',
                acceptMods: [{ stat: 'treasury', amount: -50, time: 1 }, { stat: 'military', amount: 2, time: 0 }],
                rejectMods: [{ stat: 'military', amount: -1, time: 1 }, { stat: 'people', amount: 1, time: 1 }],
            };

            mockSet(handleDecision({ type: 'law', item: law, hasAccepted: false, state: mockState as GameState }));

            const arg = lastSetArg();
            expect(arg.budget.treasury).toBe(100);
            expect(arg.relations.current).toEqual({ military: -1, business: 0, people: 1 });
            expect(arg.gameManagement.modifiers).toHaveLength(0);
            expect(arg.law.lastLawOutcome).toBe(false);
        });

        it('reject treasury spec is applied to base immediately', () => {
            const law: Law = {
                id: 7,
                power: 'people',
                acceptMods: [{ stat: 'people', amount: 1, time: 0 }],
                rejectMods: [{ stat: 'treasury', amount: -20, time: 1 }],
            };

            mockSet(handleDecision({ type: 'law', item: law, hasAccepted: false, state: mockState as GameState }));

            expect(lastSetArg().budget.treasury).toBe(80);
        });
    });

    describe('Deal decisions', () => {
        it('accept deal builds a deal modifier; base untouched; text set', () => {
            const deal: Deal = {
                id: 1,
                text: 'Test deal',
                acceptText: 'Deal accepted!',
                rejectText: 'Deal rejected!',
                acceptMods: [{ stat: 'treasury', amount: 80, time: 1 }, { stat: 'business', amount: 2, time: 0 }],
                rejectMods: [{ stat: 'business', amount: -1, time: 1 }],
            };

            mockSet(handleDecision({ type: 'deal', item: deal, hasAccepted: true, state: mockState as GameState }));

            const arg = lastSetArg();
            expect(arg.budget.treasury).toBe(100);
            expect(arg.relations.current).toEqual({ military: 0, business: 0, people: 0 });
            const mod = findMod(arg, 'deals.1');
            expect(mod.type).toBe('deal');
            expect(modAmount(mod, 'treasury')).toBe(80);
            expect(modAmount(mod, 'business')).toBe(2);
            expect(arg.deals.lastDealOutcome).toEqual(['Deal accepted!']);
        });

        it('reject risk triggers a random-faction penalty + riskText', () => {
            vi.mocked(MathUtils.rollChance).mockImplementation((p: number) => 0.1 < p); // rolled 0.1 → triggers
            vi.mocked(MathUtils.getRandomFromList).mockReturnValue('business');

            const deal: Deal = {
                id: 2,
                text: 'Risky deal',
                acceptText: 'Accepted',
                rejectText: 'Rejected',
                acceptMods: [{ stat: 'treasury', amount: 100, time: 1 }],
                rejectMods: [],
                rejectRisk: 0.3,
                riskText: 'Things went wrong!',
            };

            mockSet(handleDecision({ type: 'deal', item: deal, hasAccepted: false, state: mockState as GameState }));

            const arg = lastSetArg();
            expect(arg.budget.treasury).toBe(100); // reject has no treasury spec
            expect(arg.relations.current).toEqual({ military: 0, business: -2, people: 0 });
            expect(arg.deals.lastDealOutcome).toEqual(['Rejected', 'Things went wrong!']);

            vi.restoreAllMocks();
        });

        it('no risk penalty when reject risk does not trigger', () => {
            vi.mocked(MathUtils.rollChance).mockImplementation((p: number) => 0.9 < p); // rolled 0.9 → won't trigger

            const deal: Deal = {
                id: 2,
                text: 'Risky deal',
                acceptText: 'Accepted',
                rejectText: 'Rejected',
                acceptMods: [{ stat: 'treasury', amount: 100, time: 1 }],
                rejectMods: [],
                rejectRisk: 0.3,
                riskText: 'Things went wrong!',
            };

            mockSet(handleDecision({ type: 'deal', item: deal, hasAccepted: false, state: mockState as GameState }));

            const arg = lastSetArg();
            expect(arg.relations.current).toEqual({ military: 0, business: 0, people: 0 });
            expect(arg.deals.lastDealOutcome).toEqual(['Rejected']);

            vi.restoreAllMocks();
        });

        it('accept-path risk shows riskText but never applies a penalty', () => {
            vi.mocked(MathUtils.rollChance).mockImplementation((p: number) => 0.1 < p); // would trigger

            const deal: Deal = {
                id: 2,
                text: 'Risky deal',
                acceptText: 'Accepted',
                rejectText: 'Rejected',
                acceptMods: [{ stat: 'treasury', amount: 100, time: 1 }],
                rejectMods: [],
                acceptRisk: 0.3,
                riskText: 'Things went wrong!',
            };

            mockSet(handleDecision({ type: 'deal', item: deal, hasAccepted: true, state: mockState as GameState }));

            const arg = lastSetArg();
            // No -2 penalty even though risk rolled true; treasury stays base (it's in the modifier).
            expect(arg.relations.current).toEqual({ military: 0, business: 0, people: 0 });
            expect(arg.budget.treasury).toBe(100);
            expect(modAmount(findMod(arg, 'deals.2'), 'treasury')).toBe(100);
            expect(arg.deals.lastDealOutcome).toEqual(['Accepted', 'Things went wrong!']);

            vi.restoreAllMocks();
        });
    });

    describe('Law budget/tax effects land on the modifier (not base)', () => {
        it('expenditure specs become securitySpend/educationSpend mods', () => {
            const law: Law = {
                id: 3,
                power: 'people',
                acceptMods: [{ stat: 'educationSpend', amount: 2, time: 0 }, { stat: 'healthSpend', amount: -5, time: 0 }],
                rejectMods: [],
            };

            mockSet(handleDecision({ type: 'law', item: law, hasAccepted: true, state: mockState as GameState }));

            const arg = lastSetArg();
            const mod = findMod(arg, 'laws.3');
            expect(modAmount(mod, 'educationSpend')).toBe(2);
            expect(modAmount(mod, 'healthSpend')).toBe(-5);
            // Base sliders are not touched (effective value is read via getEffectiveBudgetStat).
            expect(arg.budget.expenditures.education).toBe(1);
            expect(arg.budget.expenditures.health).toBe(1);
        });

        it('tax specs become businessTaxes/peopleTaxes mods', () => {
            const law: Law = {
                id: 4,
                power: 'business',
                acceptMods: [{ stat: 'peopleTaxes', amount: 10, time: 0 }, { stat: 'businessTaxes', amount: 100, time: 0 }],
                rejectMods: [],
            };

            mockSet(handleDecision({ type: 'law', item: law, hasAccepted: true, state: mockState as GameState }));

            const arg = lastSetArg();
            const mod = findMod(arg, 'laws.4');
            expect(modAmount(mod, 'peopleTaxes')).toBe(10);
            expect(modAmount(mod, 'businessTaxes')).toBe(100);
            expect(arg.budget.taxes.peopleTaxes).toBe(20);
            expect(arg.budget.taxes.businessTaxes).toBe(30);
        });
    });

    describe('Charisma scoring on law decisions', () => {
        it('awards +1 charisma for rejecting when reject outcome is better', () => {
            const law: Law = {
                id: 5,
                power: 'military',
                acceptMods: [{ stat: 'military', amount: -2, time: 0 }],
                rejectMods: [{ stat: 'military', amount: 1, time: 1 }],
            };

            mockSet(handleDecision({ type: 'law', item: law, hasAccepted: false, state: mockState as GameState }));

            expect(lastSetArg().gameManagement.charisma.current).toBe(1);
        });

        it('awards no charisma for rejecting when accept outcome was better', () => {
            const law: Law = {
                id: 6,
                power: 'military',
                acceptMods: [{ stat: 'military', amount: 2, time: 0 }],
                rejectMods: [{ stat: 'military', amount: -1, time: 1 }],
            };

            mockSet(handleDecision({ type: 'law', item: law, hasAccepted: false, state: mockState as GameState }));

            expect(lastSetArg().gameManagement.charisma.current).toBe(0);
        });
    });

    // ADR-0011: every decision pushes a structured LogEvent carrying the ACTUAL
    // applied deltas (grace-dampened on reject; the ongoing modifier effect on accept).
    describe('Log event capture (ADR-0011)', () => {
        const pendingLog = (arg: any) => arg.gameManagement.pendingLog;

        it('records the dampened reject delta, not the authored amount', () => {
            mockState.gameManagement!.round = 1; // round 1 → ×0.25 grace dampening
            const law: Law = {
                id: 5,
                power: 'military',
                acceptMods: [],
                rejectMods: [{ stat: 'military', amount: -4, time: 1 }],
            };

            mockSet(handleDecision({ type: 'law', item: law, hasAccepted: false, state: mockState as GameState }));

            const arg = lastSetArg();
            // -4 dampened to round(-4 * 0.25) = -1 — the value actually applied to base.
            expect(arg.relations.current.military).toBe(-1);
            const event = pendingLog(arg).at(-1);
            expect(event.key).toBe('log.rejected_law');
            expect(event.labelKey).toBe('laws.labels.5');
            expect(event.deltas.military).toBe(-1);
        });

        it('records an accepted law as ongoing relations + one-time treasury/charisma reward', () => {
            const law: Law = {
                id: 1,
                power: 'military',
                acceptMods: [
                    { stat: 'treasury', amount: -50, time: 1 },
                    { stat: 'military', amount: 2, time: 0 },
                    { stat: 'business', amount: -1, time: 0 },
                ],
                rejectMods: [{ stat: 'military', amount: -1, time: 1 }],
            };

            mockSet(handleDecision({ type: 'law', item: law, hasAccepted: true, state: mockState as GameState }));

            const event = pendingLog(lastSetArg()).at(-1);
            expect(event.key).toBe('log.passed_law');
            expect(event.ongoing).toEqual({ military: 2, business: -1 });
            // One-time: the time:1 treasury that banks this round + the +1 charisma reward.
            expect(event.deltas).toEqual({ treasury: -50, charisma: 1 });
        });

        it('records a deal with its per-deal name label', () => {
            const deal: Deal = {
                id: 9,
                text: 't', acceptText: 'a', rejectText: 'r',
                acceptMods: [{ stat: 'treasury', amount: 80, time: 1 }, { stat: 'business', amount: 2, time: 0 }],
                rejectMods: [],
            };

            mockSet(handleDecision({ type: 'deal', item: deal, hasAccepted: true, state: mockState as GameState }));

            const event = pendingLog(lastSetArg()).at(-1);
            expect(event.key).toBe('log.accepted_deal_named');
            expect(event.labelKey).toBe('deals.9.name');
            expect(event.labelNs).toBe('deals');
            expect(event.deltas).toEqual({ treasury: 80 });
            expect(event.ongoing).toEqual({ business: 2 });
        });
    });

    describe('Reject-path base relation clamping', () => {
        it('clamps a reject gain to the maximum', () => {
            mockState.relations!.current.military = 9;
            const law: Law = {
                id: 1,
                power: 'military',
                acceptMods: [],
                rejectMods: [{ stat: 'military', amount: 5, time: 1 }],
            };

            mockSet(handleDecision({ type: 'law', item: law, hasAccepted: false, state: mockState as GameState }));

            expect(lastSetArg().relations.current.military).toBe(10);
        });

        it('clamps a reject penalty to the minimum', () => {
            mockState.relations!.current.people = -9;
            const law: Law = {
                id: 1,
                power: 'people',
                acceptMods: [],
                rejectMods: [{ stat: 'people', amount: -5, time: 1 }],
            };

            mockSet(handleDecision({ type: 'law', item: law, hasAccepted: false, state: mockState as GameState }));

            expect(lastSetArg().relations.current.people).toBe(-10);
        });
    });
});