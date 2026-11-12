import { useMemo } from 'react';
import { useGameStore } from '../Stores/GameState';
import { STREET_IDE } from '../assets/data/street-objects.ide';
import { STREET_IPL } from '../assets/data/street-placement.ipl';
import type { ResolvedPlacement, TextureSlot } from '../types/WorldLayout';
import { countModifiersByType, getVisibleModifiers } from '../Utils/Modifiers';
import { STATUES } from '../assets/ShopItems';
import { buildingVariantForSlot, groundVariantSuffix } from '../Utils/BuildingDegradation';

const ideMap = new Map(STREET_IDE.objs.map((o) => [o.modelName, o]));

/** Ordered building slots: canonical (normal) IPL entries drive variant selection each round. */
interface BuildingSlot { normal: string; poor: string; rich: string | null; }
const BUILDING_SLOTS: BuildingSlot[] = [
    { normal: 'env_bld_mixeduse_normal',    poor: 'env_bld_mixeduse_poor',    rich: 'env_bld_mixeduse_rich' },
    { normal: 'env_bld_apartment_normal',   poor: 'env_bld_apartment_poor',   rich: 'env_bld_apartment_rich' },
    { normal: 'env_bld_commercial_normal',  poor: 'env_bld_commercial_poor',  rich: 'env_bld_commercial_rich' },
    { normal: 'env_bld_civic_normal',       poor: 'env_bld_civic_poor',       rich: 'env_bld_civic_rich' },
    { normal: 'env_bld_residential_normal', poor: 'env_bld_residential_poor', rich: 'env_bld_residential_rich' },
];

/** All non-canonical building variant names — IPL instances with these names are skipped;
 *  the canonical (normal) entry for that slot emits the correct variant placement. */
const BUILDING_VARIANT_NAMES = new Set(
    BUILDING_SLOTS.flatMap((s) => [s.poor, ...(s.rich ? [s.rich] : [])]),
);

/** Single-mesh ground objects whose GLB doesn't change between tiers — only the painted
 *  texture does, via textureVariantSuffix (art-bible §7.2.3). */
const GROUND_MODEL_NAMES = new Set(['env_roads', 'env_plaza']);

/**
 * Deduplicated texture slots across the entire IDE. Keyed by texture path; if the same
 * texture appears in multiple models, `transparent: true` wins (union). Used by
 * PlacedObjects to preload all textures once and build the per-slot TextureMap.
 */
export const STREET_TEXTURE_SLOTS: TextureSlot[] = (() => {
    const seen = new Map<string, boolean>();
    STREET_IDE.objs.forEach((o) =>
        (o.textures ?? []).forEach(({ texture, transparent }) => {
            seen.set(texture, (seen.get(texture) ?? false) || transparent);
        }),
    );
    return [...seen.entries()].map(([texture, transparent]) => ({ texture, transparent }));
})();

/** Flat URL list derived from STREET_TEXTURE_SLOTS — same order, for useLoader. */
export const STREET_TEXTURE_URLS: string[] = STREET_TEXTURE_SLOTS.map((s) => s.texture);

/**
 * Merges IDE definitions with IPL placements and filters by current game state.
 * Returns only instances whose visibleIf conditions are all satisfied.
 */
export function useStreetLayout(): ResolvedPlacement[] {
    const activeTab      = useGameStore((s) => s.tabs.activeTab);
    const infrastructure = useGameStore((s) => s.budget.expenditures.infrastructure);
    const security       = useGameStore((s) => s.budget.expenditures.security);
    const conditionStage = useGameStore((s) => s.gameManagement.conditionStage);
    const modifiers      = useGameStore((s) => s.gameManagement.modifiers);
    const round          = useGameStore((s) => s.gameManagement.round);
    const debugEnabled   = useGameStore((s) => s.debug.enabled);

    const visibleModifiers = useMemo(
        () => getVisibleModifiers(modifiers, round),
        [modifiers, round],
    );

    // Debug mode shows every statue slot filled (as the old palace placeholder did).
    const statueCount = debugEnabled ? STATUES.length : countModifiersByType(modifiers, 'statue');

    return useMemo((): ResolvedPlacement[] => {
        return STREET_IPL.inst.flatMap((inst): ResolvedPlacement[] => {
            // Building slot path: canonical (normal) IPL entries drive variant selection.
            // Fallback: a variant with no IDE entry renders the slot's normal model (name and asset).
            const slotIndex = BUILDING_SLOTS.findIndex((s) => s.normal === inst.modelName);
            if (slotIndex !== -1) {
                if (activeTab !== 'Street') return [];
                const slot = BUILDING_SLOTS[slotIndex];
                const variant = buildingVariantForSlot(slotIndex, conditionStage);
                const wanted = variant === 'poor'               ? slot.poor
                             : variant === 'rich' && slot.rich  ? slot.rich
                             : slot.normal;
                const variantName = ideMap.has(wanted) ? wanted : slot.normal;
                const def = ideMap.get(variantName)!;
                return [{
                    instanceId: inst.id,
                    modelName:  variantName,
                    asset:      def.asset,
                    textures:   def.textures ?? [],
                    pos:        inst.pos,
                    rot:        inst.rot,
                    scale:      inst.scale ?? [1, 1, 1],
                }];
            }

            // Skip variant (poor/rich) building IPL entries — the canonical entry handles them.
            if (BUILDING_VARIANT_NAMES.has(inst.modelName)) return [];

            // Standard visibleIf path for all non-building props.
            const def = ideMap.get(inst.modelName);
            if (!def) return [];

            const v = def.visibleIf;
            if (v) {
                if (v.tab !== undefined && v.tab !== activeTab) return [];
                if (v.infrastructure !== undefined) {
                    const [min, max] = v.infrastructure;
                    if (infrastructure < min || infrastructure > max) return [];
                }
                if (v.security !== undefined) {
                    const [min, max] = v.security;
                    if (security < min || security > max) return [];
                }
                if (v.modifier !== undefined) {
                    if (!visibleModifiers.some((m) => m.id === v.modifier)) return [];
                }
                if (v.minRound !== undefined && round < v.minRound) return [];
                if (v.statues !== undefined) {
                    const [min, max] = v.statues;
                    if (statueCount < min || statueCount > max) return [];
                }
            }

            const suffix = GROUND_MODEL_NAMES.has(inst.modelName) ? groundVariantSuffix(conditionStage) : '';

            return [{
                instanceId: inst.id,
                modelName:  inst.modelName,
                asset:      def.asset,
                textures:   def.textures ?? [],
                pos:        inst.pos,
                rot:        inst.rot,
                scale:      inst.scale ?? [1, 1, 1],
                ...(suffix ? { textureVariantSuffix: suffix } : {}),
            }];
        });
    }, [activeTab, infrastructure, security, conditionStage, round, visibleModifiers, statueCount]);
}
