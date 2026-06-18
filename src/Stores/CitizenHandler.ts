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
import { getRandomFromList, getRandomUniqueItem, getRandomNumberInRange, rollFloat, rollChance, Clamp } from '../Utils/Math';

// ---------------------------------------------------------------------------
// Name tables (GDD §3.1 — Latin-American male names; women/children deferred per GDD §3.1)
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
// P2 Tuning constants — Employment, Happiness, Body-type (GDD §4.1–4.5)
// ---------------------------------------------------------------------------

/** Relation weight in factionFortune: (rel/10) × FACTION_FORTUNE_REL_WEIGHT (GDD §4.1). */
export const FACTION_FORTUNE_REL_WEIGHT = 3;

/** Normalises a 0–10 budget to −1…+1: (budget − 5) / FACTION_FORTUNE_BUDGET_DIVISOR (GDD §4.1). */
export const FACTION_FORTUNE_BUDGET_DIVISOR = 5;

/** Charisma weight in charismaTerm: (charisma/10) × CHARISMA_TERM_WEIGHT (GDD §4.1). */
export const CHARISMA_TERM_WEIGHT = 2;

/** Happiness penalty applied to unemployed army/business peds each round (GDD §4.1). */
export const DISPLACEMENT_PENALTY = 2;

/** Scales relation swing to the volatility contribution (GDD §4.1). */
export const VOLATILITY_COEFFICIENT = 0.4;

/** Maximum volatility contribution per round — prevents runaway swings (GDD §4.1). */
export const VOLATILITY_CAP = 2;

/** businessTax percentage above which a −0.5 budgetSignal penalty fires (GDD §4.1). */
export const BUSINESS_TAX_PENALTY_THRESHOLD = 45;

/** peopleTax percentage above which a −0.5 budgetSignal penalty fires (GDD §4.1). */
export const PEOPLE_TAX_PENALTY_THRESHOLD = 30;

/** Amount subtracted from budgetSignal when the faction's tax threshold is exceeded (GDD §4.1). */
export const TAX_PENALTY_AMOUNT = 0.5;

/** Minimum security budget for army peds to remain employed (GDD §4.2). */
export const ARMY_SECURITY_THRESHOLD = 4;

/** Minimum infrastructure budget for business peds to remain employed (GDD §4.2). */
export const BUSINESS_INFRA_THRESHOLD = 3;

