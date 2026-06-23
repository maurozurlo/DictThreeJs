// Round resolution — the pure prelude of nextRound(), extracted from GameState.ts.
// Computes coup outcome, financials, relation/tax effects, representative status,
// the log entry, the round increment, the onStart pass, and the end-condition
// flags. The store's nextRound() consumes this and owns only the set() branches
// (which draw RNG laws/deals and apply frozen-faction restore + special ending —
// steps that must run AFTER the end-condition checks).

import { GAMESTATE } from "../Constants/GameState";
import { Clamp, getRandomFromList, getRandomUniqueItem, rollChance } from "../Utils/Math";
import { LAWS } from "../assets/laws";
import { WEIRD_LAWS } from "../assets/weirdLaws";
import type { GameState, GameStats, LogEvent, RoundLogEntry, Modifier } from "../types/GameState";
import type { Power } from "../types/Power";
import { applyBudgetEffects } from "./EffectHandler";
import { calculateRoundFinancials, type RoundFinancials } from "./BudgetHandler";
import { getRandomDailyEvent } from "./DailyEventHandler";
import { getRandomUniqueItemForPower } from "../Utils/Laws";
import { getGameDate } from "../Utils/GameDate";
import { filterLawPool } from "./RecurringHandler";
import { checkCoup } from "./CoupHandler";
import { educationToDumbScore } from "../Utils/String";
import { getEffectiveCharisma, getEffectiveRelation, getEffectiveBudgetStat, fireOnStartModifiers } from "../Utils/Modifiers";
import { resolveCitizenPipeline } from "./CitizenHandler";
import type { CitizenState } from "../types/Citizen";

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
        newCitizenStates: CitizenState[];
        newDisplayedPopulation: number;
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
    const effectiveCharisma = getEffectiveCharisma(state.gameManagement.charisma.current, state.gameManagement.modifiers, coupRound);
    const coupResult = checkCoup(
        effectiveRelationsForCoup,
        effectiveCharisma,
        state.gameManagement.coupArmedLastRound ?? false,
        state.budget.expenditures.security,
    );
    if (coupResult.outcome === 'coup') return { kind: 'coup', coupResult };

    const newCoupArmedLastRound = coupResult.outcome === 'grace';
    const newCoupWarningFaction: Power | null =
        coupResult.outcome === 'grace' || coupResult.outcome === 'yellow-warning'
            ? coupResult.faction
            : null;

    // --- 1. Financial resolution (recurring income/expense from active modifiers
    //        at the resolving round; ADR-0008 §5). All current recurring content is
    //        immediate+permanent, so the resolving round and round+1 are equivalent. ---
    const financials = calculateRoundFinancials(state.budget, state.gameManagement.modifiers, coupRound);
    // Treasury-stat modifiers (accept-path time:1 specs, ADR-0008 §9) are now included
    // in financials.netChange via calculateRoundFinancials — no separate sumModifiers call needed.
    let newTreasury = state.budget.treasury + financials.netChange;
    const recurringGmFields = recurringFieldKeys(financials);

    // Effective budget sliders (base + active law/deal modifier contributions,
    // re-clamped to the slider range; ADR-0008 §9). All gameplay-effect reads below
    // (budget→relation, tax penalty, rep-sick health roll, dumb score, citizen
    // pipeline inputs) use these rather than the raw base sliders (AC-10/AC-11).
    const mods = state.gameManagement.modifiers;
    const effSecurity = getEffectiveBudgetStat(state.budget, mods, 'securitySpend', coupRound);
    const effHealth = getEffectiveBudgetStat(state.budget, mods, 'healthSpend', coupRound);
    const effInfrastructure = getEffectiveBudgetStat(state.budget, mods, 'infrastructureSpend', coupRound);
    const effEducation = getEffectiveBudgetStat(state.budget, mods, 'educationSpend', coupRound);
    const effPeopleTax = getEffectiveBudgetStat(state.budget, mods, 'peopleTaxes', coupRound);
    const effBusinessTax = getEffectiveBudgetStat(state.budget, mods, 'businessTaxes', coupRound);

    // --- 2. Budget → relation effects (structured events, ADR-0011) ---
    const { newRelations, logEvents: budgetEvents } = applyBudgetEffects(state.budget, state.relations.current, mods, coupRound);

    // --- 3. Tax penalty + charisma corrosion (Plan G) ---
    const taxEvents: LogEvent[] = [];
    let newCharisma = state.gameManagement.charisma.current;
    if (effPeopleTax > GAMESTATE.INCOME.TAX_PENALTY_PEOPLE_THRESHOLD) {
        newRelations.people = Clamp(newRelations.people - 1, GAMESTATE.RELATIONS.MIN, GAMESTATE.RELATIONS.MAX);
        newCharisma = Clamp(newCharisma - 1, GAMESTATE.CHARISMA.MIN, GAMESTATE.CHARISMA.MAX);
        taxEvents.push({ key: 'log.tax_penalty_people', deltas: { people: -1, charisma: -1 } });
    }
    if (effBusinessTax > GAMESTATE.INCOME.TAX_PENALTY_BUSINESS_THRESHOLD) {
        newRelations.business = Clamp(newRelations.business - 1, GAMESTATE.RELATIONS.MIN, GAMESTATE.RELATIONS.MAX);
        newCharisma = Clamp(newCharisma - 1, GAMESTATE.CHARISMA.MIN, GAMESTATE.CHARISMA.MAX);
        taxEvents.push({ key: 'log.tax_penalty_business', deltas: { business: -1, charisma: -1 } });
    }

    // --- 4. Representative status for next round ---
    const prevStatuses = state.gameManagement.representativeStatuses;
    const newRepStatuses: RepStatuses = { military: 'active', business: 'active', people: 'active' };
    if (effHealth < GAMESTATE.BUDGET_EFFECTS.HEALTH.LOW) {
        (['military', 'business', 'people'] as Power[])
            .forEach(p => { if (rollChance(0.5)) newRepStatuses[p] = 'sick'; });
    }
    const newSelectedPower: Power | 'none' =
        state.meet.selectedPower !== 'none' &&
        prevStatuses[state.meet.selectedPower] === 'active' &&
        newRepStatuses[state.meet.selectedPower] === 'active'
            ? state.meet.selectedPower
            : 'none';
    const newDumbScore = educationToDumbScore(effEducation);

    // --- 5. Build log entry (ADR-0011) ---
    // The player's own actions (law/deal/meet/event/shop) were captured with their
    // ACTUAL deltas into pendingLog as they happened this round; the resolution-time
    // consequences (budget, tax, financials, coup, news) are appended here. The vague
    // "charisma up/down" line is gone — per-action charisma deltas are now explicit.
    const coupEvents: LogEvent[] = [];
    if (coupResult.outcome === 'yellow-warning') {
        coupEvents.push({ key: 'log.coup_yellow_warning', refParams: { faction: `power.${coupResult.faction}` } });
    }
    if (coupResult.outcome === 'grace') {
        coupEvents.push({ key: 'log.coup_red_warning', refParams: { faction: `power.${coupResult.faction}` } });
    }
    const dailyEvents: LogEvent[] = state.dailyEvent.current
        ? [{ key: 'log.event.daily', labelKey: state.dailyEvent.current.key, labelNs: 'daily_events', dumb: true }]
        : [];

    const events: LogEvent[] = [
        ...state.gameManagement.pendingLog,
        ...budgetEvents,
        ...taxEvents,
        { key: 'log.financials', params: { income: financials.totalIncome, expenses: financials.expenses } },
        ...coupEvents,
        ...dailyEvents,
    ];
    const newLog: RoundLogEntry[] = [...state.log, { date: getGameDate(state.gameManagement.round), events }];

    // --- 6. Increment round, onStart pass, draw next daily event ---
    const newRound = state.gameManagement.round + 1;
    const { modifiers: modifiersAfterOnStart } = fireOnStartModifiers(state.gameManagement.modifiers, newRound);
    const nextDailyEvent = getRandomDailyEvent();

    // --- 7. Citizen pipeline (employment → happiness → role → death → feedback, GDD §4, Story 7-3).
    //        Runs AFTER financials/relations/modifiers resolve so inputs are final for this round.
    //        Feedback may reduce newTreasury (thief skim) or newRelations.people (protest);
    //        end conditions in step 8 read these post-citizen values. ---
    let newCitizenStates: CitizenState[] = state.citizenStates;
    let newDisplayedPopulation: number = state.displayedPopulation;
    if (state.citizens.length > 0) {
        const pipeline = resolveCitizenPipeline({
            citizens: state.citizens,
            citizenStates: state.citizenStates,
            effectiveRelations: effectiveRelationsForCoup,
            effectiveCharisma,
            security: effSecurity,
            infrastructure: effInfrastructure,
            health: effHealth,
            education: effEducation,
            peopleTax: effPeopleTax,
            businessTax: effBusinessTax,
            currentPeopleRel: newRelations.people,
            currentTreasury: newTreasury,
        });
        newCitizenStates = pipeline.newCitizenStates;
        newDisplayedPopulation = pipeline.newDisplayedPopulation;
        newRelations.people = pipeline.peopleRelation;
        newTreasury = pipeline.treasury;
    }

    // --- 8. End conditions (overthrow reads EFFECTIVE relations, ADR-0008 §6;
    //        reads post-citizen newTreasury and newRelations.people) ---
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
        newCitizenStates, newDisplayedPopulation,
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
    const hasActiveWeirdLaw = state.gameManagement.modifiers.findIndex(
        m => m.type === 'weird-law' && m.state === 'active',
    ) !== -1;
    if (!hasActiveWeirdLaw && rollChance(0.10)) {
        return getRandomFromList(WEIRD_LAWS);
    }
    const lawPool = filterLawPool(LAWS, state.gameManagement.modifiers);
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
