import Typography from '../Typography/Typography'
import Button from '../Button/Button'
import { Icon } from '../Icon/Icon'
import styles from './Tabs.module.css'
import { useGameStore } from '../../Stores/GameState'
import { useTranslation } from 'react-i18next'
import { MoneyNumberFormatter } from '../../Constants/Budget'
import { GAMESTATE } from '../../Constants/GameState'

const Meet = () => {
    const { t } = useTranslation()
    const { t: meetT } = useTranslation('meet');
    const selectedPower = useGameStore((s) => s.meet.selectedPower)
    const takeAction = useGameStore((s) => s.meet.takeAction)
    const actionTaken = useGameStore((s) => s.meet.actionTaken)
    const actionOutcomeText = useGameStore((s) => s.meet.actionOutcomeText)

    const getOutcomeText = () => {
        if (!actionOutcomeText) return null;
        const extraParams = { power: '', angryPower: '' }
        if ('params' in actionOutcomeText) {
            if ('power' in actionOutcomeText.params!) {
                extraParams.power = t(`power.${actionOutcomeText.params.power}`);
            }
            if ('angryPower' in actionOutcomeText.params!) {
                extraParams.angryPower = t(`power.${actionOutcomeText.params.angryPower}`);
            }
        }
        return meetT(actionOutcomeText.key, { ...actionOutcomeText.params, ...extraParams });
    }

    // --- Show result after action ---
    if (actionTaken.taken && actionTaken.power) {
        return (
            <>
                <Typography variant="caption" className={styles.title}>
                    {t(`meet.${actionTaken.type}`)}: {t(`power.${actionTaken.power}`)}
                </Typography>
                <Typography variant="body">

                    {getOutcomeText()}
                </Typography>
            </>
        )
    }

    // --- No power selected ---
    if (selectedPower === 'none') {
        return (
            <Typography variant="caption" className={styles.title}>
                {t('meet.none_selected')}
            </Typography>
        )
    }

    // --- Actions for selected power ---
    const bribeCost = GAMESTATE.MEET.ACTIONS.BRIBE.COSTS[selectedPower]
    const expropiateGain = GAMESTATE.MEET.ACTIONS.EXPROPIATE.GAINS[selectedPower]

    return (
        <>
            <Typography variant="caption" className={styles.title}>
                {t('meet.selected')}: {t(`power.${selectedPower}`)}
            </Typography>

            <div className={styles.actionsContainer}>
                <Button onClick={() => takeAction(selectedPower, 'bribe')}>
                    <Icon type="bribe" /> {t('meet.bribe')} (-{MoneyNumberFormatter(bribeCost)})
                </Button>

                <Button onClick={() => takeAction(selectedPower, 'eliminate')}>
                    <Icon type="gun" /> {t('meet.eliminate')}
                </Button>

                <Button onClick={() => takeAction(selectedPower, 'expropriate')}>
                    <Icon type="takeover" /> {t('meet.expropiate')} (+{MoneyNumberFormatter(expropiateGain)})
                </Button>

                <Button onClick={() => takeAction(selectedPower, 'dialogue')}>
                    <Icon type="charisma" /> {t('meet.dialogue')}
                </Button>
            </div>
        </>
    )
}

export default Meet
