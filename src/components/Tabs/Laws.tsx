import Typography from '../Typography/Typography'
import Button from '../Button/Button'
import { Icon } from '../Icon/Icon'
import styles from './Tabs.module.css'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../Stores/GameState'
import { useMemo } from 'react'
import { dumbifyText } from '../../Utils/String'
import { GAMESTATE } from '../../Constants/GameState'

const Laws = () => {
    const { t: commonT } = useTranslation()
    const { t } = useTranslation('laws')
    const currentLaw = useGameStore(s => s.law.current);
    const lawDecided = useGameStore(s => s.law.lawDecided)
    const lastLawOutcome = useGameStore(s => s.law.lastLawOutcome)
    const actUponLaw = useGameStore(s => s.law.actUponLaw)
    const dumbScore = useGameStore(s => s.gameManagement.dumbScore)
    const infrastructure = useGameStore(s => s.budget.expenditures.infrastructure)
    const infraLocked = infrastructure < GAMESTATE.BUDGET_EFFECTS.INFRASTRUCTURE.LOW
    // Law is voided when lawDecided=true but lastLawOutcome=null (rep was eliminated mid-round)
    const lawVoided = lawDecided && lastLawOutcome === null

    const powerName = currentLaw
        ? (currentLaw.type === 'weird' ? '???' : commonT(`power.${currentLaw.power}`))
        : ''
    const lawHeader = useMemo(() =>
        dumbifyText(t('proposal_by', { power: powerName }), dumbScore),
        [powerName, dumbScore, t]
    )

    if (infraLocked) {
        return <Typography variant='caption' className={styles.title}>{t('infra_locked')}</Typography>
    }

    if (lawVoided) {
        return <Typography variant='caption' className={styles.title}>{t('rep_indisposed')}</Typography>
    }

    return (
        currentLaw === null ? null :
            lawDecided ? (
                <Typography variant='caption' className={styles.title}>{t('acted_upon_law')}</Typography>
            ) : <>
                <Typography variant='caption' className={styles.title}>{lawHeader}</Typography>
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