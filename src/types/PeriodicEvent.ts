import type { Power } from "./Power";

type PeriodicEventEffect = Partial<Record<Power, number> & { treasury: number }>;

type PeriodicEventOption = {
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
