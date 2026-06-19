import { describe, it, expect } from 'vitest';
import { LAWS } from './laws';
import { DEALS } from './deals';
import { RECURRING, GAINS } from '../Constants/Costs';
import type { ModifierSpec } from '../types/GameState';
import enLaws from '../../public/locales/en/laws.json';
import esLaws from '../../public/locales/es/laws.json';
import enDeals from '../../public/locales/en/deals.json';
import esDeals from '../../public/locales/es/deals.json';

/**
 * Story 2-4 (re-expressed for ADR-0008 Amendment 2026-06-18 / Story 7-7):
 * content validation for the 9 lasting-effect entries (L-A..L-F laws,
 * D-A..D-C deals). Effects are now ModifierSpec[] (acceptMods); recurring
 * income/expense are roundIncome/roundExpense mods; the display label is on
 * `label`.
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

/** Amount of the first spec matching `stat` (undefined if none). */
const amountOf = (mods: ModifierSpec[], stat: ModifierSpec['stat']): number | undefined =>
    mods.find(m => m.stat === stat)?.amount;

const hasRecurring = (mods: ModifierSpec[]): boolean =>
    mods.some(m => m.stat === 'roundIncome' || m.stat === 'roundExpense');

const lawById = (id: number) => LAWS.find(l => l.id === id)!;
const dealById = (id: number) => DEALS.find(d => d.id === id)!;

