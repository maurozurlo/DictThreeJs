import { GAMESTATE } from "../Constants/GameState";

export const getCharismaLeft = (charisma: number) => {
    const minChar = GAMESTATE.CHARISMA.MIN;
    const maxChar = GAMESTATE.CHARISMA.MAX;
    const minLeft = -10;
    const maxLeft = 90;

    return minLeft + ((charisma - minChar) / (maxChar - minChar)) * (maxLeft - minLeft);
};