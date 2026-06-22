import { useMemo } from 'react';
import { useGameStore } from '../Stores/GameState';
import { STREET_IDE } from '../assets/data/street-objects.ide';
import { STREET_IPL } from '../assets/data/street-placement.ipl';
import type { ResolvedPlacement } from '../types/WorldLayout';
import { getVisibleModifiers } from '../Utils/Modifiers';

const ideMap = new Map(STREET_IDE.objs.map((o) => [o.modelName, o]));

/**
 * Merges IDE definitions with IPL placements and filters by current game state.
 * Returns only instances whose visibleIf conditions are all satisfied.
 */
export function useStreetLayout(): ResolvedPlacement[] {
    const activeTab      = useGameStore((s) => s.tabs.activeTab);
    const infrastructure = useGameStore((s) => s.budget.expenditures.infrastructure);
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
                if (v.modifier !== undefined) {
                    if (!visibleModifiers.some((m) => m.id === v.modifier)) return [];
                }
                if (v.minRound !== undefined && round < v.minRound) return [];
            }

            return [{
                instanceId: inst.id,
                modelName:  inst.modelName,
                asset:      def.asset,
                texture:    def.texture ?? null,
                pos:        inst.pos,
                rot:        inst.rot,
                scale:      inst.scale ?? [1, 1, 1],
            }];
        });
    }, [activeTab, infrastructure, round, visibleModifiers]);
}
