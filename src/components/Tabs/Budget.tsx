import styles from './Tabs.module.css'
import type { TabProps } from '../../types/Tabs'
import { useTranslation } from 'react-i18next'
import Typography from '../Typography/Typography'
import { BudgetRow } from '../BudgetRow/BudgetRow'
import { EXPENDITURES, TAXES, MoneyNumberFormatter } from '../../Constants/Budget'
import { useGameStore } from '../../Stores/GameState'
import TabLayout from './TabLayout'
import { calculateRoundFinancials } from '../../Stores/BudgetHandler'


const Budget = ({ isActive }: TabProps) => {
    const { t } = useTranslation();
    const budget = useGameStore(s => s.budget)
    const financials = calculateRoundFinancials(budget)
    const net = financials.netChange

    return (
        <TabLayout
            headerTitle={t('tabs.budget')}
            sideMenu={<>
                <Typography variant="h3">{t('budget.totalTax')}: +{MoneyNumberFormatter(financials.totalIncome)}</Typography>
                |
                <Typography variant="h3">{t('budget.totalExpenses')}: -{MoneyNumberFormatter(financials.expenses)}</Typography>
                |
                <span style={{ fontFamily: 'inherit', fontSize: 'inherit', color: net >= 0 ? '#27ae60' : '#e74c3c' }}>
                    {t('budget.net')}: {net >= 0 ? '+' : '-'}{MoneyNumberFormatter(Math.abs(net))}
                </span>
            </>}
            isActive={isActive}>
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
        </TabLayout>
    )
}

export default Budget