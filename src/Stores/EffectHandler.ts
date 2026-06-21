import type { GameState, LogDeltas, LogEvent, Modifier, ModifierSpec, ModifierType } from "../types/GameState";
import type { Deal } from "../types/Deal";
import type { Law } from "../types/Law";
import { Clamp, getRandomFromList, rollChance } from "../Utils/Math";
import { Power } from "../Constants/Power";
import { GAMESTATE } from "../Constants/GameState";
import { buildContentModifier, dealModifierId, lawModifierId } from "../assets/modifierContent";
import { getEffectiveBudgetStat } from "../Utils/Modifiers";
import { applyGraceDampening } from "../Utils/GracePeriod";
import { buildDeltas } from "../Utils/RoundLog";

export type BudgetEffectResult = {
    newRelations: GameState["relations"]["current"];
    /** Structured log events for budget→relation effects (ADR-0011). */
    logEvents: LogEvent[];
};

const RELATION_STATS: ModifierSpec['stat'][] = ['military', 'business', 'people'];

/** Σ of a spec list's relation contributions — drives the law charisma "chose the better option" reward. */
function sumRelationAmount(specs: ModifierSpec[]): number {
    return specs.reduce((sum, s) => (RELATION_STATS.includes(s.stat) ? sum + s.amount : sum), 0);
}

/** Sum the listed stats out of a spec list into a LogDeltas bag (for log display only). */
function pickSpecDeltas(specs: ModifierSpec[], stats: readonly (keyof LogDeltas)[]): LogDeltas {
    const d: LogDeltas = {};
    for (const s of specs) {
        if ((stats as readonly string[]).includes(s.stat)) {
            const k = s.stat as keyof LogDeltas;
            d[k] = (d[k] ?? 0) + s.amount;
        }
    }
    return d;
}

/**
 * Applies end-of-round budget effects to faction relations. Low/high spending
 * thresholds penalise or reward specific factions. Reads EFFECTIVE spend
 * (base + active law/deal slider modifiers) via getEffectiveBudgetStat
 * (ADR-0008 Amendment 2026-06-18, AC-11).
 */
export function applyBudgetEffects(
    budget: GameState["budget"],
    relations: GameState["relations"]["current"],
    modifiers: Modifier[] = [],
    round: number = 0,
): BudgetEffectResult {
    const { BUDGET_EFFECTS } = GAMESTATE;
    const cur = { ...relations };
    const logEvents: LogEvent[] = [];

    const security = getEffectiveBudgetStat(budget, modifiers, 'securitySpend', round);
    const health = getEffectiveBudgetStat(budget, modifiers, 'healthSpend', round);
    const infrastructure = getEffectiveBudgetStat(budget, modifiers, 'infrastructureSpend', round);

    // Security budget effects — high spending rewards military loyalty
    if (security > BUDGET_EFFECTS.SECURITY.HIGH) {
        cur.military = Clamp(cur.military + 1, GAMESTATE.RELATIONS.MIN, GAMESTATE.RELATIONS.MAX);
        logEvents.push({ key: 'log.budget_military_high', deltas: { military: 1 } });
    }

    // Health budget effects — high spending rewards people loyalty
    if (health > BUDGET_EFFECTS.HEALTH.HIGH) {
        cur.people = Clamp(cur.people + 1, GAMESTATE.RELATIONS.MIN, GAMESTATE.RELATIONS.MAX);
        logEvents.push({ key: 'log.budget_health_high', deltas: { people: 1 } });
    }

    // Infrastructure budget effects — high spending rewards business and people
    if (infrastructure > BUDGET_EFFECTS.INFRASTRUCTURE.HIGH) {
        cur.business = Clamp(cur.business + 1, GAMESTATE.RELATIONS.MIN, GAMESTATE.RELATIONS.MAX);
        cur.people = Clamp(cur.people + 1, GAMESTATE.RELATIONS.MIN, GAMESTATE.RELATIONS.MAX);
        logEvents.push({ key: 'log.budget_infra_high', deltas: { business: 1, people: 1 } });
    }

    return { newRelations: cur, logEvents };
}



