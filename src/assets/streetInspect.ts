/**
 * Street-view object inspector data: which placed models can be clicked, and which
 * card each one shows.
 *
 * A card is `family` + `tier`. Its copy lives in the `street` i18n namespace under
 * `props.<family>`: a `kind` caption, three row `labels`, and per tier a `titles`
 * pool (one picked per instance, stable), three row `values` and an optional
 * plaque `legend`. The `gauge` says which live game stat the card's one "real"
 * line reports (see src/Utils/StreetInspect.ts).
 *
 * Models missing from this table are not clickable (roads, plaza floor, skyline,
 * decals, flags, billboard).
 */

/** Which live stat a card's real line reports. */
export type InspectGauge = 'infrastructure' | 'security' | 'condition' | 'statue' | 'pedestal';

/** Copy family — one `props.<family>` block in the `street` locale namespace. */
export type InspectFamily =
    | 'bench' | 'streetlight' | 'tree' | 'planter' | 'bush' | 'fountain' | 'trashcan'
    | 'bld_mixeduse' | 'bld_apartment' | 'bld_commercial' | 'bld_civic' | 'bld_residential' | 'bld_terrace'
    | 'statue' | 'pedestal'
    | 'barricade' | 'guard_post' | 'camera_pole' | 'tank' | 'cannon' | 'gun_nest' | 'searchlight';

/**
 * Tier key inside a family block. Infrastructure props and buildings use
 * poor/normal/rich; security props low/medium/high (the IDE visibleIf band they
 * appear in); statues their metal; empty pedestals `empty`.
 */
export type InspectTier =
    | 'poor' | 'normal' | 'rich'
    | 'low' | 'medium' | 'high'
    | 'bronze' | 'silver' | 'gold'
    | 'empty';

/** One inspectable model's card. */
export interface InspectEntry {
    family: InspectFamily;
    tier: InspectTier;
    gauge: InspectGauge;
    /** Statues and pedestals only: the statue slot (0 = first purchase) — dates the statue / prices the next one. */
    statueSlot?: number;
}

/** Number of rows every card shows (labels and values arrays must have this length). */
export const INSPECT_ROW_COUNT = 3;

