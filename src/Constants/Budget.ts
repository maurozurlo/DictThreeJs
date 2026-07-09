import type { Expenditures, Taxes } from "../types/Budget"
import i18n from "../i18n"
const EXPENDITURE_MULTIPLIER = 10

export const EXPENDITURES: { id: Expenditures, label: string }[] = [
    {
        id: 'health',
        label: 'budget.health'
    },
    {
        id: 'infrastructure',
        label: 'budget.infrastructure'
    },
    {
        id: 'security',
        label: 'budget.security'
    },
    {
        id: 'education',
        label: 'budget.education'
    },
]

export const TAXES: { id: Taxes, label: string }[] = [
    {
        id: 'peopleTaxes',
        label: 'budget.peopleTax'
    },
    {
        id: 'businessTaxes',
        label: 'budget.businessTax'
    }
]

export const TaxNumberFormatter = (n: number) => `${n}%`
export const ExpendNumberFormatter = (n: number) => `$${n * EXPENDITURE_MULTIPLIER}m`
export const MoneyNumberFormatter = (n: number) => {
    const symbol = i18n.t('currency.symbol', { defaultValue: '$' })
    const unit = i18n.t('currency.unit', { defaultValue: 'm' })
    return `${symbol}${n}${unit}`
}
