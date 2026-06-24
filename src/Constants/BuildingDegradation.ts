/**
 * Tuning knobs for the building condition degradation system (Story 8-7, GDD §3.1).
 * `advanceConditionStage` in src/Utils/BuildingDegradation.ts consumes these.
 */

/** Infrastructure slider threshold at or below which buildings degrade (Poor tier). */
export const BUILDING_POOR_THRESHOLD = 3;
/** Infrastructure slider threshold at or above which buildings recover toward Rich (Rich tier). */
export const BUILDING_RICH_THRESHOLD = 8;

/** Stages lost per round when infrastructure is at Poor tier (fast neglect). */
export const BUILDING_DEGRADE_RATE = 2;
/** Stages gained per round when infrastructure is at Rich tier. */
export const BUILDING_RECOVER_RATE_RICH = 1;
/** Stages gained per round when infrastructure is Normal and conditionStage < 0 (repair). */
export const BUILDING_RECOVER_RATE_POOR_REPAIR = 1;
/** Stages lost per round when infrastructure is Normal and conditionStage > 0 (luxury decay). */
export const BUILDING_RECOVER_RATE_RICH_DECAY = 1;

/** Minimum conditionStage — all 5 building slots display the poor variant. */
export const BUILDING_STAGE_MIN = -5;
/** Maximum conditionStage — all 5 building slots display the rich variant. */
export const BUILDING_STAGE_MAX = 5;
