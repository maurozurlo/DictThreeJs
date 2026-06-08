import type { Power } from "./Power"

export type DailyEvent = {
    power: Power,
    key: string;
    headline: string;
    mod: number;
    chance: number;
}