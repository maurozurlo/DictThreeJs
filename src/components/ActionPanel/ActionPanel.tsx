import styles from './ActionPanel.module.css'
import { Icon } from '../Icon/Icon'
import Button from '../Button/Button'
import Typography from '../Typography/Typography'


const ActionPanel = () => {
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

                <Typography variant='caption' className={styles.title}>Selected Faction: Military</Typography>
                <div className={styles.actionsContainer}>
                    <Button>
                        <Icon type='plus' /> Bribe
                    </Button>


                    <Button>
                        <Icon type='meet' /> Eliminate
                    </Button>



                    <Button>
                        <Icon type='news' /> Expropiate (+$100)
                    </Button>
                    <Button>
                        <Icon type='charisma' /> Dialogue (+$100)
                    </Button>
                </div>



            </div>


        </div>
    )
}

export default ActionPanel