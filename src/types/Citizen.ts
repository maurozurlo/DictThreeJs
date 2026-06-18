/**
 * Citizen identity and per-round state types for the Citizen Simulation.
 * (Story 7-1, GDD: design/gdd/citizen-simulation.md §3.1)
 *
 * ADR-0010: `bodySeed` is drawn once from `rollFloat()` at generation — seeded,
 * stable across save/reload. ADR-0002: all fields are plain JSON-serializable
 * values; no class instances.
 *
 * Faction uses the canonical `Power` type (`'military' | 'business' | 'people'`),
 * matching relations, coup system, and the Power constant array, so no translation
 * bridge is needed when reading effective relations in CitizenHandler P2/P3.
 */

import type { Power } from './Power';

// ---------------------------------------------------------------------------
// Immutable identity — set once at generation, never mutated post-creation
// ---------------------------------------------------------------------------

/**
 * A citizen's birth record. Fields here never change across the lifetime of a
 * run; they are generated once in `buildCitizenRoster` and restored as-is from
 * the save payload (never re-derived on load).
 */
export interface Citizen {
    /** Stable 0-based index within the 25-citizen roster. */
    id: number;
    /** First + last name; the identity anchor rendered in the inspector. */
    name: string;
    /** Skin-tone variant index, 0–4. */
    skin: 0 | 1 | 2 | 3 | 4;
    /**
     * Born faction allegiance — canonical `Power` type so P2/P3 can read
     * `getEffectiveRelation(state, faction)` directly with no mapping step.
     * Fixed split across every run: 11 `'people'` / 7 `'military'` / 7 `'business'`.
     */
    faction: Power;
    /**
     * Body-type seed drawn from `rollFloat()` at generation (seeded cursor,
     * ADR-0010). Value in [0, 1). Stable across save/reload — body type is
     * part of identity, not per-round state.
     */
    bodySeed: number;
}

// ---------------------------------------------------------------------------
// Mutable per-round state — recomputed by CitizenHandler P2/P3 each round
// ---------------------------------------------------------------------------

/**
 * The volatile record for a single citizen, overwritten during round resolution.
 * Kept separate from `Citizen` so the identity array can be stored read-only and
 * the state array can be patched atomically in the round resolution `set()`.
 */
export interface CitizenState {
    /** One-way flag: once false it stays false; dead citizens are never replaced. */
    alive: boolean;
    /**
     * Whether the ped holds their faction role this round:
     * - army: `security >= 4 AND militaryRel >= 0`
     * - business: `businessRel >= 0 AND infrastructure >= 3`
     * - people: always `true` (never displaced)
     */
    employed: boolean;
    /** Happiness 0–10 (clamped); the output of the §4.1 formula. */
    happiness: number;
    /**
     * What the ped *does* on the street this round.
     * `'gone'` is terminal — resolves to `alive = false` in the death step.
     */
    role: 'content' | 'neutral' | 'thief' | 'protestor' | 'gone';
    /**
     * Effective faction relation from the previous round. Carried forward to
     * compute `volatility` in the next round's happiness formula.
     * Initialized to the round-1 effective relation at generation so `volatility
     * == 0` on the first round (Edge Case 11).
     */
    lastFactionRelation: number;
}