/**
 * Resolve a normal law or deal decision (ADR-0008 Amendment 2026-06-18).
 * - Accept: build ONE modifier from `acceptMods` (relations/charisma/budget time:0
 *   read-through, treasury time:1 applied in nextRound, recurring income/expense
 *   time:0). No base mutation — effects are read through the modifier. Deduped by id.
 * - Reject: apply `rejectMods` as direct base mutations now (one-round equivalents,
 *   ADR-0008 Option B); no modifier stored (a rejection can't be repealed).
 * Risk is rolled per path; the law charisma reward stays a base mutation.
 */
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
    const round = state.gameManagement.round;

    const newRelations = { ...state.relations.current };
    let newTreasury = state.budget.treasury;
    let newModifiers = state.gameManagement.modifiers;

    if (hasAccepted) {
        const id = type === "law" ? lawModifierId(item.id) : dealModifierId(item.id);
        const modType: ModifierType = type === "law" ? "law-recurring" : "deal";
        const modifier = buildContentModifier(id, modType, item.acceptMods, round);
        newModifiers = state.gameManagement.modifiers.some(m => m.id === modifier.id && m.state === 'active')
            ? state.gameManagement.modifiers
            : [...state.gameManagement.modifiers, modifier];
    } else {
        for (const spec of item.rejectMods) {
            if (spec.stat === 'treasury') {
                newTreasury += spec.amount;
            } else if (spec.stat === 'military' || spec.stat === 'business' || spec.stat === 'people') {
                newRelations[spec.stat] = handleRelations({
                    power: spec.stat,
                    amount: spec.amount,
                    current: newRelations[spec.stat],
                    round,
                });
            }
            // Current content carries no budget/charisma/recurring specs on reject paths.
        }
    }

    // Risk mechanics — per path (deals only). Accept-path risk is flavour (riskText);
    // reject-path risk also fires the random-faction penalty.
    const riskProb = hasAccepted ? (item as Deal).acceptRisk : (item as Deal).rejectRisk;
    const riskTriggered = typeof riskProb === 'number' && rollChance(riskProb);
    if (riskTriggered && !hasAccepted) {
        const angryPower = getRandomFromList(Power);
        newRelations[angryPower] = handleRelations({
            power: angryPower,
            amount: -2,
            current: newRelations[angryPower],
            round,
        });
    }

    // Charisma scoring for laws: +1 if the player chose the option with the better
    // Power outcome (base mutation — a gameplay reward, not authored content).
    let charismaDelta = 0;
    if (type === "law") {
        const acceptScore = sumRelationAmount(item.acceptMods);
        const rejectScore = sumRelationAmount(item.rejectMods);
        if (hasAccepted && acceptScore > rejectScore) charismaDelta = 1;
        else if (!hasAccepted && rejectScore > acceptScore) charismaDelta = 1;
    }

    const newCharisma = Clamp(
        state.gameManagement.charisma.current + charismaDelta,
        GAMESTATE.CHARISMA.MIN,
        GAMESTATE.CHARISMA.MAX
    );

    // --- Log event (ADR-0011): record the ACTUAL applied effect, not the authored
    //     content. On accept the lasting effect lives in the modifier (ongoing);
    //     the only one-time hits are the time:1 treasury and the charisma reward.
    //     On reject the relation/treasury base mutations are diffed post-dampening. ---
    const relDiff: LogDeltas = {
        military: newRelations.military - state.relations.current.military,
        business: newRelations.business - state.relations.current.business,
        people: newRelations.people - state.relations.current.people,
    };
    const treasuryDiff = newTreasury - state.budget.treasury;

    let logEvent: LogEvent;
    if (type === 'law') {
        const law = item as Law;
        const labelKey = `laws.labels.${law.id}`;
        if (hasAccepted) {
            logEvent = {
                key: 'log.passed_law', labelKey, labelNs: 'laws',
                deltas: buildDeltas({ treasury: pickSpecDeltas(law.acceptMods, ['treasury']).treasury, charisma: charismaDelta }),
                ongoing: buildDeltas(pickSpecDeltas(law.acceptMods, ['military', 'business', 'people', 'charisma'])),
            };
        } else {
            logEvent = {
                key: 'log.rejected_law', labelKey, labelNs: 'laws',
                deltas: buildDeltas({ ...relDiff, treasury: treasuryDiff, charisma: charismaDelta }),
            };
        }
    } else {
        const deal = item as Deal;
        // Every deal now has a short name (deals.<id>.name); show it in the log.
        const labelKey = `deals.${deal.id}.name`;
        if (hasAccepted) {
            logEvent = {
                key: 'log.accepted_deal_named', labelKey, labelNs: 'deals',
                deltas: buildDeltas({ treasury: pickSpecDeltas(deal.acceptMods, ['treasury']).treasury }),
                ongoing: buildDeltas(pickSpecDeltas(deal.acceptMods, ['military', 'business', 'people', 'charisma'])),
            };
        } else {
            logEvent = {
                key: 'log.declined_deal_named', labelKey, labelNs: 'deals',
                deltas: buildDeltas({ ...relDiff, treasury: treasuryDiff }),
            };
        }
    }

    // Shared state update
    const baseUpdate = {
        budget: { ...state.budget, treasury: newTreasury },
        relations: { ...state.relations, current: newRelations },
        gameManagement: {
            ...state.gameManagement,
            charisma: { ...state.gameManagement.charisma, current: newCharisma },
            modifiers: newModifiers,
            pendingLog: [...(state.gameManagement.pendingLog ?? []), logEvent],
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
    round = 3,
}: {
    power: keyof GameState["relations"]["current"];
    amount: number;
    current: number;
    round?: number;
}) {
    const dampened = applyGraceDampening(amount, round);
    const newValue = Clamp(
        current + dampened,
        GAMESTATE.RELATIONS.MIN,
        GAMESTATE.RELATIONS.MAX
    );

    if (newValue <= GAMESTATE.RELATIONS.MIN) {
        console.warn(`Relation with ${power} reached minimum (${GAMESTATE.RELATIONS.MIN}).`);
        // Add side effects here if needed
    }

    return newValue;
}