/**
 * CitizenHandler P1 — Generation + Immutable Identity (Story 7-1).
 *
 * Implements `buildCitizenRoster(initialRelations)`:
 *   • 25 citizens, fixed split: indices 0–10 → 'people', 11–17 → 'military',
 *     18–24 → 'business' (exactly 11 / 7 / 7 — constant, not RNG-driven).
 *   • Name drawn from FIRST_NAMES + LAST_NAMES tables via `getRandomFromList()`.
 *   • `skin` drawn from `getRandomNumberInRange(0, 4)`.
 *   • `bodySeed` drawn from `rollFloat()` — seeded cursor (ADR-0010), so body
 *     type is stable across save/reload (Edge Case 11).
 *   • No inline `Math.random()` — all draws go through named `Utils/Math` helpers.
 *   • Pure function: no store imports (ADR-0002).
 *
 * Constants for the rest of the citizen pipeline (P2/P3) live here as well so
 * all tuning knobs are co-located with the simulation that uses them. They are
 * exported to allow unit tests to reference canonical values without magic numbers.
 */

import type { Citizen, CitizenState } from '../types/Citizen';
import type { Power } from '../types/Power';
import { getRandomFromList, getRandomNumberInRange, rollFloat } from '../Utils/Math';

// ---------------------------------------------------------------------------
// Name tables (GDD §3.1 — diverse, Latin-American flavour)
// ---------------------------------------------------------------------------

const FIRST_NAMES: string[] = ["Juan",
    "José",
    "Carlos",
    "Luis",
    "Antonio",
    "Manuel",
    "Francisco",
    "Jorge",
    "Miguel",
    "Pedro",
    "Ángel",
    "Roberto",
    "Fernando",
    "Daniel",
    "Raúl",
    "Eduardo",
    "Enrique",
    "Ricardo",
    "Héctor",
    "Oscar",
    "Hugo",
    "Rubén",
    "Julio",
    "Mario",
    "Alberto"]

const LAST_NAMES: string[] = [
    'Reyes', 'Morales', 'Silva', 'Torres', 'Vargas', 'Herrera', 'Mendoza',
    'Castillo', 'Guerrero', 'Ramos', 'Rojas', 'Diaz', 'Perez', 'Soto',
    'Vega', 'Cruz', 'Ortiz', 'Navarro', 'Fuentes', 'Rios',
    'Alonso', 'Cabrera', 'Ibarra', 'Montes', 'Espinoza',
];

// ---------------------------------------------------------------------------
// Faction assignment — fixed-order, independent of RNG
// ---------------------------------------------------------------------------

/**
 * Faction assigned by citizen index (0-based). The split is deterministic so
 * every run has the same faction distribution regardless of seed.
 *
 * | Index range | Faction     | Count |
 * |-------------|-------------|-------|
 * | 0 – 10      | 'people'    | 11    |
 * | 11 – 17     | 'military'  |  7    |
 * | 18 – 24     | 'business'  |  7    |
 */
function factionForIndex(index: number): Power {
    if (index <= 10) return 'people';
    if (index <= 17) return 'military';
    return 'business';
}

// ---------------------------------------------------------------------------
// Tuning constants (GDD §7 — all gameplay values; exported for tests + P2/P3)
// ---------------------------------------------------------------------------

/** Total citizens in the simulation — also the population denominator (GDD §4.8). */
export const TOTAL_CITIZENS = 25;

/** Base real-world population the citizen roster maps to (GDD §4.8). */
export const BASE_POPULATION = 5_924_511;

/** Happiness (0–10) from which a ped can roll `gone` per round (GDD §4.3). */
export const GONE_HAPPINESS_THRESHOLD = 1;

/** Probability a ped at `happiness <= GONE_HAPPINESS_THRESHOLD` emigrates (GDD §4.3). */
export const GONE_CHANCE = 0.15;

/** Health budget value below which starvation risk activates (GDD §4.4). */
export const HEALTH_DEATH_THRESHOLD = 3;

/** Peak starvation probability at `health == 0` (GDD §4.4). */
export const DEATH_RATE_MAX = 0.15;

/** Happiness floor for `content` role; `happiness >= CONTENT_THRESHOLD` (GDD §4.3). */
export const CONTENT_THRESHOLD = 6;

/** Happiness floor for `neutral` role; `happiness >= NEUTRAL_THRESHOLD` (GDD §4.3). */
export const NEUTRAL_THRESHOLD = 4;

/** Number of protestors needed to reduce `peopleRelation` by 1 (GDD §4.6). */
export const PROTEST_DIVISOR = 3;

/** Maximum `peopleRelation` loss per round from protest feedback (GDD §4.6). */
export const PROTEST_FEEDBACK_CAP = 5;

/** Treasury drained per thief per round (GDD §4.6). */
export const THIEF_SKIM = 2;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate the 25-citizen roster from the currently seeded PRNG cursor (ADR-0010).
 *
 * Caller is responsible for calling `seedRng()` before this function so citizen
 * generation is part of the reproducible stream. (StateFactory.buildStartState
 * calls `seedRng(freshEntropy)` before the first draw — citizens follow immediately.)
 *
 * @param initialRelations  Round-1 effective relations per faction, used to
 *                          initialize each citizen's `lastFactionRelation` to 0
 *                          volatility on the first round (Edge Case 11).
 * @returns  Immutable `Citizen[]` (25 entries) and their initial `CitizenState[]`.
 */
export function buildCitizenRoster(
    initialRelations: Record<Power, number>,
): { citizens: Citizen[]; citizenStates: CitizenState[] } {
    const citizens: Citizen[] = [];
    const citizenStates: CitizenState[] = [];

    for (let i = 0; i < TOTAL_CITIZENS; i++) {
        const faction = factionForIndex(i);
        const firstName = getRandomFromList(FIRST_NAMES);
        const lastName = getRandomFromList(LAST_NAMES);
        const skin = getRandomNumberInRange(0, 4) as 0 | 1 | 2 | 3 | 4;
        // bodySeed drawn from rollFloat() — seeded cursor, not Math.random()
        const bodySeed = rollFloat();

        citizens.push({
            id: i,
            name: `${firstName} ${lastName}`,
            skin,
            faction,
            bodySeed,
        });

        citizenStates.push({
            alive: true,
            employed: true,       // will be recomputed by P2 on the first round
            happiness: 5,         // neutral start; recomputed by P2
            role: 'neutral',      // recomputed by P3
            lastFactionRelation: initialRelations[faction],
        });
    }

    return { citizens, citizenStates };
}
