import type { GameState } from "../types/GameState";
import type { Deal } from "../types/Deal";
import type { Law } from "../types/Law";
import { Clamp, getRandomFromList } from "../Utils/Math";
import { Power } from "../Constants/Power";
import { GAMESTATE } from "../Constants/GameState";

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
    const newTreasury = (state.budget.treasury ?? 0) + (effect.treasury ?? 0);

    // Apply relation changes
    const newRelations = { ...state.relations.current };
    Power.forEach((key) => {
        const delta = effect[key];
        if (typeof delta === "number") {
            newRelations[key] = handleRelations({
                power: key,
                amount: delta,
                current: newRelations,
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
            current: newRelations,
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
    current: GameState["relations"]["current"];
}) {
    const newValue = Clamp(
        current[power] + amount,
        GAMESTATE.RELATIONS.MIN,
        GAMESTATE.RELATIONS.MAX
    );

    if (newValue <= GAMESTATE.RELATIONS.MIN) {
        console.warn(`Relation with ${power} reached minimum (${GAMESTATE.RELATIONS.MIN}).`);
        // Add side effects here if needed
    }

    return newValue;
}