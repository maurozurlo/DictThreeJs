import { useGameStore } from '../../Stores/GameState'
import { MoneyNumberFormatter } from '../../Constants/Budget'
import { GAMESTATE } from '../../Constants/GameState'
import Typography from '../Typography/Typography'
import Button from '../Button/Button'
import { useTranslation } from 'react-i18next'
import { Modal, ModalCard } from '../Modal/Modal'
import styles from './DayEnded.module.css'
import AdvisorButton from '../Advisor/AdvisorButton'
import { computeDayendedVerdict, computeDayendedTrigger } from '../../Utils/Advisor'
import { getEffectiveCharisma, getEffectiveRelation } from '../../Utils/Modifiers'
import { Icon } from '../Icon/Icon'

const DayEnded = () => {
    const { t } = useTranslation()
    const phase = useGameStore(s => s.gameManagement.phase)
    const dayEnded = useGameStore(s => s.gameManagement.dayEnded)
    const round = useGameStore(s => s.gameManagement.round)
    const lastRoundIncome = useGameStore(s => s.gameManagement.lastRoundIncome)
    const lastRoundExpenses = useGameStore(s => s.gameManagement.lastRoundExpenses)
    const recurringIncome = useGameStore(s => s.gameManagement.lastRoundRecurringIncome)
    const recurringExpenses = useGameStore(s => s.gameManagement.lastRoundRecurringExpenses)
    const extraIncome = useGameStore(s => s.gameManagement.currentRoundExtraIncome)
    const extraExpenses = useGameStore(s => s.gameManagement.currentRoundExtraExpenses)
    // coupArmedLastRound is written at the START of the current round by nextRound().
    // When true here, the player survived a grace roll this round.
    // Clicking Continue calls nextRound() with graceTaken=true → certain coup.
    const coupArmed = useGameStore(s => s.gameManagement.coupArmedLastRound)
    const coupWarningFaction = useGameStore(s => s.gameManagement.coupWarningFaction)
    const currentCharisma = useGameStore(s => getEffectiveCharisma(s.gameManagement.charisma.current, s.gameManagement.modifiers, s.gameManagement.round))
    const effectiveRelations = useGameStore(s => ({
        military: getEffectiveRelation(s.relations.current.military, s.gameManagement.modifiers, 'military', s.gameManagement.round),
        business: getEffectiveRelation(s.relations.current.business, s.gameManagement.modifiers, 'business', s.gameManagement.round),
        people:   getEffectiveRelation(s.relations.current.people,   s.gameManagement.modifiers, 'people',   s.gameManagement.round),
    }))
    const nextRound = useGameStore(s => s.gameManagement.nextRound)

    // Re-evaluate whether the threat is still live at round-end.
    // If the player eliminated the faction this round, the warning is no longer valid.
    const coupStillActive = coupArmed
        && coupWarningFaction !== null
        && effectiveRelations[coupWarningFaction as keyof typeof effectiveRelations] >= GAMESTATE.COUP.RELATION_THRESHOLD
        && currentCharisma <= GAMESTATE.COUP.CHARISMA_THRESHOLD

    const treasury = useGameStore(s => s.budget.treasury)
    const advisorVerdict = computeDayendedVerdict(coupStillActive, treasury)
    const advisorTrigger = computeDayendedTrigger(coupStillActive, treasury)

    if (!dayEnded || phase !== 'start') return null

    const net = lastRoundIncome + recurringIncome + extraIncome
        - lastRoundExpenses - recurringExpenses - extraExpenses

    return (
        <Modal>
            <ModalCard>
                <Typography variant="h2" color="accent" className={styles.header}>
                    <Icon type="calendar" />
                    {t('actionPanel.month_ended', { round })}</Typography>
                <div className={styles.statRow}>
                    <span>{t('actionPanel.tax_income')}</span>
                    <span className={styles.positive}>+{MoneyNumberFormatter(lastRoundIncome)}</span>
                </div>
                <div className={styles.statRow}>
                    <span>{t('actionPanel.budget_expenses')}</span>
                    <span className={styles.negative}>-{MoneyNumberFormatter(lastRoundExpenses)}</span>
                </div>
                {recurringIncome > 0 && (
                    <div className={styles.statRow}>
                        <span>{t('actionPanel.recurring_income')}</span>
                        <span className={styles.positive}>+{MoneyNumberFormatter(recurringIncome)}</span>
                    </div>
                )}
                {recurringExpenses > 0 && (
                    <div className={styles.statRow}>
                        <span>{t('actionPanel.recurring_expenses')}</span>
                        <span className={styles.negative}>-{MoneyNumberFormatter(recurringExpenses)}</span>
                    </div>
                )}
                {extraIncome > 0 && (
                    <div className={styles.statRow}>
                        <span>{t('actionPanel.bonus_income')}</span>
                        <span className={styles.positive}>+{MoneyNumberFormatter(extraIncome)}</span>
                    </div>
                )}
                {extraExpenses > 0 && (
                    <div className={styles.statRow}>
                        <span>{t('actionPanel.extra_expenses')}</span>
                        <span className={styles.negative}>-{MoneyNumberFormatter(extraExpenses)}</span>
                    </div>
                )}
                <div className={styles.statRow}>
                    <span>{t('actionPanel.net')}</span>
                    <span className={net >= 0 ? styles.positive : styles.negative}>
                        {net >= 0 ? '+' : '-'}{MoneyNumberFormatter(Math.abs(net))}
                    </span>
                </div>
                {coupStillActive && (
                    <div className={styles.coupWarning}>
                        {t('actionPanel.coup_warning')}
                    </div>
                )}
                <AdvisorButton category="dayended" verdict={advisorVerdict} trigger={advisorTrigger} />
                <Button onClick={nextRound}>
                    {round + 1 <= GAMESTATE.ROUNDS.MAX ? t('actionPanel.continue_month', { month: round + 1 }) : t('actionPanel.finish_month', { month: round })}
                </Button>
            </ModalCard>
        </Modal>
    )
}

export default DayEnded
