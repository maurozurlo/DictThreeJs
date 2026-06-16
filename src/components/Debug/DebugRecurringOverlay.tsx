import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../Stores/GameState'
import { RECURRING } from '../../Constants/Costs'
import { sumModifiers } from '../../Utils/Modifiers'
import { getModifierContent, isRepealable } from '../../assets/modifierContent'
import styles from './DebugRecurringOverlay.module.css'

/**
 * Debug-only overlay (rendered when debug mode is on) listing the active recurring
 * modifiers (laws/deals/weird laws) with translated labels, per-round income/expense
 * contributions, the income-law pool cap counter, last-round recurring sums, and
 * whether the currently offered law carries a recurring effect.
 *
 * Labels are rendered through i18n on purpose — a raw `laws.recurring.*` key showing
 * up here means a missing translation.
 */
const DebugRecurringOverlay = () => {
    const { t } = useTranslation(['laws', 'deals'])
    const modifiers = useGameStore(s => s.gameManagement.modifiers)
    const round = useGameStore(s => s.gameManagement.round)
    const lastIncome = useGameStore(s => s.gameManagement.lastRoundRecurringIncome)
    const lastExpenses = useGameStore(s => s.gameManagement.lastRoundRecurringExpenses)
    const currentLaw = useGameStore(s => s.law.current)

    const active = modifiers.filter(m => m.state === 'active' && isRepealable(m))
    const totalIncome = sumModifiers(modifiers, 'roundIncome', round)
    const totalExpenses = sumModifiers(modifiers, 'roundExpense', round)
    const incomeLawCount = active.filter(
        m => m.type === 'law-recurring' && m.mods.some(sm => sm.stat === 'roundIncome' && sm.amount > 0),
    ).length

    const translateLabel = (label: string) =>
        t(label, { ns: label.startsWith('deals.') ? 'deals' : 'laws' })

    const lawOfferTag = currentLaw?.recurringEffect
        ? (currentLaw.recurringEffect.incomeBonus ?? 0) > 0 ? ' [RECURRING INCOME]' : ' [RECURRING EXPENSE]'
        : ''

    return (
        <div className={styles.overlay}>
            <div className={styles.header}>
                RECURRING ({active.length}) · income laws {incomeLawCount}/{RECURRING.MAX_INCOME_LAWS_PER_RUN}
            </div>
            {active.length === 0 && <div className={styles.row}>none active</div>}
            {active.map(m => {
                const content = getModifierContent(m.id)
                const income = sumModifiers([m], 'roundIncome', m.acquiredRound)
                const expense = sumModifiers([m], 'roundExpense', m.acquiredRound)
                return (
                    <div key={m.id} className={styles.row}>
                        <span className={styles.source}>{m.id}</span>
                        <span>{content ? translateLabel(content.label) : m.type}</span>
                        <span className={income > 0 ? styles.income : styles.expense}>
                            {income > 0 ? `+${income}` : expense > 0 ? `-${expense}` : '—'}
                        </span>
                        <span className={styles.meta}>{content?.faction ?? '—'} @r{m.acquiredRound}</span>
                    </div>
                )
            })}
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
