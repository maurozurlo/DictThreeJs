import styles from './Tabs.module.css'
import type { TabProps } from '../../types/Tabs'
import clsx from 'clsx'
import Typography from '../Typography/Typography'
import Button from '../Button/Button'
import { useGameStore } from '../../Stores/GameState'
import { useTranslation } from 'react-i18next'
import { useEffect, useRef, useState } from 'react'
import { importSave } from '../../Utils/SaveLoad'
import { loadMeta } from '../../Utils/MetaProgress'
import type { MetaProgress, EndingId } from '../../types/MetaProgress'
import { Tabs } from '../../types/Tabs'
import HelpOverlay from '../HelpOverlay/HelpOverlay'

const ENDING_IDS: EndingId[] = [
    'military', 'business', 'people', 'bankruptcy',
    'military_coup', 'business_coup', 'people_coup', 'victory',
    'secret_room_0_good', 'secret_room_0_bad',
    'secret_room_1_good', 'secret_room_1_bad',
    'secret_room_2_good', 'secret_room_2_bad',
];


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
    const [meta, setMeta] = useState<MetaProgress>(loadMeta);

    useEffect(() => {
        if (isActive) setMeta(loadMeta());
    }, [isActive]);

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

                <div className={styles.recordsPanel}>
                    <div className={styles.recordsTier}>
                        <span className={styles.recordsLabel}>{t('records.bestTier')}</span>
                        <span className={styles.recordsTierBadge}>
                            {meta.highestTier ?? t('records.noTier')}
                        </span>
                    </div>
                    <span className={styles.recordsLabel}>{t('records.endings')}</span>
                    <div className={styles.recordsEndingsGrid}>
                        {ENDING_IDS.map((id) => {
                            const unlocked = meta.endingsUnlocked.includes(id);
                            return (
                                <div
                                    key={id}
                                    className={clsx(styles.recordsSlot, { [styles.recordsSlotLocked]: !unlocked })}
                                >
                                    {unlocked ? t(`records.ending_${id}`) : t('records.locked')}
                                </div>
                            );
                        })}
                    </div>
                </div>

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
                            <label htmlFor="lang-select" className={styles.recordsLabel}>
                                {t('mainMenu.language')}
                            </label>
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
