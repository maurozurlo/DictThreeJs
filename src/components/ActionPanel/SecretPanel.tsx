import { useGameStore } from '../../Stores/GameState'
import Button from '../Button/Button'
import Typography from '../Typography/Typography'
import { useTranslation } from 'react-i18next'
import styles from './ActionPanel.module.css'

/** Renders the secret ending card inside the ActionPanel's activeTab area. */
const SecretPanel = () => {
    const { t } = useTranslation('secret')
    const available = useGameStore(s => s.specialEnding.available)
    const faction = useGameStore(s => s.specialEnding.faction)
    const used = useGameStore(s => s.specialEnding.used)
    const use = useGameStore(s => s.specialEnding.use)

    if (!available || !faction) return null

    return (
        <>
            <Typography variant="h2" className={styles.secretTitle}>
                {t(`${faction}.title`)}
            </Typography>
            <Typography variant="body" className={styles.secretText}>{t(`${faction}.description`)}</Typography>
            {!used ? (
                <Button onClick={use}>{t(`${faction}.button`)}</Button>
            ) : (
                <Typography variant="body" className={styles.secretText}>
                    {t('done')}
                </Typography>
            )}
        </>
    )
}

export default SecretPanel
