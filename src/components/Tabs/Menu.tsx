import styles from './Tabs.module.css'
import type { TabProps } from '../../types/Tabs'
import clsx from 'clsx'
import Typography from '../Typography/Typography'
import Button from '../Button/Button'
import { useGameStore } from '../../Stores/GameState'
import { useTranslation } from 'react-i18next'
import { useRef } from 'react'
import { importSave } from '../../Utils/SaveLoad'


const Menu = ({ isActive }: TabProps) => {
    const setGamePhase = useGameStore((s) => s.gameManagement.setPhase);
    const saveGame = useGameStore((s) => s.gameManagement.saveGame);
    const loadGame = useGameStore((s) => s.gameManagement.loadGame);
    const phase = useGameStore((s) => s.gameManagement.phase);
    const { t } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleLoadClick = () => fileInputRef.current?.click();

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const data = await importSave(file);
            loadGame(data);
        } catch {
            // ignore bad files silently
        }
        e.target.value = '';
    };

    return (
        <div className={clsx(styles.Tab, styles.TabMenu, { [styles.isActive]: isActive })}>
            <div className={styles.centeredContainer}>
                <Typography variant={'h1'}>
                    Dictator Simulator
                </Typography>
                <hr />

                <div className={styles.menuButtons}>
                    <Button variant='primary' onClick={() => setGamePhase('start')}>{t('mainMenu.newGame')}</Button>
                    {phase === 'start' && (
                        <Button variant='primary' onClick={saveGame}>{t('mainMenu.saveGame')}</Button>
                    )}
                    <Button variant='primary' onClick={handleLoadClick}>{t('mainMenu.loadGame')}</Button>
                    <Button variant='primary'>{t('mainMenu.help')}</Button>
                    <Button variant='primary'>{t('mainMenu.settings')}</Button>
                    <Button variant='primary'>{t('mainMenu.credits')}</Button>
                </div>

                <input
                    ref={fileInputRef}
                    type='file'
                    accept='.dict'
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                />
            </div>
        </div>
    )
}

export default Menu
