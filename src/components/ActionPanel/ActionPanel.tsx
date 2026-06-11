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
import { useDebugControls } from '../../Hooks/useDebugControls'
import { GAMESTATE } from '../../Constants/GameState'

const ActionPanel = () => {
    useDebugControls()
    const { t } = useTranslation()
    const activeTab = useGameStore((s) => s.tabs.activeTab)
    const relations = useGameStore((s) => s.relations.current)
    const money = useGameStore((s) => s.budget.treasury)
    const charisma = useGameStore(s => s.gameManagement.charisma.current)
    const round = useGameStore(s => s.gameManagement.round)
    const { displayTime, progress } = useRoundTimer()
    const totalMinutes = progress * 480
    const minuteAngle = (totalMinutes % 60) / 60 * 360 - 90
    const hourAngle = ((totalMinutes / 60 + 9) % 12) / 12 * 360 - 90

    return (
        <div className={styles.actionPanel} data-tutorial="action-panel">
            <div className={styles.genStats}>
                <div className={styles.clock}>
                    <Icon type='clock' className={styles.bigClock}>
                        <div className={styles.hours}   style={{ transform: `rotate(${hourAngle}deg)` }} />
                        <div className={styles.minutes} style={{ transform: `rotate(${minuteAngle}deg)` }} />
                    </Icon>
                    <Typography variant={'caption'} className={styles.time}>{displayTime}</Typography>
                </div>

                <div className={styles.budget}>
                    <Typography variant={'caption'}>{t('nav.month')} {round}/{GAMESTATE.ROUNDS.MAX}</Typography>
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

            <div className={styles.actions} data-tutorial="action-buttons">
                <div className={styles.activeTab}>
                    {activeTab === Tabs.Meet ? <Meet /> : null}
                    {activeTab === Tabs.Laws ? <Laws /> : null}
                </div>
            </div>
        </div>
    )
}

export default ActionPanel
