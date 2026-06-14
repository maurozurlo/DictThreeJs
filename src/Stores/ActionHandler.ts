import { GAMESTATE } from "../Constants/GameState";
import type { GameState } from "../types/GameState";
import type { MeetActionType, Power } from "../types/Power";
import { handleRelations } from "./EffectHandler";
import { getRandomFromList, rollChance, rollFloat } from "../Utils/Math";
import { applyGraceDampening } from "../Utils/GracePeriod";

type ActionResult = {
    resultText: { key: string; params?: Record<string, string | number> };
    newRelations: Record<Power, number>;
    treasuryUpdate: number;
    actionTaken: boolean;
    charismaDelta: number;
};

function handleBribe(power: Power, state: GameState): ActionResult {
    const cost = GAMESTATE.MEET.ACTIONS.BRIBE.COSTS[power];

    if (state.budget.treasury < cost) {
        return {
            resultText: { key: "bribe_insufficient_funds" },
            treasuryUpdate: 0,
            actionTaken: false,
            charismaDelta: 0,
            newRelations: { ...state.relations.current },
        };
    }

    return {
        resultText: { key: "bribe_success", params: { power, cost } },
        treasuryUpdate: -cost,
        actionTaken: true,
        charismaDelta: 0,
        newRelations: {
            ...state.relations.current,
            [power]: handleRelations({
                power,
                amount: 3,
                current: state.relations.current[power],
                round: state.gameManagement.round,
            }),
        },
    };
}

function handleEliminate(
    power: Power,
    newRelations: Record<Power, number>,
    state: GameState
): Omit<ActionResult, "treasuryUpdate"> {
    const charisma = state.gameManagement.charisma.current;
    // Backlash base 30%; high charisma halves it, low charisma raises it by 50%
    let backlashChance = 0.3;
    if (charisma >= 5) backlashChance = 0.15;
    else if (charisma <= -5) backlashChance = 0.45;

    const hasBacklash = rollChance(backlashChance);

    if (!hasBacklash) {
        return {
            resultText: { key: "eliminate_success", params: { power } },
            actionTaken: true,
            charismaDelta: -2,
            newRelations: {
                ...state.relations.current,
                [power]: 0,
            },
        };
    }

    const otherPowers = Object.keys(newRelations).filter((p) => p !== power) as Power[];
    const angryPower = getRandomFromList(otherPowers);
    const backlashDelta = applyGraceDampening(-2, state.gameManagement.round);

    return {
        resultText: { key: "eliminate_backlash", params: { power, angryPower, backlashDelta } },
        actionTaken: true,
        charismaDelta: -2,
        newRelations: {
            ...state.relations.current,
            [power]: 0,
            [angryPower]: handleRelations({
                power: angryPower,
                amount: -2,
                current: state.relations.current[angryPower],
                round: state.gameManagement.round,
            }),
        },
    };
}

function handleExpropriate(power: Power, state: GameState): ActionResult {
    const gain = GAMESTATE.MEET.ACTIONS.EXPROPRIATE.GAINS[power];
    const round = state.gameManagement.round;
    const relationDelta = applyGraceDampening(-3, round);

    return {
        resultText: { key: "expropriate_success", params: { power, gain, relationDelta } },
        treasuryUpdate: gain,
        actionTaken: true,
        // -2 matches eliminate: expropriation is treasury-positive aggression,
        // priced at the same charisma cost (balance review 2026-06-12)
        charismaDelta: -2,
        newRelations: {
            ...state.relations.current,
            [power]: handleRelations({
                power,
                amount: -3,
                current: state.relations.current[power],
                round: state.gameManagement.round,
            }),
        },
    };
}

function handleDialogue(
    power: Power,
    state: GameState
): Omit<ActionResult, "treasuryUpdate"> {
    // Education too low — population can't hold a productive conversation
    const education = state.budget.expenditures.education
    const round = state.gameManagement.round;
    const dialogueFailDelta = applyGraceDampening(-1, round);
    if (education <= GAMESTATE.BUDGET.BOUNDS.EXPENDITURE.MIN + 1) {
        return {
            resultText: { key: "dialogue_fail", params: { power, relationDelta: dialogueFailDelta } },
            actionTaken: true,
            charismaDelta: -1,
            newRelations: {
                ...state.relations.current,
                [power]: handleRelations({
                    power,
                    amount: -1,
                    current: state.relations.current[power],
                    round,
                }),
            },
        }
    }

    const baseSuccessRate = GAMESTATE.MEET.ACTIONS.DIALOGUE.BASE_SUCCESS_RATE[power];
    const charisma = state.gameManagement.charisma.current;
    // High charisma expands the success zone; low charisma shrinks it
    const charismaBonus = Math.max(-0.25, Math.min(0.25, charisma * 0.03));
    const failThreshold = 0.1 * (1 - baseSuccessRate);
    const successThreshold = Math.max(failThreshold + 0.01, Math.min(0.95, failThreshold + baseSuccessRate * 0.7 + charismaBonus));
    const roll = rollFloat();

    if (roll < failThreshold) {
        return {
            resultText: { key: "dialogue_fail", params: { power, relationDelta: dialogueFailDelta } },
            actionTaken: true,
            charismaDelta: 0,
            newRelations: {
                ...state.relations.current,
                [power]: handleRelations({
                    power,
                    amount: -1,
                    current: state.relations.current[power],
                    round,
                }),
            },
        };
    }

    if (roll < successThreshold) {
        return {
            resultText: { key: "dialogue_success", params: { power } },
            actionTaken: true,
            // +1 on success only — dialogue is the charisma recovery loop.
            // Roll-fail stays 0 (2-7% band, not player-controlled); the
            // education-gated auto-fail above keeps -1 (player-controlled).
            charismaDelta: 1,
            newRelations: {
                ...state.relations.current,
                [power]: handleRelations({
                    power,
                    amount: 1,
                    current: state.relations.current[power],
                    round,
                }),
            },
        };
    }

    return {
        resultText: { key: "dialogue_neutral", params: { power } },
        actionTaken: true,
        charismaDelta: 0,
        newRelations: { ...state.relations.current },
    };
}

export function handleActionOutcome(
    power: Power,
    action: MeetActionType,
    state: GameState
): ActionResult {
    const newRelations = { ...state.relations.current };

    const actionHandlers: Record<MeetActionType, () => Omit<ActionResult, "newRelations">> = {
        bribe: () => handleBribe(power, state),
        eliminate: () => ({ ...handleEliminate(power, newRelations, state), treasuryUpdate: 0 }),
        expropriate: () => handleExpropriate(power, state),
        dialogue: () => ({ ...handleDialogue(power, state), treasuryUpdate: 0 }),
    };

    return actionHandlers[action]() as ActionResult;
}
