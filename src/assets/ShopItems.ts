/**
 * Shop item content (ADR-0008 §4 — no content in the engine, and no content in
 * the UI). All purchasable-item data lives here as plain data; the generic
 * modifier engine (src/Utils/Modifiers.ts) and the Shop component both stay
 * content-agnostic and simply map over these arrays.
 */

import { resolveWindow } from '../Utils/Modifiers';
import type { Modifier, ModifierStat, ModifierType, ShopItemId } from '../types/GameState';
import type { Power } from '../types/Power';

/** A stat contribution template on a shop item — `time` is a TIME_MODIFIERS id. */
export interface ShopModTemplate {
    stat: ModifierStat;
    amount: number;
    /** TIME_MODIFIERS id resolved to a concrete window at purchase. */
    time: number;
}

/** A purchasable item: i18n keys + price + the modifier it grants. */
export interface ShopItem {
    /** Stable, unique modifier id (also the content-lookup key). */
    id: string;
    type: ModifierType;
    nameKey: string;
    descriptionKey: string;
    price: number;
    mods: ShopModTemplate[];
}

/**
 * Statue tiers. Each successive purchase grants a permanent +1 charisma at an
 * escalating price. Add a tier by appending a row — no code changes.
 */
export const STATUES: ShopItem[] = [
    { id: 'statue.0', type: 'statue', nameKey: 'shop.statue.name', descriptionKey: 'shop.statue.description', price: 100, mods: [{ stat: 'charisma', amount: 1, time: 0 }] },
    { id: 'statue.1', type: 'statue', nameKey: 'shop.statue.name', descriptionKey: 'shop.statue.description', price: 150, mods: [{ stat: 'charisma', amount: 1, time: 0 }] },
    { id: 'statue.2', type: 'statue', nameKey: 'shop.statue.name', descriptionKey: 'shop.statue.description', price: 200, mods: [{ stat: 'charisma', amount: 1, time: 0 }] },
];

/**
 * A media package: freezes one faction's relation for a round (no modifier).
 * A structurally different shop item from statues — kept in its own array so
 * the Shop component and the store both map over data rather than hardcoding.
 */
export interface MediaPackage {
    id: ShopItemId;
    faction: Power;
    price: number;
}

export const MEDIA_PACKAGES: MediaPackage[] = [
    { id: 'media_coverage', faction: 'people', price: 80 },
    { id: 'media_shielding', faction: 'military', price: 80 },
    { id: 'media_blackout', faction: 'business', price: 80 },
];

/**
 * Build a runtime Modifier from a shop-item data entry at the given round.
 * Resolves each template's TIME_MODIFIERS id into a concrete window. The
 * engine never sees the content — it only receives the resolved Modifier.
 */
export function buildShopModifier(item: ShopItem, round: number): Modifier {
    return {
        id: item.id,
        type: item.type,
        state: 'active',
        acquiredRound: round,
        mods: item.mods.map(m => ({
            stat: m.stat,
            amount: m.amount,
            window: resolveWindow(m.time, round),
        })),
    };
}
