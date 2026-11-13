import { describe, expect, it } from 'vitest';
import enStreet from '../../../src/../public/locales/en/street.json';
import esStreet from '../../../src/../public/locales/es/street.json';
import { STREET_IDE } from '../../../src/assets/data/street-objects.ide';
import { STREET_IPL } from '../../../src/assets/data/street-placement.ipl';
import { PED_OBSTACLE_FOOTPRINT } from '../../../src/Constants/Traffic';
import { INSPECT_CARDS, INSPECT_ROW_COUNT, STREET_INSPECT, type InspectEntry } from '../../../src/assets/streetInspect';
import { STREET_BAND_HIGH_MIN, STREET_BAND_LOW_MAX } from '../../../src/Constants/StreetInspect';
import { BUILDING_STAGE_MAX, BUILDING_STAGE_MIN } from '../../../src/Constants/BuildingDegradation';
import { GAMESTATE } from '../../../src/Constants/GameState';
import { STATUES } from '../../../src/assets/ShopItems';
import { advanceConditionStage } from '../../../src/Utils/BuildingDegradation';
import {
    isInspectable,
    realLineFor,
    statueRoundsFrom,
    variantIndex,
    type InspectContext,
} from '../../../src/Utils/StreetInspect';
import type { Modifier } from '../../../src/types/GameState';
import { useGameStore } from '../../../src/Stores/GameState';

/** IDE models deliberately left out of the inspector (ground, backdrop, decals, flags, ads). */
const NOT_INSPECTABLE = new Set([
    'env_roads', 'env_plaza', 'env_skyline',
    'env_flagpole_large', 'env_flag_small', 'env_billboard', 'env_scaffolding_large',
    'env_graffiti_decal', 'env_pothole_decal', 'env_burned_decal',
]);

const LOCALES = { en: enStreet, es: esStreet } as const;
const EXPENDITURE_MAX = GAMESTATE.BUDGET.BOUNDS.EXPENDITURE.MAX;
const EXPENDITURE_MIN = GAMESTATE.BUDGET.BOUNDS.EXPENDITURE.MIN;

/** Walk a dotted path through a locale object. */
function at(obj: unknown, path: string): unknown {
    return path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj);
}

const ctx = (over: Partial<InspectContext> = {}): InspectContext => ({
    infrastructure: 5,
    effectiveInfrastructure: 5,
    security: 5,
    conditionStage: 0,
    statueRounds: [undefined, undefined, undefined],
    statueCount: 0,
    ...over,
});

/** Band an inspect tier maps to, as an inclusive [min, max] budget range. */
function bandFor(tier: InspectEntry['tier']): [number, number] {
    if (tier === 'poor' || tier === 'low') return [EXPENDITURE_MIN, STREET_BAND_LOW_MAX];
    if (tier === 'rich' || tier === 'high') return [STREET_BAND_HIGH_MIN, EXPENDITURE_MAX];
    return [STREET_BAND_LOW_MAX + 1, STREET_BAND_HIGH_MIN - 1];
}

describe('street inspector — card table', () => {
    const ideNames = new Set(STREET_IDE.objs.map((o) => o.modelName));

    it('test_every_inspectable_model_exists_in_the_ide', () => {
        for (const name of Object.keys(STREET_INSPECT)) expect(ideNames, name).toContain(name);
    });

    it('test_every_ide_model_is_inspectable_or_explicitly_excluded', () => {
        const uncovered = [...ideNames].filter((n) => !isInspectable(n) && !NOT_INSPECTABLE.has(n));
        expect(uncovered).toEqual([]);
        for (const n of NOT_INSPECTABLE) expect(isInspectable(n), n).toBe(false);
    });

    it('test_tier_bands_match_ide_visibleif_ranges', () => {
        for (const [name, entry] of Object.entries(STREET_INSPECT)) {
            if (entry.gauge !== 'infrastructure' && entry.gauge !== 'security') continue;
            const vis = STREET_IDE.objs.find((o) => o.modelName === name)?.visibleIf;
            const range = entry.gauge === 'infrastructure' ? vis?.infrastructure : vis?.security;
            expect(range, name).toEqual(bandFor(entry.tier));
        }
    });

    it('test_statue_slots_cover_each_shop_statue_once', () => {
        const statues = Object.values(STREET_INSPECT).filter((e) => e.family === 'statue').map((e) => e.statueSlot);
        const pedestals = Object.values(STREET_INSPECT).filter((e) => e.family === 'pedestal').map((e) => e.statueSlot);
        const slots = STATUES.map((_, i) => i);
        expect([...statues].sort()).toEqual(slots);
        expect([...pedestals].sort()).toEqual(slots);
    });
});

