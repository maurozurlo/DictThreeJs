import type { Modifier, ModifierStat, ModifierType, ResolvedStatMod, ResolvedWindow } from '../types/GameState';
import type { Power } from '../types/Power';
import { GAMESTATE } from '../Constants/GameState';
import { Clamp } from './Math';

/**
 * Authoring-time timing registry (ADR-0008 §2). Content references a timing by
 * `id`; at acquisition the window is resolved to concrete rounds and stored on
 * the instance. Resolved windows are persisted — never the id — so a later
 * registry rebalance cannot retroactively alter a live save. Append-only.
 */
export interface TimeModifier {
    id: number;
    /** Rounds before the contribution starts (0 = immediate). */
    delay: number;
    /** Rounds active once started; null = permanent. */
    duration: number | null;
}

export const TIME_MODIFIERS: TimeModifier[] = [
    { id: 0, delay: 0, duration: null }, // immediate + permanent (statue, recurring income)
    { id: 1, delay: 0, duration: 1 },    // now, one round (very common)
    { id: 2, delay: 2, duration: null }, // delayed 2, then permanent (the cows)
];

/**
 * Resolve a TimeModifier id into a concrete window, anchored at `acquiredRound`.
 * Call once at acquisition; store the result on the ResolvedStatMod.
 */
export function resolveWindow(timeId: number, acquiredRound: number): ResolvedWindow {
    const t = TIME_MODIFIERS.find(tm => tm.id === timeId) ?? TIME_MODIFIERS[0];
    const startRound = acquiredRound + t.delay;
    return {
        startRound,
        endRound: t.duration === null ? null : startRound + t.duration,
    };
}

/**
 * Is a resolved window active at `round`? Exclusive upper bound (ADR-0008 §5):
 * active for startRound ≤ round < endRound; permanent once endRound is null.
 */
export function isWindowActive(w: ResolvedWindow, round: number): boolean {
    if (round < w.startRound) return false;
    return w.endRound === null || round < w.endRound;
}

/**
 * Sum every active, in-window modifier contribution to a given stat at `round`.
 * The single chokepoint that knows how to aggregate modifiers — gameplay and UI
 * both go through here. Rejected modifiers and out-of-window contributions are
 * skipped.
 */
export function sumModifiers(modifiers: Modifier[], stat: ModifierStat, round: number): number {
    let total = 0;
    for (const m of modifiers) {
        if (m.state !== 'active') continue;
        for (const sm of m.mods) {
            if (sm.stat === stat && isWindowActive(sm.window, round)) total += sm.amount;
        }
    }
    return total;
}

/**
 * Effective charisma used by all real-time calculations and the HUD:
 * base charisma (which fluctuates with gameplay) plus in-window modifier
 * contributions, clamped to the charisma bounds.
 */
export function getEffectiveCharisma(
    baseCharisma: number,
    modifiers: Modifier[],
    round: number,
): number {
    return Clamp(
        baseCharisma + sumModifiers(modifiers, 'charisma', round),
        GAMESTATE.CHARISMA.MIN,
        GAMESTATE.CHARISMA.MAX,
    );
}

/**
 * Effective faction relation: base (which still erodes via gameplay) plus
 * in-window modifier contributions, re-clamped to ±10 — mirrors charisma
 * (ADR-0008 §6). Coup/overthrow/special-ending read this; repeal penalty and
 * timer-skip target selection read base.
 */
export function getEffectiveRelation(
    baseRelation: number,
    modifiers: Modifier[],
    faction: Power,
    round: number,
): number {
    return Clamp(
        baseRelation + sumModifiers(modifiers, faction as ModifierStat, round),
        GAMESTATE.RELATIONS.MIN,
        GAMESTATE.RELATIONS.MAX,
    );
}

/**
 * Count active modifiers of a given type. Generic — the engine knows no content,
 * so the caller names the type (e.g. 'statue'). Single source of truth for
 * "how many of X do I own", replacing duplicated counters in the store.
 */
export function countModifiersByType(modifiers: Modifier[], type: ModifierType): number {
    return modifiers.reduce((n, m) => (m.type === type && m.state === 'active' ? n + 1 : n), 0);
}

/** Repeal cost tier — drives treasury/relation cost lookup (GAMESTATE.REPEAL_COST). */
export type RepealTier = 'Small' | 'Medium' | 'Large';

/**
 * Economic magnitude of a modifier (ADR-0008 §8): Σ|amount| over its
 * roundIncome/roundExpense contributions, frozen at acquisition. Stat-only
 * modifiers (charisma/relations) have magnitude 0.
 */
