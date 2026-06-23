import clsx from 'clsx'
import styles from './Tabs.module.css'
import type { TabProps } from '../../types/Tabs'
import { useTranslation } from 'react-i18next'
import { Icon } from '../Icon/Icon'
import Typography from '../Typography/Typography'
import { BudgetRow } from '../BudgetRow/BudgetRow'
import { EXPENDITURES, TAXES, MoneyNumberFormatter } from '../../Constants/Budget'
import { useGameStore } from '../../Stores/GameState'
import TabLayout from './TabLayout'
import { calculateRoundFinancials, computeRoundsLeft } from '../../Stores/BudgetHandler'
import { useMemo } from 'react'
import { computeBudgetVerdict, computeBudgetTrigger, getAdvisorLine } from '../../Utils/Advisor'
import { AdvisorFooter } from '../Advisor/AdvisorFooter'


const Budget = ({ isActive }: TabProps) => {
    const { t } = useTranslation();
    const { t: tAdvisor } = useTranslation('advisor')
    const budget = useGameStore(s => s.budget)
    const modifiers = useGameStore(s => s.gameManagement.modifiers)
    const round = useGameStore(s => s.gameManagement.round)
    const advisorLevel = useGameStore(s => s.shop.advisorLevel)
    const financials = calculateRoundFinancials(budget, modifiers, round)
    const net = financials.netChange
    const roundsLeft = computeRoundsLeft(budget.treasury, net)
    const budgetVerdict = computeBudgetVerdict(budget.expenditures)
    const budgetTrigger = computeBudgetTrigger(budget.expenditures, budget.taxes)

    const advisorKey = useMemo(
        () => getAdvisorLine({ category: 'budget', verdict: budgetVerdict, level: advisorLevel, trigger: budgetTrigger }),
        [budgetVerdict, advisorLevel, budgetTrigger]
    )
    const advisorText = advisorKey === 'No advice available.' ? advisorKey : tAdvisor(advisorKey)

    return (
        <TabLayout
            headerTitle={t('tabs.budget')}
            sideMenu={<>
                <Typography variant="caption" className={styles.positive}>{t('budget.taxes')}: +{MoneyNumberFormatter(financials.totalIncome)}</Typography>
                <Typography variant="caption" className={styles.negative}>{t('budget.expenses')}: -{MoneyNumberFormatter(financials.expenses)}</Typography>
                {financials.recurringIncome !== 0 && <Typography variant="caption" className={styles.positive}>{t('budget.recurring_income')}: +{MoneyNumberFormatter(financials.recurringIncome)}</Typography>}
                {financials.recurringExpenses !== 0 && <Typography variant="caption" className={styles.negative}>{t('budget.recurring_expense')}: -{MoneyNumberFormatter(financials.recurringExpenses)}</Typography>}
                {financials.lawTreasuryDelta !== 0 && <Typography variant="caption" className={financials.lawTreasuryDelta >= 0 ? styles.positive : styles.negative}>{t('budget.law_effects')}: {financials.lawTreasuryDelta >= 0 ? '+' : ''}{MoneyNumberFormatter(financials.lawTreasuryDelta)}</Typography>}
                {financials.dealTreasuryDelta !== 0 && <Typography variant="caption" className={financials.dealTreasuryDelta >= 0 ? styles.positive : styles.negative}>{t('budget.deal_effects')}: {financials.dealTreasuryDelta >= 0 ? '+' : ''}{MoneyNumberFormatter(financials.dealTreasuryDelta)}</Typography>}
                <div className={clsx(styles.netStatus, net >= 0 ? styles.positive : styles.negative)}>
                    {t('budget.total')}: {net >= 0 ? '+' : ''}{MoneyNumberFormatter(net)}
                </div>
                {roundsLeft !== null && <Typography variant="caption" className={styles.roundsWarning}><Icon type="warning" /> {t('budget.rounds_left', { rounds: roundsLeft })}</Typography>}
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
            <div className={styles.footer}>
                <AdvisorFooter advisorLevel={advisorLevel} advisorText={advisorText} />
            </div>
        </TabLayout>
    )
}

export default Budget
