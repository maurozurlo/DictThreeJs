import type { Power } from "./Power";

export type PeriodicEventEffect = Partial<Record<Power, number> & { treasury: number }>;

export type PeriodicEventOption = {
    text: string;
    effect: PeriodicEventEffect;
    result: string;
};

export type PeriodicEvent = {
    round: number;
    title: string;
    text: string;
    options: PeriodicEventOption[];
};
