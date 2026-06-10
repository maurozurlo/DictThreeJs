import type { Power } from "./Power";

export type PeriodicEventEffect = Partial<Record<Power, number> & { treasury: number }>;

export type PeriodicEventOption = {
    id: string;
    text: string;
    effect: PeriodicEventEffect;
    result: string;
};

export type PeriodicEvent = {
    id: string;
    round: number;
    title: string;
    text: string;
    options: PeriodicEventOption[];
};
