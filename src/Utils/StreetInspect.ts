import { STREET_INSPECT, type InspectEntry } from '../assets/streetInspect';
import { STATUES } from '../assets/ShopItems';
import { STREET_BAND_HIGH_MIN, STREET_BAND_LOW_MAX } from '../Constants/StreetInspect';
import {
    BUILDING_POOR_THRESHOLD,
    BUILDING_RICH_THRESHOLD,
    BUILDING_STAGE_MAX,
    BUILDING_STAGE_MIN,
} from '../Constants/BuildingDegradation';
import type { Modifier } from '../types/GameState';

/**
 * Pure helpers behind the street-view object inspector: which models are clickable,
 * which title variant an instance shows, and the one "real" line each card carries.
 * No store, React or Three.js imports — the Scene and the UI both call these.
 */

/** Card entry for a placed model, or undefined when the model is not inspectable. */
export function inspectEntryFor(modelName: string): InspectEntry | undefined {
    return STREET_INSPECT[modelName];
}

/** True when clicking this model should open an inspector card. */
export function isInspectable(modelName: string): boolean {
    return modelName in STREET_INSPECT;
}

/**
 * Stable variant pick for an instance: the same object always shows the same title,
 * neighbouring instances usually differ. Integer hash, not RNG (no seeded-cursor draw).
 *
 * @param instanceId placement instance id (IPL id or plan id)
 * @param count      number of variants available; ≤ 0 returns 0
 */
export function variantIndex(instanceId: number, count: number): number {
    if (count <= 0) return 0;
    let h = instanceId | 0;
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h ^= h >>> 16;
    return (h >>> 0) % count;
}

/** Live game numbers a card's real line reads. */
export interface InspectContext {
    /** Infrastructure slider value — the one the props' visibility bands read. */
    infrastructure: number;
    /** Effective infrastructure (slider + modifiers) — the one the round resolver feeds the condition stage. */
    effectiveInfrastructure: number;
    /** Security slider value — the one the security props' visibility bands read. */
    security: number;
    /** District condition stage, BUILDING_STAGE_MIN..BUILDING_STAGE_MAX. */
    conditionStage: number;
    /** Purchase round per statue slot (index = slot), undefined when unknown (debug fill). */
    statueRounds: ReadonlyArray<number | undefined>;
    /** Statues bought so far. */
    statueCount: number;
}

/** One translatable line: a key in the `street` namespace plus its interpolation params. */
export interface RealLine {
    key: string;
    params: Record<string, string | number>;
}

/** "+2" / "0" / "-3" — signed for the condition stage. */
function signed(n: number): string {
    return n > 0 ? `+${n}` : String(n);
}

/**
 * Purchase round per statue slot, from the active `statue.N` modifiers.
 *
 * @param modifiers the run's modifier ledger
 */
export function statueRoundsFrom(modifiers: ReadonlyArray<Modifier>): Array<number | undefined> {
    const rounds: Array<number | undefined> = STATUES.map(() => undefined);
    for (const m of modifiers) {
        if (m.type !== 'statue' || m.state !== 'active') continue;
        const slot = Number(m.id.split('.')[1]);
        if (Number.isInteger(slot) && slot >= 0 && slot < rounds.length) rounds[slot] = m.acquiredRound;
    }
    return rounds;
}

/**
 * The card's real line: what the object says about the stat behind it, and what
 * would change it. Thresholds come from constants, never from the copy.
 *
 * @param entry the model's inspect entry
 * @param ctx   live game numbers
 */
export function realLineFor(entry: InspectEntry, ctx: InspectContext): RealLine {
    switch (entry.gauge) {
        case 'infrastructure': {
            const tier = entry.tier === 'poor' || entry.tier === 'rich' ? entry.tier : 'normal';
            return {
                key: `real.infrastructure.${tier}`,
                params: { value: ctx.infrastructure, up: tier === 'poor' ? STREET_BAND_LOW_MAX + 1 : STREET_BAND_HIGH_MIN, down: tier === 'rich' ? STREET_BAND_HIGH_MIN : STREET_BAND_LOW_MAX + 1 },
            };
        }
        case 'security': {
            const tier = entry.tier === 'low' || entry.tier === 'high' ? entry.tier : 'medium';
            return {
                key: `real.security.${tier}`,
                params: { value: ctx.security, low: STREET_BAND_LOW_MAX, mid: STREET_BAND_LOW_MAX + 1, midTop: STREET_BAND_HIGH_MIN - 1, high: STREET_BAND_HIGH_MIN },
            };
        }
        case 'condition': {
            const infra = ctx.effectiveInfrastructure;
            const stage = ctx.conditionStage;
            // Same branch order as advanceConditionStage (src/Utils/BuildingDegradation.ts).
            const trend = infra <= BUILDING_POOR_THRESHOLD ? 'decay'
                : infra >= BUILDING_RICH_THRESHOLD ? (stage < BUILDING_STAGE_MAX ? 'upgrade' : 'peak')
                : stage < 0 ? 'repair'
                : stage > 0 ? 'fade'
                : 'stable';
            return {
                key: `real.condition.${trend}`,
                params: { stage: signed(stage), min: BUILDING_STAGE_MIN, max: signed(BUILDING_STAGE_MAX), infra, poor: BUILDING_POOR_THRESHOLD, rich: BUILDING_RICH_THRESHOLD },
            };
        }
        case 'statue': {
            const slot = entry.statueSlot ?? 0;
            const charisma = STATUES[slot]?.mods.reduce((sum, m) => (m.stat === 'charisma' ? sum + m.amount : sum), 0) ?? 0;
            const round = ctx.statueRounds[slot];
            return round === undefined
                ? { key: 'real.statue.undated', params: { charisma } }
                : { key: 'real.statue.dated', params: { charisma, round } };
        }
        case 'pedestal': {
            const slot = entry.statueSlot ?? 0;
            const next = STATUES[slot];
            return slot === ctx.statueCount && next
                ? { key: 'real.pedestal.next', params: { price: next.price } }
                : { key: 'real.pedestal.later', params: {} };
        }
    }
}
