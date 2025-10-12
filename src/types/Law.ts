import type { Expenditures, Taxes } from "./Budget";
import type { Power } from "./Power";

export type LawEffect = Partial<Record<Power | 'treasury' | 'risk' | Taxes | Expenditures, number>>

export type Law = {
    id: number;
    label: string;
    power: Power;
    acceptEffect: LawEffect;
    rejectEffect: LawEffect;
}