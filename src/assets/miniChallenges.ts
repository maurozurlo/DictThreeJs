import type { MiniChallenge } from "../types/MiniChallenge";

export const MINI_CHALLENGES: MiniChallenge[] = [
    {
        text: "A foreign spy offers you classified intelligence in exchange for $50M. Accept the deal?",
        acceptText: "You accepted the spy's offer. Gained valuable intelligence but risked exposure.",
        rejectText: "You rejected the spy's offer. Played it safe but missed potential advantage.",
        acceptEffect: { treasury: -50, military: 2, risk: 0.3 },
        rejectEffect: { military: 1 },
        riskText: "The intelligence was a trap! Military relations suffer."
    },
    {
        text: "A wealthy businessman offers you a $80M 'donation' for favorable policies. Accept?",
        acceptText: "You accepted the businessman's donation. Treasury boosted but ethics questioned.",
        rejectText: "You rejected the bribe. Maintained integrity but missed financial opportunity.",
        acceptEffect: { treasury: 80, business: 1, people: -2 },
        rejectEffect: { people: 1, business: -1 }
    },
    {
        text: "Intelligence reports suggest a rival is planning against you. Spend $40M on counter-intelligence?",
        acceptText: "You invested in counter-intelligence. Potential threats neutralized.",
        rejectText: "You chose not to investigate. Saved money but remained vulnerable.",
        acceptEffect: { treasury: -40, military: 1 },
        rejectEffect: { risk: 0.2 },
        riskText: "Your rival successfully undermined your position with the military!"
    },
    {
        text: "A popular celebrity wants to endorse your regime for $30M. Worth the investment?",
        acceptText: "You hired the celebrity endorsement. Public image improved significantly.",
        rejectText: "You declined the celebrity deal. Saved money but missed the PR opportunity.",
        acceptEffect: { treasury: -30, people: 2 },
        rejectEffect: {}
    },
    {
        text: "Black market arms dealers offer you military equipment for $60M. Make the deal?",
        acceptText: "You purchased black market weapons. Military strength increased but reputation damaged.",
        rejectText: "You refused the illegal arms deal. Maintained legitimacy but missed military advantage.",
        acceptEffect: { treasury: -60, military: 2, people: -1 },
        rejectEffect: { people: 1 }
    }
];
