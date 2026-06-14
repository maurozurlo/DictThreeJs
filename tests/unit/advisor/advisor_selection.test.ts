/**
 * Story 5-12: Economy Advisor — UI & Selection Logic
 * Tests for getAdvisorLine and all verdict/trigger computation helpers.
 */

import { describe, it, expect } from 'vitest';
import {
    getAdvisorLine,
    computeLawVerdict,
    computeLawTrigger,
    computeDealVerdict,
    computeBudgetVerdict,
    computeBudgetTrigger,
    computeDayendedVerdict,
    computeDayendedTrigger,
} from '../../../src/Utils/Advisor';

// ── getAdvisorLine ────────────────────────────────────────────────────────────

describe('getAdvisorLine', () => {
    it('test_advisor_line_valid_context_returns_string', () => {
        const result = getAdvisorLine({ category: 'law', verdict: 'approve', level: 3 });
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
    });

    it('test_advisor_line_generic_key_starts_with_g', () => {
        const result = getAdvisorLine({ category: 'law', verdict: 'approve', level: 1 });
        expect(result.startsWith('g_')).toBe(true);
    });

    it('test_advisor_line_override_trigger_returns_o_prefix', () => {
        const result = getAdvisorLine({ category: 'dayended', verdict: 'warn', level: 2, trigger: 'coup_warn' });
        expect(result.startsWith('o_')).toBe(true);
    });

    it('test_advisor_line_level0_ignores_trigger_returns_generic', () => {
        const result = getAdvisorLine({ category: 'dayended', verdict: 'warn', level: 0, trigger: 'coup_warn' });
        expect(result.startsWith('g_')).toBe(true);
    });

    it('test_advisor_line_empty_filter_returns_no_advice_fallback', () => {
        // coup_warn override has category='dayended', not 'law' — produces no match
        const result = getAdvisorLine({ category: 'law', verdict: 'approve', level: 1, trigger: 'coup_warn' });
        expect(result).toBe('No advice available.');
    });

    it('test_advisor_line_all_categories_and_verdicts_resolve_at_level2', () => {
        const cases: Array<[Parameters<typeof getAdvisorLine>[0]['category'], Parameters<typeof getAdvisorLine>[0]['verdict']]> = [
            ['law', 'approve'],
            ['law', 'reject'],
            ['deal', 'approve'],
            ['deal', 'reject'],
            ['budget', 'warn'],
            ['budget', 'ok'],
            ['dayended', 'warn'],
            ['dayended', 'ok'],
        ];
        for (const [category, verdict] of cases) {
            const result = getAdvisorLine({ category, verdict, level: 2 });
            expect(result).not.toBe('No advice available.');
        }
    });
});

// ── computeLawVerdict ─────────────────────────────────────────────────────────

describe('computeLawVerdict', () => {
    it('test_law_verdict_approve_when_accept_net_greater', () => {
        const verdict = computeLawVerdict({
            acceptEffect: { treasury: 100 },
            rejectEffect: { treasury: 50 },
        });
        expect(verdict).toBe('approve');
    });

    it('test_law_verdict_reject_when_reject_net_greater', () => {
        const verdict = computeLawVerdict({
            acceptEffect: { treasury: -50 },
            rejectEffect: { treasury: 100 },
        });
        expect(verdict).toBe('reject');
    });

    it('test_law_verdict_approve_when_sums_are_equal', () => {
        const verdict = computeLawVerdict({
            acceptEffect: { treasury: 20 },
            rejectEffect: { treasury: 20 },
        });
        expect(verdict).toBe('approve');
    });
});

// ── computeLawTrigger ─────────────────────────────────────────────────────────

describe('computeLawTrigger', () => {
    it('test_law_trigger_income_bonus_returns_recurring_income', () => {
        const trigger = computeLawTrigger({ recurringEffect: { incomeBonus: 10, label: 'test' } });
        expect(trigger).toBe('law_recurring_income');
    });

    it('test_law_trigger_expense_bonus_returns_recurring_expense', () => {
        const trigger = computeLawTrigger({ recurringEffect: { expenseBonus: 5, label: 'test' } });
        expect(trigger).toBe('law_recurring_expense');
    });

    it('test_law_trigger_no_recurring_returns_undefined', () => {
        const trigger = computeLawTrigger({});
        expect(trigger).toBeUndefined();
    });
});

// ── computeDealVerdict ────────────────────────────────────────────────────────

describe('computeDealVerdict', () => {
    it('test_deal_verdict_approve_when_accept_net_greater', () => {
        const verdict = computeDealVerdict({
            acceptEffect: { treasury: 200 },
            rejectEffect: { treasury: 10 },
        });
        expect(verdict).toBe('approve');
    });

    it('test_deal_verdict_reject_when_reject_net_greater', () => {
        const verdict = computeDealVerdict({
            acceptEffect: { treasury: -20 },
            rejectEffect: { treasury: 80 },
        });
        expect(verdict).toBe('reject');
    });
});

