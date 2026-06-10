import { useGameStore } from '../../Stores/GameState'
import type { EndCause, GameStats } from '../../types/GameState'
import type { Power } from '../../types/Power'
import Button from '../Button/Button'
import Typography from '../Typography/Typography'
import styles from './EndScreen.module.css'

type Tier = {
    tier: string
    name: string
    flavour: string
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
        if (round <= 4) return { tier: 'F', name: 'Brief Experiment in Authoritarianism', flavour: 'A bold attempt. Tragically brief.', color: '#e74c3c' }
        switch (endCause) {
            case 'military':   return { tier: 'D', name: 'Retired at Gunpoint',                    flavour: "The generals had a meeting. You weren't invited.",       color: '#c0392b' }
            case 'business':   return { tier: 'D', name: 'Hostile Takeover, Personal Edition',      flavour: 'Capitalism got you before you could get capitalism.',    color: '#c0392b' }
            case 'people':     return { tier: 'D', name: 'Democratically Removed (Permanently)',    flavour: 'The people have spoken. Loudly. With torches.',          color: '#c0392b' }
            case 'bankruptcy': return { tier: 'D', name: 'Fiscally Challenged Former Leader',       flavour: "You ran out of other people's money.",                   color: '#c0392b' }
            default:           return { tier: 'D', name: 'Deposed Dictator',                        flavour: 'Your reign has ended. As they all do.',                  color: '#c0392b' }
        }
    }

    const avg = (relations.military + relations.business + relations.people) / 3
    const score = avg * 3 + charisma * 2 + Math.min(treasury / 100, 10)

    if (score >= 40) return { tier: 'S', name: 'Supreme Overlord',              flavour: "They'll build statues. You already did.",                       color: '#f1c40f' }
    if (score >= 25) return { tier: 'A', name: 'Seasoned Autocrat',             flavour: 'Ruled with purpose and only mild atrocities.',                  color: '#27ae60' }
    if (score >= 10) return { tier: 'B', name: 'The Pragmatist',                flavour: 'Did what had to be done. Mostly legal.',                        color: '#3498db' }
    if (score >= 0)  return { tier: 'C', name: 'Mediocre Majesty',              flavour: 'Survived through luck, bribery, and stubbornness.',             color: '#9b59b6' }
    if (score >= -15) return { tier: 'D', name: 'Accidental Dictator',          flavour: "Still standing. Nobody's more surprised than you.",             color: '#e67e22' }
    return              { tier: 'F', name: "Democracy's Problem Now",            flavour: "Won on a technicality. Please don't tell the UN.",              color: '#e74c3c' }
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
    const phase = useGameStore(s => s.gameManagement.phase)
    const round = useGameStore(s => s.gameManagement.round)
    const endReason = useGameStore(s => s.gameManagement.endReason)
    const endCause = useGameStore(s => s.gameManagement.endCause)
    const charisma = useGameStore(s => s.gameManagement.charisma.current)
    const meetCounts = useGameStore(s => s.gameManagement.meetCounts)
    const relations = useGameStore(s => s.relations.current)
    const treasury = useGameStore(s => s.budget.treasury)
    const stats = useGameStore(s => s.stats)
    const setPhase = useGameStore(s => s.gameManagement.setPhase)

    const tier = calcTier(phase, endCause, round, relations, charisma, treasury)
    const isWin = phase === 'victory' || phase === 'special_ending'
    const roundsPlayed = round - 1

    const totalNet = stats.totalIncomeEarned + stats.totalExtrasEarned - stats.totalExpensesSpent - stats.totalExtrasSpent

    return (
        <div className={styles.overlay}>
            <div className={styles.card}>
                {/* Header */}
                <div className={styles.header}>
                    <Typography variant="h2" className={styles.outcome}>
                        {isWin ? '🏆 Victory' : '☠ Game Over'}
                    </Typography>
                    {endReason && (
                        <p className={styles.endReason}>{endReason}</p>
                    )}
                </div>

                {/* Tier */}
                <div className={styles.tierBlock} style={{ borderColor: tier.color }}>
                    <span className={styles.tierLetter} style={{ color: tier.color }}>{tier.tier}</span>
                    <div className={styles.tierText}>
                        <span className={styles.tierName} style={{ color: tier.color }}>{tier.name}</span>
                        <span className={styles.tierFlavour}>"{tier.flavour}"</span>
                    </div>
                </div>

                <div className={styles.grid}>
                    {/* Relations */}
                    <Section title="RELATIONS">
                        <div className={styles.factionGrid}>
                            {(['military', 'business', 'people'] as Power[]).map(p => (
                                <div key={p} className={styles.factionCol}>
                                    <span className={styles.factionName}>{p}</span>
                                    <span className={styles.factionFinal} style={{ color: relationColor(relations[p]) }}>{relations[p]}</span>
                                    <span className={styles.factionSub}>↑{factionPeakLow(stats.relationsHistory, p).peak} ↓{factionPeakLow(stats.relationsHistory, p).low}</span>
                                </div>
                            ))}
                        </div>
                        <StatRow label="Rounds survived" value={String(roundsPlayed)} />
                        <StatRow label="Final charisma" value={charisma >= 0 ? `+${charisma}` : String(charisma)} positive={charisma > 0 ? true : charisma < 0 ? false : undefined} />
                    </Section>

                    {/* Treasury */}
                    <Section title="TREASURY">
                        <StatRow label="Final" value={`$${treasury}M`} positive={treasury > 0} />
                        <StatRow label="Peak" value={`$${stats.peakTreasury}M`} positive={true} />
                        <StatRow label="Lowest" value={`$${stats.lowestTreasury}M`} positive={stats.lowestTreasury > 0} />
                        <StatRow label="Total earned" value={`$${stats.totalIncomeEarned + stats.totalExtrasEarned}M`} />
                        <StatRow label="Total spent" value={`$${stats.totalExpensesSpent + stats.totalExtrasSpent}M`} />
                        <StatRow label="Net across run" value={`${totalNet >= 0 ? '+' : ''}$${totalNet}M`} positive={totalNet >= 0} />
                    </Section>

                    {/* Decisions */}
                    <Section title="DECISIONS">
                        <StatRow label="Laws passed" value={String(stats.lawsPassed)} positive={true} />
                        <StatRow label="Laws rejected" value={String(stats.lawsRejected)} />
                        <StatRow label="Deals accepted" value={String(stats.dealsAccepted)} positive={true} />
                        <StatRow label="Deals rejected" value={String(stats.dealsRejected)} />
                    </Section>

                    {/* Meetings */}
                    <Section title="MEETINGS">
                        <StatRow label="Military" value={String(meetCounts.military)} />
                        <StatRow label="Business (Elite)" value={String(meetCounts.business)} />
                        <StatRow label="People" value={String(meetCounts.people)} />
                        <StatRow label="Total" value={String(meetCounts.military + meetCounts.business + meetCounts.people)} />
                    </Section>
                </div>

                <Button onClick={() => setPhase('start')}>Play Again</Button>
            </div>
        </div>
    )
}

export default EndScreen
