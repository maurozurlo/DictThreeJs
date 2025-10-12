import Typography from '../Typography/Typography'
import Button from '../Button/Button'
import { Icon } from '../Icon/Icon'
import styles from './Tabs.module.css'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../Stores/GameState'

const Laws = () => {
    const { t } = useTranslation('laws')
    const currentLaw = useGameStore(s => s.law.current);
    //const outcome = useGameStore(s => s.deals.lastDealOutcome)
    const lawDecided = useGameStore(s => s.law.lawDecided)
    const actUponLaw = useGameStore(s => s.law.actUponLaw)

    return currentLaw ? (
        <>
            <Typography variant='caption' className={styles.title}>Law Proposal by {currentLaw.power}</Typography>
            <div className={styles.actionsContainer}>
                <Button onClick={() => actUponLaw(true)} disabled={lawDecided}>
                    <Icon type='approve' /> {t('laws.approve')}
                </Button>


                <Button onClick={() => actUponLaw(false)} disabled={lawDecided}>
                    <Icon type='reject' /> {t('laws.reject')}
                </Button>

            </div>
        </>
    ) : null
}

export default Laws