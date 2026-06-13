/**
 * Story 3-1: Meta-Progression Data Layer
 *
 * Integration tests for loadMeta, saveMeta, mergeMeta, recordGameEnd,
 * buildSavePayload, and importSave meta-merge behaviour.
 *
 * All 10 test cases from the story QA table are covered.
 *
 * localStorage is stubbed per test so tests are fully isolated and deterministic
 * (ADR-0004 no-global-state rule; unit tests must not depend on execution order).
 *
 * Design doc: production/stories/3-1-meta-progression.md
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadMeta, saveMeta, mergeMeta, recordGameEnd, isValidMetaProgress } from '../../../src/Utils/MetaProgress';
import { buildSavePayload, importSave } from '../../../src/Utils/SaveLoad';
import type { MetaProgress, TierRank } from '../../../src/types/MetaProgress';
import type { GameState } from '../../../src/types/GameState';

// ---------------------------------------------------------------------------
// localStorage stub
// ---------------------------------------------------------------------------

function makeLocalStorageStub(initial: Record<string, string> = {}): Storage {
    const store: Record<string, string> = { ...initial };
    return {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => { store[key] = value; },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { Object.keys(store).forEach(k => delete store[k]); },
        get length() { return Object.keys(store).length; },
        key: (index: number) => Object.keys(store)[index] ?? null,
    };
}

/** Replace the global localStorage stub before each test. */
function setLocalStorage(initial: Record<string, string> = {}): void {
    Object.defineProperty(globalThis, 'localStorage', {
        value: makeLocalStorageStub(initial),
        writable: true,
        configurable: true,
    });
}

beforeEach(() => {
    setLocalStorage(); // fresh, empty localStorage for every test
});

// ---------------------------------------------------------------------------
// Minimal GameState stub for exportSave / buildSavePayload
// ---------------------------------------------------------------------------

function makeMinimalState(round = 3): GameState {
    // Only the fields that are read by buildSavePayload (gameManagement.round)
    // and stripFunctions need to exist. The rest can be stub values because
    // buildSavePayload only serialises; it does not call store logic.
    return {
        gameManagement: {
            round,
            phase: 'start',
            endReason: null,
            endCause: null,
            dayEnded: false,
            lastRoundIncome: 0,
            lastRoundExpenses: 0,
            lastRoundRecurringIncome: 0,
            lastRoundRecurringExpenses: 0,
            currentRoundExtraIncome: 0,
            currentRoundExtraExpenses: 0,
            timerStartedAt: null,
            timerPausedAt: null,
            activeRecurringEffects: [],
            repealTakenThisRound: false,
            coupArmedLastRound: false,
            coupWarningFaction: null,
            charisma: { current: 0, adjustCharisma: () => {} },
            meetCounts: { military: 0, business: 0, people: 0 },
            setPhase: () => {},
            nextRound: () => {},
            expireTimer: () => {},
            pauseTimer: () => {},
            resumeTimer: () => {},
            advanceRoundRequested: false,
            requestAdvanceRound: () => {},
            clearAdvanceRoundRequest: () => {},
            saveGame: () => {},
            loadGame: () => {},
            repeal: () => {},
        },
    } as unknown as GameState;
}

// ---------------------------------------------------------------------------
// TC-1: loadMeta() with empty localStorage
// ---------------------------------------------------------------------------

describe('TC-1: loadMeta — empty localStorage', () => {
    it('returns the default empty MetaProgress', () => {
        const result = loadMeta();
        expect(result).toEqual({ highestTier: null, endingsUnlocked: [] });
    });
});

// ---------------------------------------------------------------------------
// TC-2: recordGameEnd then loadMeta
// ---------------------------------------------------------------------------

describe('TC-2: recordGameEnd then loadMeta', () => {
    it('persists the tier and ending after a single game end', () => {
        recordGameEnd('S', 'bankruptcy');
        const result = loadMeta();
        expect(result.highestTier).toBe('S');
        expect(result.endingsUnlocked).toContain('bankruptcy');
    });
});

// ---------------------------------------------------------------------------
// TC-3: highestTier not downgraded
// ---------------------------------------------------------------------------

