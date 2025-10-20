import type { GameState } from "../types/GameState";
import type { Deal } from "../types/Deal";
import type { Law } from "../types/Law";

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

    // --- Budget update ---
    const newTreasury = (state.budget.treasury ?? 0) + (effect.treasury ?? 0);

    // --- Relations update (clamped) ---
    const newRelations = { ...state.relations.current };
    (["military", "business", "people"] as const).forEach((key) => {
        const delta = effect[key];
        if (typeof delta === "number") {
            newRelations[key] = Math.max(-10, Math.min(10, newRelations[key] + delta));
        }
    });

    // --- Shared partial update ---
    const baseUpdate = {
        budget: { ...state.budget, treasury: newTreasury },
        relations: { ...state.relations, current: newRelations },
    };

    // --- Deal branch (has text + risk) ---
    if (type === "deal") {
        const deal = item as Deal;
        let finalText = hasAccepted ? deal.acceptText : deal.rejectText;

        if (effect.risk && Math.random() < effect.risk) {
            if (hasAccepted && deal.acceptEffect.military) {
                newRelations.military = Math.max(-10, newRelations.military - 2);
            } else if (!hasAccepted) {
                const powers = ["military", "business", "people"] as const;
                const angryPower = powers[Math.floor(Math.random() * powers.length)];
                newRelations[angryPower] = Math.max(-10, newRelations[angryPower] - 1);
            }
            finalText += " " + (deal.riskText ?? "");
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
        return;
    }

    // --- Law branch (no text / risk) ---
    const law = item as Law;
    set({
        ...baseUpdate,
        law: {
            ...state.law,
            lastLawOutcome: hasAccepted,
            lawDecided: true,
            interactedWithLaws: new Set(state.law.interactedWithLaws).add(law)
        },
    });
}
