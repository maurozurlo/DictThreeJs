import { GAMESTATE } from '../Constants/GameState';
import type { GameState } from '../types/GameState';
import type { Power } from '../types/Power';
import type { Expenditures } from '../types/Budget';

/**
 * Visual Consequence Registry (TR-lasting-009, story 2-9).
 *
 * Data-only scaffolding: maps game-state conditions to visual asset slots so
 * the 3D team can wire rendering in a future sprint without touching this file's
 * shape. No 3D calls are made here — `getActiveVisualConsequences` is a pure
 * evaluator (ADR-0002 Handler Contract: state in → array out, no store imports).
 */

/**
 * Trigger condition for a visual consequence. AND logic across all provided
 * fields — undefined fields are ignored (always pass).
 */
export type VisualTriggerCondition = {
    /** Matches when an entry with this sourceId exists in activeRecurringEffects. */
    activeRecurringEffectId?: string;
    /** Restricts factionRelation to one faction. Without factionRelation this field has no effect. */
    faction?: Power;
    /** Relation range check — applies to `faction` if set, otherwise matches if ANY faction is in range. */
    factionRelation?: { gte?: number; lte?: number };
    /** Budget slider range check on the given expenditure key. */
    budgetSlider?: { key: Expenditures; gte?: number; lte?: number };
    /** Current round range check. */
    round?: { gte?: number; lte?: number };
};

/** Where in the scene the 3D team should mount the asset. */
export type VisualLayerHint =
    | 'street-prop-foreground'
    | 'street-prop-background'
    | 'street-overlay'
    | 'meet-character-badge'
    | 'plaza-prop';

/** One registry entry: a condition mapped to a placeholder asset slot. */
export type VisualConsequenceEntry = {
    id: string;
    /** Human-readable description for the 3D team. */
    label: string;
    condition: VisualTriggerCondition;
    /** Placeholder slot name, e.g. "casino_sign" — 3D implementation fills this later. */
    assetSlot: string;
    layer: VisualLayerHint;
    position?: { x: number; y: number; z: number };
    /** Entry IDs this entry replaces when active (removed from the result). */
    exclusive?: string[];
};

/**
 * Starter registry — 5 entries (PRD Feature 5).
 * sourceId strings use the real `${sourceType}-${law.id}` format from
 * RecurringHandler: law-39 = L-A Legalize Gambling, law-40 = L-B Free Housing.
 */