describe('TC-3: highestTier is never downgraded', () => {
    it('keeps S when A is recorded afterward', () => {
        recordGameEnd('S', 'bankruptcy');
        recordGameEnd('A', 'victory');
        const result = loadMeta();
        expect(result.highestTier).toBe('S');
    });
});

// ---------------------------------------------------------------------------
// TC-4: highestTier is upgraded
// ---------------------------------------------------------------------------

describe('TC-4: highestTier is upgraded', () => {
    it('updates from A to S when S is recorded', () => {
        recordGameEnd('A', 'victory');
        recordGameEnd('S', 'bankruptcy');
        const result = loadMeta();
        expect(result.highestTier).toBe('S');
    });
});

// ---------------------------------------------------------------------------
// TC-5: Full tier ordering F < D < C < B < A < S
// ---------------------------------------------------------------------------

describe('TC-5: Full tier ordering', () => {
    const tiers: TierRank[] = ['F', 'D', 'C', 'B', 'A', 'S'];

    for (let i = 0; i < tiers.length; i++) {
        for (let j = i + 1; j < tiers.length; j++) {
            const lower = tiers[i];
            const higher = tiers[j];

            it(`mergeMeta picks ${higher} over ${lower}`, () => {
                const a: MetaProgress = { highestTier: lower, endingsUnlocked: [] };
                const b: MetaProgress = { highestTier: higher, endingsUnlocked: [] };
                expect(mergeMeta(a, b).highestTier).toBe(higher);
                expect(mergeMeta(b, a).highestTier).toBe(higher);
            });
        }
    }
});

// ---------------------------------------------------------------------------
// TC-6: No duplicate endings
// ---------------------------------------------------------------------------

