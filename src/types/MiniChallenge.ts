import type { Power } from "./Power";

export type MiniChallengeEffect = Partial<Record<Power, number> & { treasury: number; risk: number }>;

export type MiniChallenge = {
    id: string;
    text: string;
    acceptText: string;
    rejectText: string;
    acceptEffect: MiniChallengeEffect;
    rejectEffect: MiniChallengeEffect;
    riskText?: string;
};
