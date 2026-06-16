// Round resolution — the pure prelude of nextRound(), extracted from GameState.ts.
// Computes coup outcome, financials, relation/tax effects, representative status,
// the log entry, the round increment, the onStart pass, and the end-condition
// flags. The store's nextRound() consumes this and owns only the set() branches
// (which draw RNG laws/deals and apply frozen-faction restore + special ending —
// steps that must run AFTER the end-condition checks).

import { GAMESTATE } from "../Constants/GameState";
import { Clamp, getRandomFromList, getRandomUniqueItem, rollChance, rollFloat } from "../Utils/Math";
import { LAWS } from "../assets/laws";
import { WEIRD_LAWS } from "../assets/weirdLaws";
import type { GameState, GameStats, RoundLogEntry, Modifier } from "../types/GameState";
import type { Power } from "../types/Power";
import { applyBudgetEffects } from "./EffectHandler";
import { calculateRoundFinancials, type RoundFinancials } from "./BudgetHandler";
import { getRandomDailyEvent } from "./DailyEventHandler";
import { getRandomUniqueItemForPower } from "../Utils/Laws";
import { getGameDate } from "../Utils/GameDate";
import { filterLawPool } from "./RecurringHandler";
import { checkCoup } from "./CoupHandler";
import { educationToDumbScore } from "../Utils/String";
import { getEffectiveCharisma, getEffectiveRelation, fireOnStartModifiers } from "../Utils/Modifiers";
import i18n from "../i18n";

type CoupResult = ReturnType<typeof checkCoup>;
type RepStatuses = Record<Power, 'active' | 'sick' | 'eliminated'>;
type Relations = GameState['relations']['current'];

const recurringFieldKeys = (financials: RoundFinancials) => ({
    lastRoundRecurringIncome: financials.recurringIncome,
    lastRoundRecurringExpenses: financials.recurringExpenses,
    repealTakenThisRound: false,
});

export type RoundResolution =
    | { kind: 'coup'; coupResult: Extract<CoupResult, { outcome: 'coup' }> }
    | {
        kind: 'continue';
        newCoupArmedLastRound: boolean;
        newCoupWarningFaction: Power | null;
        financials: RoundFinancials;
        newTreasury: number;
        recurringGmFields: ReturnType<typeof recurringFieldKeys>;
        newRelations: Relations;
        newCharisma: number;
        newRepStatuses: RepStatuses;
        newSelectedPower: Power | 'none';
        newDumbScore: number;
        newLog: RoundLogEntry[];
        newRound: number;
        modifiersAfterOnStart: Modifier[];
        nextDailyEvent: GameState['dailyEvent']['current'];
        bankruptcy: boolean;
        overthrown: Power | undefined;
    };

/**
 * Compute the round's resolution from the current state. Returns `kind: 'coup'`
 * (game over before any further RNG) or `kind: 'continue'` with every value the
 * store's branches need. RNG call order matches the original nextRound: coup
 * roll → representative-sick rolls → daily event. Law/deal draws stay in the store.
 */
