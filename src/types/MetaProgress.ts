/**
 * Meta-progression types for Story 3-1.
 *
 * MetaProgress persists cross-session player records (highest tier achieved,
 * endings unlocked) to localStorage and is embedded in .dict save files so
 * records survive a browser clear.
 *
 * Design doc: production/stories/3-1-meta-progression.md
 */

/** Performance tier ranking, ordered F (worst) → S (best). */
export type TierRank = 'F' | 'D' | 'C' | 'B' | 'A' | 'S';

/**
 * Every terminal game-ending the player can reach.
 * Maps 1-to-1 with EndCause values in GameState plus the special-room and
 * victory endings. See the Ending ID table in story 3-1.
 */
export type EndingId =
    | 'military'
    | 'business'
    | 'people'
    | 'bankruptcy'
    | 'military_coup'
    | 'business_coup'
    | 'people_coup'
    | 'victory'
    | 'secret_room_0_good'
    | 'secret_room_0_bad'
    | 'secret_room_1_good'
    | 'secret_room_1_bad'
    | 'secret_room_2_good'
    | 'secret_room_2_bad';

/**
 * Cross-session progress record.
 * Plain-object shape — no class instances — so it round-trips through
 * JSON.stringify/parse cleanly (ADR-0002 serialization rules).
 */
export type MetaProgress = {
    /** The highest performance tier the player has ever achieved, or null if
     *  no game has been completed yet. */
    highestTier: TierRank | null;
    /** All ending IDs the player has ever seen; no duplicates. */
    endingsUnlocked: EndingId[];
};
