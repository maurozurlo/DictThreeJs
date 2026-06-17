// Seeded RNG (ADR-0010). All game-logic randomness flows through this module so
// that (a) a run is reproducible from its seed and (b) the cursor can be saved and
// restored — a reloaded game resumes the exact stream, which (with commit-on-roll,
// ADR-0002) makes risky outcomes un-save-scummable. Implementation: mulberry32, a
// tiny dependency-free 32-bit PRNG.
//
// The cursor (`_rngState`) is the single source of truth. Persist it via
// getRngState()/setRngState() — see SaveLoad.buildSavePayload. Seed once at
// new-game via seedRng() — see StateFactory.buildStartState.
//
// Tests control randomness by mocking the named functions below (vi.mock / vi.spyOn
// on '../Utils/Math') or by calling seedRng() with a fixed seed — never by spying
// Math.random(), which these functions no longer call (ADR-0010 supersedes ADR-0004).

export const Clamp = (value: number, min: number, max: number) => {
    return Math.min(Math.max(value, min), max);
}

/** mulberry32 cursor — the running 32-bit PRNG state. Advanced by every draw. */
let _rngState = 0;

/** Seed the PRNG (coerced to uint32). Call once at new-game; also restores a saved cursor. */
export function seedRng(seed: number): void {
    _rngState = seed >>> 0;
}

/** Current cursor. Serialize into the save so rolls replay-stably on reload. */
export function getRngState(): number {
    return _rngState;
}

/** Restore a previously serialized cursor (coerced to uint32). */
export function setRngState(state: number): void {
    _rngState = state >>> 0;
}

/**
 * Core mulberry32 step: advances the cursor and returns a float in [0, 1).
 * Not exported — all randomness is consumed through the named helpers below
 * (or rollFloat) so call sites stay mockable.
 */
function next(): number {
    _rngState = (_rngState + 0x6D2B79F5) >>> 0;
    let t = _rngState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function getRandomNumberInRange(min: number, max: number): number {
    return Math.floor(next() * (max - min + 1)) + min;
}

export function getRandomUniqueItem<T>(list: T[], used: Set<T>): T | null {
    if (list.length === 0) {
        console.warn("⚠️ getRandomUniqueItem: list is empty.");
        return null;
    }

    const available = list.filter(item => !used.has(item));

    if (available.length === 0) {
        console.warn("⚠️ getRandomUniqueItem: all items have already been used.");
        return null;
    }

    const randomIndex = Math.floor(next() * available.length);
    return available[randomIndex];
}

export function getRandomFromList<T>(list: T[]): T {
    if (list.length === 0) {
        throw new Error("getRandomFromList: list is empty.");
    }
    const randomIndex = Math.floor(next() * list.length);
    return list[randomIndex];
}

/** Returns true with probability p (0–1). */
export function rollChance(p: number): boolean {
    return next() < p;
}

/** Returns a random float in [0, 1). Use for multi-threshold rolls. */
export function rollFloat(): number {
    return next();
}
