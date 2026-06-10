import styles from './ActionPanel.module.css'
import { Icon } from '../Icon/Icon'
import Typography from '../Typography/Typography'
import Meet from '../Tabs/Meet'
import Laws from '../Tabs/Laws'
import { useGameStore } from '../../Stores/GameState'
import { Tabs } from '../../types/Tabs'
import { MoneyNumberFormatter } from '../../Constants/Budget'
import { getCharismaLeft } from '../../Utils/UI'
import { useTranslation } from 'react-i18next'
import { useRoundTimer } from '../../Hooks/useRoundTimer'
import Button from '../Button/Button'
import { useState } from 'react'
import { calculateRoundFinancials } from '../../Stores/BudgetHandler'


const ActionPanel = () => {
    const { t } = useTranslation()
    const activeTab = useGameStore((s) => s.tabs.activeTab);
    const relations = useGameStore((s) => s.relations.current);
    const money = useGameStore((s) => s.budget.treasury);
    const charisma = useGameStore(s => s.gameManagement.charisma.current)
    const { displayTime } = useRoundTimer()
    const phase = useGameStore(s => s.gameManagement.phase)
    const dayEnded = useGameStore(s => s.gameManagement.dayEnded)
    const lastRoundIncome = useGameStore(s => s.gameManagement.lastRoundIncome)
    const lastRoundExpenses = useGameStore(s => s.gameManagement.lastRoundExpenses)
    const nextRound = useGameStore(s => s.gameManagement.nextRound)
    const expireTimer = useGameStore(s => s.gameManagement.expireTimer)
    const budget = useGameStore(s => s.budget)
    const round = useGameStore(s => s.gameManagement.round)
    const extraIncome = useGameStore(s => s.gameManagement.currentRoundExtraIncome)
    const extraExpenses = useGameStore(s => s.gameManagement.currentRoundExtraExpenses)
    const meetTaken = useGameStore(s => s.meet.actionTaken.taken)
    const lawDecided = useGameStore(s => s.law.lawDecided)
    const dealDecided = useGameStore(s => s.deals.dealDecided)
    const [showConfirm, setShowConfirm] = useState(false)
    const [showSkipModal, setShowSkipModal] = useState(false)

    const allActionsDone = meetTaken && lawDecided && dealDecided
    const net = lastRoundIncome - lastRoundExpenses
    const projected = calculateRoundFinancials(budget)
    const projectedNet = projected.totalIncome - projected.expenses

    function handleNextRound() {
        if (dayEnded) {
            nextRound()
        } else if (allActionsDone) {
            setShowSkipModal(true)
        } else {
            setShowConfirm(true)
        }
    }

    function handleConfirm() {
        setShowConfirm(false)
        setShowSkipModal(true)
    }

    function handleSkipModalContinue() {
        setShowSkipModal(false)
        expireTimer()
    }

    return (
        <>
            <div className={styles.actionPanel}>
                <div className={styles.genStats}>
                    <div className={styles.clock}>
                        <Icon type='clock' className={styles.bigClock}><div className={styles.hours} />
                            <div className={styles.minutes} /></Icon>

                        <Typography variant={'caption'} className={styles.time}>{displayTime}</Typography>
                    </div>

                    <div className={styles.budget}>
                        <Typography variant={'body'}>{t('actionPanel.treasury')}</Typography>
                        <Typography variant={'caption'}>{MoneyNumberFormatter(money)}</Typography>
                    </div>
                </div>

                <div className={styles.respect}>
                    <div className={styles.respectPowers}>
                        <div className={styles.respectItem}>
                            <Icon type='business' />
                            <span className={styles.respectNumber}>{relations.business}</span>
                        </div>
                        <div className={styles.respectItem}>
                            <Icon type='military' />
                            <span className={styles.respectNumber}>{relations.military}</span>
                        </div>
                        <div className={styles.respectItem}>
                            <Icon type='people' />
                            <span className={styles.respectNumber}>{relations.people}</span>

                        </div>
                    </div>

                    <div className={styles.charisma}>
                        <Typography variant='caption'>{t('actionPanel.charisma')}</Typography>


                        <div className={styles.charismaSlider}>
                            <Icon type='needle' style={{
                                position: 'absolute',
                                top: '10%',
                                left: `${getCharismaLeft(charisma)}%`
                            }} />
                        </div>
                    </div>
                </div>

                <div className={styles.actions}>
                    {showConfirm ?
                        <div className={styles.confirmBox}>
                            <Typography variant="body">{t('actionPanel.advance_warning')}</Typography>
                            <div className={styles.confirmButtons}>
                                <Button onClick={handleConfirm}>{t('actionPanel.confirm')}</Button>
                                <Button onClick={() => setShowConfirm(false)}>{t('actionPanel.cancel')}</Button>
                            </div>
                        </div>
                        :
                        <>
                            <div className={styles.activeTab}>
                                {activeTab === Tabs.Meet ? <Meet /> : null}
                                {activeTab === Tabs.Laws ? <Laws /> : null}
                            </div>
                            <div className={styles.nextRound}>
                                {phase === 'start' && !dayEnded && (
                                    <Button onClick={handleNextRound}>
                                        {allActionsDone ? t('actionPanel.next_round') : t('actionPanel.skip')}
                                    </Button>
                                )}
                            </div>
                        </>
                    }
                </div>
            </div>

            {dayEnded && phase === 'start' && (
                <div className={styles.skipOverlay}>
                    <div className={styles.skipCard}>
                        <Typography variant="h2" color="accent">{t('actionPanel.day_ended', { round })}</Typography>
                        <div className={styles.skipStatRow}>
                            <span>{t('actionPanel.tax_income')}</span>
                            <span className={styles.positive}>+${lastRoundIncome}M</span>
                        </div>
                        {extraIncome > 0 && (
                            <div className={styles.skipStatRow}>
                                <span>{t('actionPanel.bonus_income')}</span>
                                <span className={styles.positive}>+${extraIncome}M</span>
                            </div>
                        )}
                        <div className={styles.skipStatRow}>
                            <span>{t('actionPanel.budget_expenses')}</span>
                            <span className={styles.negative}>-${lastRoundExpenses}M</span>
                        </div>
                        {extraExpenses > 0 && (
                            <div className={styles.skipStatRow}>
                                <span>{t('actionPanel.extra_expenses')}</span>
                                <span className={styles.negative}>-${extraExpenses}M</span>
                            </div>
                        )}
                        <div className={styles.skipStatRow}>
                            <span>{t('actionPanel.net')}</span>
                            <span className={net >= 0 ? styles.positive : styles.negative}>
                                {net >= 0 ? '+' : ''}${net}M
                            </span>
                        </div>
                        <Button onClick={nextRound}>
                            {t('actionPanel.continue_day', { day: round + 1 })}
                        </Button>
                    </div>
                </div>
            )}

            {showSkipModal && (
                <div className={styles.skipOverlay}>
                    <div className={styles.skipCard}>
                        <Typography variant="h2">{t('actionPanel.day_ended', { round })}</Typography>
                        <div className={styles.skipStatRow}>
                            <span>{t('actionPanel.tax_income')}</span>
                            <span className={styles.positive}>+${projected.totalIncome}M</span>
                        </div>
                        <div className={styles.skipStatRow}>
                            <span>{t('actionPanel.budget_expenses')}</span>
                            <span className={styles.negative}>-${projected.expenses}M</span>
                        </div>
                        <div className={styles.skipStatRow}>
                            <span>{t('actionPanel.net')}</span>
                            <span className={projectedNet >= 0 ? styles.positive : styles.negative}>
                                {projectedNet >= 0 ? '+' : ''}${projectedNet}M
                            </span>
                        </div>
                        <Button onClick={handleSkipModalContinue}>
                            {t('actionPanel.continue_day', { day: round + 1 })}
                        </Button>
                    </div>
                </div>
            )}
        </>
    )
}

export default ActionPanel
