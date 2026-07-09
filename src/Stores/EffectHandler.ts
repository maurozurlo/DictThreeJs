import type { GameState, LogDeltas, LogEvent, Modifier, ModifierSpec, ModifierType } from "../types/GameState";
import type { Deal } from "../types/Deal";
import type { Law } from "../types/Law";
import { Clamp, getRandomFromList, rollChance } from "../Utils/Math";
import { Power } from "../Constants/Power";
import { GAMESTATE } from "../Constants/GameState";
import { buildContentModifier, buildWeirdLawModifier, dealModifierId, lawModifierId } from "../assets/modifierContent";
import { getEffectiveBudgetStat } from "../Utils/Modifiers";
import { applyGraceDampening } from "../Utils/GracePeriod";
import { buildDeltas, relationDiff } from "../Utils/RoundLog";

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
 *
 * Pure: returns the full store patch (including stats and, for deals, the
 * extra-income/expense recap counters) for ONE atomic `set()` (ADR-0002, Story 10-3).
 */
export function handleDecision({
    type,
    item,
    hasAccepted,
    state,
}: {
    type: "deal" | "law";
    item: Deal | Law;
    hasAccepted: boolean;
    state: GameState;
}): Partial<GameState> {
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

    // Type-specific slices
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

        // Treasury delta for the round's extra-income/expense readout (DayEnded +
        // totalExtras stats). The treasury itself is applied via the modifier on
        // accept or as a base mutation above on reject.
        const chosenMods = hasAccepted ? deal.acceptMods : deal.rejectMods;
        const extraDelta = chosenMods.reduce((sum, s) => (s.stat === 'treasury' ? sum + s.amount : sum), 0);

        return {
            ...baseUpdate,
            gameManagement: {
                ...baseUpdate.gameManagement,
                currentRoundExtraIncome: extraDelta > 0
                    ? state.gameManagement.currentRoundExtraIncome + extraDelta
                    : state.gameManagement.currentRoundExtraIncome,
                currentRoundExtraExpenses: extraDelta < 0
                    ? state.gameManagement.currentRoundExtraExpenses + Math.abs(extraDelta)
                    : state.gameManagement.currentRoundExtraExpenses,
            },
            stats: {
                ...state.stats,
                dealsAccepted: hasAccepted ? state.stats.dealsAccepted + 1 : state.stats.dealsAccepted,
                dealsRejected: !hasAccepted ? state.stats.dealsRejected + 1 : state.stats.dealsRejected,
            },
            deals: {
                ...state.deals,
                dealDecided: true,
                lastDealOutcome: finalText,
                lastDealAccepted: hasAccepted,
                interactedWithDeals: new Set(state.deals.interactedWithDeals).add(deal),
            },
        };
    }

    const law = item as Law;
    return {
        ...baseUpdate,
        stats: {
            ...state.stats,
            lawsPassed: hasAccepted ? state.stats.lawsPassed + 1 : state.stats.lawsPassed,
            lawsRejected: !hasAccepted ? state.stats.lawsRejected + 1 : state.stats.lawsRejected,
        },
        law: {
            ...state.law,
            lastLawOutcome: hasAccepted,
            lawDecided: true,
            interactedWithLaws: new Set(state.law.interactedWithLaws).add(law),
        },
    };
}

/**
 * Resolve a weird-law decision (Story 5-2 content, extracted Story 10-3).
 * Accept applies `acceptMods` as immediate base mutations (ADR-0008 class A —
 * the weird modifier below carries no contributions; it enforces the
 * one-weird-law slot, drives Street View, and is a repealable ledger entry).
 * Reject has no faction penalty. Pure: returns the full patch for one `set()`.
 */
