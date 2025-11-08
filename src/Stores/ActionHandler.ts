import { GAMESTATE } from "../Constants/GameState";
import type { GameState } from "../types/GameState";
import type { MeetActionType, Power } from "../types/Power";
import { handleRelations } from "./EffectHandler";

type ActionResult = {
    resultText: string;
    newRelations: Record<Power, number>;
    treasuryUpdate: number;
    actionTaken: boolean;
};

function handleBribe(
    power: Power,
    state: GameState,
): ActionResult {
    const cost = GAMESTATE.MEET.ACTIONS.BRIBE.COSTS[power];

    if (state.budget.treasury < cost) {
        return {
            resultText: `Insufficient funds for bribery. Action failed.`,
            treasuryUpdate: 0,
            actionTaken: false,
            newRelations: { ...state.relations.current }
        };
    }

    return {
        resultText: `You bribed the ${power}. Relation +3, Treasury -$${cost}M`,
        treasuryUpdate: -cost,
        actionTaken: true,
        newRelations: {
            ...state.relations.current,
            [power]: handleRelations({
                power,
                amount: 3,
                current: state.relations.current[power]
            }),
        }
    };
}

function handleEliminate(
    power: Power,
    newRelations: Record<Power, number>,
    state: GameState,
): Omit<ActionResult, 'treasuryUpdate'> {

    const hasBacklash = Math.random() < 0.3;
    if (!hasBacklash) {
        return {
            resultText: `You eliminated ${power} leadership. ${power} relation reset to neutral.`,
            actionTaken: true,
            newRelations: {
                ...state.relations.current,
                [power]: 0
            }
        };
    }

    const otherPowers = Object.keys(newRelations).filter(p => p !== power) as Power[];
    const angryPower = otherPowers[Math.floor(Math.random() * otherPowers.length)];

    return {
        resultText: `You eliminated ${power} leadership. ${power} reset to neutral, ${angryPower} relation -2 (backlash)`,
        actionTaken: true,
        newRelations: {
            ...state.relations.current,
            [power]: 0,
            [angryPower]: handleRelations({
                power: angryPower,
                amount: -2,
                current: state.relations.current[angryPower]
            }),
        }
    };
}

function handleExpropriate(
    power: Power,
    state: GameState,
): ActionResult {
    const gain = GAMESTATE.MEET.ACTIONS.EXPROPIATE.GAINS[power];

    return {
        resultText: `You expropriated assets from ${power}. Treasury +$${gain}M, relation -3`,
        treasuryUpdate: gain,
        actionTaken: true,
        newRelations: { ...state.relations.current, power: handleRelations({ power, amount: -3, current: state.relations.current[power] }) }
    };
}

function handleDialogue(
    power: Power,
    state: GameState,
): Omit<ActionResult, 'treasuryUpdate'> {
    const roll = Math.random();

    if (roll < 0.1) {
        return {
            resultText: `Dialogue with ${power} went terribly wrong! Relation -1`,
            actionTaken: true,
            newRelations: { ...state.relations.current, power: handleRelations({ power, amount: -1, current: state.relations.current[power] }) }

        };
    }

    if (roll < 0.7) {
        return {
            resultText: `Successful dialogue with ${power}. Relation +1`,
            actionTaken: true,
            newRelations: { ...state.relations.current, power: handleRelations({ power, amount: 1, current: state.relations.current[power] }) }
        };
    }

    return {
        resultText: `Dialogue with ${power} was inconclusive. No change.`,
        actionTaken: true,
        newRelations: { ...state.relations.current }
    };
}

export function handleActionOutcome(
    power: Power,
    action: MeetActionType,
    state: GameState
): ActionResult {
    const newRelations = { ...state.relations.current };

    const actionHandlers: Record<MeetActionType, () => Omit<ActionResult, 'newRelations'>> = {
        bribe: () => handleBribe(power, state),
        eliminate: () => ({ ...handleEliminate(power, newRelations, state), treasuryUpdate: 0 }),
        expropriate: () => handleExpropriate(power, state),
        dialogue: () => ({ ...handleDialogue(power, state), treasuryUpdate: 0 }),
    };

    return actionHandlers[action]() as ActionResult;
}