import { useTranslation } from 'react-i18next';
import Typography from '../../components/Typography/Typography';
import styles from './Laws.module.css'
import clsx from 'clsx'

const DictatorHands = () => {
    const { t } = useTranslation('laws');
    return (
        <>
            <div className={styles.law}>
                <Typography variant='h1' color='dark'>{t('laws.proposal')}</Typography>
                <Typography variant='body' color='dark'>{t('laws.0')}</Typography>
            </div>
            <img className={styles.hand} src='/assets/dicthand.png' />
            <img className={clsx(styles.hand, styles.right)} src='/assets/dicthand.png' />

        </>
    )
}

export default DictatorHands;