// ── computeBudgetVerdict ──────────────────────────────────────────────────────

describe('computeBudgetVerdict', () => {
    it('test_budget_verdict_warn_when_health_below_threshold', () => {
        const verdict = computeBudgetVerdict({ health: 2, infrastructure: 5, security: 5, education: 5 });
        expect(verdict).toBe('warn');
    });

    it('test_budget_verdict_warn_when_infra_below_threshold', () => {
        const verdict = computeBudgetVerdict({ health: 5, infrastructure: 2, security: 5, education: 5 });
        expect(verdict).toBe('warn');
    });

    it('test_budget_verdict_warn_when_security_below_threshold', () => {
        const verdict = computeBudgetVerdict({ health: 5, infrastructure: 5, security: 2, education: 5 });
        expect(verdict).toBe('warn');
    });

    it('test_budget_verdict_ok_when_all_above_threshold', () => {
        const verdict = computeBudgetVerdict({ health: 3, infrastructure: 3, security: 3, education: 1 });
        expect(verdict).toBe('ok');
    });

    it('test_budget_verdict_ok_education_does_not_trigger_warn', () => {
        const verdict = computeBudgetVerdict({ health: 5, infrastructure: 5, security: 5, education: 0 });
        expect(verdict).toBe('ok');
    });
});

// ── computeBudgetTrigger ──────────────────────────────────────────────────────

describe('computeBudgetTrigger', () => {
    const okTaxes = { peopleTaxes: 20, businessTaxes: 30 };

    it('test_budget_trigger_infra_low_takes_priority', () => {
        const trigger = computeBudgetTrigger({ health: 2, infrastructure: 2, security: 2, education: 2 }, okTaxes);
        expect(trigger).toBe('budget_infra_low');
    });

    it('test_budget_trigger_health_low_when_infra_ok', () => {
        const trigger = computeBudgetTrigger({ health: 2, infrastructure: 5, security: 5, education: 5 }, okTaxes);
        expect(trigger).toBe('budget_health_low');
    });

    it('test_budget_trigger_security_low_when_health_infra_ok', () => {
        const trigger = computeBudgetTrigger({ health: 5, infrastructure: 5, security: 2, education: 5 }, okTaxes);
        expect(trigger).toBe('budget_security_low');
    });

    it('test_budget_trigger_tax_penalty_people_over_threshold', () => {
        const trigger = computeBudgetTrigger(
            { health: 5, infrastructure: 5, security: 5, education: 5 },
            { peopleTaxes: 35, businessTaxes: 30 }
        );
        expect(trigger).toBe('budget_tax_penalty');
    });

    it('test_budget_trigger_tax_penalty_business_over_threshold', () => {
        const trigger = computeBudgetTrigger(
            { health: 5, infrastructure: 5, security: 5, education: 5 },
            { peopleTaxes: 20, businessTaxes: 50 }
        );
        expect(trigger).toBe('budget_tax_penalty');
    });

    it('test_budget_trigger_none_when_all_ok', () => {
        const trigger = computeBudgetTrigger({ health: 5, infrastructure: 5, security: 5, education: 5 }, okTaxes);
        expect(trigger).toBeUndefined();
    });
});

// ── computeDayendedVerdict ────────────────────────────────────────────────────

describe('computeDayendedVerdict', () => {
    it('test_dayended_verdict_warn_when_coup_active', () => {
        expect(computeDayendedVerdict(true, 500)).toBe('warn');
    });

    it('test_dayended_verdict_warn_when_treasury_below_100', () => {
        expect(computeDayendedVerdict(false, 50)).toBe('warn');
    });

    it('test_dayended_verdict_ok_when_no_coup_and_treasury_above_100', () => {
        expect(computeDayendedVerdict(false, 200)).toBe('ok');
    });

    it('test_dayended_verdict_warn_when_coup_active_even_with_high_treasury', () => {
        expect(computeDayendedVerdict(true, 1000)).toBe('warn');
    });
});

// ── computeDayendedTrigger ────────────────────────────────────────────────────

describe('computeDayendedTrigger', () => {
    it('test_dayended_trigger_coup_warn_takes_priority', () => {
        expect(computeDayendedTrigger(true, 50)).toBe('coup_warn');
    });

    it('test_dayended_trigger_treasury_low_when_below_100', () => {
        expect(computeDayendedTrigger(false, 50)).toBe('treasury_low');
    });

    it('test_dayended_trigger_treasury_high_when_above_500', () => {
        expect(computeDayendedTrigger(false, 600)).toBe('treasury_high');
    });

    it('test_dayended_trigger_none_when_treasury_in_normal_range', () => {
        expect(computeDayendedTrigger(false, 300)).toBeUndefined();
    });
});
