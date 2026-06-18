/**
 * Story 3-3: Secret Room Rework
 *
 * Unit tests for:
 *   - Trigger threshold: relation >= 5 (not MAX=10) at round 9
 *   - Faction → room index mapping (military=0, business=1, people=2)
 *   - Charisma-weighted outcome roll (good/bad)
 *   - secretRoomIndex set deterministically when special ending fires
 *
 * Design doc: production/stories/3-3-secret-room-rework.md
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGameStore } from '../../../src/Stores/GameState';
import { GAMESTATE } from '../../../src/Constants/GameState';

vi.mock('../../../src/i18n', () => ({
    default: { t: (key: string) => key }
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetStore(): void {
    useGameStore.setState((s) => ({
        gameManagement: {
            ...s.gameManagement,
            phase: 'start',
            round: 0,
            charisma: { ...s.gameManagement.charisma, current: 0 },
        },
        specialEnding: {
            ...s.specialEnding,
            available: false,
            faction: null,
            outcome: null,
            used: false
        },
        tabs: {
            ...s.tabs,
            secretRoomIndex: 0
        },
        relations: {
            ...s.relations,
            current: { military: 0, business: 0, people: 0 }
        }
    }));
}

/**
 * Seeds store directly at round 8 with safe treasury and neutral charisma.
 * Direct seeding avoids budget/coup side-effects from 7 real nextRound() calls.
 * Also sets the specified faction's relation to the given value.
 */
function seedRound8(
    faction: 'military' | 'business' | 'people',
    relationValue: number,
    otherRelations: number = 0
): void {
    useGameStore.setState((s) => ({
        gameManagement: {
            ...s.gameManagement,
            round: 8,
            charisma: { ...s.gameManagement.charisma, current: 0 },
        },
        budget: { ...s.budget, treasury: 2000 }, // large treasury prevents bankruptcy
        relations: {
            ...s.relations,
            current: {
                military: otherRelations,
                business: otherRelations,
                people: otherRelations,
                [faction]: relationValue,
            },
        },
        // Null out the daily event so nextRound() doesn't apply a random modifier
        // that could push the target faction's relation below the threshold.
        dailyEvent: { current: null },
    }));
}

/** Sets up and triggers a special ending, then asserts it fired. */
function triggerSpecialEnding(faction: 'military' | 'business' | 'people'): void {
    seedRound8(faction, 5);
    useGameStore.getState().gameManagement.nextRound();
    expect(useGameStore.getState().specialEnding.available).toBe(true);
}

// ---------------------------------------------------------------------------
// Threshold: relation >= SPECIAL_ENDING_THRESHOLD at round 9
// ---------------------------------------------------------------------------

