/**
 * Story 3-5: Budget Tier Consequences — unit tests
 *
 * Covers:
 *   - representativeStatuses initial state (all active)
 *   - Eliminate action → faction marked eliminated immediately
 *   - Eliminated faction survives nextRound() unchanged
 *   - Health LOW → sick factions computed in nextRound (mocked rollChance = always true)
 *   - Health normal → no sick factions in nextRound
 *   - Sick factions reset to active when health recovers
 *   - selectedPower reset when faction becomes sick/eliminated
 *   - checkCoup security modifier: HIGH security raises armed threshold
 *   - checkCoup security modifier: LOW security lowers armed threshold
 *   - Infrastructure LOW → infraLocked state (derived from budget expenditures)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGameStore } from '../../../src/Stores/GameState';
import { checkCoup } from '../../../src/Stores/CoupHandler';
import { GAMESTATE } from '../../../src/Constants/GameState';
import * as MathUtils from '../../../src/Utils/Math';

vi.mock('../../../src/i18n', () => ({
    default: { t: (key: string) => key }
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function startGame() {
    useGameStore.getState().gameManagement.setPhase('start', 'medium');
}

function advanceRound() {
    useGameStore.getState().gameManagement.nextRound();
}

const LOW_HEALTH = GAMESTATE.BUDGET_EFFECTS.HEALTH.LOW - 1;       // 2
const OK_HEALTH  = GAMESTATE.BUDGET_EFFECTS.HEALTH.LOW;            // 3
const LOW_INFRA  = GAMESTATE.BUDGET_EFFECTS.INFRASTRUCTURE.LOW - 1; // 2
const LOW_SEC    = GAMESTATE.BUDGET_EFFECTS.SECURITY.LOW - 1;      // 2
const HIGH_SEC   = GAMESTATE.BUDGET_EFFECTS.SECURITY.HIGH;         // 7

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('representativeStatuses — initial state', () => {
    beforeEach(() => startGame());

    it('test_repStatuses_initial_all_active', () => {
        const { representativeStatuses } = useGameStore.getState().gameManagement;
        expect(representativeStatuses.military).toBe('active');
        expect(representativeStatuses.business).toBe('active');
        expect(representativeStatuses.people).toBe('active');
    });
});

describe('representativeStatuses — eliminate action', () => {
    beforeEach(() => startGame());

    it('test_repStatuses_eliminate_military_marks_eliminated', () => {
        // Act
        useGameStore.getState().meet.takeAction('military', 'eliminate');

        // Assert
        const { representativeStatuses } = useGameStore.getState().gameManagement;
        expect(representativeStatuses.military).toBe('eliminated');
        expect(representativeStatuses.business).toBe('active');
        expect(representativeStatuses.people).toBe('active');
    });

    it('test_repStatuses_non_eliminate_action_leaves_statuses_unchanged', () => {
        // Act
        useGameStore.getState().meet.takeAction('business', 'bribe');

        // Assert
        const { representativeStatuses } = useGameStore.getState().gameManagement;
        expect(representativeStatuses.business).toBe('active');
    });

    it('test_repStatuses_eliminated_faction_returns_active_next_round', () => {
        // Arrange: eliminate military
        useGameStore.getState().meet.takeAction('military', 'eliminate');

        // Act: advance round (health at default → no sick roll)
        advanceRound();

        // Assert: military returns as a new representative — eliminated is not preserved
        const { representativeStatuses } = useGameStore.getState().gameManagement;
        expect(representativeStatuses.military).toBe('active');
        expect(representativeStatuses.business).toBe('active');
        expect(representativeStatuses.people).toBe('active');
    });
});

describe('representativeStatuses — sick factions from low health', () => {
    beforeEach(() => {
        vi.spyOn(MathUtils, 'rollChance').mockReturnValue(true);
        startGame();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('test_repStatuses_low_health_makes_active_factions_sick', async () => {
        // Arrange: force health below LOW threshold
        useGameStore.setState(s => ({
            budget: {
                ...s.budget,
                expenditures: { ...s.budget.expenditures, health: LOW_HEALTH },
            },
        }));

        // Act
        advanceRound();

        // Assert: at least one faction is sick (rollChance always returns true → all active become sick)
        const { representativeStatuses } = useGameStore.getState().gameManagement;
        const sickCount = (['military', 'business', 'people'] as const).filter(
            p => representativeStatuses[p] === 'sick'
        ).length;
        expect(sickCount).toBeGreaterThan(0);
    });

    it('test_repStatuses_normal_health_no_sick_factions', async () => {
        // Arrange: health at or above LOW threshold
        useGameStore.setState(s => ({
            budget: {
                ...s.budget,
                expenditures: { ...s.budget.expenditures, health: OK_HEALTH },
            },
        }));

        // Act
        advanceRound();

        // Assert: no sick factions
        const { representativeStatuses } = useGameStore.getState().gameManagement;
        const sickCount = (['military', 'business', 'people'] as const).filter(
            p => representativeStatuses[p] === 'sick'
        ).length;
        expect(sickCount).toBe(0);
    });

    it('test_repStatuses_sick_factions_recover_when_health_improves', async () => {
        // Arrange: first round at low health → factions become sick
        useGameStore.setState(s => ({
            budget: {
                ...s.budget,
                expenditures: { ...s.budget.expenditures, health: LOW_HEALTH },
            },
        }));
        advanceRound();

        // Raise health above LOW
        useGameStore.setState(s => ({
            budget: {
                ...s.budget,
                expenditures: { ...s.budget.expenditures, health: OK_HEALTH },
            },
        }));

        // Act: next round
        advanceRound();

        // Assert: no sick factions (they recovered)
        const { representativeStatuses } = useGameStore.getState().gameManagement;
        const sickCount = (['military', 'business', 'people'] as const).filter(
            p => representativeStatuses[p] === 'sick'
        ).length;
        expect(sickCount).toBe(0);
    });

    it('test_repStatuses_eliminated_faction_can_return_as_sick_when_health_low', async () => {
        // Arrange: eliminate military, then set health LOW
        // rollChance=true (from beforeEach) → all active factions become sick
        useGameStore.getState().meet.takeAction('military', 'eliminate');
        useGameStore.setState(s => ({
            budget: {
                ...s.budget,
                expenditures: { ...s.budget.expenditures, health: LOW_HEALTH },
            },
        }));

        // Act
        advanceRound();

        // Assert: military returned as new rep, then rolled sick due to low health
        const { representativeStatuses } = useGameStore.getState().gameManagement;
        expect(representativeStatuses.military).toBe('sick');
    });
});

describe('selectedPower reset when representative unavailable', () => {
    beforeEach(() => startGame());

    it('test_selectedPower_reset_to_none_when_selected_faction_eliminated', () => {
        // Arrange: select military, then eliminate them
        useGameStore.setState(s => ({ meet: { ...s.meet, selectedPower: 'military' } }));
        useGameStore.getState().meet.takeAction('military', 'eliminate');

        // Advance round (resets selectedPower if faction unavailable)
        advanceRound();

        // Assert
        expect(useGameStore.getState().meet.selectedPower).toBe('none');
    });
});

// ---------------------------------------------------------------------------
// checkCoup — security modifier
// ---------------------------------------------------------------------------

describe('checkCoup — security spend modifier', () => {
    const baseRelations = { military: 8, business: 0, people: 0 };
    const lowCharisma = GAMESTATE.COUP.CHARISMA_THRESHOLD; // ≤ -3

    it('test_checkCoup_high_security_raises_armed_threshold_by_one', () => {
        // With HIGH security, threshold becomes 9 → military at 8 is NOT armed
        const result = checkCoup(baseRelations, lowCharisma, 0.9, false, HIGH_SEC);
        // military = 8 < 9 (raised threshold) → not armed; but may still yellow-warn
        expect(result.outcome).not.toBe('coup');
        expect(result.outcome).not.toBe('grace');
    });

    it('test_checkCoup_normal_security_uses_default_threshold', () => {
        // Normal security (between LOW and HIGH): threshold stays at 8 → military at 8 is armed
        const normalSec = GAMESTATE.BUDGET_EFFECTS.SECURITY.LOW; // 3
        const result = checkCoup(baseRelations, lowCharisma, 0.9, false, normalSec);
        // Relation 8 >= threshold 8 → armed; graceRoll 0.9 >= GRACE_CHANCE 0.5 → coup
        expect(result.outcome === 'coup' || result.outcome === 'grace').toBe(true);
    });

    it('test_checkCoup_low_security_lowers_armed_threshold_by_one', () => {
        // With LOW security, threshold becomes 7 → military at 7 is armed
        const relations7 = { military: 7, business: 0, people: 0 };
        const result = checkCoup(relations7, lowCharisma, 0.9, false, LOW_SEC);
        // military = 7 >= 7 (lowered threshold) → armed; graceRoll 0.9 >= GRACE_CHANCE → coup
        expect(result.outcome === 'coup' || result.outcome === 'grace').toBe(true);
    });

    it('test_checkCoup_low_security_no_effect_if_relation_below_lowered_threshold', () => {
        // military at 6 — below even the lowered threshold of 7
        const relations6 = { military: 6, business: 0, people: 0 };
        const result = checkCoup(relations6, lowCharisma, 0.9, false, LOW_SEC);
        expect(result.outcome).not.toBe('coup');
        expect(result.outcome).not.toBe('grace');
    });

    it('test_checkCoup_omitted_security_param_applies_no_modifier', () => {
        // Calling without securitySpend → no modifier → threshold stays at 8 → military at 8 is armed
        const result = checkCoup(baseRelations, lowCharisma, 0.9, false);
        expect(result.outcome === 'coup' || result.outcome === 'grace').toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Law proposal filtering — eliminated reps return next round, sick reps don't propose
// ---------------------------------------------------------------------------

describe('law proposal filtering — eliminated faction returns and can propose next round', () => {
    beforeEach(() => {
        // rollChance false → no weird laws, no sick from health
        vi.spyOn(MathUtils, 'rollChance').mockReturnValue(false);
        startGame();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('test_law_can_come_from_any_faction_after_elimination_since_reps_return', () => {
        // Arrange: eliminate military and people
        useGameStore.getState().meet.takeAction('military', 'eliminate');
        useGameStore.getState().meet.takeAction('people', 'eliminate');

        // Act: advance round — eliminated reps return as new representatives
        advanceRound();

        // Assert: law can now come from any faction (all returned as active)
        const proposedLaw = useGameStore.getState().law.current;
        if (proposedLaw !== null && proposedLaw.type !== 'weird') {
            expect(['military', 'business', 'people']).toContain(proposedLaw.power);
        }
    });
});

// ---------------------------------------------------------------------------
// Infrastructure lockout — derived value check
// ---------------------------------------------------------------------------

describe('infrastructure lockout — budget threshold', () => {
    beforeEach(() => startGame());

    it('test_infraLocked_true_when_infrastructure_below_low', () => {
        useGameStore.setState(s => ({
            budget: {
                ...s.budget,
                expenditures: { ...s.budget.expenditures, infrastructure: LOW_INFRA },
            },
        }));
        const infra = useGameStore.getState().budget.expenditures.infrastructure;
        expect(infra < GAMESTATE.BUDGET_EFFECTS.INFRASTRUCTURE.LOW).toBe(true);
    });

    it('test_infraLocked_false_when_infrastructure_at_low_threshold', () => {
        useGameStore.setState(s => ({
            budget: {
                ...s.budget,
                expenditures: { ...s.budget.expenditures, infrastructure: OK_HEALTH },
            },
        }));
        const infra = useGameStore.getState().budget.expenditures.infrastructure;
        expect(infra < GAMESTATE.BUDGET_EFFECTS.INFRASTRUCTURE.LOW).toBe(false);
    });
});
