import type { Expenditures, Taxes } from "../types/Budget"

export const BOUNDS_EXPENDITURE = [1, 10]
export const BOUNDS_TAX = [0, 50]
export const EXPENDITURE_MULTIPLIER = 25

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
        id: 'people',
        label: 'budget.peopleTax'
    },
    {
        id: 'business',
        label: 'budget.businessTax'
    }
]

export const TaxNumberFormatter = (n: number) => `${n}%`
export const ExpendNumberFormatter = (n: number) => `$${n * EXPENDITURE_MULTIPLIER}m`
export const MoneyNumberFormatter = (n: number) => `$${n}m`
