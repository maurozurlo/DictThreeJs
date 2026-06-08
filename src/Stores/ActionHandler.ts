import { GAMESTATE } from "../Constants/GameState";
import type { GameState } from "../types/GameState";
import type { MeetActionType, Power } from "../types/Power";
import { handleRelations } from "./EffectHandler";

type ActionResult = {
    resultText: { key: string; params?: Record<string, string | number> };
    newRelations: Record<Power, number>;
    treasuryUpdate: number;
    actionTaken: boolean;
};

function handleBribe(power: Power, state: GameState): ActionResult {
    const cost = GAMESTATE.MEET.ACTIONS.BRIBE.COSTS[power];

    if (state.budget.treasury < cost) {
        return {
            resultText: { key: "bribe_insufficient_funds" },
            treasuryUpdate: 0,
            actionTaken: false,
            newRelations: { ...state.relations.current },
        };
    }

    return {
        resultText: { key: "bribe_success", params: { power, cost } },
        treasuryUpdate: -cost,
        actionTaken: true,
        newRelations: {
            ...state.relations.current,
            [power]: handleRelations({
                power,
                amount: 3,
                current: state.relations.current[power],
            }),
        },
    };
}

function handleEliminate(
    power: Power,
    newRelations: Record<Power, number>,
    state: GameState
): Omit<ActionResult, "treasuryUpdate"> {
    const hasBacklash = Math.random() < 0.3;

    if (!hasBacklash) {
        return {
            resultText: { key: "eliminate_success", params: { power } },
            actionTaken: true,
            newRelations: {
                ...state.relations.current,
                [power]: 0,
            },
        };
    }

    const otherPowers = Object.keys(newRelations).filter((p) => p !== power) as Power[];
    const angryPower = otherPowers[Math.floor(Math.random() * otherPowers.length)];

    return {
        resultText: { key: "eliminate_backlash", params: { power, angryPower } },
        actionTaken: true,
        newRelations: {
            ...state.relations.current,
            [power]: 0,
            [angryPower]: handleRelations({
                power: angryPower,
                amount: -2,
                current: state.relations.current[angryPower],
            }),
        },
    };
}

function handleExpropriate(power: Power, state: GameState): ActionResult {
    const gain = GAMESTATE.MEET.ACTIONS.EXPROPRIATE.GAINS[power];

    return {
        resultText: { key: "expropriate_success", params: { power, gain } },
        treasuryUpdate: gain,
        actionTaken: true,
        newRelations: {
            ...state.relations.current,
            [power]: handleRelations({
                power,
                amount: -3,
                current: state.relations.current[power],
            }),
        },
    };
}

function handleDialogue(
    power: Power,
    state: GameState
): Omit<ActionResult, "treasuryUpdate"> {
    const baseSuccessRate = GAMESTATE.MEET.ACTIONS.DIALOGUE.BASE_SUCCESS_RATE[power];
    const roll = Math.random();

    if (roll < 0.1 * (1 - baseSuccessRate)) {
        return {
            resultText: { key: "dialogue_fail", params: { power } },
            actionTaken: true,
            newRelations: {
                ...state.relations.current,
                [power]: handleRelations({
                    power,
                    amount: -1,
                    current: state.relations.current[power],
                }),
            },
        };
    }

    if (roll < 0.7 * (1 - baseSuccessRate)) {
        return {
            resultText: { key: "dialogue_success", params: { power } },
            actionTaken: true,
            newRelations: {
                ...state.relations.current,
                [power]: handleRelations({
                    power,
                    amount: 1,
                    current: state.relations.current[power],
                }),
            },
        };
    }

    return {
        resultText: { key: "dialogue_neutral", params: { power } },
        actionTaken: true,
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
