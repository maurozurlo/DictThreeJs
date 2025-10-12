import type { Power } from "./Power";

export type DealEffect = Partial<Record<Power | 'treasury' | 'risk', number>>

export interface Deal {
    id: number;
    text: string;
    acceptText: string;
    rejectText: string;
    acceptEffect: DealEffect;
    rejectEffect: DealEffect;
    riskText?: string;
}