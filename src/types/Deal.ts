import type { Power } from "./Power";
import type { RecurringEffect } from "./Law";

export type DealEffect = Partial<Record<Power | 'treasury' | 'risk', number>>

export interface Deal {
    id: number;
    text: string;
    acceptText: string;
    rejectText: string;
    acceptEffect: DealEffect;
    rejectEffect: DealEffect;
    riskText?: string;
    /** Optional recurring effect — present only on lasting-effect deals. */
    recurringEffect?: RecurringEffect;
}