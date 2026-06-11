import type { GameState } from "../types/GameState";
import i18n from '../i18n';
import type { Deal } from "../types/Deal";
import type { Law } from "../types/Law";
import { Clamp, getRandomFromList, rollChance } from "../Utils/Math";
import { Power } from "../Constants/Power";
import { GAMESTATE } from "../Constants/GameState";
import type { Expenditures, Taxes } from "../types/Budget";
import { withRecurringEffect } from "./RecurringHandler";

export type BudgetEffectResult = {
    newRelations: GameState["relations"]["current"];
    logMessages: string[];
};

/**
 * Applies end-of-round budget effects to faction relations.
 * Low/high spending thresholds penalise or reward specific factions.
 */
export function applyBudgetEffects(
    budget: GameState["budget"],
    relations: GameState["relations"]["current"]
): BudgetEffectResult {
    const { BUDGET_EFFECTS } = GAMESTATE;
    const cur = { ...relations };
    const logMessages: string[] = [];

    // Security budget effects
    if (budget.expenditures.security < BUDGET_EFFECTS.SECURITY.LOW) {
        cur.military = Clamp(cur.military - 2, GAMESTATE.RELATIONS.MIN, GAMESTATE.RELATIONS.MAX);
        logMessages.push(i18n.t('log.budget_military_low'));
    } else if (budget.expenditures.security > BUDGET_EFFECTS.SECURITY.HIGH) {
        cur.military = Clamp(cur.military + 1, GAMESTATE.RELATIONS.MIN, GAMESTATE.RELATIONS.MAX);
        logMessages.push(i18n.t('log.budget_military_high'));
    }

    // Health budget effects
    if (budget.expenditures.health < BUDGET_EFFECTS.HEALTH.LOW) {
        cur.people = Clamp(cur.people - 2, GAMESTATE.RELATIONS.MIN, GAMESTATE.RELATIONS.MAX);
        logMessages.push(i18n.t('log.budget_health_low'));
    } else if (budget.expenditures.health > BUDGET_EFFECTS.HEALTH.HIGH) {
        cur.people = Clamp(cur.people + 1, GAMESTATE.RELATIONS.MIN, GAMESTATE.RELATIONS.MAX);
        logMessages.push(i18n.t('log.budget_health_high'));
    }

    // Infrastructure budget effects
    if (budget.expenditures.infrastructure < BUDGET_EFFECTS.INFRASTRUCTURE.LOW) {
        cur.business = Clamp(cur.business - 1, GAMESTATE.RELATIONS.MIN, GAMESTATE.RELATIONS.MAX);
        cur.people = Clamp(cur.people - 1, GAMESTATE.RELATIONS.MIN, GAMESTATE.RELATIONS.MAX);
        logMessages.push(i18n.t('log.budget_infra_low'));
    } else if (budget.expenditures.infrastructure > BUDGET_EFFECTS.INFRASTRUCTURE.HIGH) {
        cur.business = Clamp(cur.business + 1, GAMESTATE.RELATIONS.MIN, GAMESTATE.RELATIONS.MAX);
        cur.people = Clamp(cur.people + 1, GAMESTATE.RELATIONS.MIN, GAMESTATE.RELATIONS.MAX);
        logMessages.push(i18n.t('log.budget_infra_high'));
    }

    return { newRelations: cur, logMessages };
}



