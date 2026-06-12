import { describe, it, expect } from 'vitest';
import { LAWS } from './laws';
import { DEALS } from './deals';
import { RECURRING, GAINS } from '../Constants/Costs';
import enLaws from '../../public/locales/en/laws.json';
import esLaws from '../../public/locales/es/laws.json';
import enDeals from '../../public/locales/en/deals.json';
import esDeals from '../../public/locales/es/deals.json';

/**
 * Story 2-4: content validation for the 9 lasting-effect entries
 * (L-A..L-F laws, D-A..D-C deals) against the PRD Feature 1 table.
 *
 * Exact amounts are asserted on purpose — the PRD tier values ARE the spec
 * (boundary-value exception to the no-magic-numbers rule).
 */

/** Resolve a dotted i18n key (e.g. 'laws.recurring.x') inside a locale JSON object. */
function resolveKey(localeJson: object, key: string): unknown {
    return key.split('.').reduce<unknown>(
        (node, part) => (node as Record<string, unknown> | undefined)?.[part],
        localeJson,
    );
}

const lawById = (id: number) => LAWS.find(l => l.id === id)!;
const dealById = (id: number) => DEALS.find(d => d.id === id)!;

describe('lasting-effect laws (L-A..L-F)', () => {
    it('all six laws exist with a recurringEffect', () => {
        for (const id of [39, 40, 41, 42, 43, 44]) {
            expect(lawById(id), `law ${id} missing`).toBeDefined();
            expect(lawById(id).recurringEffect, `law ${id} has no recurringEffect`).toBeDefined();
        }
    });

    it('recurring amounts match the PRD tiers', () => {
        expect(lawById(39).recurringEffect!.incomeBonus).toBe(RECURRING.LARGE);   // L-A +25
        expect(lawById(40).recurringEffect!.expenseBonus).toBe(RECURRING.MEDIUM); // L-B −15
        expect(lawById(41).recurringEffect!.expenseBonus).toBe(RECURRING.MEDIUM); // L-C −15
        expect(lawById(42).recurringEffect!.incomeBonus).toBe(RECURRING.MEDIUM);  // L-D +15
        expect(lawById(43).recurringEffect!.incomeBonus).toBe(RECURRING.MEDIUM);  // L-E +15
        expect(lawById(44).recurringEffect!.expenseBonus).toBe(RECURRING.LARGE);  // L-F −25
    });

    it('income laws L-A, L-D, L-E carry the -2 opposing-people penalty', () => {
        for (const id of [39, 42, 43]) {
            expect(lawById(id).acceptEffect.people, `law ${id} opposing penalty`).toBe(-GAINS.MEDIUM);
        }
    });

    it('one-time effects match the PRD table', () => {
        expect(lawById(39).acceptEffect).toMatchObject({ business: 1, people: -2 });
        expect(lawById(40).acceptEffect).toMatchObject({ people: 2, treasury: -30 });
        expect(lawById(41).acceptEffect).toMatchObject({ military: 1, treasury: -20 });
        expect(lawById(42).acceptEffect).toMatchObject({ military: 1, people: -2 });
        expect(lawById(43).acceptEffect).toMatchObject({ business: 1, people: -2 });
        expect(lawById(44).acceptEffect).toMatchObject({ people: 1, business: 1, treasury: -30 });
    });

    it('proposing factions match the PRD table', () => {
        expect(lawById(39).power).toBe('business');
        expect(lawById(40).power).toBe('people');
        expect(lawById(41).power).toBe('military');
        expect(lawById(42).power).toBe('military');
        expect(lawById(43).power).toBe('business');
        expect(lawById(44).power).toBe('people');
    });

    it('law ids are unique (no pool collisions)', () => {
        const ids = LAWS.map(l => l.id);
        expect(new Set(ids).size).toBe(ids.length);
    });
});

describe('lasting-effect deals (D-A..D-C)', () => {
    it('all three deals exist with recurringEffect and a proposing power', () => {
        for (const id of [16, 17, 18]) {
            expect(dealById(id), `deal ${id} missing`).toBeDefined();
            expect(dealById(id).recurringEffect, `deal ${id} has no recurringEffect`).toBeDefined();
            expect(dealById(id).power, `deal ${id} must declare power (repeal target)`).toBeDefined();
        }
    });

    it('recurring amounts match the PRD tiers', () => {
        expect(dealById(16).recurringEffect!.incomeBonus).toBe(RECURRING.MEDIUM); // D-A +15
        expect(dealById(17).recurringEffect!.expenseBonus).toBe(RECURRING.MEDIUM); // D-B −15
        expect(dealById(18).recurringEffect!.expenseBonus).toBe(RECURRING.SMALL);  // D-C −8
    });

    it('one-time effects match the PRD table', () => {
        expect(dealById(16).acceptEffect).toMatchObject({ treasury: 40, business: 1 });
        expect(dealById(17).acceptEffect).toMatchObject({ military: 2, treasury: -30 });
        expect(dealById(18).acceptEffect).toMatchObject({ people: 2, business: -1 });
    });

    it('deal ids are unique', () => {
        const ids = DEALS.map(d => d.id);
        expect(new Set(ids).size).toBe(ids.length);
    });
});

describe('i18n coverage for recurring content', () => {
    const recurringLaws = LAWS.filter(l => l.recurringEffect);
    const recurringDeals = DEALS.filter(d => d.recurringEffect);

    it('every recurringEffect.label resolves in EN and ES', () => {
        for (const item of [...recurringLaws, ...recurringDeals]) {
            const key = item.recurringEffect!.label;
            const [en, es] = key.startsWith('laws.') ? [enLaws, esLaws] : [enDeals, esDeals];
            expect(typeof resolveKey(en, key), `EN missing ${key}`).toBe('string');
            expect(typeof resolveKey(es, key), `ES missing ${key}`).toBe('string');
        }
    });

    it('every new law has an EN and ES name label', () => {
        for (const law of recurringLaws) {
            const key = `laws.labels.${law.id}`;
            expect(typeof resolveKey(enLaws, key), `EN missing ${key}`).toBe('string');
            expect(typeof resolveKey(esLaws, key), `ES missing ${key}`).toBe('string');
        }
    });

    it('every new deal has EN and ES text, acceptText and rejectText', () => {
        for (const deal of recurringDeals) {
            for (const field of [deal.text, deal.acceptText, deal.rejectText]) {
                expect(typeof resolveKey(enDeals, field), `EN missing ${field}`).toBe('string');
                expect(typeof resolveKey(esDeals, field), `ES missing ${field}`).toBe('string');
            }
        }
    });
});
