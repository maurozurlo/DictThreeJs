import TabLayout from './TabLayout'
import { useTranslation } from 'react-i18next'
import type { TabProps } from '../../types/Tabs'
import Card from '../Card/Card'
import { useGameStore } from '../../Stores/GameState'
import styles from './Deals.module.css'
import Button from '../Button/Button'
import Typography from '../Typography/Typography'
import clsx from 'clsx'
import { useMemo, useState } from 'react'
import { dumbifyText } from '../../Utils/String'
import AdvisorButton from '../Advisor/AdvisorButton'
import { computeDealVerdict, computeDealTrigger } from '../../Utils/Advisor'
import { formatConsequences } from '../../Utils/formatConsequences'

const Deals = ({ isActive }: TabProps) => {
    const { t: menuT } = useTranslation('menu')
    const { t } = useTranslation('deals')
    const currentDeal = useGameStore(s => s.deals.current);
    const outcome = useGameStore(s => s.deals.lastDealOutcome)
    const dealDecided = useGameStore(s => s.deals.dealDecided)
    const actUponDeal = useGameStore(s => s.deals.actUponDeal)
    const dumbScore = useGameStore(s => s.gameManagement.dumbScore)

    const [pendingDecision, setPendingDecision] = useState<boolean | null>(null);
    const [lastDecision, setLastDecision] = useState<boolean | null>(null);

    const dealText = useMemo(
        () => currentDeal ? dumbifyText(t(currentDeal.text), dumbScore) : '',
        [currentDeal?.text, dumbScore, t]
    )
    const dealVerdict = currentDeal ? computeDealVerdict(currentDeal) : 'approve' as const
    const dealTrigger = currentDeal ? computeDealTrigger(currentDeal) : undefined
    return (
        <TabLayout headerTitle={menuT('tabs.deals')} isActive={isActive} sideMenu={
            !dealDecided && <AdvisorButton category="deal" position="bottom" verdict={dealVerdict} trigger={dealTrigger} />
        }>
            {currentDeal ?
                <Card className={styles.dealCard}>
                    {pendingDecision !== null ? (
                        // Confirmation view
                        <>
                            <Typography variant='h3'>
                                {menuT(pendingDecision ? 'consequence.confirm_accept_deal' : 'consequence.confirm_reject_deal')}
                            </Typography>
                            {(() => {
                                const mods = pendingDecision ? currentDeal.acceptMods : currentDeal.rejectMods;
                                const lines = formatConsequences(mods, menuT);
                                return lines.length === 0
                                    ? <Typography variant='caption'>{menuT('consequence.none')}</Typography>
                                    : lines.map((line, i) => (
                                        <Typography key={i} variant='caption' className={line.amount >= 0 ? styles.positive : styles.negative}>
                                            {line.label}: {line.amount >= 0 ? '+' : ''}{line.amount}
                                            {line.timing ? ` (${line.timing})` : ''}
                                        </Typography>
                                    ));
                            })()}
                            <div className={styles.cardActions}>
                                <Button onClick={() => {
                                    setLastDecision(pendingDecision);
                                    actUponDeal(pendingDecision);
                                    setPendingDecision(null);
                                }}>{menuT('consequence.confirm')}</Button>
                                <Button onClick={() => setPendingDecision(null)}>{menuT('consequence.back')}</Button>
                            </div>
                        </>
                    ) : (
                        // Normal / post-decision view
                        <>
                            <Typography variant='body' className={clsx({
                                [styles.isInactive]: dealDecided
                            })}>{dealText}</Typography>

                            <div className={styles.cardActions}>
                                <Button disabled={dealDecided} onClick={() => setPendingDecision(true)}>{t('deals.accept')}</Button>
                                <Button disabled={dealDecided} onClick={() => setPendingDecision(false)}>{t('deals.reject')}</Button>
                            </div>

                            {dealDecided ? <>
                                <Typography variant='h3'>{t('deals.outcome')}</Typography>
                                {outcome && outcome.length ?
                                    <span>
                                        {outcome.map((line) => (
                                            <Typography key={line} variant='body'>{t(line)}</Typography>
                                        ))}
                                    </span> : ""}
                                {lastDecision !== null && (() => {
                                    const mods = lastDecision ? currentDeal.acceptMods : currentDeal.rejectMods;
                                    const lines = formatConsequences(mods, menuT);
                                    return lines.length === 0
                                        ? <Typography variant='caption'>{menuT('consequence.none')}</Typography>
                                        : lines.map((line, i) => (
                                            <Typography key={i} variant='caption' className={line.amount >= 0 ? styles.positive : styles.negative}>
                                                {line.label}: {line.amount >= 0 ? '+' : ''}{line.amount}
                                                {line.timing ? ` (${line.timing})` : ''}
                                            </Typography>
                                        ));
                                })()}
                            </> : null}
                        </>
                    )}
                </Card>

                : <Card>
                    <Typography variant='body'>
                        {t('deals.no_current_deals')}
                    </Typography>
                </Card>}

        </TabLayout>
    )
}
export default Deals
