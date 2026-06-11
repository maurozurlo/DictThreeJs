import type { Expenditures, Taxes } from "./Budget";
import type { Power } from "./Power";

export type LawEffect = Partial<Record<Power | 'treasury' | 'risk' | Taxes | Expenditures, number>>

/** Per-round economic effect applied while this law remains active. */
export type RecurringEffect = {
    /** Added to treasury each round. Omit or set 0 if not applicable. */
    incomeBonus?: number;
    /** Subtracted from treasury each round. Omit or set 0 if not applicable. */
    expenseBonus?: number;
    /** i18n key displayed in DayEnded breakdown and Active Legislation list. */
    label: string;
}

export type Law = {
    id: number;
    power: Power;
    acceptEffect: LawEffect;
    rejectEffect: LawEffect;
    /** Optional recurring effect — present only on lasting-effect laws. */
    recurringEffect?: RecurringEffect;
}