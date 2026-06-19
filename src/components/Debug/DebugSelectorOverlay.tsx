import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../Stores/GameState'
import { LAWS } from '../../assets/laws'
import { WEIRD_LAWS } from '../../assets/weirdLaws'
import { DEALS } from '../../assets/deals'
import { DAILY_EVENTS } from '../../assets/dailyEvents'
import type { Law } from '../../types/Law'
import type { Deal } from '../../types/Deal'
import type { ModifierSpec } from '../../types/GameState'
import type { DailyEvent } from '../../types/DailyEvent'
import styles from './DebugSelectorOverlay.module.css'

type Section = 'laws' | 'deals' | 'events'

const ALL_LAWS = [...LAWS, ...WEIRD_LAWS].sort((a, b) => a.id - b.id)

const sign = (n: number) => n > 0 ? `+${n}` : `${n}`

/** Renders a one-line summary of a ModifierSpec[] (`stat:±amount`, `*` marks one-round). */
function modSummary(specs: ModifierSpec[]): string {
    if (specs.length === 0) return '—'
    return specs
        .map(s => `${s.stat.replace('Taxes', 'Tax').replace('infrastructure', 'infra').replace('Spend', 'Sp')}:${sign(s.amount)}${s.time === 1 ? '*' : ''}`)
        .join('  ')
}

type Hovered = { key: string; y: number }

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

type TooltipProps = {
    law?: Law
    deal?: Deal
    event?: DailyEvent
    y: number
}

const Tooltip = ({ law, deal, event, y }: TooltipProps) => {
    const clampedY = Math.min(y, window.innerHeight - 140)

    return (
        <div className={styles.tooltip} style={{ top: clampedY }}>
            {law && <>
                <div className={styles.ttAccept}>✓ ACCEPT</div>
                <div className={styles.ttLine}>{modSummary(law.acceptMods)}</div>
                <div className={styles.ttReject}>✗ REJECT</div>
                <div className={styles.ttLine}>{modSummary(law.rejectMods)}</div>
            </>}

            {deal && <>
                <div className={styles.ttAccept}>✓ ACCEPT</div>
                <div className={styles.ttLine}>{modSummary(deal.acceptMods)}</div>
                <div className={styles.ttReject}>✗ REJECT</div>
                <div className={styles.ttLine}>{modSummary(deal.rejectMods)}</div>
                {(deal.acceptRisk ?? deal.rejectRisk) !== undefined && (
                    <div className={styles.ttRisk}>⚠ risk: {deal.acceptRisk ?? deal.rejectRisk}</div>
                )}
            </>}

            {event && <>
                <div className={styles.ttLine}>faction: {event.power}</div>
                <div className={styles.ttLine}>mod: {sign(event.mod)}</div>
                <div className={styles.ttLine}>chance: {event.chance}%</div>
            </>}
        </div>
    )
}

// ---------------------------------------------------------------------------
// Main overlay
// ---------------------------------------------------------------------------

