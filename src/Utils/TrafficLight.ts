/**
 * Global internal traffic light for the Street View (no visual representation).
 * All crossings share one phase, driven by the scene clock's elapsed seconds:
 *
 *   [0, CAR_PHASE_SECONDS)                     cars roll, peds wait at kerbs
 *   [CAR_PHASE_SECONDS, +PED_PHASE_SECONDS)    cars hold at stopFor nodes, peds cross
 *
 * Peds only START crossing during the first PED_START_WINDOW seconds of the
 * ped phase so they finish before cars are released (crossings are ~8 m and
 * walk speeds >= 0.9 m/s). Purely cosmetic timing — no seeded RNG involved.
 */

export const CAR_PHASE_SECONDS = 9;
export const PED_PHASE_SECONDS = 9;
export const PED_START_WINDOW = 4;

const CYCLE = CAR_PHASE_SECONDS + PED_PHASE_SECONDS;

export type LightPhase = 'cars' | 'peds';

/** Phase of the shared light at `elapsed` seconds of scene time. */
export function lightPhase(elapsed: number): LightPhase {
    const t = ((elapsed % CYCLE) + CYCLE) % CYCLE;
    return t < CAR_PHASE_SECONDS ? 'cars' : 'peds';
}

/** Seconds into the CURRENT phase at `elapsed` seconds of scene time. */
export function phaseTime(elapsed: number): number {
    const t = ((elapsed % CYCLE) + CYCLE) % CYCLE;
    return t < CAR_PHASE_SECONDS ? t : t - CAR_PHASE_SECONDS;
}

/** True while a ped may BEGIN crossing (early ped phase — see PED_START_WINDOW). */
export function canStartCrossing(elapsed: number): boolean {
    return lightPhase(elapsed) === 'peds' && phaseTime(elapsed) < PED_START_WINDOW;
}
