// Shop purchase resolution (Story 10-3) — pure Handler per ADR-0002. The store's
// shop.buy action delegates here and applies the returned patch in one set().

import type { GameState, LogEvent, ShopItemId } from "../types/GameState";
import { STATUES, MEDIA_PACKAGES, buildShopModifier } from "../assets/ShopItems";
import { countModifiersByType } from "../Utils/Modifiers";
import { buildDeltas } from "../Utils/RoundLog";
import type { Power } from "../types/Power";

const ADVISOR_ITEMS = ['advisor_1', 'advisor_2', 'advisor_3'] as const;
type AdvisorItem = typeof ADVISOR_ITEMS[number];

const ADVISOR_COSTS: Record<AdvisorItem, number> = { advisor_1: 100, advisor_2: 150, advisor_3: 200 };
const ADVISOR_LEVELS: Record<AdvisorItem, 1 | 2 | 3> = { advisor_1: 1, advisor_2: 2, advisor_3: 3 };

/**
 * Resolve a shop purchase. Returns the full store patch for one atomic `set()`,
 * or `null` when the purchase is rejected (already owned, frozen faction, or
 * insufficient treasury) — a rejected purchase is a silent no-op by design.
 */
export function handlePurchase(state: GameState, item: ShopItemId): Partial<GameState> | null {
    if ((ADVISOR_ITEMS as readonly string[]).includes(item)) {
        const advisorItem = item as AdvisorItem;
        const targetLevel = ADVISOR_LEVELS[advisorItem];
        if (state.shop.advisorLevel >= targetLevel) return null;
        const cost = ADVISOR_COSTS[advisorItem];
        if (state.budget.treasury < cost) return null;
        const advisorEvent: LogEvent = {
            key: 'log.event.hired_advisor',
            params: { level: targetLevel },
            deltas: { treasury: -cost },
        };
        return {
            budget: { ...state.budget, treasury: state.budget.treasury - cost },
            shop: { ...state.shop, advisorLevel: targetLevel },
            gameManagement: {
                ...state.gameManagement,
                pendingLog: [...state.gameManagement.pendingLog, advisorEvent],
                currentRoundShopCost: state.gameManagement.currentRoundShopCost + cost,
            },
        };
    }

    if (item === 'statue') {
        // Owned count is derived from the modifiers ledger — single source of truth.
        const statueCount = countModifiersByType(state.gameManagement.modifiers, 'statue');
        const shopItem = STATUES[statueCount];
        if (!shopItem) return null; // all tiers owned
        if (state.budget.treasury < shopItem.price) return null;
        const statueEvent: LogEvent = {
            key: 'log.event.bought_statue',
            deltas: { treasury: -shopItem.price },
            ongoing: buildDeltas({ charisma: shopItem.mods.reduce((a, m) => m.stat === 'charisma' ? a + m.amount : a, 0) }),
        };
        return {
            budget: { ...state.budget, treasury: state.budget.treasury - shopItem.price },
            gameManagement: {
                ...state.gameManagement,
                modifiers: [
                    ...state.gameManagement.modifiers,
                    buildShopModifier(shopItem, state.gameManagement.round),
                ],
                pendingLog: [...state.gameManagement.pendingLog, statueEvent],
                currentRoundShopCost: state.gameManagement.currentRoundShopCost + shopItem.price,
            },
        };
    }

    const mediaPackage = MEDIA_PACKAGES.find(p => p.id === item);
    if (!mediaPackage || state.shop.frozenFactions.has(mediaPackage.faction)) return null;
    if (state.budget.treasury < mediaPackage.price) return null;
    const newFrozen = new Set<Power>(state.shop.frozenFactions);
    newFrozen.add(mediaPackage.faction);
    const mediaEvent: LogEvent = {
        key: 'log.event.bought_media',
        refParams: { faction: `power.${mediaPackage.faction}` },
        deltas: { treasury: -mediaPackage.price },
    };
    return {
        budget: { ...state.budget, treasury: state.budget.treasury - mediaPackage.price },
        shop: { ...state.shop, frozenFactions: newFrozen },
        gameManagement: {
            ...state.gameManagement,
            pendingLog: [...state.gameManagement.pendingLog, mediaEvent],
            currentRoundShopCost: state.gameManagement.currentRoundShopCost + mediaPackage.price,
        },
    };
}
