import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../Stores/GameState'
import { RECURRING } from '../../Constants/Costs'
import styles from './DebugRecurringOverlay.module.css'

/**
 * Debug-only overlay (rendered when debug mode is on) listing the active
 * recurring effects with translated labels, income/expense totals, the
 * income-law pool cap counter, last-round recurring sums, and whether the
 * currently offered law carries a recurring effect.
 *
 * Labels are rendered through i18n on purpose — a raw `laws.recurring.*`
 * key showing up here means a missing translation.
 */
const DebugRecurringOverlay = () => {
    const { t } = useTranslation(['laws', 'deals'])
    const effects = useGameStore(s => s.gameManagement.activeRecurringEffects)
    const lastIncome = useGameStore(s => s.gameManagement.lastRoundRecurringIncome)
    const lastExpenses = useGameStore(s => s.gameManagement.lastRoundRecurringExpenses)
    const currentLaw = useGameStore(s => s.law.current)

    const totalIncome = effects.reduce((sum, e) => sum + e.incomeBonus, 0)
    const totalExpenses = effects.reduce((sum, e) => sum + e.expenseBonus, 0)
    const incomeLawCount = effects.filter(e => e.sourceType === 'law' && e.incomeBonus > 0).length

    const translateLabel = (label: string) =>
        t(label, { ns: label.startsWith('laws.') ? 'laws' : 'deals' })

    const lawOfferTag = currentLaw?.recurringEffect
        ? (currentLaw.recurringEffect.incomeBonus ?? 0) > 0 ? ' [RECURRING INCOME]' : ' [RECURRING EXPENSE]'
        : ''

    return (
        <div className={styles.overlay}>
            <div className={styles.header}>
                RECURRING ({effects.length}) · income laws {incomeLawCount}/{RECURRING.MAX_INCOME_LAWS_PER_RUN}
            </div>
            {effects.length === 0 && <div className={styles.row}>none active</div>}
            {effects.map(e => (
                <div key={e.sourceId} className={styles.row}>
                    <span className={styles.source}>{e.sourceId}</span>
                    <span>{translateLabel(e.label)}</span>
                    <span className={e.incomeBonus > 0 ? styles.income : styles.expense}>
                        {e.incomeBonus > 0 ? `+${e.incomeBonus}` : `-${e.expenseBonus}`}
                    </span>
                    <span className={styles.meta}>{e.sourceFaction} @r{e.roundActivated}</span>
                </div>
            ))}
            <div className={styles.totals}>
                Σ <span className={styles.income}>+{totalIncome}</span> / <span className={styles.expense}>-{totalExpenses}</span>
                {' · '}last round <span className={styles.income}>+{lastIncome}</span> / <span className={styles.expense}>-{lastExpenses}</span>
            </div>
            {currentLaw && (
                <div className={styles.meta}>law offer: #{currentLaw.id}{lawOfferTag}</div>
            )}
        </div>
    )
}

export default DebugRecurringOverlay