export function resolveRound(state: GameState): RoundResolution {
    // --- 0. Coup check (effective relations + charisma; ADR-0008 §6) ---
    const coupRound = state.gameManagement.round;
    const effectiveRelationsForCoup: Record<Power, number> = {
        military: getEffectiveRelation(state.relations.current.military, state.gameManagement.modifiers, 'military', coupRound),
        business: getEffectiveRelation(state.relations.current.business, state.gameManagement.modifiers, 'business', coupRound),
        people: getEffectiveRelation(state.relations.current.people, state.gameManagement.modifiers, 'people', coupRound),
    };
    const coupResult = checkCoup(
        effectiveRelationsForCoup,
        getEffectiveCharisma(state.gameManagement.charisma.current, state.gameManagement.modifiers, coupRound),
        rollFloat(),
        state.gameManagement.coupArmedLastRound ?? false,
        state.budget.expenditures.security,
    );
    if (coupResult.outcome === 'coup') return { kind: 'coup', coupResult };

    const newCoupArmedLastRound = coupResult.outcome === 'grace';
    const newCoupWarningFaction: Power | null =
        coupResult.outcome === 'grace' || coupResult.outcome === 'yellow-warning'
            ? coupResult.faction
            : null;

    // --- 1. Financial resolution (includes active recurring effects) ---
    const financials = calculateRoundFinancials(state.budget, state.gameManagement.activeRecurringEffects);
    const newTreasury = state.budget.treasury + financials.netChange;
    const recurringGmFields = recurringFieldKeys(financials);

    // --- 2. Budget → relation effects ---
    const { newRelations, logMessages } = applyBudgetEffects(state.budget, state.relations.current);

    // --- 3. Tax penalty + charisma corrosion (Plan G) ---
    const taxMessages: string[] = [];
    let newCharisma = state.gameManagement.charisma.current;
    if (state.budget.taxes.peopleTaxes > GAMESTATE.INCOME.TAX_PENALTY_PEOPLE_THRESHOLD) {
        newRelations.people = Clamp(newRelations.people - 1, GAMESTATE.RELATIONS.MIN, GAMESTATE.RELATIONS.MAX);
        newCharisma = Clamp(newCharisma - 1, GAMESTATE.CHARISMA.MIN, GAMESTATE.CHARISMA.MAX);
        taxMessages.push(i18n.t('log.tax_penalty_people'));
    }
    if (state.budget.taxes.businessTaxes > GAMESTATE.INCOME.TAX_PENALTY_BUSINESS_THRESHOLD) {
        newRelations.business = Clamp(newRelations.business - 1, GAMESTATE.RELATIONS.MIN, GAMESTATE.RELATIONS.MAX);
        newCharisma = Clamp(newCharisma - 1, GAMESTATE.CHARISMA.MIN, GAMESTATE.CHARISMA.MAX);
        taxMessages.push(i18n.t('log.tax_penalty_business'));
    }

    // --- 4. Representative status for next round ---
    const prevStatuses = state.gameManagement.representativeStatuses;
    const newRepStatuses: RepStatuses = { military: 'active', business: 'active', people: 'active' };
    if (state.budget.expenditures.health < GAMESTATE.BUDGET_EFFECTS.HEALTH.LOW) {
        (['military', 'business', 'people'] as Power[])
            .forEach(p => { if (rollChance(0.5)) newRepStatuses[p] = 'sick'; });
    }
    const newSelectedPower: Power | 'none' =
        state.meet.selectedPower !== 'none' &&
        prevStatuses[state.meet.selectedPower] === 'active' &&
        newRepStatuses[state.meet.selectedPower] === 'active'
            ? state.meet.selectedPower
            : 'none';
    const newDumbScore = educationToDumbScore(state.budget.expenditures.education);

    // --- 5. Build log entry ---
    const logLines: string[] = [];
    if (state.law.lawDecided && state.law.current && state.law.lastLawOutcome !== null) {
        const verbKey = state.law.lastLawOutcome ? 'log.passed_law' : 'log.rejected_law';
        const lawLabelKey = state.law.current.type === 'weird'
            ? `laws.weird.${state.law.current.id}.label`
            : `laws.labels.${state.law.current.id}`;
        logLines.push(i18n.t(verbKey, { label: i18n.t(lawLabelKey, { ns: 'laws' }) }));
    }
    if (state.deals.dealDecided && state.deals.current) {
        logLines.push(i18n.t(state.deals.lastDealAccepted ? 'log.accepted_deal' : 'log.declined_deal'));
    }
    if (state.meet.actionTaken.taken && state.meet.actionTaken.power && state.meet.actionTaken.type) {
        logLines.push(i18n.t('log.met_with', {
            power: i18n.t(`power.${state.meet.actionTaken.power}`),
            action: i18n.t(`meet.${state.meet.actionTaken.type}`),
        }));
    }
    logLines.push(i18n.t('log.financials', { income: financials.totalIncome, expenses: financials.expenses }));
    logLines.push(...logMessages, ...taxMessages);
    if (newCharisma > state.gameManagement.charisma.current) logLines.push(i18n.t('log.charisma_up'));
    else if (newCharisma < state.gameManagement.charisma.current) logLines.push(i18n.t('log.charisma_down'));
    if (coupResult.outcome === 'yellow-warning') {
        logLines.push(i18n.t('log.coup_yellow_warning', { faction: i18n.t(`power.${coupResult.faction}`) }));
    }
    if (coupResult.outcome === 'grace') {
        logLines.push(i18n.t('log.coup_red_warning', { faction: i18n.t(`power.${coupResult.faction}`) }));
    }
    const newLog: RoundLogEntry[] = [...state.log, { date: getGameDate(state.gameManagement.round), lines: logLines }];

    // --- 6. Increment round, onStart pass, draw next daily event ---
    const newRound = state.gameManagement.round + 1;
    const { modifiers: modifiersAfterOnStart } = fireOnStartModifiers(state.gameManagement.modifiers, newRound);
    const nextDailyEvent = getRandomDailyEvent();

    // --- 7. End conditions (overthrow reads EFFECTIVE relations, ADR-0008 §6) ---
    const bankruptcy = newTreasury <= 0;
    const overthrown = (Object.keys(newRelations) as Power[]).find(
        p => getEffectiveRelation(newRelations[p], state.gameManagement.modifiers, p, newRound) <= GAMESTATE.RELATIONS.MIN,
    );

    return {
        kind: 'continue',
        newCoupArmedLastRound, newCoupWarningFaction,
        financials, newTreasury, recurringGmFields,
        newRelations, newCharisma, newRepStatuses, newSelectedPower, newDumbScore,
        newLog, newRound, modifiersAfterOnStart, nextDailyEvent,
        bankruptcy, overthrown,
    };
}

