import { useTranslation } from 'react-i18next';
import Typography from '../../components/Typography/Typography';
import styles from './Laws.module.css'
import clsx from 'clsx'
import { useGameStore } from '../../Stores/GameState';

const DictatorHands = () => {
    const { t } = useTranslation('laws');
    const currentLaw = useGameStore(s => s.law.current)
    return currentLaw ? (
        <>
            <div className={styles.law}>
                <Typography variant='h1' color='dark'>{t('laws.proposal')}</Typography>
                <div className={styles.lawContainer}>
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className={styles.contentLine} style={{ width: `${Math.random() * 30 + 10}%` }}></div>
                    ))}
                    <Typography variant='body' color='dark'>{currentLaw.label}</Typography>
                    {[...Array(36)].map((_, i) => (
                        <div key={i} className={styles.contentLine} style={{ width: `${Math.random() * 30 + 10}%` }}></div>
                    ))}
                </div>
            </div>
            <img className={styles.hand} src='/assets/dicthand.png' />
            <img className={clsx(styles.hand, styles.right)} src='/assets/dicthand.png' />

        </>
    ) : null
}

export default DictatorHands;