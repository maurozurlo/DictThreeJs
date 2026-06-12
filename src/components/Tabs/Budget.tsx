import clsx from 'clsx'
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
    const treasury = useGameStore(s => s.budget.treasury)
    const financials = calculateRoundFinancials(budget)
    const net = financials.netChange
    const roundsLeft = net < 0 ? Math.floor(treasury / Math.abs(net)) : null

    return (
        <TabLayout
            headerTitle={t('tabs.budget')}
            sideMenu={<>
                <Typography variant="caption" className={styles.positive}>{t('budget.in')}: +{MoneyNumberFormatter(financials.totalIncome)}</Typography>
                <Typography variant="caption" className={styles.negative}>{t('budget.out')}: -{MoneyNumberFormatter(financials.expenses)}</Typography>
                <div className={clsx(styles.netStatus, net >= 0 ? styles.positive : styles.negative)}>
                    {t('budget.net')}: {net >= 0 ? '+' : '-'}{MoneyNumberFormatter(Math.abs(net))}
                </div>
                {roundsLeft !== null && <Typography variant="caption" className={styles.roundsWarning}>⚠️ {t('budget.rounds_left', { rounds: roundsLeft })}</Typography>}
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