describe('lasting-effect laws (L-A..L-F)', () => {
    it('all six laws exist with a recurring mod and a label', () => {
        for (const id of [39, 40, 41, 42, 43, 44]) {
            expect(lawById(id), `law ${id} missing`).toBeDefined();
            expect(lawById(id).label, `law ${id} has no label`).toBeDefined();
            expect(hasRecurring(lawById(id).acceptMods), `law ${id} has no recurring mod`).toBe(true);
        }
    });

    it('recurring amounts match the PRD tiers', () => {
        expect(amountOf(lawById(39).acceptMods, 'roundIncome')).toBe(RECURRING.LARGE);   // L-A +25
        expect(amountOf(lawById(40).acceptMods, 'roundExpense')).toBe(RECURRING.MEDIUM); // L-B −15
        expect(amountOf(lawById(41).acceptMods, 'roundExpense')).toBe(RECURRING.MEDIUM); // L-C −15
        expect(amountOf(lawById(42).acceptMods, 'roundIncome')).toBe(RECURRING.MEDIUM);  // L-D +15
        expect(amountOf(lawById(43).acceptMods, 'roundIncome')).toBe(RECURRING.MEDIUM);  // L-E +15
        expect(amountOf(lawById(44).acceptMods, 'roundExpense')).toBe(RECURRING.LARGE);  // L-F −25
    });

    it('income laws L-A, L-D, L-E carry the -2 opposing-people penalty', () => {
        for (const id of [39, 42, 43]) {
            expect(amountOf(lawById(id).acceptMods, 'people'), `law ${id} opposing penalty`).toBe(-GAINS.MEDIUM);
        }
    });

    it('one-time effects match the PRD table', () => {
        expect(amountOf(lawById(39).acceptMods, 'business')).toBe(1);
        expect(amountOf(lawById(39).acceptMods, 'people')).toBe(-2);
        expect(amountOf(lawById(40).acceptMods, 'people')).toBe(2);
        expect(amountOf(lawById(40).acceptMods, 'treasury')).toBe(-30);
        expect(amountOf(lawById(41).acceptMods, 'military')).toBe(1);
        expect(amountOf(lawById(41).acceptMods, 'treasury')).toBe(-20);
        expect(amountOf(lawById(42).acceptMods, 'military')).toBe(1);
        expect(amountOf(lawById(42).acceptMods, 'people')).toBe(-2);
        expect(amountOf(lawById(43).acceptMods, 'business')).toBe(1);
        expect(amountOf(lawById(43).acceptMods, 'people')).toBe(-2);
        expect(amountOf(lawById(44).acceptMods, 'people')).toBe(1);
        expect(amountOf(lawById(44).acceptMods, 'business')).toBe(1);
        expect(amountOf(lawById(44).acceptMods, 'treasury')).toBe(-30);
    });

    it('treasury specs are one-shot (time:1); recurring + relation specs permanent (time:0)', () => {
        const treasury = lawById(40).acceptMods.find(m => m.stat === 'treasury')!;
        const recurring = lawById(40).acceptMods.find(m => m.stat === 'roundExpense')!;
        const relation = lawById(40).acceptMods.find(m => m.stat === 'people')!;
        expect(treasury.time).toBe(1);
        expect(recurring.time).toBe(0);
        expect(relation.time).toBe(0);
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
    it('all three deals exist with a recurring mod, label and proposing power', () => {
        for (const id of [16, 17, 18]) {
            expect(dealById(id), `deal ${id} missing`).toBeDefined();
            expect(dealById(id).label, `deal ${id} has no label`).toBeDefined();
            expect(dealById(id).power, `deal ${id} must declare power (repeal target)`).toBeDefined();
            expect(hasRecurring(dealById(id).acceptMods), `deal ${id} has no recurring mod`).toBe(true);
        }
    });

    it('recurring amounts match the PRD tiers', () => {
        expect(amountOf(dealById(16).acceptMods, 'roundIncome')).toBe(RECURRING.MEDIUM);  // D-A +15
        expect(amountOf(dealById(17).acceptMods, 'roundExpense')).toBe(RECURRING.MEDIUM); // D-B −15
        expect(amountOf(dealById(18).acceptMods, 'roundExpense')).toBe(RECURRING.SMALL);  // D-C −8
    });

    it('one-time effects match the PRD table', () => {
        expect(amountOf(dealById(16).acceptMods, 'treasury')).toBe(40);
        expect(amountOf(dealById(16).acceptMods, 'business')).toBe(1);
        expect(amountOf(dealById(17).acceptMods, 'military')).toBe(2);
        expect(amountOf(dealById(17).acceptMods, 'treasury')).toBe(-30);
        expect(amountOf(dealById(18).acceptMods, 'people')).toBe(2);
        expect(amountOf(dealById(18).acceptMods, 'business')).toBe(-1);
    });

    it('deal ids are unique', () => {
        const ids = DEALS.map(d => d.id);
        expect(new Set(ids).size).toBe(ids.length);
    });
});

describe('i18n coverage for recurring content', () => {
    const labelledLaws = LAWS.filter(l => l.label);
    const labelledDeals = DEALS.filter(d => d.label);

    it('every law/deal label resolves in EN and ES', () => {
        for (const item of [...labelledLaws, ...labelledDeals]) {
            const key = item.label!;
            const [en, es] = key.startsWith('laws.') ? [enLaws, esLaws] : [enDeals, esDeals];
            expect(typeof resolveKey(en, key), `EN missing ${key}`).toBe('string');
            expect(typeof resolveKey(es, key), `ES missing ${key}`).toBe('string');
        }
    });

    it('every new law has an EN and ES name label', () => {
        for (const law of labelledLaws) {
            const key = `laws.labels.${law.id}`;
            expect(typeof resolveKey(enLaws, key), `EN missing ${key}`).toBe('string');
            expect(typeof resolveKey(esLaws, key), `ES missing ${key}`).toBe('string');
        }
    });

    it('every new deal has EN and ES text, acceptText and rejectText', () => {
        for (const deal of labelledDeals) {
            for (const field of [deal.text, deal.acceptText, deal.rejectText]) {
                expect(typeof resolveKey(enDeals, field), `EN missing ${field}`).toBe('string');
                expect(typeof resolveKey(esDeals, field), `ES missing ${field}`).toBe('string');
            }
        }
    });
});