describe('Special ending trigger threshold', () => {
    beforeEach(resetStore);

    it('constant SPECIAL_ENDING_THRESHOLD is 5', () => {
        expect(GAMESTATE.SPECIAL_ENDING_THRESHOLD).toBe(5);
    });

    it('faction at relation 5 at round 9 → specialEnding.available = true', () => {
        // Arrange: seed round 8, military=5
        seedRound8('military', 5);
        expect(useGameStore.getState().gameManagement.round).toBe(8);

        // Act
        useGameStore.getState().gameManagement.nextRound();

        // Assert
        expect(useGameStore.getState().specialEnding.available).toBe(true);
        expect(useGameStore.getState().specialEnding.faction).toBe('military');
    });

    it('faction at relation 4 at round 9 → specialEnding.available stays false', () => {
        // Arrange: all factions at 4 — below threshold
        useGameStore.setState((s) => ({
            gameManagement: { ...s.gameManagement, round: 8 },
            budget: { ...s.budget, treasury: 2000 },
            relations: {
                ...s.relations,
                current: { military: 4, business: 4, people: 4 },
            },
            dailyEvent: { current: null }, // prevent a positive daily event from pushing a faction to ≥5
        }));

        // Act
        useGameStore.getState().gameManagement.nextRound();

        // Assert
        expect(useGameStore.getState().specialEnding.available).toBe(false);
    });

    it('faction at relation 10 (MAX) at round 9 → specialEnding.available = true', () => {
        // Regression: old MAX threshold should still qualify under the new lower threshold
        seedRound8('people', 10);

        useGameStore.getState().gameManagement.nextRound();

        expect(useGameStore.getState().specialEnding.available).toBe(true);
    });

    it('specialEnding does NOT fire before round 9 even with relation >= 5', () => {
        // Seed at round 7 (not yet round 9 after nextRound)
        useGameStore.setState((s) => ({
            gameManagement: { ...s.gameManagement, round: 7 },
            budget: { ...s.budget, treasury: 2000 },
            relations: { ...s.relations, current: { military: 5, business: 0, people: 0 } },
        }));

        // Act: nextRound takes us to round 8, not 9
        useGameStore.getState().gameManagement.nextRound();

        // Assert: round 8 does not trigger special ending
        expect(useGameStore.getState().specialEnding.available).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Faction → room index
// ---------------------------------------------------------------------------

describe('Faction to secret room index mapping', () => {
    beforeEach(resetStore);

    it('FACTION_ROOM_INDEX maps military=0, business=1, people=2', () => {
        expect(GAMESTATE.FACTION_ROOM_INDEX.military).toBe(0);
        expect(GAMESTATE.FACTION_ROOM_INDEX.business).toBe(1);
        expect(GAMESTATE.FACTION_ROOM_INDEX.people).toBe(2);
    });

    it('military trigger at round 9 → tabs.secretRoomIndex = 0', () => {
        seedRound8('military', 5);

        useGameStore.getState().gameManagement.nextRound();

        expect(useGameStore.getState().tabs.secretRoomIndex).toBe(0);
    });

    it('business trigger at round 9 → tabs.secretRoomIndex = 1', () => {
        seedRound8('business', 5);

        useGameStore.getState().gameManagement.nextRound();

        expect(useGameStore.getState().tabs.secretRoomIndex).toBe(1);
    });

    it('people trigger at round 9 → tabs.secretRoomIndex = 2', () => {
        seedRound8('people', 5);

        useGameStore.getState().gameManagement.nextRound();

        expect(useGameStore.getState().tabs.secretRoomIndex).toBe(2);
    });
});

// ---------------------------------------------------------------------------
// Charisma-weighted outcome roll
// ---------------------------------------------------------------------------

describe('Special ending charisma-weighted outcome', () => {
    beforeEach(resetStore);
    afterEach(() => vi.restoreAllMocks());

    it('charisma = 10 → goodChance = 0.75; roll < 0.75 → outcome = good', () => {
        triggerSpecialEnding('military');
        useGameStore.setState((s) => ({
            gameManagement: { ...s.gameManagement, charisma: { ...s.gameManagement.charisma, current: 10 } },
        }));
        // goodChance = 0.5 + (10/10)*0.25 = 0.75; roll 0.3 < 0.75 → good
        vi.spyOn(Math, 'random').mockReturnValue(0.3);

        useGameStore.getState().specialEnding.use();

        expect(useGameStore.getState().specialEnding.outcome).toBe('good');
    });

    it('charisma = -10 → goodChance = 0.25; roll 0.99 >= 0.25 → outcome = bad', () => {
        triggerSpecialEnding('business');
        useGameStore.setState((s) => ({
            gameManagement: { ...s.gameManagement, charisma: { ...s.gameManagement.charisma, current: -10 } },
        }));
        // goodChance = 0.5 + (-10/10)*0.25 = 0.25; roll 0.99 >= 0.25 → bad
        vi.spyOn(Math, 'random').mockReturnValue(0.99);

        useGameStore.getState().specialEnding.use();

        expect(useGameStore.getState().specialEnding.outcome).toBe('bad');
    });

    it('after use(), phase becomes special_ending and endReason is null', () => {
        triggerSpecialEnding('people');
        vi.spyOn(Math, 'random').mockReturnValue(0.1);

        useGameStore.getState().specialEnding.use();

        expect(useGameStore.getState().gameManagement.phase).toBe('special_ending');
        expect(useGameStore.getState().gameManagement.endReason).toBeNull();
    });

    it('calling use() twice does nothing on second call', () => {
        triggerSpecialEnding('military');
        vi.spyOn(Math, 'random').mockReturnValue(0.1);

        useGameStore.getState().specialEnding.use();
        const outcomeAfterFirst = useGameStore.getState().specialEnding.outcome;

        vi.spyOn(Math, 'random').mockReturnValue(0.9);
        useGameStore.getState().specialEnding.use();

        expect(useGameStore.getState().specialEnding.outcome).toBe(outcomeAfterFirst);
    });
});
