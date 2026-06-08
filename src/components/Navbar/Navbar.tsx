import styles from './Navbar.module.css'
import Button from '../Button/Button'
import { Icon, type IconType } from '../Icon/Icon'
import { useGameStore } from '../../Stores/GameState'
import { Tabs } from '../../types/Tabs'
import LanguageSwitcher from '../LanguageSwitcher'
import { useTranslation } from 'react-i18next';
import { GAMESTATE } from '../../Constants/GameState'

const Navbar = () => {
    const setCurrentTab = useGameStore((s) => s.tabs.setActiveTab);
    const displayTabs = useGameStore((s) => s.tabs.activeTab) !== Tabs.Menu;
    const round = useGameStore(s => s.gameManagement.round)
    const tabsLocked = useGameStore(s => s.tabs.tabsLocked)
    const { t } = useTranslation();

    const tabConfig: { tab: Tabs, icon: IconType, label: string, disabled?: boolean }[] = [
        { tab: Tabs.Log, icon: 'news', label: t('tabs.log') },
        { tab: Tabs.Meet, icon: 'meet', label: t('tabs.meet'), disabled: tabsLocked },
        { tab: Tabs.Laws, icon: 'law', label: t('tabs.laws'), disabled: tabsLocked },
        { tab: Tabs.Deals, icon: 'opportunity', label: t('tabs.deals'), disabled: tabsLocked },
        { tab: Tabs.Budget, icon: 'budget', label: t('tabs.budget'), disabled: tabsLocked },
    ];


    return (
        <header className={styles.navbar}>
            <div className={styles.navbarContent}>
                <div className={styles.gameTitle}>Dictator Simulator</div>
            </div>

            {displayTabs && (
                <div className={styles.buttonContainer}>
                    {tabConfig.map(({ tab, icon, label, disabled }) => (
                        <Button
                            key={tab}
                            variant="primary"
                            disabled={disabled}
                            onClick={() => setCurrentTab(tab)}
                        >
                            <Icon type={icon} />
                            {label}
                        </Button>
                    ))}
                </div>
            )}

            <div className={styles.gameInfo}>
                <LanguageSwitcher />
                {displayTabs && <div>{t('nav.rounds')}: {round}/{GAMESTATE.ROUNDS.MAX}</div>}
            </div>
        </header>
    );
};

export default Navbar;
