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
import { GAMESTATE } from '../../Constants/GameState'
import { Modal, ModalCard } from '../Modal/Modal'


const ActionPanel = () => {
    const { t } = useTranslation()
    const activeTab = useGameStore((s) => s.tabs.activeTab);
    const relations = useGameStore((s) => s.relations.current);
    const money = useGameStore((s) => s.budget.treasury);
    const charisma = useGameStore(s => s.gameManagement.charisma.current)
    const { displayTime, progress } = useRoundTimer()
    const totalMinutes = progress * 480;
    const minuteAngle = (totalMinutes % 60) / 60 * 360 - 90;
    const hourAngle   = ((totalMinutes / 60 + 9) % 12) / 12 * 360 - 90;
    const phase = useGameStore(s => s.gameManagement.phase)
    const dayEnded = useGameStore(s => s.gameManagement.dayEnded)
    const lastRoundIncome = useGameStore(s => s.gameManagement.lastRoundIncome)
    const lastRoundExpenses = useGameStore(s => s.gameManagement.lastRoundExpenses)
    const nextRound = useGameStore(s => s.gameManagement.nextRound)
    const round = useGameStore(s => s.gameManagement.round)
    const extraIncome = useGameStore(s => s.gameManagement.currentRoundExtraIncome)
    const extraExpenses = useGameStore(s => s.gameManagement.currentRoundExtraExpenses)

    const net = lastRoundIncome - lastRoundExpenses

    return (
        <>
            <div className={styles.actionPanel}>
                <div className={styles.genStats}>
                    <div className={styles.clock}>
                        <Icon type='clock' className={styles.bigClock}>
                            <div className={styles.hours}   style={{ transform: `rotate(${hourAngle}deg)` }} />
                            <div className={styles.minutes} style={{ transform: `rotate(${minuteAngle}deg)` }} />
                        </Icon>

                        <Typography variant={'caption'} className={styles.time}>{displayTime}</Typography>
                    </div>

                    <div className={styles.budget}>
                        <Typography variant={'body'}>{t('nav.rounds')} {round}/{GAMESTATE.ROUNDS.MAX}</Typography>
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
                    <div className={styles.activeTab}>
                        {activeTab === Tabs.Meet ? <Meet /> : null}
                        {activeTab === Tabs.Laws ? <Laws /> : null}
                    </div>
                </div>
            </div>

            {dayEnded && phase === 'start' && (
                <Modal>
                    <ModalCard>
                        <Typography variant="h2" color="accent">{t('actionPanel.day_ended', { round })}</Typography>
                        <div className={styles.skipStatRow}>
                            <span>{t('actionPanel.tax_income')}</span>
                            <span className={styles.positive}>+{MoneyNumberFormatter(lastRoundIncome)}</span>
                        </div>
                        {extraIncome > 0 && (
                            <div className={styles.skipStatRow}>
                                <span>{t('actionPanel.bonus_income')}</span>
                                <span className={styles.positive}>+{MoneyNumberFormatter(extraIncome)}</span>
                            </div>
                        )}
                        <div className={styles.skipStatRow}>
                            <span>{t('actionPanel.budget_expenses')}</span>
                            <span className={styles.negative}>-{MoneyNumberFormatter(lastRoundExpenses)}</span>
                        </div>
                        {extraExpenses > 0 && (
                            <div className={styles.skipStatRow}>
                                <span>{t('actionPanel.extra_expenses')}</span>
                                <span className={styles.negative}>-{MoneyNumberFormatter(extraExpenses)}</span>
                            </div>
                        )}
                        <div className={styles.skipStatRow}>
                            <span>{t('actionPanel.net')}</span>
                            <span className={net >= 0 ? styles.positive : styles.negative}>
                                {net >= 0 ? '+' : '-'}{MoneyNumberFormatter(Math.abs(net))}
                            </span>
                        </div>
                        <Button onClick={nextRound}>
                            {t('actionPanel.continue_day', { day: round + 1 })}
                        </Button>
                    </ModalCard>
                </Modal>
            )}
        </>
    )
}

export default ActionPanel
