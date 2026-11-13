import { useTranslation } from 'react-i18next';
import { useGameStore } from '../../Stores/GameState';
import { STATUES } from '../../assets/ShopItems';
import { countModifiersByType, getEffectiveBudgetStat } from '../../Utils/Modifiers';
import { inspectEntryFor, realLineFor, statueRoundsFrom, variantIndex } from '../../Utils/StreetInspect';
import { INSPECT_ROW_COUNT } from '../../assets/streetInspect';
import styles from './PropInspector.module.css';

/** `t(..., { returnObjects: true })` as a string list — [] when the key is missing. */
function asList(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/**
 * Street inspector card for a clicked street object: a title picked per instance,
 * three joke stat rows for its tier, an optional statue plaque, and one real line
 * tying the object to the budget stat behind it. Copy: `street` namespace,
 * `props.<family>`; card table: src/assets/streetInspect.ts.
 * No Three.js imports — reads only from Zustand (ADR-0003).
 */
const PropInspector = ({ instanceId, modelName }: { instanceId: number; modelName: string }) => {
    const { t } = useTranslation('street');
    const budget         = useGameStore((s) => s.budget);
    const modifiers      = useGameStore((s) => s.gameManagement.modifiers);
    const round          = useGameStore((s) => s.gameManagement.round);
    const conditionStage = useGameStore((s) => s.gameManagement.conditionStage);
    const debugEnabled   = useGameStore((s) => s.debug.enabled);

    const entry = inspectEntryFor(modelName);
    if (!entry) return null;

    const base = `props.${entry.family}`;
    const card = `${base}.${entry.tier}`;
    const titles = asList(t(`${card}.titles`, { returnObjects: true }));
    const labels = asList(t(`${base}.labels`, { returnObjects: true }));
    const values = asList(t(`${card}.values`, { returnObjects: true }));
    const legend = t(`${card}.legend`, { defaultValue: '' });
    const title = titles[variantIndex(instanceId, titles.length)] ?? t(`${base}.kind`);

    const real = realLineFor(entry, {
        infrastructure: budget.expenditures.infrastructure,
        effectiveInfrastructure: getEffectiveBudgetStat(budget, modifiers, 'infrastructureSpend', round),
        security: budget.expenditures.security,
        conditionStage,
        statueRounds: statueRoundsFrom(modifiers),
        // Debug shows every statue slot filled — mirror useStreetLayout.
        statueCount: debugEnabled ? STATUES.length : countModifiersByType(modifiers, 'statue'),
    });

    return (
        <div className={styles.panel} data-testid="prop-inspector">
            <div className={styles.main}>
                <div className={styles.kind}>{t(`${base}.kind`)}</div>
                <div className={styles.name}>{title}</div>

                {Array.from({ length: INSPECT_ROW_COUNT }, (_, i) => (
                    labels[i] && values[i] ? (
                        <div key={i} className={styles.row}>
                            <span className={styles.label}>{labels[i]}</span>
                            <span className={styles.value}>{values[i]}</span>
                        </div>
                    ) : null
                ))}
            </div>

            <div className={styles.side}>
                {legend ? (
                    <blockquote className={styles.legend}>
                        <span className={styles.legendTag}>{t('inspector.legend')}</span>
                        {legend}
                    </blockquote>
                ) : null}

                <p className={styles.real}>{t(real.key, real.params)}</p>
            </div>
        </div>
    );
};

export default PropInspector;
