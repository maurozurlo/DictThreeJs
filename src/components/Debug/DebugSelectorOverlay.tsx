import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../Stores/GameState'
import { LAWS } from '../../assets/laws'
import { WEIRD_LAWS } from '../../assets/weirdLaws'
import { DEALS } from '../../assets/deals'
import { DAILY_EVENTS } from '../../assets/dailyEvents'
import type { Law } from '../../types/Law'
import type { Deal } from '../../types/Deal'
import type { DailyEvent } from '../../types/DailyEvent'
import styles from './DebugSelectorOverlay.module.css'

type Section = 'laws' | 'deals' | 'events'

const ALL_LAWS = [...LAWS, ...WEIRD_LAWS].sort((a, b) => a.id - b.id)

const DebugSelectorOverlay = () => {
    const { t } = useTranslation(['laws', 'deals'])
    const [section, setSection] = useState<Section>('laws')

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

    const mod = (n: number) => n > 0 ? `+${n}` : `${n}`

    return (
        <div className={styles.panel}>
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
                    >
                        <span className={styles.id}>{mod(event.mod)}</span>
                        <span className={styles.faction}>{event.power[0].toUpperCase()}</span>
                        <span className={styles.label}>{event.key.replace('daily_events.', '')}</span>
                    </button>
                ))}
            </div>

            <div className={styles.footer}>
                ` to toggle · click row to force-set current
            </div>
        </div>
    )
}

export default DebugSelectorOverlay
