// BudgetRow.tsx
import { useGameStore } from '../../Stores/GameState'
import Typography from '../Typography/Typography'
import Button from '../Button/Button'
import { Icon } from '../Icon/Icon'
import { ExpendNumberFormatter, TaxNumberFormatter } from '../../Constants/Budget'
import type { Expenditures, Taxes } from '../../types/Budget'
import { useTranslation } from 'react-i18next'
import styles from './BudgetRow.module.css'

type BudgetRowProps = {
    id: Expenditures | Taxes
    label: string
    isTax?: boolean
}

export const BudgetRow = ({ id, label, isTax = false }: BudgetRowProps) => {
    const { t } = useTranslation();
    const value = useGameStore(s =>
        isTax ? s.budget.taxes[id as Taxes] : s.budget.expenditures[id as Expenditures]
    )

    const adjust = useGameStore(s => s.budget.adjustBudgetItem)

    return (
        <div className={styles.budgetRow}>
            <Typography variant="body">{t(label)}</Typography>

            <div className={styles.amountControl}>
                {isTax ?
                    <Button onClick={() => adjust(id, -5)}>
                        <Icon type="minus" /> 5
                    </Button> : null
                }
                <Button onClick={() => adjust(id, -1)}>
                    <Icon type="minus" />
                </Button>

                <Typography variant="body" color="accent">
                    {isTax ? TaxNumberFormatter(value) : ExpendNumberFormatter(value)}
                </Typography>

                <Button onClick={() => adjust(id, 1)}>
                    <Icon type="plus" />
                </Button>
                {isTax ?
                    <Button onClick={() => adjust(id, 5)}>
                        <Icon type="plus" /> 5
                    </Button> : null
                }
            </div>
        </div>
    )
}