export const VISUAL_CONSEQUENCES: VisualConsequenceEntry[] = [
    {
        id: 'casino-sign',
        label: 'Casino sign on main street',
        condition: { activeRecurringEffectId: 'law-39' }, // L-A: Legalize Gambling
        assetSlot: 'casino_sign',
        layer: 'street-prop-foreground',
    },
    {
        id: 'military-checkpoint',
        label: 'Military checkpoint on corner',
        condition: { budgetSlider: { key: 'security', gte: 8 } },
        assetSlot: 'military_checkpoint',
        layer: 'street-prop-foreground',
    },
    {
        id: 'dilapidated-buildings',
        label: 'Crumbling building facades',
        condition: { budgetSlider: { key: 'infrastructure', lte: 2 } },
        assetSlot: 'dilapidated_buildings',
        layer: 'street-prop-background',
        exclusive: ['normal-buildings', 'high-end-buildings'],
    },
    {
        id: 'faction-coup-crown',
        label: 'Faction power badge in Meet (coup warning)',
        condition: { factionRelation: { gte: GAMESTATE.COUP.WARN_RELATION } }, // coup yellow-warning threshold
        assetSlot: 'faction_crown_badge',
        layer: 'meet-character-badge',
    },
    {
        id: 'public-housing-blocks',
        label: 'Public housing towers in background',
        condition: { activeRecurringEffectId: 'law-40' }, // L-B: Free Housing Program
        assetSlot: 'public_housing_blocks',
        layer: 'street-prop-background',
        exclusive: ['dilapidated-buildings'],
    },
    // Weird deal visual stubs (Story 5-3) — 3D assets wired in Sprint 5 visual pass
    {
        id: 'deal-19-tiny-cows',
        label: 'Tiny cows wander parks and sidewalks (Dog-Sized Cow Initiative)',
        condition: { activeRecurringEffectId: 'deal-19' },
        assetSlot: 'weird_tiny_cows',
        layer: 'street-prop-foreground',
    },
    {
        id: 'deal-20-giant-mouse',
        label: 'Giant mouse-shaped building on plaza (Giant National Computer Mouse)',
        condition: { activeRecurringEffectId: 'deal-20' },
        assetSlot: 'weird_giant_mouse',
        layer: 'plaza-prop',
    },
    {
        id: 'deal-21-pigeon-cameras',
        label: 'Pigeons wear tiny cameras (Strategic Pigeon Surveillance Program)',
        condition: { activeRecurringEffectId: 'deal-21' },
        assetSlot: 'weird_pigeon_cameras',
        layer: 'street-prop-foreground',
    },
    // Weird law visual stubs (Story 5-2) — 3D assets wired in Sprint 5 visual pass
    {
        id: 'weird-cemeteries',
        label: 'Zombies wander streets (24/7 Cemeteries Act)',
        condition: { activeRecurringEffectId: 'weird-law-1001' },
        assetSlot: 'weird_cemeteries_zombies',
        layer: 'street-prop-foreground',
    },
    {
        id: 'weird-pigeon-hats',
        label: 'All pigeons wear tiny hats (Mandatory Pigeon Hats)',
        condition: { activeRecurringEffectId: 'weird-law-1002' },
        assetSlot: 'weird_pigeon_hats',
        layer: 'street-prop-foreground',
    },
    {
        id: 'weird-night-sun',
        label: 'A second sun appears (Night Sun Initiative)',
        condition: { activeRecurringEffectId: 'weird-law-1003' },
        assetSlot: 'weird_night_sun',
        layer: 'street-overlay',
    },
    {
        id: 'weird-skeletons',
        label: 'Skeletons appear on plaza (Skeleton Employment Act)',
        condition: { activeRecurringEffectId: 'weird-law-1005' },
        assetSlot: 'weird_skeletons',
        layer: 'plaza-prop',
    },
    {
        id: 'weird-giraffes',
        label: 'Random giraffes appear (National Giraffe Appreciation Act)',
        condition: { activeRecurringEffectId: 'weird-law-1007' },
        assetSlot: 'weird_giraffes',
        layer: 'street-prop-background',
    },
    {
        id: 'weird-idling',
        label: 'Citizens stop moving (Public Idling Initiative)',
        condition: { activeRecurringEffectId: 'weird-law-1008' },
        assetSlot: 'weird_idling_citizens',
        layer: 'street-prop-foreground',
    },
    {
        id: 'weird-building-height',
        label: 'All buildings same height (Building Height Equality Act)',
        condition: { activeRecurringEffectId: 'weird-law-1009' },
        assetSlot: 'weird_building_height',
        layer: 'street-prop-background',
    },
    {
        id: 'weird-water-coolers',
        label: 'Meet room full of water coolers (Department of Water Coolers)',
        condition: { activeRecurringEffectId: 'weird-law-1010' },
        assetSlot: 'weird_water_coolers',
        layer: 'meet-character-badge',
    },
    {
        id: 'weird-backwards-walking',
        label: 'Some pedestrians walk backwards (Mandatory Backwards Walking Friday)',
        condition: { activeRecurringEffectId: 'weird-law-1011' },
        assetSlot: 'weird_backwards_walking',
        layer: 'street-prop-foreground',
    },
    {
        id: 'weird-statues',
        label: 'Plaza holds 10 mini statues (Ministry of Excessive Statues)',
        condition: { activeRecurringEffectId: 'weird-law-1012' },
        assetSlot: 'weird_statues',
        layer: 'plaza-prop',
    },
    {
        id: 'weird-left-traffic',
        label: 'Vehicles drive on left side (National Left-Handed Traffic Trial)',
        condition: { activeRecurringEffectId: 'weird-law-1013' },
        assetSlot: 'weird_left_traffic',
        layer: 'street-prop-foreground',
    },
    {
        id: 'weird-ghosts',
        label: 'Transparent citizens appear (Legal Recognition of Ghosts)',
        condition: { activeRecurringEffectId: 'weird-law-1014' },
        assetSlot: 'weird_ghosts',
        layer: 'street-prop-foreground',
    },
];

/** Checks a gte/lte range against a value. Undefined bounds always pass. */
function inRange(value: number, range: { gte?: number; lte?: number }): boolean {
    if (range.gte !== undefined && value < range.gte) return false;
    if (range.lte !== undefined && value > range.lte) return false;
    return true;
}

/** Evaluates one condition against the state. AND logic — every defined field must match. */
function conditionMet(
    condition: VisualTriggerCondition,
    state: GameState,
    activeIds: Set<string>
): boolean {
    if (condition.activeRecurringEffectId !== undefined
        && !activeIds.has(condition.activeRecurringEffectId)) return false;

    if (condition.factionRelation !== undefined) {
        const relations = state.relations.current;
        if (condition.faction !== undefined) {
            if (!inRange(relations[condition.faction], condition.factionRelation)) return false;
        } else {
            const anyMatch = (Object.keys(relations) as Power[])
                .some(p => inRange(relations[p], condition.factionRelation!));
            if (!anyMatch) return false;
        }
    }

    if (condition.budgetSlider !== undefined
        && !inRange(state.budget.expenditures[condition.budgetSlider.key], condition.budgetSlider)) return false;

    if (condition.round !== undefined
        && !inRange(state.gameManagement.round, condition.round)) return false;

    return true;
}

/**
 * Returns the registry entries whose conditions match the current game state.
 *
 * Pure function (ADR-0002): no store access, no side effects. Exclusion is
 * applied in a second pass so it works regardless of registry array order —
 * an active entry removes every ID in its `exclusive` list from the result.
 */
export function getActiveVisualConsequences(state: GameState): VisualConsequenceEntry[] {
    const activeIds = new Set(state.gameManagement.activeRecurringEffects.map(e => e.sourceId));

    const matched = VISUAL_CONSEQUENCES.filter(entry => conditionMet(entry.condition, state, activeIds));

    const excluded = new Set<string>();
    matched.forEach(entry => entry.exclusive?.forEach(id => excluded.add(id)));

    return matched.filter(entry => !excluded.has(entry.id));
}
