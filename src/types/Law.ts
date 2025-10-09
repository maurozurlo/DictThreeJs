import type { Expenditures, Taxes } from "./Budget";
import type { Power } from "./Power";

export type Law = {
    id: number;
    label: string;
    power: Power;
    effects: Effect[]
}

export type Effect = {
    id: Taxes | Expenditures;
    amount: number;
}