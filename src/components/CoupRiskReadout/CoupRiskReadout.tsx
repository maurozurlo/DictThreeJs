import { useMemo } from 'react';
import { useGameStore } from '../../Stores/GameState';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { getEffectiveCharisma } from '../../Utils/Modifiers';
import { selectCoupRisk } from '../../Utils/CoupRisk';
import { Icon } from '../Icon/Icon';
import styles from './CoupRiskReadout.module.css';

/**
 * Persistent HUD badge that telegraphs coup risk to the player (TR-coup-002,
 * ADR-0009 §4). Shows faction name, live effective relation, and distance to
 * the armed threshold on hover. Returns null when no faction qualifies.
 *
 * Data is computed from live store state so the readout reflects in-round
 * actions (e.g. bribe, modifier expiry) without waiting for nextRound().
 */
const CoupRiskReadout = () => {
    const { t } = useTranslation();

    const baseRelations = useGameStore(s => s.relations.current);
    const baseCharisma  = useGameStore(s => s.gameManagement.charisma.current);
    const modifiers     = useGameStore(s => s.gameManagement.modifiers);
    const round         = useGameStore(s => s.gameManagement.round);
    const security      = useGameStore(s => s.budget.expenditures.security);
    const coupArmedLastRound = useGameStore(s => s.gameManagement.coupArmedLastRound);

    const effectiveCharisma = useMemo(
        () => getEffectiveCharisma(baseCharisma, modifiers, round),
        [baseCharisma, modifiers, round],
    );

    const risk = useMemo(
        () => selectCoupRisk(baseRelations, effectiveCharisma, modifiers, round, security),
        [baseRelations, effectiveCharisma, modifiers, round, security],
    );

    if (!risk) return null;

    const isRed = risk.tier === 'red';
    const imminent = isRed && coupArmedLastRound;
    const factionName = t(`power.${risk.faction}`);
    const distanceToThreshold = risk.armedThreshold - risk.effectiveRelation;

    return (
        <span className={clsx(styles.badge, { [styles.badgeDanger]: isRed })}>
            <Icon type={isRed ? 'danger' : 'warning'} />
            <span className={styles.tooltip}>
                {imminent
                    ? t('hud.coup_detail_imminent', { faction: factionName, relation: risk.effectiveRelation, threshold: risk.armedThreshold })
                    : isRed
                        ? t('hud.coup_detail_armed', { faction: factionName, relation: risk.effectiveRelation, threshold: risk.armedThreshold })
                        : t('hud.coup_detail', { faction: factionName, relation: risk.effectiveRelation, threshold: risk.armedThreshold, distance: distanceToThreshold })}
            </span>
        </span>
    );
};

export default CoupRiskReadout;
