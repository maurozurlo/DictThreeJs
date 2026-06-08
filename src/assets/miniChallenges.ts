import type { MiniChallenge } from "../types/MiniChallenge";

export const MINI_CHALLENGES: MiniChallenge[] = [
    {
        text: "State media proposes a $45M propaganda campaign to boost your image. Authorize it?",
        acceptText: "The campaign floods the airwaves. Citizens grow weary, but your image is polished.",
        rejectText: "You declined the campaign. The media looks elsewhere for stories.",
        acceptEffect: { treasury: -45, people: 2, military: -1 },
        rejectEffect: { people: -1 }
    },
    {
        text: "An investigative journalist is about to publish a damaging exposé. Have them silenced?",
        acceptText: "The story never runs. Your secrets are safe, but whispers spread in the shadows.",
        rejectText: "You let the press run its course. Some stories are better faced head-on.",
        acceptEffect: { people: -2, military: 1 },
        rejectEffect: { people: -1, risk: 0.3 },
        riskText: "The exposé publishes, triggering a wave of public outrage!"
    },
    {
        text: "Protests are erupting in the capital. Deploy security forces to disperse them?",
        acceptText: "The streets are cleared. Order is restored, but scars remain in public memory.",
        rejectText: "You show restraint. The protests eventually wind down on their own.",
        acceptEffect: { treasury: -20, people: -2, military: 1 },
        rejectEffect: { people: 1, military: -1 }
    },
    {
        text: "A shadowy operative offers to permanently remove a political rival for $80M. Authorize it?",
        acceptText: "The rival disappears quietly. The generals nod approvingly.",
        rejectText: "You decline. Some problems are better left to time.",
        acceptEffect: { treasury: -80, military: 1, risk: 0.5 },
        rejectEffect: { military: -1 },
        riskText: "The operation is traced back to you! International condemnation follows."
    },
    {
        text: "A high-ranking officer is planning to defect to the opposition. Buy their loyalty for $50M?",
        acceptText: "You secure their loyalty. They become one of your most devoted commanders.",
        rejectText: "You let them go. Perhaps they will cause no trouble.",
        acceptEffect: { treasury: -50, military: 2 },
        rejectEffect: { military: -2, risk: 0.4 },
        riskText: "The defector leaks your military strategies to your enemies!"
    }
];
