import styles from './Tabs.module.css'
import type { TabProps } from '../../types/Tabs'
import clsx from 'clsx'
import Typography from '../Typography/Typography'
import Button from '../Button/Button'
import { useGameStore } from '../../Stores/GameState'
import { useTranslation } from 'react-i18next'


const Menu = ({ isActive }: TabProps) => {
    const setGamePhase = useGameStore((s) => s.gameManagement.setPhase);
    const { t } = useTranslation();

    return (
        <div className={clsx(styles.Tab, styles.TabMenu, { [styles.isActive]: isActive })}>

            <div className="centeredContainer">
                <Typography variant={'h1'}>
                    Dictator Simulator
                </Typography>
                <hr />

                <div className={styles.menuButtons}>
                    <Button variant='primary' onClick={() => setGamePhase('start')}>{t('mainMenu.newGame')}</Button>
                    <Button variant='primary'>{t('mainMenu.loadGame')}</Button>
                    <Button variant='primary'>{t('mainMenu.help')}</Button>
                    <Button variant='primary'>{t('mainMenu.settings')}</Button>
                    <Button variant='primary'>{t('mainMenu.credits')}</Button>
                </div>
            </div>
        </div>
    )
}

export default Menu