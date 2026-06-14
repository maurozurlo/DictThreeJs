import type { AdvisorContext, AdvisorLevel, AdvisorOverrideTrigger, AdvisorVerdict } from '../types/Advisor';
import type { Law } from '../types/Law';
import type { Deal } from '../types/Deal';
import type { Expenditures, Taxes } from '../types/Budget';
import { ADVISOR_LINES } from '../assets/advisorDialogue';
import { getRandomFromList } from './Math';
import { GAMESTATE } from '../Constants/GameState';

export const ADVISOR_NAMES: Record<AdvisorLevel, string> = {
    0: 'Kiki',
    1: 'Edward',
    2: 'Ricky',
    3: 'Alfonso',
};

/** Returns an i18n key from the advisor namespace, or 'No advice available.' if no match found. */
export function getAdvisorLine(ctx: AdvisorContext): string {
    const activeTrigger = ctx.level === 0 ? undefined : ctx.trigger;
    const candidates = ADVISOR_LINES.filter(l =>
        l.category === ctx.category &&
        l.verdict === ctx.verdict &&
        l.level === ctx.level &&
        l.trigger === activeTrigger
    );
    if (!candidates.length) return 'No advice available.';
    return getRandomFromList(candidates).key;
}

export function computeLawVerdict(law: Pick<Law, 'acceptEffect' | 'rejectEffect'>): AdvisorVerdict {
    const acceptNet = (Object.values(law.acceptEffect) as number[]).reduce((s, v) => s + v, 0);
    const rejectNet = (Object.values(law.rejectEffect) as number[]).reduce((s, v) => s + v, 0);
    return acceptNet >= rejectNet ? 'approve' : 'reject';
}

export function computeLawTrigger(law: Pick<Law, 'recurringEffect'>): AdvisorOverrideTrigger | undefined {
    if ((law.recurringEffect?.incomeBonus ?? 0) > 0) return 'law_recurring_income';
    if ((law.recurringEffect?.expenseBonus ?? 0) > 0) return 'law_recurring_expense';
    return undefined;
}

export function computeDealVerdict(deal: Pick<Deal, 'acceptEffect' | 'rejectEffect'>): AdvisorVerdict {
    const acceptNet = (Object.values(deal.acceptEffect) as number[]).reduce((s, v) => s + v, 0);
    const rejectNet = (Object.values(deal.rejectEffect) as number[]).reduce((s, v) => s + v, 0);
    return acceptNet >= rejectNet ? 'approve' : 'reject';
}

export function computeDealTrigger(deal: Pick<Deal, 'recurringEffect'>): AdvisorOverrideTrigger | undefined {
    if ((deal.recurringEffect?.incomeBonus ?? 0) > 0) return 'law_recurring_income';
    if ((deal.recurringEffect?.expenseBonus ?? 0) > 0) return 'law_recurring_expense';
    return undefined;
}

export function computeBudgetVerdict(expenditures: Record<Expenditures, number>): AdvisorVerdict {
    const { BUDGET_EFFECTS } = GAMESTATE;
    return (
        expenditures.health < BUDGET_EFFECTS.HEALTH.LOW ||
        expenditures.infrastructure < BUDGET_EFFECTS.INFRASTRUCTURE.LOW ||
        expenditures.security < BUDGET_EFFECTS.SECURITY.LOW
    ) ? 'warn' : 'ok';
}

export function computeBudgetTrigger(
    expenditures: Record<Expenditures, number>,
    taxes: Record<Taxes, number>,
): AdvisorOverrideTrigger | undefined {
    const { BUDGET_EFFECTS, INCOME } = GAMESTATE;
    if (expenditures.infrastructure < BUDGET_EFFECTS.INFRASTRUCTURE.LOW) return 'budget_infra_low';
    if (expenditures.health < BUDGET_EFFECTS.HEALTH.LOW) return 'budget_health_low';
    if (expenditures.security < BUDGET_EFFECTS.SECURITY.LOW) return 'budget_security_low';
    if (
        taxes.peopleTaxes > INCOME.TAX_PENALTY_PEOPLE_THRESHOLD ||
        taxes.businessTaxes > INCOME.TAX_PENALTY_BUSINESS_THRESHOLD
    ) return 'budget_tax_penalty';
    return undefined;
}

export function computeDayendedVerdict(coupActive: boolean, treasury: number): AdvisorVerdict {
    return (coupActive || treasury < 100) ? 'warn' : 'ok';
}

export function computeDayendedTrigger(coupActive: boolean, treasury: number): AdvisorOverrideTrigger | undefined {
    if (coupActive) return 'coup_warn';
    if (treasury < 100) return 'treasury_low';
    if (treasury > 500) return 'treasury_high';
    return undefined;
}
