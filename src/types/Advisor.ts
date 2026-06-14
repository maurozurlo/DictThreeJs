export type AdvisorCategory = 'law' | 'deal' | 'budget' | 'dayended';
export type AdvisorVerdict = 'approve' | 'reject' | 'warn' | 'ok';
export type AdvisorLevel = 0 | 1 | 2 | 3;

export type AdvisorOverrideTrigger =
    | 'coup_warn'
    | 'law_recurring_income'
    | 'law_recurring_expense'
    | 'budget_tax_penalty'
    | 'budget_health_low'
    | 'budget_security_low'
    | 'budget_military_low'
    | 'budget_infra_low'
    | 'treasury_low'
    | 'treasury_high';

export interface AdvisorLine {
    category: AdvisorCategory;
    verdict: AdvisorVerdict;
    level: AdvisorLevel;
    key: string;
    trigger?: AdvisorOverrideTrigger;
}
