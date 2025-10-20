import { useTranslation } from 'react-i18next';
import Typography from '../../components/Typography/Typography';
import styles from './Laws.module.css'
import clsx from 'clsx'
import { useGameStore } from '../../Stores/GameState';
import { getRandomNumberInRange } from '../../Utils/Math';

const DictatorHands = () => {
    const { t } = useTranslation('laws');
    const currentLaw = useGameStore(s => s.law.current)
    const lastLawOutcome = useGameStore(s => s.law.lastLawOutcome)

    return currentLaw ? (
        <>
            <div className={styles.law}>
                <Typography variant='h1' color='dark'>{t('laws.proposal')}</Typography>
                <div className={styles.lawContainer}>
                    {lastLawOutcome !== null ? (
                        <Typography variant='h2'
                            style={{ transform: `rotate(${getRandomNumberInRange(-10, 35)}deg)` }}
                            className={clsx({
                                [styles.approvedStamp]: lastLawOutcome,
                                [styles.rejectedStamp]: !lastLawOutcome
                            })}>
                            {lastLawOutcome ? t('laws.approved') : t('laws.rejected')}
                        </Typography>
                    ) : null}
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