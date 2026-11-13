import { useGameStore } from '../../Stores/GameState'
import { MoneyNumberFormatter } from '../../Constants/Budget'
import { GAMESTATE } from '../../Constants/GameState'
import Typography from '../Typography/Typography'
import { useTranslation } from 'react-i18next'
import { Modal, ModalCard } from '../Modal/Modal'
import styles from './DayEnded.module.css'
import AdvisorButton from '../Advisor/AdvisorButton'
import { computeDayendedVerdict, computeDayendedTrigger } from '../../Utils/Advisor'
import { getEffectiveCharisma, getEffectiveRelation } from '../../Utils/Modifiers'
import { Icon } from '../Icon/Icon'
import { dumbifyText } from '../../Utils/String'
import { buildRevealHeadline } from '../../Utils/RevealHeadline'

interface DayEndedProps {
    /** True once the mandatory reveal window has elapsed (ADR-0012); the modal then hides. */
    revealAcked: boolean;
}

const DayEnded = ({ revealAcked }: DayEndedProps) => {
    const { t } = useTranslation()
    const phase = useGameStore(s => s.gameManagement.phase)
    const dayEnded = useGameStore(s => s.gameManagement.dayEnded)
    const dwelling = useGameStore(s => s.gameManagement.dwelling)
    const dumbScore = useGameStore(s => s.gameManagement.dumbScore)
    const round = useGameStore(s => s.gameManagement.round)
    const lastRoundIncome = useGameStore(s => s.gameManagement.lastRoundIncome)
    const lastRoundExpenses = useGameStore(s => s.gameManagement.lastRoundExpenses)
    const recurringIncome = useGameStore(s => s.gameManagement.lastRoundRecurringIncome)
    const recurringExpenses = useGameStore(s => s.gameManagement.lastRoundRecurringExpenses)
    const lawTreasuryDelta = useGameStore(s => s.gameManagement.lastRoundLawTreasuryDelta)
    const dealTreasuryDelta = useGameStore(s => s.gameManagement.lastRoundDealTreasuryDelta)
    const expropriateGain = useGameStore(s => s.gameManagement.currentRoundExpropriateGain)
    const bribeCost = useGameStore(s => s.gameManagement.currentRoundBribeCost)
    const shopCost = useGameStore(s => s.gameManagement.currentRoundShopCost)
    const extraIncome = useGameStore(s => s.gameManagement.currentRoundExtraIncome)
    const extraExpenses = useGameStore(s => s.gameManagement.currentRoundExtraExpenses)
    // coupArmedLastRound is written at the START of the current round by nextRound().
    // When true here, the player survived a grace roll this round.
    // Clicking Continue calls nextRound() with graceTaken=true → certain coup.
    const coupArmed = useGameStore(s => s.gameManagement.coupArmedLastRound)
    const coupWarningFaction = useGameStore(s => s.gameManagement.coupWarningFaction)
    const currentCharisma = useGameStore(s => getEffectiveCharisma(s.gameManagement.charisma.current, s.gameManagement.modifiers, s.gameManagement.round))
    // Select each relation as a primitive — a selector returning a fresh object
    // literal breaks useSyncExternalStore's Object.is check and causes an infinite
    // re-render loop. Assemble the object in the component body instead.
    const militaryRelation = useGameStore(s => getEffectiveRelation(s.relations.current.military, s.gameManagement.modifiers, 'military', s.gameManagement.round))
    const businessRelation = useGameStore(s => getEffectiveRelation(s.relations.current.business, s.gameManagement.modifiers, 'business', s.gameManagement.round))
    const peopleRelation = useGameStore(s => getEffectiveRelation(s.relations.current.people, s.gameManagement.modifiers, 'people', s.gameManagement.round))
    const effectiveRelations = {
        military: militaryRelation,
        business: businessRelation,
        people: peopleRelation,
    }
    // Re-evaluate whether the threat is still live at round-end.
    // If the player eliminated the faction this round, the warning is no longer valid.
    const coupStillActive = coupArmed
        && coupWarningFaction !== null
        && effectiveRelations[coupWarningFaction as keyof typeof effectiveRelations] >= GAMESTATE.COUP.RELATION_THRESHOLD
        && currentCharisma <= GAMESTATE.COUP.CHARISMA_THRESHOLD

    const treasury = useGameStore(s => s.budget.treasury)
    const advisorVerdict = computeDayendedVerdict(coupStillActive, treasury)
    const advisorTrigger = computeDayendedTrigger(coupStillActive, treasury)

    // Mandatory-reveal-then-optional-dwell hinge (ADR-0012). This component is
    // only the blocking reveal stage; once `revealAcked` (App-owned timer) flips,
    // the dwell-stage advance lives in the Navbar advance slot so nothing covers
    // the Street view. Gated on `dwelling` (not `dayEnded`) so the same flow
    // covers the round-1 opening and every round-end hinge.
    if (!dwelling || phase !== 'start' || revealAcked) return null

    // Round-1 opening has no round to report on yet — distinct headline.
    const isIntro = !dayEnded

    const net = lastRoundIncome + recurringIncome + extraIncome + lawTreasuryDelta + dealTreasuryDelta + expropriateGain
        - lastRoundExpenses - recurringExpenses - extraExpenses - bribeCost - shopCost

    const headline = isIntro
        ? dumbifyText(t('hinge.intro_headline'), dumbScore)
        : dumbifyText(buildRevealHeadline(round, t), dumbScore)

    if (isIntro) {
        return (
            <Modal>
                <ModalCard>
                    <Typography variant="h2" color="accent" className={styles.headline}>{headline}</Typography>
                </ModalCard>
            </Modal>
        )
    }

    return (
        <Modal>
            <ModalCard>
                <Typography variant="h2" color="accent" className={styles.header}>
                    <Icon type="calendar" />
                    {t('actionPanel.month_ended', { round })}</Typography>
                <Typography variant="h3" color="accent" className={styles.headline}>{headline}</Typography>
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
                {expropriateGain > 0 && (
                    <div className={styles.statRow}>
                        <span>{t('actionPanel.expropriation_gain')}</span>
                        <span className={styles.positive}>+{MoneyNumberFormatter(expropriateGain)}</span>
                    </div>
                )}
                {bribeCost > 0 && (
                    <div className={styles.statRow}>
                        <span>{t('actionPanel.bribe_cost')}</span>
                        <span className={styles.negative}>-{MoneyNumberFormatter(bribeCost)}</span>
                    </div>
                )}
                {shopCost > 0 && (
                    <div className={styles.statRow}>
                        <span>{t('actionPanel.shop_cost')}</span>
                        <span className={styles.negative}>-{MoneyNumberFormatter(shopCost)}</span>
                    </div>
                )}
                {lawTreasuryDelta !== 0 && (
                    <div className={styles.statRow}>
                        <span>{t('actionPanel.law_effects')}</span>
                        <span className={lawTreasuryDelta >= 0 ? styles.positive : styles.negative}>
                            {lawTreasuryDelta >= 0 ? '+' : ''}{MoneyNumberFormatter(lawTreasuryDelta)}
                        </span>
                    </div>
                )}
                {dealTreasuryDelta !== 0 && (
                    <div className={styles.statRow}>
                        <span>{t('actionPanel.deal_effects')}</span>
                        <span className={dealTreasuryDelta >= 0 ? styles.positive : styles.negative}>
                            {dealTreasuryDelta >= 0 ? '+' : ''}{MoneyNumberFormatter(dealTreasuryDelta)}
                        </span>
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
                {/* No advance button here — mandatory reveal stage cannot be skipped early (ADR-0012 AC-6). */}
            </ModalCard>
        </Modal>
    )
}

export default DayEnded