/** Inspectable models, keyed by IDE model name. */
export const STREET_INSPECT: Readonly<Record<string, InspectEntry>> = {
    // Street furniture — tier follows the infrastructure budget band
    env_parkbench_poor:              { family: 'bench',       tier: 'poor',   gauge: 'infrastructure' },
    env_parkbench_medium:            { family: 'bench',       tier: 'normal', gauge: 'infrastructure' },
    env_parkbench_rich:              { family: 'bench',       tier: 'rich',   gauge: 'infrastructure' },
    env_streetlight_poor:            { family: 'streetlight', tier: 'poor',   gauge: 'infrastructure' },
    env_streetlight_standard_medium: { family: 'streetlight', tier: 'normal', gauge: 'infrastructure' },
    env_streetlight_rich:            { family: 'streetlight', tier: 'rich',   gauge: 'infrastructure' },
    env_tree_poor:                   { family: 'tree',        tier: 'poor',   gauge: 'infrastructure' },
    env_tree_medium:                 { family: 'tree',        tier: 'normal', gauge: 'infrastructure' },
    env_tree_rich:                   { family: 'tree',        tier: 'rich',   gauge: 'infrastructure' },
    env_planter_poor:                { family: 'planter',     tier: 'poor',   gauge: 'infrastructure' },
    env_planter_normal:              { family: 'planter',     tier: 'normal', gauge: 'infrastructure' },
    env_planter_rich:                { family: 'planter',     tier: 'rich',   gauge: 'infrastructure' },
    env_bush_rich:                   { family: 'bush',        tier: 'rich',   gauge: 'infrastructure' },
    env_fountain_normal:             { family: 'fountain',    tier: 'normal', gauge: 'infrastructure' },
    env_fountain_rich:               { family: 'fountain',    tier: 'rich',   gauge: 'infrastructure' },
    env_trashcan_burning:            { family: 'trashcan',    tier: 'poor',   gauge: 'infrastructure' },

    // Buildings — variant follows the district condition stage
    env_bld_mixeduse_poor:      { family: 'bld_mixeduse',    tier: 'poor',   gauge: 'condition' },
    env_bld_mixeduse_normal:    { family: 'bld_mixeduse',    tier: 'normal', gauge: 'condition' },
    env_bld_mixeduse_rich:      { family: 'bld_mixeduse',    tier: 'rich',   gauge: 'condition' },
    env_bld_apartment_poor:     { family: 'bld_apartment',   tier: 'poor',   gauge: 'condition' },
    env_bld_apartment_normal:   { family: 'bld_apartment',   tier: 'normal', gauge: 'condition' },
    env_bld_apartment_rich:     { family: 'bld_apartment',   tier: 'rich',   gauge: 'condition' },
    env_bld_commercial_poor:    { family: 'bld_commercial',  tier: 'poor',   gauge: 'condition' },
    env_bld_commercial_normal:  { family: 'bld_commercial',  tier: 'normal', gauge: 'condition' },
    env_bld_commercial_rich:    { family: 'bld_commercial',  tier: 'rich',   gauge: 'condition' },
    env_bld_civic_poor:         { family: 'bld_civic',       tier: 'poor',   gauge: 'condition' },
    env_bld_civic_normal:       { family: 'bld_civic',       tier: 'normal', gauge: 'condition' },
    env_bld_civic_rich:         { family: 'bld_civic',       tier: 'rich',   gauge: 'condition' },
    env_bld_residential_poor:   { family: 'bld_residential', tier: 'poor',   gauge: 'condition' },
    env_bld_residential_normal: { family: 'bld_residential', tier: 'normal', gauge: 'condition' },
    env_bld_residential_rich:   { family: 'bld_residential', tier: 'rich',   gauge: 'condition' },
    env_bld_terrace_poor:       { family: 'bld_terrace',     tier: 'poor',   gauge: 'condition' },
    env_bld_terrace_normal:     { family: 'bld_terrace',     tier: 'normal', gauge: 'condition' },
    env_bld_terrace_rich:       { family: 'bld_terrace',     tier: 'rich',   gauge: 'condition' },

    // Statue row — slot N is the Nth purchase (bronze, silver, gold); empty pedestals price the next one
    env_statue_bronze:         { family: 'statue',   tier: 'bronze', gauge: 'statue',   statueSlot: 0 },
    env_statue_silver:         { family: 'statue',   tier: 'silver', gauge: 'statue',   statueSlot: 1 },
    env_statue_gold:           { family: 'statue',   tier: 'gold',   gauge: 'statue',   statueSlot: 2 },
    env_statue_pedestal_slot1: { family: 'pedestal', tier: 'empty',  gauge: 'pedestal', statueSlot: 0 },
    env_statue_pedestal_slot2: { family: 'pedestal', tier: 'empty',  gauge: 'pedestal', statueSlot: 1 },
    env_statue_pedestal_slot3: { family: 'pedestal', tier: 'empty',  gauge: 'pedestal', statueSlot: 2 },

    // Security props — tier is the security band the IDE shows them in
    env_streetbarricade_medium: { family: 'barricade',   tier: 'low',    gauge: 'security' },
    env_guard_post_small:       { family: 'guard_post',  tier: 'medium', gauge: 'security' },
    env_camera_pole_medium:     { family: 'camera_pole', tier: 'medium', gauge: 'security' },
    env_tank_large:             { family: 'tank',        tier: 'high',   gauge: 'security' },
    env_cannon_medium:          { family: 'cannon',      tier: 'high',   gauge: 'security' },
    env_gunnest_small:          { family: 'gun_nest',    tier: 'high',   gauge: 'security' },
    env_searchlight_large:      { family: 'searchlight', tier: 'high',   gauge: 'security' },
};

/** Every (family, tier) card the table can produce — the locale files must cover each one. */
export const INSPECT_CARDS: ReadonlyArray<{ family: InspectFamily; tier: InspectTier }> = (() => {
    const seen = new Set<string>();
    const out: Array<{ family: InspectFamily; tier: InspectTier }> = [];
    for (const { family, tier } of Object.values(STREET_INSPECT)) {
        const k = `${family}.${tier}`;
        if (seen.has(k)) continue;
        seen.add(k);
        out.push({ family, tier });
    }
    return out;
})();