describe('street inspector — locale copy', () => {
    for (const [lng, file] of Object.entries(LOCALES)) {
        it(`test_${lng}_has_a_complete_card_for_every_family_tier`, () => {
            for (const { family, tier } of INSPECT_CARDS) {
                const base = `props.${family}`;
                expect(at(file, `${base}.kind`), `${lng} ${base}.kind`).toEqual(expect.any(String));
                const labels = at(file, `${base}.labels`) as string[];
                expect(labels, `${lng} ${base}.labels`).toHaveLength(INSPECT_ROW_COUNT);
                const titles = at(file, `${base}.${tier}.titles`) as string[];
                expect(Array.isArray(titles) && titles.length > 0, `${lng} ${base}.${tier}.titles`).toBe(true);
                expect(at(file, `${base}.${tier}.values`), `${lng} ${base}.${tier}.values`).toHaveLength(INSPECT_ROW_COUNT);
                if (family === 'statue' || family === 'pedestal') {
                    expect(at(file, `${base}.${tier}.legend`), `${lng} ${base}.${tier}.legend`).toEqual(expect.any(String));
                }
            }
        });

        it(`test_${lng}_copy_has_no_empty_strings_or_emojis`, () => {
            const strings: string[] = [];
            const walk = (v: unknown) => {
                if (typeof v === 'string') strings.push(v);
                else if (v && typeof v === 'object') Object.values(v).forEach(walk);
            };
            walk(file);
            for (const s of strings) {
                expect(s.trim().length, JSON.stringify(s)).toBeGreaterThan(0);
                expect(/\p{Extended_Pictographic}/u.test(s), s).toBe(false);
            }
        });
    }

    it('test_en_and_es_have_identical_key_shapes', () => {
        const shape = (v: unknown): unknown =>
            Array.isArray(v) ? `array:${v.length}`
            : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x)]))
            : typeof v;
        expect(shape(esStreet)).toEqual(shape(enStreet));
    });
});

