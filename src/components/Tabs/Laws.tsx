import Typography from '../Typography/Typography'
import Button from '../Button/Button'
import { Icon } from '../Icon/Icon'
import styles from './Tabs.module.css'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../Stores/GameState'
import { useMemo, useState } from 'react'
import { dumbifyText } from '../../Utils/String'
import { GAMESTATE } from '../../Constants/GameState'
import AdvisorButton from '../Advisor/AdvisorButton'
import { computeLawVerdict, computeLawTrigger } from '../../Utils/Advisor'
import { formatConsequences } from '../../Utils/formatConsequences'

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

    const [pendingDecision, setPendingDecision] = useState<boolean | null>(null);

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

    const lawVerdict = currentLaw ? computeLawVerdict(currentLaw) : 'approve' as const
    const lawTrigger = currentLaw ? computeLawTrigger(currentLaw) : undefined

    // Pre-compute post-decision consequence lines (lastLawOutcome is non-null here — lawVoided guard above)
    const postDecisionMods = (lawDecided && currentLaw)
        ? ((lastLawOutcome ?? false) ? currentLaw.acceptMods : currentLaw.rejectMods)
        : [];
    const postDecisionLines = formatConsequences(postDecisionMods, commonT);

    // Confirmation view — shown when player has clicked Approve/Reject but not yet confirmed
    if (pendingDecision !== null && currentLaw !== null) {
        const mods = pendingDecision ? currentLaw.acceptMods : currentLaw.rejectMods;
        const lines = formatConsequences(mods, commonT);
        return (
            <>
                <Typography variant='h3' className={styles.title}>
                    {commonT(pendingDecision ? 'consequence.confirm_approve' : 'consequence.confirm_reject')}
                </Typography>
                {lines.length === 0
                    ? <Typography variant='caption'>{commonT('consequence.none')}</Typography>
                    : lines.map((line, i) => (
                        <Typography key={i} variant='caption' className={line.amount >= 0 ? styles.positive : styles.negative}>
                            {line.label}: {line.amount >= 0 ? '+' : ''}{line.amount}
                            {line.timing ? ` (${line.timing})` : ''}
                        </Typography>
                    ))
                }
                <div className={styles.actionsContainer}>
                    <Button onClick={() => { actUponLaw(pendingDecision); setPendingDecision(null); }}>
                        {commonT('consequence.confirm')}
                    </Button>
                    <Button onClick={() => setPendingDecision(null)}>
                        {commonT('consequence.back')}
                    </Button>
                </div>
            </>
        );
    }

    return (
        currentLaw === null ? null :
            lawDecided ? (
                <>
                    <div className={styles.lawHeader}>
                        <Typography variant='h3' className={styles.title}>
                            {lastLawOutcome ? t('laws.approved') : t('laws.rejected')}
                        </Typography>
                        <AdvisorButton category='law' verdict={lawVerdict} trigger={lawTrigger} />
                    </div>
                    {postDecisionLines.length === 0
                        ? <Typography variant='caption'>{commonT('consequence.none')}</Typography>
                        : postDecisionLines.map((line, i) => (
                            <Typography key={i} variant='caption' className={line.amount >= 0 ? styles.positive : styles.negative}>
                                {line.label}: {line.amount >= 0 ? '+' : ''}{line.amount}
                                {line.timing ? ` (${line.timing})` : ''}
                            </Typography>
                        ))
                    }
                </>
            ) : <>
                <div className={styles.lawHeader}>
                    <Typography variant='h3' className={styles.title}>{lawHeader}</Typography>
                    <AdvisorButton category='law' verdict={lawVerdict} trigger={lawTrigger} />
                </div>
                <div className={styles.actionsContainer}>
                    <Button onClick={() => setPendingDecision(true)} disabled={lawDecided}>
                        <Icon type='approve' /> {t('laws.approve')}
                    </Button>
                    <Button onClick={() => setPendingDecision(false)} disabled={lawDecided}>
                        <Icon type='reject' /> {t('laws.reject')}
                    </Button>
                </div>
            </>
    )
}

export default Laws
