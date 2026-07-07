import { Clamp } from './Math';
import {
    BUILDING_POOR_THRESHOLD,
    BUILDING_RICH_THRESHOLD,
    BUILDING_DEGRADE_RATE,
    BUILDING_RECOVER_RATE_RICH,
    BUILDING_RECOVER_RATE_POOR_REPAIR,
    BUILDING_RECOVER_RATE_RICH_DECAY,
    BUILDING_STAGE_MIN,
    BUILDING_STAGE_MAX,
} from '../Constants/BuildingDegradation';

/** Number of building slots in the street scene. Each slot renders one variant. */
export const NUM_BUILDING_SLOTS = 5;

/**
 * Advances the building condition counter by one round.
 *
 * Degradation formula (GDD §3.1):
 *   infrastructure ≤ BUILDING_POOR_THRESHOLD                              → −BUILDING_DEGRADE_RATE
 *   infrastructure ≥ BUILDING_RICH_THRESHOLD AND stage < STAGE_MAX       → +BUILDING_RECOVER_RATE_RICH
 *   Normal tier AND stage < 0                                             → +BUILDING_RECOVER_RATE_POOR_REPAIR
 *   Normal tier AND stage > 0                                             → −BUILDING_RECOVER_RATE_RICH_DECAY
 *   otherwise (Normal tier, stage === 0)                                  → 0
 *
 * Output is always clamped to [BUILDING_STAGE_MIN, BUILDING_STAGE_MAX].
 *
 * @param conditionStage - current stage value
 * @param infrastructure - effective infrastructure slider value (post-modifier)
 */
export function advanceConditionStage(conditionStage: number, infrastructure: number): number {
    let delta: number;

    const isNormalTier = infrastructure > BUILDING_POOR_THRESHOLD && infrastructure < BUILDING_RICH_THRESHOLD;

    if (infrastructure <= BUILDING_POOR_THRESHOLD) {
        delta = -BUILDING_DEGRADE_RATE;
    } else if (infrastructure >= BUILDING_RICH_THRESHOLD && conditionStage < BUILDING_STAGE_MAX) {
        delta = BUILDING_RECOVER_RATE_RICH;
    } else if (isNormalTier && conditionStage < 0) {
        delta = BUILDING_RECOVER_RATE_POOR_REPAIR;
    } else if (isNormalTier && conditionStage > 0) {
        delta = -BUILDING_RECOVER_RATE_RICH_DECAY;
    } else {
        delta = 0;
    }

    return Clamp(conditionStage + delta, BUILDING_STAGE_MIN, BUILDING_STAGE_MAX);
}

/**
 * Returns the display variant for a single building slot given the current condition stage.
 *
 * Formula (GDD §3.1):
 *   poorSlotCount  = max(0, −conditionStage)
 *   richSlotCount  = max(0, +conditionStage)
 *   slot < poorSlotCount              → 'poor'
 *   slot < NUM_BUILDING_SLOTS − richSlotCount → 'normal'
 *   otherwise                         → 'rich'
 *
 * @param slotIndex     Zero-indexed building slot (0–4)
 * @param conditionStage Current stage from game state (−5 to +5)
 */
export function buildingVariantForSlot(slotIndex: number, conditionStage: number): 'poor' | 'normal' | 'rich' {
    const poorSlotCount = Math.max(0, -conditionStage);
    const richSlotCount = Math.max(0, conditionStage);
    if (slotIndex < poorSlotCount) return 'poor';
    if (slotIndex < NUM_BUILDING_SLOTS - richSlotCount) return 'normal';
    return 'rich';
}

/**
 * Texture-variant suffix for single-mesh ground objects (env_roads, env_plaza) whose GLB
 * geometry is identical across tiers — only the painted texture changes (art-bible §7.2.3).
 * Unlike buildings there is no per-slot partial conversion: the whole mesh flips at once.
 * No rich variant exists yet, mirroring the building system's current poor/normal-only state.
 *
 * @param conditionStage Current stage from game state (−5 to +5)
 */
export function groundVariantSuffix(conditionStage: number): '_poor' | '' {
    return conditionStage < 0 ? '_poor' : '';
}