const DebugSelectorOverlay = () => {
    const { t } = useTranslation(['laws', 'deals'])
    const [section, setSection] = useState<Section>('laws')
    const [hovered, setHovered] = useState<Hovered | null>(null)

    const selectorOpen = useGameStore(s => s.debug.selectorOpen)
    const toggleSelector = useGameStore(s => s.debug.toggleSelector)
    const currentLaw = useGameStore(s => s.law.current)
    const currentDeal = useGameStore(s => s.deals.current)
    const currentEvent = useGameStore(s => s.dailyEvent.current)

    if (!selectorOpen) return null

    const forceLaw = (law: Law) => {
        useGameStore.setState(s => ({
            law: { ...s.law, current: law, lawDecided: false },
        }))
    }

    const forceDeal = (deal: Deal) => {
        useGameStore.setState(s => ({
            deals: { ...s.deals, current: deal, dealDecided: false },
        }))
    }

    const forceEvent = (event: DailyEvent) => {
        useGameStore.setState(s => ({
            dailyEvent: { ...s.dailyEvent, current: event },
        }))
    }

    const lawLabel = (law: Law): string => {
        if (law.type === 'weird') {
            return t(`laws.weird.${law.id}.label`, { ns: 'laws', defaultValue: `weird-${law.id}` })
        }
        return t(`laws.labels.${law.id}`, { ns: 'laws', defaultValue: `law-${law.id}` })
    }

    const dealLabel = (deal: Deal): string =>
        t(`${deal.id}.text`, { ns: 'deals', defaultValue: `deal-${deal.id}` })

    const hover = (key: string, e: React.MouseEvent) => {
        setHovered({ key, y: e.currentTarget.getBoundingClientRect().top })
    }

    // Resolve tooltip target from hovered key
    const hoveredLaw = hovered ? ALL_LAWS.find(l => `law-${l.id}` === hovered.key) : undefined
    const hoveredDeal = hovered ? DEALS.find(d => `deal-${d.id}` === hovered.key) : undefined
    const hoveredEvent = hovered ? DAILY_EVENTS.find(ev => `ev-${ev.key}` === hovered.key) : undefined

    return (
        <>
            {hovered && (hoveredLaw || hoveredDeal || hoveredEvent) && (
                <Tooltip
                    law={hoveredLaw}
                    deal={hoveredDeal}
                    event={hoveredEvent}
                    y={hovered.y}
                />
            )}

            <div className={styles.panel} onMouseLeave={() => setHovered(null)}>
                <div className={styles.titleBar}>
                    <span>DEBUG SELECTOR</span>
                    <button className={styles.closeBtn} onClick={toggleSelector}>✕</button>
                </div>

                <div className={styles.tabs}>
                    <button
                        className={section === 'laws' ? styles.tabActive : styles.tab}
                        onClick={() => setSection('laws')}
                    >
                        LAWS ({ALL_LAWS.length})
                    </button>
                    <button
                        className={section === 'deals' ? styles.tabActive : styles.tab}
                        onClick={() => setSection('deals')}
                    >
                        DEALS ({DEALS.length})
                    </button>
                    <button
                        className={section === 'events' ? styles.tabActive : styles.tab}
                        onClick={() => setSection('events')}
                    >
                        EVENTS ({DAILY_EVENTS.length})
                    </button>
                </div>

                <div className={styles.list}>
                    {section === 'laws' && ALL_LAWS.map(law => (
                        <button
                            key={law.id}
                            className={currentLaw?.id === law.id ? styles.rowActive : styles.row}
                            onClick={() => forceLaw(law)}
                            onMouseEnter={e => hover(`law-${law.id}`, e)}
                        >
                            <span className={styles.id}>
                                {law.type === 'weird' ? '⚡' : ''}{law.id}
                            </span>
                            <span className={styles.faction}>{law.type === 'weird' ? '???' : law.power[0].toUpperCase()}</span>
                            <span className={styles.label}>{lawLabel(law)}</span>
                        </button>
                    ))}

                    {section === 'deals' && DEALS.map(deal => (
                        <button
                            key={deal.id}
                            className={currentDeal?.id === deal.id ? styles.rowActive : styles.row}
                            onClick={() => forceDeal(deal)}
                            onMouseEnter={e => hover(`deal-${deal.id}`, e)}
                        >
                            <span className={styles.id}>{deal.id}</span>
                            <span className={styles.faction}>{deal.power ? deal.power[0].toUpperCase() : '—'}</span>
                            <span className={styles.label}>{dealLabel(deal)}</span>
                        </button>
                    ))}

                    {section === 'events' && DAILY_EVENTS.map((event, i) => (
                        <button
                            key={i}
                            className={currentEvent?.key === event.key ? styles.rowActive : styles.row}
                            onClick={() => forceEvent(event)}
                            onMouseEnter={e => hover(`ev-${event.key}`, e)}
                        >
                            <span className={styles.id}>{sign(event.mod)}</span>
                            <span className={styles.faction}>{event.power[0].toUpperCase()}</span>
                            <span className={styles.label}>{event.key.replace('daily_events.', '')}</span>
                        </button>
                    ))}
                </div>

                <div className={styles.footer}>
                    ` to toggle · hover for effects · click to force-set
                </div>
            </div>
        </>
    )
}

export default DebugSelectorOverlay
