import { GAMESTATE } from "../Constants/GameState";
import type { Expenditures, Taxes } from "../types/Budget";
import type { GameState } from "../types/GameState";
import { Clamp } from "../Utils/Math";

export type BudgetChangeResult = {
    taxes: GameState["budget"]["taxes"],
    expenditures: GameState["budget"]["expenditures"]
}
export function handelBudgetChange({ budget, id, amount }: {
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