export function handleDecision({
    type,
    item,
    hasAccepted,
    get,
    set,
}: {
    type: "deal" | "law";
    item: Deal | Law;
    hasAccepted: boolean;
    get: () => GameState;
    set: (partial: Partial<GameState>) => void;
}) {
    const state = get();
    const effect = hasAccepted ? item.acceptEffect : item.rejectEffect;

    // Apply treasury changes
    const newTreasury = state.budget.treasury + (effect.treasury ?? 0);

    // Apply relation changes
    const newRelations = { ...state.relations.current };
    Power.forEach((key) => {
        const delta = effect[key];
        if (typeof delta === "number") {
            newRelations[key] = handleRelations({
                power: key,
                amount: delta,
                current: newRelations[key],
            });
        }
    });

    // Apply budget expenditure / tax key effects from laws
    const newExpenditures = { ...state.budget.expenditures };
    const newTaxes = { ...state.budget.taxes };
    const expenditureKeys: Expenditures[] = ["security", "health", "infrastructure", "education"];
    const taxKeys: Taxes[] = ["businessTaxes", "peopleTaxes"];
    expenditureKeys.forEach((key) => {
        const delta = effect[key as keyof typeof effect];
        if (typeof delta === "number") {
            newExpenditures[key] = Clamp(
                newExpenditures[key] + delta,
                GAMESTATE.BUDGET.BOUNDS.EXPENDITURE.MIN,
                GAMESTATE.BUDGET.BOUNDS.EXPENDITURE.MAX
            );
        }
    });
    taxKeys.forEach((key) => {
        const delta = effect[key as keyof typeof effect];
        if (typeof delta === "number") {
            newTaxes[key] = Clamp(
                newTaxes[key] + delta,
                GAMESTATE.BUDGET.BOUNDS.TAX.MIN,
                GAMESTATE.BUDGET.BOUNDS.TAX.MAX
            );
        }
    });

    // Handle risk mechanics - random faction penalty on rejection
    const riskTriggered = effect.risk && rollChance(effect.risk);
    if (riskTriggered && !hasAccepted) {
        const angryPower = getRandomFromList(Power);
        newRelations[angryPower] = handleRelations({
            power: angryPower,
            amount: -2,
            current: newRelations[angryPower],
        });
    }

    // Charisma scoring for laws: +1 if the player chose the option with better Power outcome
    let charismaDelta = 0;
    if (type === "law") {
        const acceptScore = Power.reduce((sum, p) => sum + ((item.acceptEffect[p] as number | undefined) ?? 0), 0);
        const rejectScore = Power.reduce((sum, p) => sum + ((item.rejectEffect[p] as number | undefined) ?? 0), 0);
        if (hasAccepted && acceptScore > rejectScore) charismaDelta = 1;
        else if (!hasAccepted && rejectScore > acceptScore) charismaDelta = 1;
    }

    const newCharisma = Clamp(
        state.gameManagement.charisma.current + charismaDelta,
        GAMESTATE.CHARISMA.MIN,
        GAMESTATE.CHARISMA.MAX
    );

    // Activate the item's recurring effect on acceptance (deduped by sourceId)
    const newActiveRecurringEffects = hasAccepted
        ? withRecurringEffect({
            effects: state.gameManagement.activeRecurringEffects,
            item,
            sourceType: type,
            round: state.gameManagement.round,
        })
        : state.gameManagement.activeRecurringEffects;

    // Shared state update
    const baseUpdate = {
        budget: { ...state.budget, treasury: newTreasury, expenditures: newExpenditures, taxes: newTaxes },
        relations: { ...state.relations, current: newRelations },
        gameManagement: {
            ...state.gameManagement,
            charisma: { ...state.gameManagement.charisma, current: newCharisma },
            activeRecurringEffects: newActiveRecurringEffects,
        },
    };

    // Type-specific state updates
    if (type === "deal") {
        const deal = item as Deal;
        const finalText = []
        if (hasAccepted) {
            finalText.push(deal.acceptText);
        } else {
            finalText.push(deal.rejectText);
        }
        if (riskTriggered && deal.riskText) {
            finalText.push(deal.riskText);
        }

        set({
            ...baseUpdate,
            deals: {
                ...state.deals,
                dealDecided: true,
                lastDealOutcome: finalText,
                lastDealAccepted: hasAccepted,
                interactedWithDeals: new Set(state.deals.interactedWithDeals).add(deal),
            },
        });
    } else {
        const law = item as Law;
        set({
            ...baseUpdate,
            law: {
                ...state.law,
                lastLawOutcome: hasAccepted,
                lawDecided: true,
                interactedWithLaws: new Set(state.law.interactedWithLaws).add(law),
            },
        });
    }
}

export function handleRelations({
    power,
    amount,
    current,
}: {
    power: keyof GameState["relations"]["current"];
    amount: number;
    current: number
}) {
    const newValue = Clamp(
        current + amount,
        GAMESTATE.RELATIONS.MIN,
        GAMESTATE.RELATIONS.MAX
    );

    if (newValue <= GAMESTATE.RELATIONS.MIN) {
        console.warn(`Relation with ${power} reached minimum (${GAMESTATE.RELATIONS.MIN}).`);
        // Add side effects here if needed
    }

    return newValue;
}