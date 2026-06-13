/**
 * Meta-progression utility layer for Story 3-1.
 *
 * Persists cross-session player records (highest tier, endings unlocked) to
 * localStorage under the key `dict_meta`. All localStorage access is wrapped
 * in try/catch — a SecurityError or quota error fails silently so the game
 * can continue without crashing.
 *
 * Public API:
 *   loadMeta()                      → MetaProgress (safe default on failure)
 *   saveMeta(meta)                  → void (silent on failure)
 *   mergeMeta(existing, incoming)   → MetaProgress (pure, no side effects)
 *   recordGameEnd(tier, endingId)   → void (load → merge → save)
 *
 * Design doc: production/stories/3-1-meta-progression.md
 */

import type { EndingId, MetaProgress, TierRank } from '../types/MetaProgress';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'dict_meta';

/**
 * Numeric weights for tier comparison.
 * F=0, D=1, C=2, B=3, A=4, S=5
 */
const TIER_ORDER: Record<TierRank, number> = {
    F: 0,
    D: 1,
    C: 2,
    B: 3,
    A: 4,
    S: 5,
};

const TIER_FROM_VALUE: TierRank[] = ['F', 'D', 'C', 'B', 'A', 'S'];

const DEFAULT_META: MetaProgress = {
    highestTier: null,
    endingsUnlocked: [],
};

/**
 * Returns true if value is a well-formed MetaProgress object.
 * Used by importSave to guard against corrupt save files.
 */
export function isValidMetaProgress(value: unknown): value is MetaProgress {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    const v = value as Record<string, unknown>;
    if (!('highestTier' in v) || !('endingsUnlocked' in v)) return false;
    if (v.highestTier !== null && !(v.highestTier as string in TIER_ORDER)) return false;
    if (!Array.isArray(v.endingsUnlocked)) return false;
    return true;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Merges two MetaProgress records using best-of logic:
 * - `highestTier`: picks the higher rank; null counts as lower than any rank.
 * - `endingsUnlocked`: union — no duplicates, no removal of existing entries.
 *
 * Pure function — no side effects, no localStorage access.
 */
export function mergeMeta(existing: MetaProgress, incoming: MetaProgress): MetaProgress {
    // Tier merge
    let highestTier: TierRank | null = existing.highestTier;
    if (incoming.highestTier !== null) {
        if (highestTier === null) {
            highestTier = incoming.highestTier;
        } else {
            const existingVal = TIER_ORDER[highestTier];
            const incomingVal = TIER_ORDER[incoming.highestTier];
            highestTier = TIER_FROM_VALUE[Math.max(existingVal, incomingVal)];
        }
    }

    // Endings union (preserve order: existing first, then any new from incoming)
    const seen = new Set<EndingId>(existing.endingsUnlocked);
    for (const id of incoming.endingsUnlocked) {
        seen.add(id);
    }
    const endingsUnlocked: EndingId[] = Array.from(seen);

    return { highestTier, endingsUnlocked };
}

// ---------------------------------------------------------------------------
// localStorage I/O
// ---------------------------------------------------------------------------

/**
 * Reads MetaProgress from localStorage.
 * Returns the default empty state if localStorage is unavailable, the key
 * is absent, or the stored value cannot be parsed.
 */
export function loadMeta(): MetaProgress {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw === null) return { ...DEFAULT_META, endingsUnlocked: [] };
        const parsed = JSON.parse(raw) as Partial<MetaProgress>;
        return {
            highestTier: parsed.highestTier ?? null,
            endingsUnlocked: Array.isArray(parsed.endingsUnlocked) ? parsed.endingsUnlocked : [],
        };
    } catch {
        return { ...DEFAULT_META, endingsUnlocked: [] };
    }
}

/**
 * Writes a MetaProgress record to localStorage.
 * Fails silently if localStorage is unavailable or throws.
 */
export function saveMeta(meta: MetaProgress): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
    } catch {
        // SecurityError or quota exceeded — continue without saving
    }
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

/**
 * Records a completed game run: loads existing meta, merges in the new tier
 * and ending, then saves the result back to localStorage.
 *
 * This is the only function that should be called from game-end flow code.
 * Wiring to the game-end flow is out of scope for story 3-1 (handled in 3-4).
 */
export function recordGameEnd(tier: TierRank, endingId: EndingId): void {
    const existing = loadMeta();
    const incoming: MetaProgress = {
        highestTier: tier,
        endingsUnlocked: [endingId],
    };
    saveMeta(mergeMeta(existing, incoming));
}
