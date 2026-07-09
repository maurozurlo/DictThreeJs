// Structured round-log formatting (ADR-0011). The store records each happening as
// a LogEvent carrying the *actual* applied deltas; this module turns those events
// into the two-line (headline + indented effects) text shown in the Log tab. Pure
// and translation-agnostic: it receives a `t` function so it is fully unit-testable
// and so the whole log re-localises on language switch.

import type { LogDeltas, LogEvent } from '../types/GameState';
import { dumbifyText } from './String';

/** Minimal translator shape — satisfied by i18next's `t` and by test fakes. */
export type TFn = (key: string, options?: Record<string, unknown>) => string;

/** Relation stats, in display order. */
const RELATION_KEYS = ['military', 'business', 'people'] as const;

/** "+3" / "-2" — always signed. */
function signed(n: number): string {
    return n > 0 ? `+${n}` : `${n}`;
}

/** "+$20M" / "-$50M" — signed treasury amount in millions. */
function signedMoney(n: number): string {
    return `${n > 0 ? '+' : '-'}$${Math.abs(n)}M`;
}

/** Relation before/after → LogDeltas diff bag (ADR-0011). */
export function relationDiff(
    before: Record<'military' | 'business' | 'people', number>,
    after: Record<'military' | 'business' | 'people', number>,
): LogDeltas {
    return {
        military: after.military - before.military,
        business: after.business - before.business,
        people: after.people - before.people,
    };
}

/**
 * Keep only the non-zero stats of a raw delta bag, returning `undefined` when
 * nothing changed. Capture sites pass computed before/after diffs through this so
 * an event only carries the stats it actually moved.
 */
export function buildDeltas(raw: LogDeltas): LogDeltas | undefined {
    const out: LogDeltas = {};
    let any = false;
    (['military', 'business', 'people', 'charisma', 'treasury'] as const).forEach((k) => {
        const v = raw[k];
        if (typeof v === 'number' && v !== 0) {
            out[k] = v;
            any = true;
        }
    });
    return any ? out : undefined;
}

/**
 * Render one delta bag into its component strings (e.g. ["People +1", "Charisma +1"]).
 * `perRound` appends the "/round" tag used for an accepted law/deal's ongoing
 * contribution. Stat names come from the menu namespace (power.*, log.delta_*).
 */
function deltaParts(deltas: LogDeltas | undefined, t: TFn, perRound: boolean): string[] {
    if (!deltas) return [];
    const suffix = perRound ? t('log.per_round_suffix') : '';
    const parts: string[] = [];
    RELATION_KEYS.forEach((k) => {
        const v = deltas[k];
        if (typeof v === 'number' && v !== 0) parts.push(`${t(`power.${k}`)} ${signed(v)}${suffix}`);
    });
    if (typeof deltas.charisma === 'number' && deltas.charisma !== 0) {
        parts.push(`${t('log.delta_charisma')} ${signed(deltas.charisma)}${suffix}`);
    }
    if (typeof deltas.treasury === 'number' && deltas.treasury !== 0) {
        parts.push(`${t('log.delta_treasury')} ${signedMoney(deltas.treasury)}${suffix}`);
    }
    return parts;
}

/**
 * Join a log event's one-time and ongoing deltas into a single effects line,
 * e.g. "People +2/round, Charisma +1". Empty string when the event has no deltas.
 */
export function formatDeltas(event: LogEvent, t: TFn): string {
    return [
        ...deltaParts(event.deltas, t, false),
        ...deltaParts(event.ongoing, t, true),
    ].join(', ');
}

/**
 * Format a log event into its headline and (optional) effects line. The headline
 * resolves refParams (menu-ns key values) and an optional cross-namespace label
 * before interpolating `key`; the effects line is the joined delta parts.
 */
export function formatLogEvent(
    event: LogEvent,
    t: TFn,
    dumbScore = 0,
): { headline: string; effects: string } {
    const refs: Record<string, string> = {};
    if (event.refParams) {
        for (const [name, refKey] of Object.entries(event.refParams)) refs[name] = t(refKey);
    }

    let label: string | undefined;
    if (event.labelKey) {
        const raw = t(event.labelKey, event.labelNs ? { ns: event.labelNs } : undefined);
        label = event.dumb ? dumbifyText(raw, dumbScore) : raw;
    }

    const params = {
        ...event.params,
        ...refs,
        ...(label !== undefined ? { label } : {}),
        ...(event.keyNs ? { ns: event.keyNs } : {}),
    };

    return {
        headline: t(event.key, params),
        effects: formatDeltas(event, t),
    };
}
