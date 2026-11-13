/**
 * Small seeded PRNG (mulberry32) for the cosmetic street simulation.
 *
 * Deliberately separate from the gameplay RNG cursor (ADR-0010): traffic rolls must never consume
 * gameplay randomness. Production seeds it from Math.random() (cosmetic entropy is allowed);
 * tests pass a fixed seed so soak runs are reproducible.
 */
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
