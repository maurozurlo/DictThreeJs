import { useMemo } from 'react';
import { useGameStore } from '../Stores/GameState';
import { STREET_IDE } from '../assets/data/street-objects.ide';
import { STREET_IPL } from '../assets/data/street-placement.ipl';
import type { ResolvedPlacement, TextureSlot } from '../types/WorldLayout';
import { getVisibleModifiers } from '../Utils/Modifiers';

const ideMap = new Map(STREET_IDE.objs.map((o) => [o.modelName, o]));

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
    const modifiers      = useGameStore((s) => s.gameManagement.modifiers);
    const round          = useGameStore((s) => s.gameManagement.round);

    const visibleModifiers = useMemo(
        () => getVisibleModifiers(modifiers, round),
        [modifiers, round],
    );

    return useMemo((): ResolvedPlacement[] => {
        return STREET_IPL.inst.flatMap((inst): ResolvedPlacement[] => {
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
            }

            return [{
                instanceId: inst.id,
                modelName:  inst.modelName,
                asset:      def.asset,
                textures:   def.textures ?? [],
                pos:        inst.pos,
                rot:        inst.rot,
                scale:      inst.scale ?? [1, 1, 1],
            }];
        });
    }, [activeTab, infrastructure, security, round, visibleModifiers]);
}
