import styles from './ActionPanel.module.css'
import { Icon } from '../Icon/Icon'
import Typography from '../Typography/Typography'
import Meet from '../Tabs/Meet'
import Laws from '../Tabs/Laws'
import { useGameStore } from '../../Stores/GameState'
import { Tabs } from '../../types/Tabs'


const ActionPanel = () => {
    const activeTab = useGameStore((s) => s.tabs.activeTab);

    return (
        <div className={styles.actionPanel}>
            <div className={styles.genStats}>
                <div className={styles.clock}>
                    <Icon type='clock' className={styles.bigClock}><div className={styles.hours} />
                        <div className={styles.minutes} /></Icon>

                    <Typography variant={'caption'} className={styles.time}>12:34</Typography>
                </div>

                <div className={styles.budget}>
                    <Typography variant={'body'}>Treasury</Typography>
                    <Typography variant={'caption'}>$550m</Typography>
                </div>
            </div>

            <div className={styles.respect}>
                <div className={styles.respectPowers}>

                    <div className={styles.respectItem}>
                        <Icon type='people' />
                        <span className={styles.respectNumber}>7</span>

                    </div>
                    <div className={styles.respectItem}>
                        <Icon type='company' />
                        <span className={styles.respectNumber}>2</span>
                    </div>
                    <div className={styles.respectItem}>
                        <Icon type='military' />
                        <span className={styles.respectNumber}>3</span>
                    </div>
                </div>

                <div className={styles.charisma}>
                    <Typography variant='caption'>Charisma</Typography>


                    <div className={styles.charismaSlider}>
                        <Icon type='needle' style={{
                            position: 'absolute',
                            top: '10%',
                            left: '40%' // always -10%
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