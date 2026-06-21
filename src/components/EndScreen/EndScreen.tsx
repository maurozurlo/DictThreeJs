import { useEffect } from 'react'
import { useGameStore } from '../../Stores/GameState'
import type { EndCause, GameStats } from '../../types/GameState'
import type { Power } from '../../types/Power'
import Button from '../Button/Button'
import Typography from '../Typography/Typography'
import styles from './EndScreen.module.css'
import { useTranslation } from 'react-i18next'
import { MoneyNumberFormatter } from '../../Constants/Budget'
import { Modal, ModalCard } from '../Modal/Modal'
import { recordGameEnd } from '../../Utils/MetaProgress'
import { getEffectiveCharisma, getEffectiveRelation } from '../../Utils/Modifiers'
import type { EndingId, TierRank } from '../../types/MetaProgress'
import { Icon } from '../Icon/Icon'

type Tier = {
    tier: string
    nameKey: string
    flavourKey: string
    color: string
}

function calcTier(
    phase: string,
    endCause: EndCause,
    round: number,
    relations: Record<Power, number>,
    charisma: number,
    treasury: number
): Tier {
    if (phase === 'lose') {
        if (round <= 4) return { tier: 'F', nameKey: 'endscreen.tiers.lose_early.name', flavourKey: 'endscreen.tiers.lose_early.flavour', color: '#e74c3c' }
        switch (endCause) {
            case 'military': return { tier: 'D', nameKey: 'endscreen.tiers.lose_military.name', flavourKey: 'endscreen.tiers.lose_military.flavour', color: '#c0392b' }
            case 'business': return { tier: 'D', nameKey: 'endscreen.tiers.lose_business.name', flavourKey: 'endscreen.tiers.lose_business.flavour', color: '#c0392b' }
            case 'people': return { tier: 'D', nameKey: 'endscreen.tiers.lose_people.name', flavourKey: 'endscreen.tiers.lose_people.flavour', color: '#c0392b' }
            case 'bankruptcy': return { tier: 'D', nameKey: 'endscreen.tiers.lose_bankruptcy.name', flavourKey: 'endscreen.tiers.lose_bankruptcy.flavour', color: '#c0392b' }
            case 'military_coup': return { tier: 'D', nameKey: 'endscreen.tiers.lose_military_coup.name', flavourKey: 'endscreen.tiers.lose_military_coup.flavour', color: '#c0392b' }
            case 'business_coup': return { tier: 'D', nameKey: 'endscreen.tiers.lose_business_coup.name', flavourKey: 'endscreen.tiers.lose_business_coup.flavour', color: '#c0392b' }
            case 'people_coup': return { tier: 'D', nameKey: 'endscreen.tiers.lose_people_coup.name', flavourKey: 'endscreen.tiers.lose_people_coup.flavour', color: '#c0392b' }
            default: return { tier: 'D', nameKey: 'endscreen.tiers.lose_default.name', flavourKey: 'endscreen.tiers.lose_default.flavour', color: '#c0392b' }
        }
    }

    const avg = (relations.military + relations.business + relations.people) / 3
    const score = avg * 3 + charisma * 2 + Math.min(treasury / 100, 10)

    if (score >= 40) return { tier: 'S', nameKey: 'endscreen.tiers.S.name', flavourKey: 'endscreen.tiers.S.flavour', color: '#f1c40f' }
    if (score >= 25) return { tier: 'A', nameKey: 'endscreen.tiers.A.name', flavourKey: 'endscreen.tiers.A.flavour', color: '#27ae60' }
    if (score >= 10) return { tier: 'B', nameKey: 'endscreen.tiers.B.name', flavourKey: 'endscreen.tiers.B.flavour', color: '#3498db' }
    if (score >= 0) return { tier: 'C', nameKey: 'endscreen.tiers.C.name', flavourKey: 'endscreen.tiers.C.flavour', color: '#9b59b6' }
    if (score >= -15) return { tier: 'D', nameKey: 'endscreen.tiers.D_accidental.name', flavourKey: 'endscreen.tiers.D_accidental.flavour', color: '#e67e22' }
    return { tier: 'F', nameKey: 'endscreen.tiers.F.name', flavourKey: 'endscreen.tiers.F.flavour', color: '#e74c3c' }
}

function relationColor(val: number): string {
    if (val >= 5) return '#27ae60'
    if (val <= -5) return '#e74c3c'
    return 'var(--text-color)'
}

