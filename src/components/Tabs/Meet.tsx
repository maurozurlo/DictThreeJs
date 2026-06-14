import Typography from '../Typography/Typography'
import Button from '../Button/Button'
import { Icon } from '../Icon/Icon'
import styles from './Tabs.module.css'
import { useGameStore } from '../../Stores/GameState'
import { useTranslation } from 'react-i18next'
import { MoneyNumberFormatter } from '../../Constants/Budget'
import { GAMESTATE } from '../../Constants/GameState'
import { useMemo } from 'react'
import { dumbifyText, educationToDumbScore } from '../../Utils/String'
import type { Power } from '../../types/Power'

const Meet = () => {
    const { t } = useTranslation()
    const { t: meetT } = useTranslation('meet');
    const selectedPower = useGameStore((s) => s.meet.selectedPower)
    const takeAction = useGameStore((s) => s.meet.takeAction)
    const actionTaken = useGameStore((s) => s.meet.actionTaken)
    const actionOutcomeText = useGameStore((s) => s.meet.actionOutcomeText)
    const education = useGameStore((s) => s.budget.expenditures.education)
    const coupWarningFaction = useGameStore((s) => s.gameManagement.coupWarningFaction)
    const coupArmed = useGameStore((s) => s.gameManagement.coupArmedLastRound)
    const repStatuses = useGameStore((s) => s.gameManagement.representativeStatuses)
    const sickFactions = (['military', 'business', 'people'] as Power[]).filter(p => repStatuses[p] === 'sick')

    const outcomeText = useMemo(() => {
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
        const translated = meetT(actionOutcomeText.key, { ...actionOutcomeText.params, ...extraParams });
        return dumbifyText(translated, educationToDumbScore(education));
    }, [actionOutcomeText, education, t, meetT]);

    // --- Show result after action ---
    if (actionTaken.taken && actionTaken.power) {
        return (
            <>
                <Typography variant="caption" className={styles.title}>
                    {t(`meet.${actionTaken.type}`)} ➔ {t(`power.${actionTaken.power}`)}
                </Typography>
                {outcomeText && (
                    <Typography variant="body" className={styles.outcomeQuote}>
                        "{outcomeText}"
                    </Typography>
                )}
            </>
        )
    }

    // --- No power selected ---
    if (selectedPower === 'none') {
        const sickNames = sickFactions.map(p => t(`power.${p}`)).join(', ')
        return (
            <>
                <Typography variant="caption" className={styles.title}>
                    {t('meet.none_selected')}
                </Typography>
                {sickFactions.length > 0 && (
                    <Typography variant="caption" className={styles.roundsWarning}>
                        {t('meet.sick_notice', { factions: sickNames })}
                    </Typography>
                )}
            </>
        )
    }

    // --- Actions for selected power ---
    const bribeCost = GAMESTATE.MEET.ACTIONS.BRIBE.COSTS[selectedPower]
    const expropiateGain = GAMESTATE.MEET.ACTIONS.EXPROPRIATE.GAINS[selectedPower]

    return (
        <>
            <Typography variant="caption" className={styles.title}>
                {t('meet.selected')}: {t(`power.${selectedPower}`)}
            </Typography>

            {coupWarningFaction === selectedPower && (
                <Typography variant="caption" className={coupArmed ? styles.negative : styles.roundsWarning}>
                    {t(coupArmed ? 'meet.coup_badge_red' : 'meet.coup_badge_yellow')}
                </Typography>
            )}

            <div className={styles.actionsContainer}>
                <Button onClick={() => takeAction(selectedPower, 'bribe')}>
                    <Icon type="bribe" /> {t('meet.bribe')} (-{MoneyNumberFormatter(bribeCost)})
                </Button>

                <Button onClick={() => takeAction(selectedPower, 'eliminate')}>
                    <Icon type="gun" /> {t('meet.eliminate')}
                </Button>

                <Button onClick={() => takeAction(selectedPower, 'expropriate')}>
                    <Icon type="takeover" /> {t('meet.expropriate')} (+{MoneyNumberFormatter(expropiateGain)})
                </Button>

                <Button onClick={() => takeAction(selectedPower, 'dialogue')}>
                    <Icon type="charisma" /> {t('meet.dialogue')}
                </Button>
            </div>
        </>
    )
}

export default Meet
