import type { Power } from "./Power"

export type DailyEvent = {
    power: Power,
    key: string;
    mod: number;
    chance: number;
}