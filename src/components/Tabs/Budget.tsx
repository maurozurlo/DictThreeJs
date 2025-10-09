import styles from './Tabs.module.css'
import type { TabProps } from '../../types/Tabs'
import clsx from 'clsx'
import { useTranslation } from 'react-i18next'
import Typography from '../Typography/Typography'
import { BudgetRow } from '../BudgetRow/BudgetRow'
import { EXPENDITURES, ExpendNumberFormatter, MoneyNumberFormatter, TAXES } from '../../Constants/Budget'
import { useGameStore } from '../../Stores/GameState'


const Budget = ({ isActive }: TabProps) => {
    const { t } = useTranslation();
    const expenditures = useGameStore(s => s.budget.expenditures)
    const totalExpenditures = Object.values(expenditures).reduce((a, b) => a + b, 0)
    const taxes = useGameStore(s => s.budget.taxes)
    const totalTax = Object.values(taxes).reduce((a, b) => a + b, 0) // TODO: Logic for this will require a formula, based on respect, charisma and difficulty maybe

    return (
        <div className={clsx(styles.Tab, { [styles.isActive]: isActive })}>
            <div className={clsx(styles.pageContainer, styles.card)}>
                <div className={styles.tabsHeader}>
                    <Typography variant="h2">{t('tabs.budget')}</Typography>
                    <div className={styles.values}>
                        <Typography variant="h3">{t('budget.totalExpenses')}: {ExpendNumberFormatter(totalExpenditures)}</Typography>
                        |
                        <Typography variant="h3">{t('budget.totalTax')}: {MoneyNumberFormatter(totalTax)}</Typography>
                    </div>
                </div>

                <div className={styles.columns}>
                    <div className={styles.column}>
                        <Typography variant="h3">{t('budget.expenditures')}</Typography>
                        {EXPENDITURES.map(e => (
                            <BudgetRow key={e.id} id={e.id} label={e.label} />
                        ))}
                    </div>

                    <div className={styles.column}>
                        <Typography variant="h3">{t('budget.taxes')}</Typography>
                        {TAXES.map(tax => (
                            <BudgetRow key={tax.id} id={tax.id} label={tax.label} isTax />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Budget