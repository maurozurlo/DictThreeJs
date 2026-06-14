export const COSTS = {
    SMALL: 10,
    MEDIUM: 20,
    LARGE: 50
};

export const GAINS = {
    SMALL: 1,
    MEDIUM: 2,
    LARGE: 3
};

/** Per-round recurring effect tiers (lasting-effects PRD Feature 1, TR-lasting-004). */
export const RECURRING = {
    /** Below SMALL — used for minor flavour deals (e.g. Deal 19 Tiny Cows +5/round). */
    TINY: 5,
    SMALL: 8,
    MEDIUM: 15,
    LARGE: 25,
    /** Pool weighting: max lasting-income laws offered per run (no-cap mitigation 2). */
    MAX_INCOME_LAWS_PER_RUN: 3
};