describe('street inspector — real line', () => {
    /** Every real line the table can produce, across the state space that matters. */
    function allRealLines() {
        const lines = [];
        for (const entry of Object.values(STREET_INSPECT)) {
            for (let v = EXPENDITURE_MIN; v <= EXPENDITURE_MAX; v++) {
                for (let stage = BUILDING_STAGE_MIN; stage <= BUILDING_STAGE_MAX; stage++) {
                    for (const statueCount of [0, 1, 2, 3]) {
                        lines.push(realLineFor(entry, ctx({
                            infrastructure: v, effectiveInfrastructure: v, security: v, conditionStage: stage, statueCount,
                            statueRounds: statueCount > 0 ? [2, 5, 9] : [undefined, undefined, undefined],
                        })));
                    }
                }
            }
        }
        return lines;
    }

    it('test_every_real_line_key_exists_in_both_locales_with_its_params', () => {
        const byKey = new Map(allRealLines().map((l) => [l.key, l]));
        for (const line of byKey.values()) {
            for (const [lng, file] of Object.entries(LOCALES)) {
                const text = at(file, line.key);
                expect(typeof text, `${lng} ${line.key}`).toBe('string');
                const vars = [...(text as string).matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
                for (const v of vars) expect(Object.keys(line.params), `${lng} ${line.key} {{${v}}}`).toContain(v);
            }
        }
    });

    it('test_condition_trend_agrees_with_advance_condition_stage', () => {
        const building: InspectEntry = STREET_INSPECT.env_bld_civic_normal;
        for (let infra = EXPENDITURE_MIN; infra <= EXPENDITURE_MAX; infra++) {
            for (let stage = BUILDING_STAGE_MIN; stage <= BUILDING_STAGE_MAX; stage++) {
                const next = advanceConditionStage(stage, infra);
                const trend = realLineFor(building, ctx({ effectiveInfrastructure: infra, conditionStage: stage })).key.split('.').pop();
                if (trend === 'upgrade' || trend === 'repair') expect(next, `${trend} ${infra}/${stage}`).toBeGreaterThan(stage);
                else if (trend === 'fade') expect(next, `${trend} ${infra}/${stage}`).toBeLessThan(stage);
                else if (trend === 'decay') expect(next < stage || stage === BUILDING_STAGE_MIN, `${trend} ${infra}/${stage}`).toBe(true);
                else expect(next, `${trend} ${infra}/${stage}`).toBe(stage);
            }
        }
    });

    it('test_condition_line_uses_effective_infrastructure_not_the_slider', () => {
        const line = realLineFor(STREET_INSPECT.env_bld_civic_normal, ctx({ infrastructure: 9, effectiveInfrastructure: 2, conditionStage: 0 }));
        expect(line.key).toBe('real.condition.decay');
        expect(line.params.infra).toBe(2);
    });

    it('test_statue_line_is_dated_from_its_purchase_round', () => {
        const rounds = statueRoundsFrom([
            { id: 'statue.0', type: 'statue', state: 'active', acquiredRound: 3, mods: [] },
            { id: 'statue.1', type: 'statue', state: 'rejected', acquiredRound: 6, mods: [] },
            { id: 'laws.5', type: 'law', state: 'active', acquiredRound: 1, mods: [] },
        ] as Modifier[]);
        expect(rounds).toEqual([3, undefined, undefined]);
        expect(realLineFor(STREET_INSPECT.env_statue_bronze, ctx({ statueRounds: rounds }))).toEqual({ key: 'real.statue.dated', params: { charisma: 1, round: 3 } });
        expect(realLineFor(STREET_INSPECT.env_statue_silver, ctx({ statueRounds: rounds })).key).toBe('real.statue.undated');
    });

    it('test_only_the_next_empty_pedestal_quotes_a_price', () => {
        const c = ctx({ statueCount: 1 });
        expect(realLineFor(STREET_INSPECT.env_statue_pedestal_slot2, c)).toEqual({ key: 'real.pedestal.next', params: { price: STATUES[1].price } });
        expect(realLineFor(STREET_INSPECT.env_statue_pedestal_slot3, c).key).toBe('real.pedestal.later');
    });

    it('test_infrastructure_line_reports_the_slider_and_the_band_edges', () => {
        expect(realLineFor(STREET_INSPECT.env_parkbench_medium, ctx({ infrastructure: 6 })))
            .toEqual({ key: 'real.infrastructure.normal', params: { value: 6, up: STREET_BAND_HIGH_MIN, down: STREET_BAND_LOW_MAX + 1 } });
        expect(realLineFor(STREET_INSPECT.env_parkbench_poor, ctx({ infrastructure: 2 })).params.up).toBe(STREET_BAND_LOW_MAX + 1);
        expect(realLineFor(STREET_INSPECT.env_parkbench_rich, ctx({ infrastructure: 9 })).params.down).toBe(STREET_BAND_HIGH_MIN);
    });
});

describe('street inspector — variant pick', () => {
    it('test_variant_index_is_stable_and_in_range', () => {
        for (let id = 0; id < 200; id++) {
            const v = variantIndex(id, 3);
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(3);
            expect(variantIndex(id, 3)).toBe(v);
        }
        expect(variantIndex(42, 0)).toBe(0);
        expect(variantIndex(100_007, 1)).toBe(0);
    });

    it('test_neighbouring_instances_use_every_variant', () => {
        const seen = new Set(Array.from({ length: 12 }, (_, i) => variantIndex(19 + i, 3)));
        expect(seen.size).toBe(3);
    });
});

describe('street inspector — selection store', () => {
    it('test_selecting_a_prop_replaces_a_selected_citizen_and_null_clears', () => {
        const { select } = useGameStore.getState().scene;
        select({ kind: 'ped', id: 4 });
        expect(useGameStore.getState().scene.selection).toEqual({ kind: 'ped', id: 4 });
        select({ kind: 'prop', instanceId: 19, modelName: 'env_parkbench_medium' });
        expect(useGameStore.getState().scene.selection).toEqual({ kind: 'prop', instanceId: 19, modelName: 'env_parkbench_medium' });
        select(null);
        expect(useGameStore.getState().scene.selection).toBeNull();
    });
});

describe('electric poles removed', () => {
    it('test_no_electric_pole_in_ide_ipl_or_ped_obstacles', () => {
        expect(STREET_IDE.objs.some((o) => o.modelName.includes('electricpole'))).toBe(false);
        expect(STREET_IPL.inst.some((i) => i.modelName.includes('electricpole'))).toBe(false);
        expect(PED_OBSTACLE_FOOTPRINT.some((f) => f.prefix.includes('electricpole'))).toBe(false);
    });
});
