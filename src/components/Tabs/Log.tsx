import styles from './Tabs.module.css'
import type { TabProps } from '../../types/Tabs'
import clsx from 'clsx'
import Newspaper from '../Newspaper/Newspaper'
import Typography from '../Typography/Typography'
import Card from '../Card/Card'
import { useTranslation } from 'react-i18next'


const Log = ({ isActive }: TabProps) => {
    const { t } = useTranslation()
    return (
        <div className={clsx(styles.Tab, { [styles.isActive]: isActive })}>
            <div className={styles.pageContainer}>
                <Typography variant='h2'>{t('log.today')}</Typography>
                <Newspaper />
                <Typography variant='h2'>{t('tabs.log')}</Typography>
                <Card>Approved Law #1: Give companies the power to do stuff</Card>
            </div>
        </div>
    )
}

export default Log