function StatRow({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
    return (
        <div className={styles.statRow}>
            <span className={styles.statLabel}>{label}</span>
            <span className={positive === true ? styles.positive : positive === false ? styles.negative : styles.statValue}>
                {value}
            </span>
        </div>
    )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className={styles.section}>
            <div className={styles.sectionTitle}>{title}</div>
            {children}
        </div>
    )
}

function factionPeakLow(history: GameStats['relationsHistory'], key: Power) {
    if (!history.length) return { peak: '—', low: '—' }
    const vals = history.map(r => (r as Record<Power, number>)[key])
    return { peak: String(Math.max(...vals)), low: String(Math.min(...vals)) }
}

const EndScreen = () => {
    const { t } = useTranslation('endscreen')
    const { t: menuT } = useTranslation('menu')
    const { t: secretT } = useTranslation('secret')
    const phase = useGameStore(s => s.gameManagement.phase)
    const round = useGameStore(s => s.gameManagement.round)
    const endReason = useGameStore(s => s.gameManagement.endReason)
    const endCause = useGameStore(s => s.gameManagement.endCause)
    const charisma = useGameStore(s => getEffectiveCharisma(s.gameManagement.charisma.current, s.gameManagement.modifiers, s.gameManagement.round))
    const meetCounts = useGameStore(s => s.gameManagement.meetCounts)
    // Select each relation as a primitive — a selector returning a fresh object
    // literal breaks useSyncExternalStore's Object.is check and causes an infinite
    // re-render loop. Assemble the object in the component body instead.
    const militaryRelation = useGameStore(s => getEffectiveRelation(s.relations.current.military, s.gameManagement.modifiers, 'military', s.gameManagement.round))
    const businessRelation = useGameStore(s => getEffectiveRelation(s.relations.current.business, s.gameManagement.modifiers, 'business', s.gameManagement.round))
    const peopleRelation = useGameStore(s => getEffectiveRelation(s.relations.current.people, s.gameManagement.modifiers, 'people', s.gameManagement.round))
    const relations = {
        military: militaryRelation,
        business: businessRelation,
        people: peopleRelation,
    }
    const treasury = useGameStore(s => s.budget.treasury)
    const stats = useGameStore(s => s.stats)
    const setPhase = useGameStore(s => s.gameManagement.setPhase)
    const secretRoomIndex = useGameStore(s => s.tabs.secretRoomIndex)
    const specialEndingOutcome = useGameStore(s => s.specialEnding.outcome)
    const specialEndingFaction = useGameStore(s => s.specialEnding.faction)

    const tier = calcTier(phase, endCause, round, relations, charisma, treasury)
    const isWin = phase === 'victory' || phase === 'special_ending'
    const roundsPlayed = round - 1

    const endingId: EndingId =
        phase === 'special_ending'
            ? (`secret_room_${secretRoomIndex}_${specialEndingOutcome ?? 'bad'}` as EndingId)
            : phase === 'victory'
                ? 'victory'
                : (endCause ?? 'military') as EndingId

    useEffect(() => {
        recordGameEnd(tier.tier as TierRank, endingId)
    }, []) // intentionally runs once on mount; tier and endingId are stable when EndScreen renders

    const totalNet = stats.totalIncomeEarned + stats.totalExtrasEarned - stats.totalExpensesSpent - stats.totalExtrasSpent

    return (
        <Modal align="start" backgroundAlpha={0.92}>
            <ModalCard maxWidth="720px" padding="2.5rem" className={styles.card}>
                {/* Header */}
                <div className={styles.header}>
                    <Typography variant="h2" className={styles.outcome}>
                        {isWin ?
                            <>
                                <Icon type="trophy" />
                                {t('endscreen.outcome.victory')}
                            </>
                            :
                            <>
                                <Icon type="skull" />
                                {t('endscreen.outcome.game_over')}
                            </>
                        }
                    </Typography>
                    {phase === 'special_ending' && specialEndingFaction && specialEndingOutcome && (
                        <p className={styles.endReason}>{secretT(`${specialEndingFaction}.outcome_${specialEndingOutcome}`)}</p>
                    )}
                    {phase !== 'special_ending' && endReason && (
                        <p className={styles.endReason}>{endReason}</p>
                    )}
                </div>

                {/* Tier */}
                <div className={styles.tierBlock} style={{ borderColor: tier.color }}>
                    <span className={styles.tierLetter} style={{ color: tier.color }}>{tier.tier}</span>
                    <div className={styles.tierText}>
                        <span className={styles.tierName} style={{ color: tier.color }}>{t(tier.nameKey)}</span>
                        <span className={styles.tierFlavour}>"{t(tier.flavourKey)}"</span>
                    </div>
                </div>

                <div className={styles.grid}>
                    {/* Relations */}
                    <Section title={t('endscreen.sections.relations')}>
                        <div className={styles.factionGrid}>
                            {(['military', 'business', 'people'] as Power[]).map(p => (
                                <div key={p} className={styles.factionCol}>
                                    <span className={styles.factionName}>{menuT(`power.${p}`)}</span>
                                    <span className={styles.factionFinal} style={{ color: relationColor(relations[p as keyof typeof relations]) }}>{relations[p as keyof typeof relations]}</span>
                                    <span className={styles.factionSub}>↑{factionPeakLow(stats.relationsHistory, p).peak} ↓{factionPeakLow(stats.relationsHistory, p).low}</span>
                                </div>
                            ))}
                        </div>
                        <StatRow label={t('endscreen.stats.rounds_survived')} value={String(roundsPlayed)} />
                        <StatRow label={t('endscreen.stats.final_charisma')} value={charisma >= 0 ? `+${charisma}` : String(charisma)} positive={charisma > 0 ? true : charisma < 0 ? false : undefined} />
                    </Section>

                    {/* Treasury */}
                    <Section title={t('endscreen.sections.treasury')}>
                        <StatRow label={t('endscreen.stats.final')} value={MoneyNumberFormatter(treasury)} positive={treasury > 0} />
                        <StatRow label={t('endscreen.stats.peak')} value={MoneyNumberFormatter(stats.peakTreasury)} positive={true} />
                        <StatRow label={t('endscreen.stats.lowest')} value={MoneyNumberFormatter(stats.lowestTreasury)} positive={stats.lowestTreasury > 0} />
                        <StatRow label={t('endscreen.stats.total_earned')} value={MoneyNumberFormatter(stats.totalIncomeEarned + stats.totalExtrasEarned)} />
                        <StatRow label={t('endscreen.stats.total_spent')} value={MoneyNumberFormatter(stats.totalExpensesSpent + stats.totalExtrasSpent)} />
                        <StatRow label={t('endscreen.stats.net')} value={`${totalNet >= 0 ? '+' : '-'}${MoneyNumberFormatter(Math.abs(totalNet))}`} positive={totalNet >= 0} />
                        <StatRow label={t('endscreen.stats.recurring_income')} value={MoneyNumberFormatter(stats.totalRecurringIncomeEarned)} />
                        <StatRow label={t('endscreen.stats.recurring_expenses')} value={MoneyNumberFormatter(stats.totalRecurringExpensesSpent)} />
                    </Section>

                    {/* Decisions */}
                    <Section title={t('endscreen.sections.decisions')}>
                        <StatRow label={t('endscreen.stats.laws_passed')} value={String(stats.lawsPassed)} positive={true} />
                        <StatRow label={t('endscreen.stats.laws_rejected')} value={String(stats.lawsRejected)} />
                        <StatRow label={t('endscreen.stats.deals_accepted')} value={String(stats.dealsAccepted)} positive={true} />
                        <StatRow label={t('endscreen.stats.deals_rejected')} value={String(stats.dealsRejected)} />
                        <StatRow label={t('endscreen.stats.repeals')} value={String(stats.repealCount)} />
                        {stats.coupGraceFired && (
                            <StatRow label={t('endscreen.stats.coup_grace')} value={t('endscreen.stats.coup_grace_value')} positive={true} />
                        )}
                    </Section>

                    {/* Meetings */}
                    <Section title={t('endscreen.sections.meetings')}>
                        <StatRow label={menuT('power.military')} value={String(meetCounts.military)} />
                        <StatRow label={t('endscreen.stats.business_elite')} value={String(meetCounts.business)} />
                        <StatRow label={menuT('power.people')} value={String(meetCounts.people)} />
                        <StatRow label={t('endscreen.stats.total')} value={String(meetCounts.military + meetCounts.business + meetCounts.people)} />
                    </Section>
                </div>

                <Button onClick={() => setPhase('start')}>{t('endscreen.play_again')}</Button>
            </ModalCard>
        </Modal>
    )
}

export default EndScreen
