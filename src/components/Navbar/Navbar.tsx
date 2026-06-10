import styles from './Navbar.module.css'
import clsx from 'clsx'
import Button from '../Button/Button'
import { Icon, type IconType } from '../Icon/Icon'
import { useGameStore } from '../../Stores/GameState'
import { Tabs } from '../../types/Tabs'
import { useTranslation } from 'react-i18next';
import { GAMESTATE } from '../../Constants/GameState'

const Navbar = () => {
    const setCurrentTab = useGameStore((s) => s.tabs.setActiveTab);
    const activeTab = useGameStore((s) => s.tabs.activeTab);
    const displayTabs = activeTab !== Tabs.Menu;
    const round = useGameStore(s => s.gameManagement.round)
    const tabsLocked = useGameStore(s => s.tabs.tabsLocked)
    const secretAvailable = useGameStore(s => s.specialEnding.available)
    const phase = useGameStore(s => s.gameManagement.phase)
    const lawDecided = useGameStore(s => s.law.lawDecided)
    const dealDecided = useGameStore(s => s.deals.dealDecided)
    const meetTaken = useGameStore(s => s.meet.actionTaken.taken)
    const miniChallengePending = useGameStore(s => s.miniChallenge.current !== null && !s.miniChallenge.decided)
    const { t } = useTranslation();

    const pending = new Set<Tabs>()
    if (phase === 'start') {
        if (!meetTaken) pending.add(Tabs.Meet)
        if (!lawDecided) pending.add(Tabs.Laws)
        if (!dealDecided) pending.add(Tabs.Deals)
        if (miniChallengePending) pending.add(Tabs.Log)
    }

    const tabConfig: { tab: Tabs, icon: IconType, label: string, disabled?: boolean }[] = [
        { tab: Tabs.Log, icon: 'news', label: t('tabs.log') },
        { tab: Tabs.Meet, icon: 'meet', label: t('tabs.meet'), disabled: tabsLocked },
        { tab: Tabs.Laws, icon: 'law', label: t('tabs.laws'), disabled: tabsLocked },
        { tab: Tabs.Deals, icon: 'opportunity', label: t('tabs.deals'), disabled: tabsLocked },
        { tab: Tabs.Budget, icon: 'budget', label: t('tabs.budget'), disabled: tabsLocked },
        { tab: Tabs.Shop, icon: 'shop', label: t('tabs.shop') },
        ...(secretAvailable ? [{ tab: Tabs.Secret, icon: 'secret' as IconType, label: '???' }] : []),
    ];


    return (
        <header className={styles.navbar}>
            <div className={styles.navbarContent}>
                <div
                    className={clsx(styles.gameTitle, { [styles.gameTitleClickable]: phase !== 'idle' && activeTab !== Tabs.Menu })}
                    onClick={() => phase !== 'idle' && activeTab !== Tabs.Menu && setCurrentTab(Tabs.Menu)}
                >
                    {t('gameTitle')}
                </div>
            </div>

            {displayTabs && (
                <div className={styles.buttonContainer}>
                    {tabConfig.map(({ tab, icon, label, disabled }) => (
                        <div key={tab} className={styles.tabWrapper}>
                            <Button
                                variant="primary"
                                disabled={disabled}
                                onClick={() => setCurrentTab(tab)}
                            >
                                <Icon type={icon} />
                                {label}
                            </Button>
                            {pending.has(tab) && <span className={styles.dot} />}
                        </div>
                    ))}
                </div>
            )}

            <div className={styles.gameInfo}>
                {displayTabs && <div>{t('nav.rounds')}: {round}/{GAMESTATE.ROUNDS.MAX}</div>}
            </div>
        </header>
    );
};

export default Navbar;