describe('TC-6: No duplicate endings', () => {
    it('does not add a duplicate when the same ending is recorded twice', () => {
        recordGameEnd('B', 'bankruptcy');
        recordGameEnd('C', 'bankruptcy');
        const result = loadMeta();
        const count = result.endingsUnlocked.filter(e => e === 'bankruptcy').length;
        expect(count).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// TC-7: buildSavePayload includes meta field
// ---------------------------------------------------------------------------

describe('TC-7: buildSavePayload includes meta field', () => {
    it('attaches the current MetaProgress as top-level meta', () => {
        saveMeta({ highestTier: 'B', endingsUnlocked: ['victory'] });
        const state = makeMinimalState();
        const payload = buildSavePayload(state);
        expect(payload.meta).toBeDefined();
        const meta = payload.meta as MetaProgress;
        expect(meta.highestTier).toBe('B');
        expect(meta.endingsUnlocked).toContain('victory');
    });

    it('strips all functions from the payload', () => {
        const state = makeMinimalState();
        const payload = buildSavePayload(state);
        const gm = payload.gameManagement as Record<string, unknown>;
        expect(typeof gm.nextRound).toBe('undefined');
        expect(typeof gm.setPhase).toBe('undefined');
        expect(typeof gm.saveGame).toBe('undefined');
    });
});

// ---------------------------------------------------------------------------
// FileReader stub (FileReader is not available in the Vitest node environment)
// ---------------------------------------------------------------------------

/**
 * Stubs the global FileReader so importSave can be exercised in the Vitest
 * node environment. The stub reads the File's text synchronously via its
 * internal array buffer, then calls onload exactly as a real FileReader would.
 */
function stubFileReader(encoded: string): void {
    vi.stubGlobal('FileReader', class {
        result: string | null = null;
        onload: ((e: { target: { result: string } }) => void) | null = null;
        onerror: (() => void) | null = null;
        readAsText(_file: File): void {
            this.result = encoded;
            // Defer to next microtask to match FileReader's async contract
            Promise.resolve().then(() => {
                if (this.onload) this.onload({ target: { result: encoded } });
            });
        }
    });
}

// ---------------------------------------------------------------------------
// TC-8: importSave merges meta from file into localStorage
// ---------------------------------------------------------------------------

describe('TC-8: importSave merges embedded meta', () => {
    it('merges incoming meta — keeps higher tier, unions endings', async () => {
        // Pre-seed localStorage: S tier, bankruptcy ending
        saveMeta({ highestTier: 'S', endingsUnlocked: ['bankruptcy'] });

        // Build a .dict-encoded payload containing A tier + victory ending
        const payload = {
            meta: { highestTier: 'A', endingsUnlocked: ['victory'] },
        };
        const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
        stubFileReader(encoded);

        const file = {} as File; // content supplied by stub
        await importSave(file);

        const result = loadMeta();
        // S > A → keep S
        expect(result.highestTier).toBe('S');
        // Union of both endings (order is non-normative — use arrayContaining)
        expect(result.endingsUnlocked).toEqual(
            expect.arrayContaining(['bankruptcy', 'victory'])
        );

        vi.unstubAllGlobals();
    });
});

// ---------------------------------------------------------------------------
// TC-9: importSave with no meta field — localStorage unchanged
// ---------------------------------------------------------------------------

describe('TC-9: importSave with no meta field', () => {
    it('leaves existing localStorage meta untouched', async () => {
        saveMeta({ highestTier: 'S', endingsUnlocked: ['bankruptcy'] });

        const payload = { someOtherField: 42 };
        const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
        stubFileReader(encoded);

        const file = {} as File;
        await importSave(file);

        const result = loadMeta();
        expect(result.highestTier).toBe('S');
        expect(result.endingsUnlocked).toContain('bankruptcy');

        vi.unstubAllGlobals();
    });
});

// ---------------------------------------------------------------------------
// TC-11: importSave with meta: {} (both fields absent) — no merge
// ---------------------------------------------------------------------------

describe('TC-11: importSave with meta: {} — both fields absent', () => {
    it('leaves localStorage unchanged when meta is an empty object', async () => {
        saveMeta({ highestTier: 'S', endingsUnlocked: ['bankruptcy'] });

        const payload = { meta: {} };
        const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
        stubFileReader(encoded);

        const file = {} as File;
        await importSave(file);

        const result = loadMeta();
        expect(result.highestTier).toBe('S');
        expect(result.endingsUnlocked).toContain('bankruptcy');

        vi.unstubAllGlobals();
    });
});

// ---------------------------------------------------------------------------
// TC-12: importSave with invalid highestTier — rejected, localStorage unchanged
// ---------------------------------------------------------------------------

describe('TC-12: importSave with invalid highestTier — rejected', () => {
    it('does not store a corrupt tier string from an untrusted save file', async () => {
        saveMeta({ highestTier: 'A', endingsUnlocked: ['victory'] });

        const payload = { meta: { highestTier: 'Z', endingsUnlocked: [] } };
        const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
        stubFileReader(encoded);

        const file = {} as File;
        await importSave(file);

        const result = loadMeta();
        // Invalid tier 'Z' must not corrupt the stored tier
        expect(result.highestTier).toBe('A');

        vi.unstubAllGlobals();
    });

    it('isValidMetaProgress rejects unknown tier strings', () => {
        expect(isValidMetaProgress({ highestTier: 'Z', endingsUnlocked: [] })).toBe(false);
        expect(isValidMetaProgress({ highestTier: 'S', endingsUnlocked: [] })).toBe(true);
        expect(isValidMetaProgress({ highestTier: null, endingsUnlocked: [] })).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// TC-10: localStorage throws SecurityError — silent failure
// ---------------------------------------------------------------------------

describe('TC-10: localStorage SecurityError — fail silently', () => {
    it('loadMeta returns the default when localStorage throws', () => {
        Object.defineProperty(globalThis, 'localStorage', {
            value: {
                getItem: () => { throw new DOMException('Blocked', 'SecurityError'); },
                setItem: () => { throw new DOMException('Blocked', 'SecurityError'); },
                removeItem: () => {},
                clear: () => {},
                length: 0,
                key: () => null,
            },
            writable: true,
            configurable: true,
        });

        expect(() => loadMeta()).not.toThrow();
        const result = loadMeta();
        expect(result).toEqual({ highestTier: null, endingsUnlocked: [] });
    });

    it('saveMeta does not throw when localStorage is blocked', () => {
        Object.defineProperty(globalThis, 'localStorage', {
            value: {
                getItem: () => null,
                setItem: () => { throw new DOMException('Blocked', 'SecurityError'); },
                removeItem: () => {},
                clear: () => {},
                length: 0,
                key: () => null,
            },
            writable: true,
            configurable: true,
        });

        expect(() => saveMeta({ highestTier: 'A', endingsUnlocked: ['victory'] })).not.toThrow();
    });
});
