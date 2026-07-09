import { describe, it, expect } from 'vitest';
import { buildDeltas, formatDeltas, formatLogEvent, type TFn } from '../../../src/Utils/RoundLog';
import type { LogEvent } from '../../../src/types/GameState';

// Fake i18next `t`: looks up a small dictionary and interpolates {{vars}} from opts.
// Namespace is ignored (the dictionary is flat), which is all the formatter needs.
const DICT: Record<string, string> = {
    'log.passed_law': 'Passed law: {{label}}',
    'log.met_with': 'Met with {{power}}: {{action}}',
    'log.financials': 'Collected ${{income}}M, Paid ${{expenses}}M',
    'log.event.bought_media': 'Bought media influence over {{faction}}',
    'power.military': 'Military',
    'power.business': 'Business',
    'power.people': 'People',
    'meet.dialogue': 'Dialogue',
    'log.delta_charisma': 'Charisma',
    'log.delta_treasury': 'Treasury',
    'log.per_round_suffix': '/round',
    'laws.labels.5': 'Mandatory military training',
};

const t: TFn = (key, opts) => {
    let s = DICT[key] ?? key;
    if (opts) {
        for (const [k, v] of Object.entries(opts)) {
            if (k === 'ns') continue;
            s = s.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
        }
    }
    return s;
};

describe('buildDeltas', () => {
    it('keeps only non-zero stats', () => {
        expect(buildDeltas({ military: 0, people: 2, charisma: 0, treasury: -50 }))
            .toEqual({ people: 2, treasury: -50 });
    });

    it('returns undefined when nothing changed', () => {
        expect(buildDeltas({ military: 0, business: 0, people: 0, charisma: 0, treasury: 0 }))
            .toBeUndefined();
        expect(buildDeltas({})).toBeUndefined();
    });
});

describe('formatDeltas', () => {
    it('formats relations then charisma with signs', () => {
        const event: LogEvent = { key: 'x', deltas: { people: 1, charisma: 1 } };
        expect(formatDeltas(event, t)).toBe('People +1, Charisma +1');
    });

    it('formats negatives and treasury as money', () => {
        const event: LogEvent = { key: 'x', deltas: { military: -2, treasury: -50 } };
        expect(formatDeltas(event, t)).toBe('Military -2, Treasury -$50M');
    });

    it('tags ongoing contributions with /round', () => {
        const event: LogEvent = { key: 'x', ongoing: { military: 2, people: -1 } };
        expect(formatDeltas(event, t)).toBe('Military +2/round, People -1/round');
    });

    it('lists one-time deltas before ongoing ones', () => {
        const event: LogEvent = { key: 'x', deltas: { treasury: 120, charisma: 1 }, ongoing: { military: -2 } };
        expect(formatDeltas(event, t)).toBe('Charisma +1, Treasury +$120M, Military -2/round');
    });

    it('is empty when there are no deltas', () => {
        expect(formatDeltas({ key: 'x' }, t)).toBe('');
    });
});

describe('formatLogEvent', () => {
    it('interpolates a cross-namespace label and renders ongoing effects', () => {
        const event: LogEvent = {
            key: 'log.passed_law', labelKey: 'laws.labels.5', labelNs: 'laws',
            ongoing: { military: 2 },
        };
        const { headline, effects } = formatLogEvent(event, t);
        expect(headline).toBe('Passed law: Mandatory military training');
        expect(effects).toBe('Military +2/round');
    });

    it('resolves refParams (menu-ns key values) into the headline', () => {
        const event: LogEvent = {
            key: 'log.met_with',
            refParams: { power: 'power.military', action: 'meet.dialogue' },
            deltas: { people: 1, charisma: 1 },
        };
        const { headline, effects } = formatLogEvent(event, t);
        expect(headline).toBe('Met with Military: Dialogue');
        expect(effects).toBe('People +1, Charisma +1');
    });

    it('renders plain params and no effects line for the financials event', () => {
        const event: LogEvent = { key: 'log.financials', params: { income: 80, expenses: 60 } };
        const { headline, effects } = formatLogEvent(event, t);
        expect(headline).toBe('Collected $80M, Paid $60M');
        expect(effects).toBe('');
    });
});