/** fatShare lerp lower bound at health = 0 (GDD §4.5). */
export const FAT_AT_ZERO = 0.05;
/** fatShare lerp upper bound at health = 10 (GDD §4.5). */
export const FAT_AT_MAX = 0.40;
/** slimShare lerp lower bound at health = 0 (GDD §4.5). */
export const SLIM_AT_ZERO = 0.70;
/** slimShare lerp upper bound at health = 10 (GDD §4.5). */
export const SLIM_AT_MAX = 0.15;

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
    const usedFirstNames = new Set<string>();
    const usedLastNames  = new Set<string>();

    for (let i = 0; i < TOTAL_CITIZENS; i++) {
        const faction = factionForIndex(i);
        const firstName = getRandomUniqueItem(FIRST_NAMES, usedFirstNames) ?? FIRST_NAMES[i];
        usedFirstNames.add(firstName);
        const lastName  = getRandomUniqueItem(LAST_NAMES, usedLastNames) ?? LAST_NAMES[i];
        usedLastNames.add(lastName);
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

/**
 * Whether a ped holds their faction role this round (GDD §4.2, Story 7-2).
 *
 * Caller must pre-compute `effectiveRelation` via `getEffectiveRelation` (ADR-0008)
 * before passing it here — this function is a pure threshold test.
 *
 * People are never displaced; they are the civilian baseline with nowhere to fall from.
 */
export function computeEmployment(
    faction: Power,
    effectiveRelation: number,
    security: number,
    infrastructure: number,
): boolean {
    switch (faction) {
        case 'military':
            return security >= ARMY_SECURITY_THRESHOLD && effectiveRelation >= 0;
        case 'business':
            return effectiveRelation >= 0 && infrastructure >= BUSINESS_INFRA_THRESHOLD;
        case 'people':
            return true;
        default:
            throw new Error(`computeEmployment: unhandled faction ${faction}`);
    }
}

/** All inputs to the per-ped happiness formula (GDD §4.1). Pass effective values — callers resolve via getEffectiveRelation / getEffectiveCharisma (ADR-0008). */
export interface HappinessInputs {
    faction: Power;
    /** Effective faction relation this round (ADR-0008). */
    effectiveRelation: number;
    /** Carried from the previous round's `lastFactionRelation` — drives the volatility term. */
    lastFactionRelation: number;
    /** Effective dictator charisma this round (ADR-0008). */
    effectiveCharisma: number;
    security: number;
    infrastructure: number;
    health: number;
    peopleTax: number;
    businessTax: number;
    /** Output of `computeEmployment` for this ped this round. */
    employed: boolean;
}

/**
 * Happiness for one ped this round (GDD §4.1, Story 7-2).
 * Returns a value in [0, 10] (clamped).
 *
 * Formula: `clamp(5 + factionFortune + charismaTerm − displacement − volatility, 0, 10)`
 * where displacement = DISPLACEMENT_PENALTY if army/business ped is unemployed, else 0.
 */
export function computeHappiness(inputs: HappinessInputs): number {
    const {
        faction, effectiveRelation, lastFactionRelation, effectiveCharisma,
        security, infrastructure, health, peopleTax, businessTax, employed,
    } = inputs;

    let budgetSignal: number;
    switch (faction) {
        case 'military':
            budgetSignal = (security - 5) / FACTION_FORTUNE_BUDGET_DIVISOR;
            break;
        case 'business':
            budgetSignal = (infrastructure - 5) / FACTION_FORTUNE_BUDGET_DIVISOR
                + (businessTax > BUSINESS_TAX_PENALTY_THRESHOLD ? -TAX_PENALTY_AMOUNT : 0);
            break;
        case 'people':
            budgetSignal = (health - 5) / FACTION_FORTUNE_BUDGET_DIVISOR
                + (peopleTax > PEOPLE_TAX_PENALTY_THRESHOLD ? -TAX_PENALTY_AMOUNT : 0);
            break;
        default:
            throw new Error(`computeHappiness: unhandled faction ${faction}`);
    }

    const factionFortune = (effectiveRelation / 10) * FACTION_FORTUNE_REL_WEIGHT + budgetSignal;
    const charismaTerm = (effectiveCharisma / 10) * CHARISMA_TERM_WEIGHT;
    // People are never displaced; displacement only applies to army/business peds (GDD §4.2)
    const displacement = faction !== 'people' && !employed ? DISPLACEMENT_PENALTY : 0;
    const volatility = Math.min(
        VOLATILITY_CAP,
        Math.abs(effectiveRelation - lastFactionRelation) * VOLATILITY_COEFFICIENT,
    );

    return Clamp(5 + factionFortune + charismaTerm - displacement - volatility, 0, 10);
}

/**
 * Body-type classification from a ped's fixed `bodySeed` and the current health
 * budget (GDD §4.5, Story 7-2).
 *
 * `bodySeed` is drawn once at generation via `rollFloat()` (ADR-0010) and never
 * changes. A ped only changes body type when health crosses their individual
 * threshold — identities stay visually stable while the crowd shifts over time.
 */
export function computeBodyType(bodySeed: number, health: number): 'slim' | 'fit' | 'fat' {
    const t = health / 10;
    const fatShare  = FAT_AT_ZERO  + (FAT_AT_MAX  - FAT_AT_ZERO)  * t;
    const slimShare = SLIM_AT_ZERO + (SLIM_AT_MAX - SLIM_AT_ZERO) * t;
    const fitShare  = Math.max(0, 1 - fatShare - slimShare);

    if (bodySeed < fatShare) return 'fat';
    if (bodySeed < fatShare + fitShare) return 'fit';
    return 'slim';
}

// ---------------------------------------------------------------------------
// P3 — Role Fork + Death + Feedback (GDD §4.3–§4.6, Story 7-3)
// ---------------------------------------------------------------------------

/**
 * Classify a citizen's street role for this round (GDD §4.3, Story 7-3).
 *
 * Flat elif chain — do NOT nest or collapse. `rollFn` is injected for deterministic
 * testing; pass `rollChance` from `Utils/Math` in production (commits the RNG
 * cursor — ADR-0010).
 */
export function computeRole(
    faction: Power,
    happiness: number,
    education: number,
    rollFn: (chance: number) => boolean,
): CitizenState['role'] {
    if (happiness >= CONTENT_THRESHOLD)                                         return 'content';
    else if (happiness >= NEUTRAL_THRESHOLD)                                    return 'neutral';
    else if (happiness <= GONE_HAPPINESS_THRESHOLD && rollFn(GONE_CHANCE))      return 'gone';
    else if (faction !== 'people')                                              return 'thief';
    else if (education <= 4)                                                    return 'thief';
    else                                                                        return 'protestor';
}

/**
 * Compute people-relation and treasury changes from this round's citizen roles (GDD §4.6, Story 7-3).
 *
 * `relDelta` is floor-divided and capped before subtraction; both outputs are
 * guarded against going below −10 or 0 respectively.
 */
export function computeFeedback(
    citizenStates: CitizenState[],
    currentPeopleRel: number,
    currentTreasury: number,
): { peopleRelation: number; treasury: number } {
    const protestorCount = citizenStates.filter(cs => cs.role === 'protestor').length;
    const thiefCount = citizenStates.filter(cs => cs.role === 'thief').length;
    const relDelta = Math.min(Math.floor(protestorCount / PROTEST_DIVISOR), PROTEST_FEEDBACK_CAP);
    return {
        peopleRelation: Math.max(currentPeopleRel - relDelta, -10),
        treasury: Math.max(currentTreasury - thiefCount * THIEF_SKIM, 0),
    };
}

/** All inputs to the per-round citizen simulation pipeline (GDD §4, Story 7-3). */
export interface CitizenPipelineInputs {
    citizens: Citizen[];
    citizenStates: CitizenState[];
    effectiveRelations: Record<Power, number>;
    effectiveCharisma: number;
    security: number;
    infrastructure: number;
    health: number;
    /** Education budget (0–10), used by the people-faction protestor/thief fork (GDD §4.3). */
    education: number;
    peopleTax: number;
    businessTax: number;
    /** people-relation value AFTER budget effects and tax penalties have resolved this round. */
    currentPeopleRel: number;
    /** Treasury value AFTER financials have resolved this round. */
    currentTreasury: number;
    /** Injected for testing — defaults to `rollChance` from `Utils/Math` in production (ADR-0010). */
    rollFn?: (chance: number) => boolean;
}

/**
 * Run the full citizen simulation pipeline for one round (GDD §4, Story 7-3).
 *
 * Order: employment → happiness → role → death → feedback.
 * `gone` and starvation death are mutually exclusive: a `gone` result exits early
 * and skips the starvation roll entirely (AC-11).
 *
 * Returns updated citizen states, a scaled `displayedPopulation`, and the
 * post-feedback `peopleRelation` and `treasury` for inclusion in the atomic set().
 */
export function resolveCitizenPipeline(inputs: CitizenPipelineInputs): {
    newCitizenStates: CitizenState[];
    newDisplayedPopulation: number;
    peopleRelation: number;
    treasury: number;
} {
    if (inputs.citizens.length === 0) {
        return {
            newCitizenStates: [],
            newDisplayedPopulation: 0,
            peopleRelation: inputs.currentPeopleRel,
            treasury: inputs.currentTreasury,
        };
    }

    const rollFn = inputs.rollFn ?? rollChance;

    const newCitizenStates: CitizenState[] = inputs.citizenStates.map((cs, i) => {
        if (!cs.alive) return cs;

        const ped = inputs.citizens[i];
        const effectiveRelation = inputs.effectiveRelations[ped.faction];

        const employed = computeEmployment(
            ped.faction, effectiveRelation, inputs.security, inputs.infrastructure,
        );
        const happiness = computeHappiness({
            faction: ped.faction,
            effectiveRelation,
            lastFactionRelation: cs.lastFactionRelation,
            effectiveCharisma: inputs.effectiveCharisma,
            security: inputs.security,
            infrastructure: inputs.infrastructure,
            health: inputs.health,
            peopleTax: inputs.peopleTax,
            businessTax: inputs.businessTax,
            employed,
        });

        const role = computeRole(ped.faction, happiness, inputs.education, rollFn);

        // Gone: exits early — starvation roll never called for this ped (AC-11, AC-22).
        if (role === 'gone') {
            return { ...cs, employed, happiness, role, alive: false, lastFactionRelation: effectiveRelation };
        }

        // Starvation: people-faction or unemployed army/business (employed elites immune — AC-10).
        let alive: boolean = cs.alive;
        if (!employed || ped.faction === 'people') {
            const starvationChance = inputs.health <= HEALTH_DEATH_THRESHOLD
                ? DEATH_RATE_MAX * (1 - inputs.health / HEALTH_DEATH_THRESHOLD)
                : 0;
            if (rollFn(starvationChance)) alive = false;
        }

        return { ...cs, employed, happiness, role, alive, lastFactionRelation: effectiveRelation };
    });

    const feedback = computeFeedback(newCitizenStates, inputs.currentPeopleRel, inputs.currentTreasury);
    const aliveCount = newCitizenStates.filter(cs => cs.alive).length;
    const newDisplayedPopulation = Math.round(aliveCount / TOTAL_CITIZENS * BASE_POPULATION);

    return {
        newCitizenStates,
        newDisplayedPopulation,
        peopleRelation: feedback.peopleRelation,
        treasury: feedback.treasury,
    };
}
