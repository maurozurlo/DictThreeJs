import { useTranslation } from 'react-i18next';
import { useGameStore } from '../../Stores/GameState';
import CitizenInspector from './CitizenInspector';
import PropInspector from './PropInspector';
import styles from './CitizenInspector.module.css';

/**
 * Sidebar panel shown in ActionPanel when the Street tab is active: the card for
 * whatever is selected in the street view (a citizen or a street object), or a hint.
 * No Three.js imports — reads only from Zustand (ADR-0003).
 */
const StreetInspector = () => {
    const { t } = useTranslation('street');
    const selection = useGameStore((s) => s.scene.selection);

    if (selection?.kind === 'ped') return <CitizenInspector citizenId={selection.id} />;
    if (selection?.kind === 'prop') {
        return <PropInspector key={selection.instanceId} instanceId={selection.instanceId} modelName={selection.modelName} />;
    }
    return (
        <div className={styles.idle}>
            <p>{t('inspector.idle')}</p>
        </div>
    );
};

export default StreetInspector;
