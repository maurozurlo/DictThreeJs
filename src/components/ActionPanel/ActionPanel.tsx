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


const ActionPanel = () => {
    const { t } = useTranslation()
    const activeTab = useGameStore((s) => s.tabs.activeTab);
    const relations = useGameStore((s) => s.relations.current);
    const money = useGameStore((s) => s.budget.treasury);
    const charisma = useGameStore(s => s.gameManagement.charisma.current)
    const { displayTime } = useRoundTimer()

    return (
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
                {activeTab === Tabs.Meet ? <Meet /> : null}
                {activeTab === Tabs.Laws ? <Laws /> : null}
            </div>


        </div>
    )
}

export default ActionPanel