export function modifierEconomicMagnitude(mods: ResolvedStatMod[]): number {
    let total = 0;
    for (const sm of mods) {
        if (sm.stat === 'roundIncome' || sm.stat === 'roundExpense') total += Math.abs(sm.amount);
    }
    return total;
}

/**
 * Generic repeal tier from a modifier's economic magnitude (Story 6-4 balance
 * pass). Thresholds preserved from the legacy RecurringHandler.getRepealTier
 * (≤8 Small / ≤15 Medium / >15 Large) — parity-checked against all current
 * law/deal recurring content: each carries a single recurring mod, so
 * Σ|amount| == the legacy max(incomeBonus, expenseBonus). Stat-only modifiers
 * (magnitude 0) → Small (minimum cost; matches current weird-law behaviour).
 *
 * Parity table (current content):
 *   TINY 5  (Deal 19 cows)      → Small   (legacy Small)
 *   SMALL 8 (Deal 18 aid)       → Small   (legacy Small)
 *   MEDIUM 15 (most laws/deals) → Medium  (legacy Medium)
 *   LARGE 25 (gambling/works)   → Large   (legacy Large)
 *   weird-law / statue (0)      → Small   (legacy Small)
 */
export function computeRepealTier(mods: ResolvedStatMod[]): RepealTier {
    const magnitude = modifierEconomicMagnitude(mods);
    if (magnitude <= 8) return 'Small';
    if (magnitude <= 15) return 'Medium';
    return 'Large';
}

/** Result of the beginning-of-round onStart pass. */
export interface OnStartResult {
    /** The modifiers array with onStartFired flipped for any that fired this round. */
    modifiers: Modifier[];
    /** Modifiers whose narrative hook fired this round — caller looks up the headline by id. */
    fired: Modifier[];
}

/**
 * Beginning-of-round narrative-hook pass (ADR-0008 §7). Fires once per modifier
 * when `round` reaches its resolved onStartTriggerRound, guarded by onStartFired
 * so it survives save/load and never double-fires. The headline key itself is
 * content (looked up by id by the caller) — this only manages the guard and
 * reports which modifiers fired. Pure: returns a new array, mutates nothing.
 */
export function fireOnStartModifiers(modifiers: Modifier[], round: number): OnStartResult {
    const fired: Modifier[] = [];
    const next = modifiers.map(m => {
        if (
            !m.onStartFired &&
            m.onStartTriggerRound !== undefined &&
            round >= m.onStartTriggerRound
        ) {
            fired.push(m);
            return { ...m, onStartFired: true };
        }
        return m;
    });
    return { modifiers: next, fired };
}

/**
 * Active-modifier projection for Street View and Advisor (ADR-0008 §8 / TR-street-001).
 * Returns only active modifiers that have at least one stat contribution in-window at
 * `round`. Modifiers whose every contribution is still future (or that carry no mods,
 * e.g. the weird-law slot entry) are excluded — they have nothing to project yet.
 * Rejected modifiers are always excluded. Label text is looked up from content assets
 * by `id` at render time — the engine stores no display data.
 */
export function getVisibleModifiers(modifiers: Modifier[], round: number): Modifier[] {
    return modifiers.filter(m =>
        m.state === 'active' && m.mods.some(sm => isWindowActive(sm.window, round))
    );
}

/**
 * Normalize a possibly-legacy persisted modifier into the current schema
 * (ADR-0008 P1 save hygiene). Pre-engine saves stored statues as
 * `{ type:'statue', mods:[{stat,amount}] }` with no id/state/window. Default a
 * missing window to permanent-from-round-0 and missing state to 'active' so old
 * statues keep contributing identically.
 */
export function normalizeModifier(raw: unknown, index: number): Modifier {
    const m = raw as Partial<Modifier> & { mods?: unknown[] };
    const mods = (m.mods ?? []).map((smRaw) => {
        const sm = smRaw as { stat: ModifierStat; amount: number; window?: ResolvedWindow };
        return {
            stat: sm.stat,
            amount: sm.amount,
            window: sm.window ?? { startRound: 0, endRound: null },
        };
    });
    return {
        id: m.id ?? `${m.type ?? 'unknown'}.${index}`,
        type: m.type ?? 'unknown',
        state: m.state ?? 'active',
        acquiredRound: m.acquiredRound ?? 0,
        onStartTriggerRound: m.onStartTriggerRound,
        onStartFired: m.onStartFired,
        mods,
    };
}
