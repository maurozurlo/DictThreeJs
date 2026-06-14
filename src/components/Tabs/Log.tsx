import styles from './Tabs.module.css'
import eventStyles from './EventPanel.module.css'
import type { TabProps } from '../../types/Tabs'
import clsx from 'clsx'
import Newspaper from '../Newspaper/Newspaper'
import Typography from '../Typography/Typography'
import Card from '../Card/Card'
import Button from '../Button/Button'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../Stores/GameState'
import { getGameDate } from '../../Utils/GameDate'
import { useMemo, useState } from 'react'
import { dumbifyText } from '../../Utils/String'
import type { ActiveRecurringEffect } from '../../types/GameState'
import { getRepealTier } from '../../Stores/RecurringHandler'
import { GAMESTATE } from '../../Constants/GameState'

// ---------------------------------------------------------------------------
// RepealCard — inline sub-component (co-located; file stays well under 400 ln)
// ---------------------------------------------------------------------------

interface RepealCardProps {
    entry: ActiveRecurringEffect;
    treasury: number;
    repealTakenThisRound: boolean;
    repeal: (sourceId: string) => void;
}

const RepealCard = ({ entry, treasury, repealTakenThisRound, repeal }: RepealCardProps) => {
    const { t } = useTranslation()
    const { t: lawsT } = useTranslation('laws')
    const { t: dealsT } = useTranslation('deals')
    const [confirming, setConfirming] = useState(false)

    const tier = getRepealTier(entry)
    const cost = GAMESTATE.REPEAL_COST[tier]
    const canAfford = treasury >= cost.treasury
    const isDisabled = repealTakenThisRound || !canAfford

    const disabledTitle = repealTakenThisRound
        ? t('log.repeal_disabled_already')
        : !canAfford
            ? t('log.repeal_disabled_funds')
            : undefined

    const effectIsIncome = entry.incomeBonus > 0
    const effectLabel = effectIsIncome
        ? t('log.repeal_effect_income', { amount: entry.incomeBonus })
        : t('log.repeal_effect_expense', { amount: entry.expenseBonus })

    const lawLabel = entry.label.startsWith('deals.') ? dealsT(entry.label) : lawsT(entry.label)

    const handleRepealClick = () => {
        if (isDisabled) return
        setConfirming(true)
    }

    const handleConfirm = () => {
        repeal(entry.sourceId)
        setConfirming(false)
    }

    const handleCancel = () => {
        setConfirming(false)
    }

    return (
        <div className={styles.repealCard}>
            <div className={styles.repealCardHeader}>
                <span className={styles.repealCardLabel}>{lawLabel}</span>
                {!confirming && (
                    <Button
                        onClick={handleRepealClick}
                        disabled={isDisabled}
                        title={disabledTitle}
                    >
                        {t('log.repeal')}
                    </Button>
                )}
            </div>

            <span className={styles.repealCardMeta}>
                {t('log.repeal_activated_round', { round: entry.roundActivated })}
            </span>

            <span className={clsx(styles.repealCardEffect, effectIsIncome ? styles.income : styles.expense)}>
                {effectLabel}
            </span>

            {confirming && (
                <div className={styles.repealConfirmPanel}>
                    <span className={styles.repealConfirmCost}>
                        {t('log.repeal_cost', {
                            treasury: cost.treasury,
                            relation: cost.relation,
                            faction: t(`power.${entry.sourceFaction}`),
                        })}
                    </span>
                    <div className={styles.repealConfirmButtons}>
                        <Button onClick={handleConfirm}>
                            {t('log.repeal_confirm')}
                        </Button>
                        <Button onClick={handleCancel}>
                            {t('log.repeal_cancel')}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}

// ---------------------------------------------------------------------------
// Log tab
// ---------------------------------------------------------------------------

const Log = ({ isActive }: TabProps) => {
    const { t } = useTranslation()
    const { t: dailyEventT } = useTranslation('daily_events')
    const { t: periodicT } = useTranslation('periodic_events')
    const { t: miniT } = useTranslation('mini_challenges')
    const periodicEvent = useGameStore((s) => s.periodicEvent)
    const miniChallenge = useGameStore((s) => s.miniChallenge)
    const logEntries = useGameStore((s) => s.log)
    const round = useGameStore((s) => s.gameManagement.round)
    const dailyEventKey = useGameStore((s) => s.dailyEvent.current?.key)
    const dumbScore = useGameStore((s) => s.gameManagement.dumbScore)
    const activeRecurringEffects = useGameStore((s) => s.gameManagement.activeRecurringEffects)
    const repealTakenThisRound = useGameStore((s) => s.gameManagement.repealTakenThisRound)
    const treasury = useGameStore((s) => s.budget.treasury)
    const repeal = useGameStore((s) => s.gameManagement.repeal)

    const challengeText = useMemo(
        () => miniChallenge.current ? dumbifyText(miniT(`${miniChallenge.current.id}.text`), dumbScore) : '',
        [miniChallenge.current?.id, dumbScore, miniT]
    )

    const dailyEventHeadline = useMemo(() => {
        if (!dailyEventKey) return undefined;
        return dumbifyText(dailyEventT(dailyEventKey), dumbScore);
    }, [dailyEventKey, dumbScore, dailyEventT]);

    return (
        <div className={clsx(styles.Tab, { [styles.isActive]: isActive })}>
            <div className={styles.pageContainer}>
                {/* --- Mini Challenge Section --- */}
                {miniChallenge.current && (
                    <div className={clsx(eventStyles.eventPanel)}>
                        <Typography variant='h2' className={clsx(eventStyles.eventTitle,
                            {
                                [styles.resolved]: miniChallenge.decided
                            }
                        )}>
                            🎲 {t('log.mini_challenge_title')}
                        </Typography>
                        <Typography variant='body'>{challengeText}</Typography>
                        {!miniChallenge.decided ? (
                            <div className={eventStyles.challengeButtons}>
                                <Button onClick={() => miniChallenge.resolve(true)}>
                                    ✓ {t('log.mini_challenge_accept')}
                                </Button>
                                <Button onClick={() => miniChallenge.resolve(false)}>
                                    ✗ {t('log.mini_challenge_reject')}
                                </Button>
                            </div>
                        ) : (
                            <div className={eventStyles.resultCard}>
                                <Card>
                                    <Typography variant='body'>
                                        {miniChallenge.resultKey ? miniT(miniChallenge.resultKey) : null}
                                    </Typography>
                                    {miniChallenge.riskTriggered && (
                                        <Typography variant='body'>
                                            {miniT(`${miniChallenge.current.id}.risk`)}
                                        </Typography>
                                    )}
                                </Card>
                            </div>
                        )}
                    </div>
                )}
                {/* --- Periodic Event Section --- */}
                {periodicEvent.current && (
                    <div className={clsx(eventStyles.eventPanel)}>
                        <Typography variant='h2' className={clsx(eventStyles.eventTitle, { [eventStyles.resolved]: periodicEvent.decided })}>
                            ⚡ {periodicT(`${periodicEvent.current.id}.title`)}
                        </Typography>
                        <Typography variant='body'>{periodicT(`${periodicEvent.current.id}.text`)}</Typography>

                        {!periodicEvent.decided ? (
                            <div className={eventStyles.optionsGrid}>
                                {periodicEvent.current.options.map((opt, i) => (
                                    <Button key={i} onClick={() => periodicEvent.resolve(i)}>
                                        {periodicT(`${periodicEvent.current!.id}.options.${opt.id}.text`)}
                                    </Button>
                                ))}
                            </div>
                        ) : (
                            <div className={eventStyles.resultCard}>
                                <Card>
                                    <Typography variant='body'>
                                        {periodicEvent.resultKey ? periodicT(periodicEvent.resultKey) : null}
                                    </Typography>
                                </Card>
                            </div>
                        )}
                    </div>
                )}

                {/* --- Active Legislation Section --- */}
                {activeRecurringEffects.length > 0 && (
                    <section className={styles.activeLegislation}>
                        <h3>{t('log.active_legislation')}</h3>
                        {activeRecurringEffects.map(entry => (
                            <RepealCard
                                key={entry.sourceId}
                                entry={entry}
                                treasury={treasury}
                                repealTakenThisRound={repealTakenThisRound}
                                repeal={repeal}
                            />
                        ))}
                    </section>
                )}

                <Typography variant='h2'>{t('log.today')}</Typography>
                <Newspaper headline={dailyEventHeadline} date={getGameDate(round)} />


                {/* --- Log History --- */}
                <Typography variant='h2'>{t('tabs.log')}</Typography>
                {logEntries.slice().reverse().map((entry, i) => (
                    <Card key={i}>
                        <Typography variant='h2'>{entry.date}</Typography>
                        {entry.lines.map((msg, j) => (
                            <Typography key={j} variant='body'>{msg}</Typography>
                        ))}
                    </Card>
                ))}
                {logEntries.length === 0 && (
                    <Card>{t('log.no_entries')}</Card>
                )}
            </div>
        </div>
    )
}

export default Log
