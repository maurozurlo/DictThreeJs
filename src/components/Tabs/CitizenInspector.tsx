import { useGameStore } from '../../Stores/GameState';
import { useTranslation } from 'react-i18next';
import styles from './CitizenInspector.module.css';

/**
 * Street inspector card for a clicked citizen (rendered by StreetInspector).
 * Displays the citizen's identity, faction, employment, role, and happiness.
 * No Three.js imports — reads only from Zustand (ADR-0003).
 */
const CitizenInspector = ({ citizenId }: { citizenId: number }) => {
    const { t } = useTranslation();
    const citizens      = useGameStore((s) => s.citizens);
    const citizenStates = useGameStore((s) => s.citizenStates);

    const citizen = citizens[citizenId];
    const cs      = citizenStates[citizenId];

    if (!citizen || !cs) return null;

    const happinessMoodKey = cs.happiness >= 8 ? 'content'
        : cs.happiness >= 6 ? 'satisfied'
        : cs.happiness >= 4 ? 'neutral'
        : cs.happiness >= 2 ? 'worried'
        : 'desperate';

    const employedLabel = cs.employed
        ? t(`citizen.inspector.employed.${citizen.faction}`)
        : t(`citizen.inspector.displaced.${citizen.faction}`);

    return (
        <div className={styles.panel}>
            <div className={styles.name}>{citizen.name}</div>

            <div className={styles.row}>
                <span className={styles.label}>{t('citizen.inspector.faction')}</span>
                <span>{t(`power.${citizen.faction}`)}</span>
            </div>

            <div className={styles.row}>
                <span className={styles.label}>{t('citizen.inspector.status')}</span>
                <span>{employedLabel}</span>
            </div>

            <div className={styles.row}>
                <span className={styles.label}>{t('citizen.inspector.role')}</span>
                <span>{t(`citizen.inspector.roles.${cs.role}`)}</span>
            </div>

            <div className={styles.row}>
                <span className={styles.label}>{t('citizen.inspector.happiness')}</span>
                <span>{Math.round(cs.happiness)}/10 — {t(`citizen.inspector.mood.${happinessMoodKey}`)}</span>
            </div>

            <div className={styles.happinessBar}>
                <div
                    className={styles.happinessFill}
                    style={{ width: `${cs.happiness * 10}%` }}
                />
            </div>
        </div>
    );
};

export default CitizenInspector;