/** Build the cumulative stats update for a resolved round. */
export function buildRoundStats(
    s: GameState,
    ctx: { financials: RoundFinancials; newTreasury: number; prevRound: number; newRelations: Relations; coupGraceFired: boolean },
): GameStats {
    return {
        ...s.stats,
        totalIncomeEarned: s.stats.totalIncomeEarned + ctx.financials.totalIncome,
        totalExpensesSpent: s.stats.totalExpensesSpent + ctx.financials.expenses,
        totalExtrasEarned: s.stats.totalExtrasEarned + s.gameManagement.currentRoundExtraIncome,
        totalExtrasSpent: s.stats.totalExtrasSpent + s.gameManagement.currentRoundExtraExpenses,
        peakTreasury: Math.max(s.stats.peakTreasury, ctx.newTreasury),
        lowestTreasury: Math.min(s.stats.lowestTreasury, ctx.newTreasury),
        relationsHistory: [...s.stats.relationsHistory, {
            round: ctx.prevRound,
            military: ctx.newRelations.military,
            business: ctx.newRelations.business,
            people: ctx.newRelations.people,
        }],
        coupGraceFired: s.stats.coupGraceFired || ctx.coupGraceFired,
        totalRecurringIncomeEarned: s.stats.totalRecurringIncomeEarned + ctx.financials.recurringIncome,
        totalRecurringExpensesSpent: s.stats.totalRecurringExpensesSpent + ctx.financials.recurringExpenses,
    };
}

/**
 * Biased law selection (Plan G) + weird-law trigger (Story 5-2). 10% chance of a
 * weird law when no weird law is active; otherwise a faction-biased pick from the
 * pool, excluding sick/eliminated factions.
 */
export function pickNextLaw(
    state: GameState,
    newRepStatuses: RepStatuses,
    usedLaws: Set<typeof LAWS[number]>,
): typeof LAWS[number] | null {
    const hasActiveWeirdLaw = state.gameManagement.activeRecurringEffects.some(e => e.sourceType === 'weird-law');
    if (!hasActiveWeirdLaw && rollChance(0.10)) {
        return getRandomFromList(WEIRD_LAWS);
    }
    const lawPool = filterLawPool(LAWS, state.gameManagement.activeRecurringEffects);
    const unavailablePowers = (['military', 'business', 'people'] as Power[])
        .filter(p => newRepStatuses[p] !== 'active');
    const effectiveLawPool = unavailablePowers.length > 0
        ? (lawPool.filter(l => !unavailablePowers.includes(l.power)).length > 0
            ? lawPool.filter(l => !unavailablePowers.includes(l.power))
            : lawPool)
        : lawPool;
    if (state.budget.taxes.peopleTaxes > GAMESTATE.INCOME.TAX_PENALTY_PEOPLE_THRESHOLD) {
        return getRandomUniqueItemForPower(effectiveLawPool, usedLaws, 'people') ?? getRandomUniqueItem(effectiveLawPool, usedLaws);
    }
    if (state.budget.taxes.businessTaxes > GAMESTATE.INCOME.TAX_PENALTY_BUSINESS_THRESHOLD) {
        return getRandomUniqueItemForPower(effectiveLawPool, usedLaws, 'business') ?? getRandomUniqueItem(effectiveLawPool, usedLaws);
    }
    return getRandomUniqueItem(effectiveLawPool, usedLaws);
}
