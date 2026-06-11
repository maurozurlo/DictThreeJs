import styles from './Tabs.module.css'
import type { TabProps } from '../../types/Tabs'
import clsx from 'clsx'
import Typography from '../Typography/Typography'
import Button from '../Button/Button'
import { useGameStore } from '../../Stores/GameState'
import { useTranslation } from 'react-i18next'
import { useRef, useState } from 'react'
import { importSave } from '../../Utils/SaveLoad'
import { Tabs } from '../../types/Tabs'
import HelpOverlay from '../HelpOverlay/HelpOverlay'


const Menu = ({ isActive }: TabProps) => {
    const setGamePhase = useGameStore((s) => s.gameManagement.setPhase);
    const setActiveTab = useGameStore((s) => s.tabs.setActiveTab);
    const saveGame = useGameStore((s) => s.gameManagement.saveGame);
    const loadGame = useGameStore((s) => s.gameManagement.loadGame);
    const phase = useGameStore((s) => s.gameManagement.phase);
    const activateTutorial = useGameStore((s) => s.tutorial.activate);
    const { t, i18n } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [showHelp, setShowHelp] = useState(false);

    const isInGame = phase === 'start';

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
        <>
        <div className={clsx(styles.Tab, styles.TabMenu, { [styles.isActive]: isActive })}>
            <div className={styles.centeredContainer}>
                <Typography variant={'h1'}>
                    {t('gameTitle')}
                </Typography>
                <hr />

                <div className={styles.menuButtons}>
                    {isInGame && (
                        <Button variant='primary' onClick={() => setActiveTab(Tabs.Log)}>
                            {t('mainMenu.continue')}
                        </Button>
                    )}
                    <Button variant='primary' onClick={() => setGamePhase('start')}>
                        {t('mainMenu.newGame')}
                    </Button>
                    {isInGame && (
                        <Button variant='primary' onClick={saveGame}>{t('mainMenu.saveGame')}</Button>
                    )}
                    <Button variant='primary' onClick={handleLoadClick}>{t('mainMenu.loadGame')}</Button>
                    <Button variant='primary' onClick={() => setShowHelp(true)}>{t('mainMenu.help')}</Button>
                    <Button variant='primary' onClick={() => { if (phase !== 'start') setGamePhase('start'); activateTutorial(); setActiveTab(Tabs.Log) }}>{t('mainMenu.tutorial')}</Button>
                    <Button variant='primary' onClick={() => setShowSettings(s => !s)}>
                        {t('mainMenu.settings')}
                    </Button>

                    {showSettings && (
                        <div className={styles.settingsPanel}>
                            <div className={styles.settingsRow}>
                                <label htmlFor="lang-select">{t('mainMenu.language')}</label>
                                <select
                                    id="lang-select"
                                    className={styles.settingsSelect}
                                    value={i18n.language.startsWith('es') ? 'es' : 'en'}
                                    onChange={e => i18n.changeLanguage(e.target.value)}
                                >
                                    <option value="en">English</option>
                                    <option value="es">Español</option>
                                </select>
                            </div>
                        </div>
                    )}

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

        {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}
        </>
    )
}

export default Menu
