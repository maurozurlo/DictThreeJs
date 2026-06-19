/**
 * Modifier ⇄ content bridge (ADR-0008 §4 — "no content in the engine").
 *
 * The timed-modifier engine (src/Utils/Modifiers.ts) stores only runtime instance
 * state keyed by a namespaced `id` (e.g. 'laws.39', 'deals.16', 'weird.1001'). This
 * module is the single place that maps those ids back to their authoring content —
 * the i18n label and the proposing faction — and that builds recurring/weird-law
 * modifiers from law/deal assets at acceptance. It also migrates legacy
 * `ActiveRecurringEffect` save entries (ADR-0008 P2 one-way migration).
 *
 * Pure: no store access. Mirrors buildShopModifier in ShopItems.ts.
 */

import { LAWS } from './laws';
import { DEALS } from './deals';
import { WEIRD_LAWS } from './weirdLaws';
import { resolveWindow } from '../Utils/Modifiers';
import type { Modifier, ModifierSpec, ModifierType, ResolvedStatMod } from '../types/GameState';
import type { Power } from '../types/Power';

/** Modifier types that appear in the Active-Legislation / repeal list (laws + deals + weird laws). */
const REPEALABLE_TYPES: ModifierType[] = ['law-recurring', 'deal', 'weird-law'];

/** True for modifiers the player can repeal from the Log's Active-Legislation list. */
export function isRepealable(m: Modifier): boolean {
    return REPEALABLE_TYPES.includes(m.type);
}

/** Namespaced modifier id for a law's recurring effect — the dedup + content-lookup key. */
export function lawModifierId(lawId: number): string {
    return `laws.${lawId}`;
}

/** Namespaced modifier id for a deal's recurring effect. */
export function dealModifierId(dealId: number): string {
    return `deals.${dealId}`;
}

/** Namespaced modifier id for a weird law's ledger/slot entry. */
export function weirdLawModifierId(lawId: number): string {
    return `weird.${lawId}`;
}

/**
 * Build a Modifier instance from a content item's `acceptMods`/`rejectMods`
 * (ADR-0008 Amendment 2026-06-18). Each authoring ModifierSpec's `time` is
 * resolved to a concrete window at acquisition. Replaces the old
 * `buildRecurringModifier` bridge — laws (relations + recurring + treasury) and
 * deals now produce one modifier carrying all their contributions.
 */
export function buildContentModifier(
    id: string,
    type: ModifierType,
    specs: ModifierSpec[],
    round: number,
    state: 'active' | 'rejected' = 'active',
): Modifier {
    const mods: ResolvedStatMod[] = specs.map(s => ({
        stat: s.stat,
        amount: s.amount,
        window: resolveWindow(s.time, round),
    }));
    return { id, type, state, acquiredRound: round, mods };
}

/**
 * Build a weird-law ledger/slot Modifier. Weird-law stat effects are applied as
 * immediate base mutations on accept (ADR-0008 class A), so the modifier carries
 * no contributions — it exists to enforce the "one weird law active" slot, drive
 * the Street View consequence, and serve as a repealable ledger entry.
 */
export function buildWeirdLawModifier(lawId: number, round: number): Modifier {
    return {
        id: weirdLawModifierId(lawId),
        type: 'weird-law',
        state: 'active',
        acquiredRound: round,
        mods: [],
    };
}

/** Display content for a modifier: the i18n label key + proposing faction (null = no faction). */
export interface ModifierContent {
    /** i18n key for the effect's name (laws/deals namespace, or weird-law label). */
    label: string;
    /** Faction whose base relation a repeal penalises; null for weird laws (no proposer). */
    faction: Power | null;
}

/**
 * Resolve a modifier id back to its display content. The engine never stores the
 * label or faction — they live on the law/deal asset and are looked up here by id.
 * Returns undefined for ids with no content mapping (e.g. statues, unknown).
 */
export function getModifierContent(id: string): ModifierContent | undefined {
    const dot = id.indexOf('.');
    if (dot < 0) return undefined;
    const ns = id.slice(0, dot);
    const numId = Number(id.slice(dot + 1));
    if (Number.isNaN(numId)) return undefined;

    if (ns === 'laws') {
        const law = LAWS.find(l => l.id === numId);
        if (!law?.label) return undefined;
        return { label: law.label, faction: law.power };
    }
    if (ns === 'deals') {
        const deal = DEALS.find(d => d.id === numId);
        if (!deal?.label) return undefined;
        return { label: deal.label, faction: deal.power ?? null };
    }
    if (ns === 'weird') {
        const law = WEIRD_LAWS.find(l => l.id === numId);
        if (!law) return undefined;
        return { label: `laws.weird.${numId}.label`, faction: null };
    }
    return undefined;
}

// ---------------------------------------------------------------------------
// Legacy save migration (ADR-0008 P2, one-way)
// ---------------------------------------------------------------------------

/** Shape of a legacy ActiveRecurringEffect entry as persisted in pre-P2 saves. */
interface LegacyRecurringEffect {
    sourceId: string;
    sourceType: 'law' | 'deal' | 'opportunity' | 'weird-law';
    sourceFaction?: Power;
    label?: string;
    incomeBonus?: number;
    expenseBonus?: number;
    roundActivated?: number;
}

const LEGACY_TYPE_MAP: Record<LegacyRecurringEffect['sourceType'], { ns: string; type: ModifierType }> = {
    law: { ns: 'laws', type: 'law-recurring' },
    deal: { ns: 'deals', type: 'deal' },
    'weird-law': { ns: 'weird', type: 'weird-law' },
    opportunity: { ns: 'opportunity', type: 'opportunity' },
};

/**
 * Convert one legacy ActiveRecurringEffect into a Modifier (ADR-0008 P2 migration).
 * Legacy entries were always active, so income/expense become permanent windows
 * (immediate from round 1). The numeric id suffix is parsed from sourceId
 * (e.g. 'law-39' → 'laws.39', 'weird-law-1001' → 'weird.1001').
 */
export function migrateLegacyEffect(effect: LegacyRecurringEffect): Modifier {
    const { ns, type } = LEGACY_TYPE_MAP[effect.sourceType] ?? { ns: 'unknown', type: 'unknown' as ModifierType };
    const numId = effect.sourceId.split('-').pop() ?? '0';
    const window = { startRound: 1, endRound: null };
    const mods: ResolvedStatMod[] = [];
    if ((effect.incomeBonus ?? 0) > 0) mods.push({ stat: 'roundIncome', amount: effect.incomeBonus!, window });
    if ((effect.expenseBonus ?? 0) > 0) mods.push({ stat: 'roundExpense', amount: effect.expenseBonus!, window });
    return {
        id: `${ns}.${numId}`,
        type,
        state: 'active',
        acquiredRound: effect.roundActivated ?? 1,
        mods,
    };
}