export function handleWeirdLaw(state: GameState, law: Law, hasAccepted: boolean): Partial<GameState> {
    if (!hasAccepted) {
        return {
            gameManagement: {
                ...state.gameManagement,
                pendingLog: [...state.gameManagement.pendingLog, {
                    key: 'log.rejected_law',
                    labelKey: `laws.weird.${law.id}.label`, labelNs: 'laws',
                } as LogEvent],
            },
            law: {
                ...state.law,
                lastLawOutcome: false,
                lawDecided: true,
                interactedWithLaws: new Set(state.law.interactedWithLaws).add(law),
            },
            stats: {
                ...state.stats,
                lawsRejected: state.stats.lawsRejected + 1,
            },
        };
    }

    const round = state.gameManagement.round;
    const newRelations = { ...state.relations.current };
    let newTreasury = state.budget.treasury;
    let charismaDelta = 0;
    for (const spec of law.acceptMods) {
        if (spec.stat === 'treasury') {
            newTreasury += spec.amount;
        } else if (spec.stat === 'military' || spec.stat === 'business' || spec.stat === 'people') {
            newRelations[spec.stat] = handleRelations({
                power: spec.stat,
                amount: spec.amount,
                current: newRelations[spec.stat],
                round,
            });
        } else if (spec.stat === 'charisma') {
            charismaDelta += spec.amount;
        }
    }
    const newCharisma = Clamp(
        state.gameManagement.charisma.current + charismaDelta,
        GAMESTATE.CHARISMA.MIN,
        GAMESTATE.CHARISMA.MAX
    );
    const weirdMod = buildWeirdLawModifier(law.id, round);
    // Effects above are immediate base mutations — diff them for the log (ADR-0011).
    const weirdLogEvent: LogEvent = {
        key: 'log.passed_law',
        labelKey: `laws.weird.${law.id}.label`, labelNs: 'laws',
        deltas: buildDeltas({
            ...relationDiff(state.relations.current, newRelations),
            treasury: newTreasury - state.budget.treasury,
            charisma: newCharisma - state.gameManagement.charisma.current,
        }),
    };

    return {
        budget: { ...state.budget, treasury: newTreasury },
        relations: { ...state.relations, current: newRelations },
        gameManagement: {
            ...state.gameManagement,
            charisma: { ...state.gameManagement.charisma, current: newCharisma },
            modifiers: state.gameManagement.modifiers.some(m => m.id === weirdMod.id && m.state === 'active')
                ? state.gameManagement.modifiers
                : [...state.gameManagement.modifiers, weirdMod],
            pendingLog: [...state.gameManagement.pendingLog, weirdLogEvent],
        },
        law: {
            ...state.law,
            lastLawOutcome: true,
            lawDecided: true,
            interactedWithLaws: new Set(state.law.interactedWithLaws).add(law),
        },
        stats: {
            ...state.stats,
            lawsPassed: state.stats.lawsPassed + 1,
        },
    };
}

/** One-shot event outcome: treasury and/or flat relation deltas (no dampening). */
export type EventEffect = { treasury?: number } & Partial<Record<'military' | 'business' | 'people', number>>;

/**
 * Apply a one-shot event outcome — the shared core of the periodic-event and
 * mini-challenge resolvers (Story 10-3): treasury + clamped relation deltas,
 * extra-income/expense recap counters, structured log event (ADR-0011), and the
 * tab unlock. Callers merge their own slice (decided/resultKey/risk) into the
 * returned patch inside the same `set()`.
 */
export function applyEventEffect(
    state: GameState,
    effect: EventEffect,
    logEvent: Pick<LogEvent, 'key' | 'labelKey' | 'labelNs'>,
    riskPenalty?: { power: keyof GameState['relations']['current']; amount: number },
): Partial<GameState> {
    const newTreasury = state.budget.treasury + (effect.treasury ?? 0);

    const newRelations = { ...state.relations.current };
    (Object.keys(newRelations) as (keyof typeof newRelations)[]).forEach((power) => {
        const delta = effect[power];
        if (typeof delta === 'number') {
            newRelations[power] = Clamp(
                newRelations[power] + delta,
                GAMESTATE.RELATIONS.MIN,
                GAMESTATE.RELATIONS.MAX
            );
        }
    });
    if (riskPenalty) {
        newRelations[riskPenalty.power] = Clamp(
            newRelations[riskPenalty.power] + riskPenalty.amount,
            GAMESTATE.RELATIONS.MIN,
            GAMESTATE.RELATIONS.MAX
        );
    }

    const treasuryDelta = effect.treasury ?? 0;
    const event: LogEvent = {
        ...logEvent,
        deltas: buildDeltas({
            ...relationDiff(state.relations.current, newRelations),
            treasury: treasuryDelta,
        }),
    };

    return {
        budget: { ...state.budget, treasury: newTreasury },
        relations: { ...state.relations, current: newRelations },
        tabs: { ...state.tabs, tabsLocked: false },
        gameManagement: {
            ...state.gameManagement,
            currentRoundExtraIncome: treasuryDelta > 0
                ? state.gameManagement.currentRoundExtraIncome + treasuryDelta
                : state.gameManagement.currentRoundExtraIncome,
            currentRoundExtraExpenses: treasuryDelta < 0
                ? state.gameManagement.currentRoundExtraExpenses + Math.abs(treasuryDelta)
                : state.gameManagement.currentRoundExtraExpenses,
            pendingLog: [...state.gameManagement.pendingLog, event],
        },
    };
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