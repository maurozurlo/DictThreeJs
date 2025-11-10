import Typography from '../Typography/Typography'
import Button from '../Button/Button'
import { Icon } from '../Icon/Icon'
import styles from './Tabs.module.css'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../Stores/GameState'

const Laws = () => {
    const { t: commonT } = useTranslation()
    const { t } = useTranslation('laws')
    const currentLaw = useGameStore(s => s.law.current);
    const lawDecided = useGameStore(s => s.law.lawDecided)
    const actUponLaw = useGameStore(s => s.law.actUponLaw)

    return (
        currentLaw === null ? null :
            lawDecided ? (
                <Typography variant='caption' className={styles.title}>{t('acted_upon_law')}</Typography>
            ) : <>
                <Typography variant='caption' className={styles.title}>
                    {t('proposal_by', { power: commonT(`power.${currentLaw.power}`) })}
                </Typography>
                <div className={styles.actionsContainer}>
                    <Button onClick={() => actUponLaw(true)} disabled={lawDecided}>
                        <Icon type='approve' /> {t('laws.approve')}
                    </Button>


                    <Button onClick={() => actUponLaw(false)} disabled={lawDecided}>
                        <Icon type='reject' /> {t('laws.reject')}
                    </Button>
                </div>
            </>
    )
}

export default Laws