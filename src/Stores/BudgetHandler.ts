import { GAMESTATE } from "../Constants/GameState";
import type { Expenditures, Taxes } from "../types/Budget";
import type { GameState, Modifier } from "../types/GameState";
import { Clamp } from "../Utils/Math";
import { sumModifiers } from "../Utils/Modifiers";

export type RoundFinancials = {
    peopleIncome: number;
    businessIncome: number;
    totalIncome: number;
    expenses: number;
    /** Per-round income from active recurring effects (laws/deals). 0 when none active. */
    recurringIncome: number;
    /** Per-round expenses from active recurring effects (laws/deals). 0 when none active. */
    recurringExpenses: number;
    netChange: number;
};

/**
 * Calculates round income and expenses based on POC logic.
 * - People income = base × (peopleTaxes / 100)
 * - Business income = base × (businessTaxes / 100), modified by infrastructure & education levels
 * - Expenses = sum of all expenditure levels × cost per level
 * - Recurring income/expenses = active modifier contributions to roundIncome/roundExpense
 *   at `round` (ADR-0008 §5 — weird-law/statue modifiers carry no economic mods, so
 *   they naturally contribute 0)
 * - Net change includes both base and recurring terms
 */
export function calculateRoundFinancials(
    budget: GameState["budget"],
    modifiers: Modifier[] = [],
    round: number = 0,
): RoundFinancials {
    const { INCOME } = GAMESTATE;
    const { peopleTaxes, businessTaxes } = budget.taxes;
    const { infrastructure, education, health, security } = budget.expenditures;

    let peopleIncome = Math.floor(INCOME.PEOPLE_BASE * (peopleTaxes / 100));
    let businessIncome = Math.floor(INCOME.BUSINESS_BASE * (businessTaxes / 100));

    // Poor infrastructure reduces business tax income by 30%
    if (infrastructure < 3) {
        businessIncome = Math.floor(businessIncome * 0.7);
    } else if (infrastructure > 7) {
        businessIncome = Math.floor(businessIncome * 1.1);
    }

    // Poor education reduces business income by 15%
    if (education < 3) {
        businessIncome = Math.floor(businessIncome * 0.85);
    }

    const totalIncome = peopleIncome + businessIncome;
    const expenses = (health + infrastructure + security + education) * INCOME.EXPENDITURE_COST_PER_LEVEL;
    const recurringIncome = sumModifiers(modifiers, 'roundIncome', round);
    const recurringExpenses = sumModifiers(modifiers, 'roundExpense', round);
    const netChange = totalIncome + recurringIncome - expenses - recurringExpenses;

    return { peopleIncome, businessIncome, totalIncome, expenses, recurringIncome, recurringExpenses, netChange };
}

/**
 * Derives rounds-until-bankruptcy from current treasury and the net per-round change.
 * Returns null when net is non-negative (infinite runway).
 * Mirrors the Budget tab's rounds-left display logic.
 */
export function computeRoundsLeft(treasury: number, net: number): number | null {
    return net < 0 ? Math.floor(treasury / Math.abs(net)) : null;
}

export type BudgetChangeResult = {
    taxes: GameState["budget"]["taxes"],
    expenditures: GameState["budget"]["expenditures"]
}
export function handleBudgetChange({ budget, id, amount }: {
    budget: GameState["budget"];
    id: Expenditures | Taxes;
    amount: number;
}): BudgetChangeResult {

    if (Object.keys(budget.expenditures).includes(id)) {
        const key = id as Expenditures;
        const current = budget.expenditures[key];
        const newValue = Clamp(current + amount, GAMESTATE.BUDGET.BOUNDS.EXPENDITURE.MIN, GAMESTATE.BUDGET.BOUNDS.EXPENDITURE.MAX);
        return { expenditures: { ...budget.expenditures, [key]: newValue }, taxes: budget.taxes }
    }

    if (Object.keys(budget.taxes).includes(id)) {
        const key = id as Taxes;
        const current = budget.taxes[key];
        const newValue = Clamp(current + amount, GAMESTATE.BUDGET.BOUNDS.TAX.MIN, GAMESTATE.BUDGET.BOUNDS.TAX.MAX);
        return { taxes: { ...budget.taxes, [key]: newValue }, expenditures: budget.expenditures }
    }

    console.error('Unknown id for budget', id);
    return { taxes: budget.taxes, expenditures: budget.expenditures };
}