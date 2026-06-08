import type { GameState } from "../types/GameState";
import type { Deal } from "../types/Deal";
import type { Law } from "../types/Law";
import { Clamp, getRandomFromList } from "../Utils/Math";
import { Power } from "../Constants/Power";
import { GAMESTATE } from "../Constants/GameState";

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
        logMessages.push("Military complains about underfunding! Military relation -2");
    } else if (budget.expenditures.security > BUDGET_EFFECTS.SECURITY.HIGH) {
        cur.military = Clamp(cur.military + 1, GAMESTATE.RELATIONS.MIN, GAMESTATE.RELATIONS.MAX);
        logMessages.push("Military feels well-funded! Military relation +1");
    }

    // Health budget effects
    if (budget.expenditures.health < BUDGET_EFFECTS.HEALTH.LOW) {
        cur.people = Clamp(cur.people - 2, GAMESTATE.RELATIONS.MIN, GAMESTATE.RELATIONS.MAX);
        logMessages.push("Health services are failing! People relation -2");
    } else if (budget.expenditures.health > BUDGET_EFFECTS.HEALTH.HIGH) {
        cur.people = Clamp(cur.people + 1, GAMESTATE.RELATIONS.MIN, GAMESTATE.RELATIONS.MAX);
        logMessages.push("Health system praised! People relation +1");
    }

    // Infrastructure budget effects
    if (budget.expenditures.infrastructure < BUDGET_EFFECTS.INFRASTRUCTURE.LOW) {
        cur.business = Clamp(cur.business - 1, GAMESTATE.RELATIONS.MIN, GAMESTATE.RELATIONS.MAX);
        cur.people = Clamp(cur.people - 1, GAMESTATE.RELATIONS.MIN, GAMESTATE.RELATIONS.MAX);
        logMessages.push("Infrastructure failing! People & Business relation -1");
    } else if (budget.expenditures.infrastructure > BUDGET_EFFECTS.INFRASTRUCTURE.HIGH) {
        cur.business = Clamp(cur.business + 1, GAMESTATE.RELATIONS.MIN, GAMESTATE.RELATIONS.MAX);
        cur.people = Clamp(cur.people + 1, GAMESTATE.RELATIONS.MIN, GAMESTATE.RELATIONS.MAX);
        logMessages.push("Infrastructure praised! People & Business relation +1");
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

    // Handle risk mechanics - random faction penalty on rejection
    const riskTriggered = effect.risk && Math.random() < effect.risk;
    if (riskTriggered && !hasAccepted) {
        const angryPower = getRandomFromList(Power);
        newRelations[angryPower] = handleRelations({
            power: angryPower,
            amount: -2,
            current: newRelations[angryPower],
        });
    }

    // Shared state update
    const baseUpdate = {
        budget: { ...state.budget, treasury: newTreasury },
        relations: { ...state.relations, current: newRelations },
    };

    // Type-specific state updates
    if (type === "deal") {
        const deal = item as Deal;
        let finalText = hasAccepted ? deal.acceptText : deal.rejectText;
        if (riskTriggered && deal.riskText) {
            finalText += " " + deal.riskText;
        }

        set({
            ...baseUpdate,
            deals: {
                ...state.deals,
                dealDecided: true,
                lastDealOutcome: finalText,
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