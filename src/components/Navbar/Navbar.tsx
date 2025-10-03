import styles from './Navbar.module.css'
import Button from '../Button/Button'
import { Icon, type IconType } from '../Icon/Icon'
import { useGameStore } from '../../Stores/GameState'
import { Tabs } from '../../types/Tabs'
import LanguageSwitcher from '../LanguageSwitcher'
import { useTranslation } from 'react-i18next';

const Navbar = () => {
    const setCurrentTab = useGameStore((s) => s.tabs.setActiveTab);
    const displayTabs = useGameStore((s) => s.tabs.shouldDisplayTabs);
    const { t } = useTranslation();

    const tabConfig: { tab: Tabs, icon: IconType, label: string, disabled?: boolean }[] = [
        { tab: Tabs.Log, icon: 'news', label: t('tabs.log') },
        { tab: Tabs.Meet, icon: 'meet', label: t('tabs.meet') },
        { tab: Tabs.Laws, icon: 'law', label: t('tabs.laws') },
        { tab: Tabs.Deals, icon: 'opportunity', label: t('tabs.deals') },
        { tab: Tabs.Budget, icon: 'budget', label: t('tabs.budget') },
        { tab: Tabs.Shop, icon: 'shop', label: t('tabs.shop') },
        { tab: Tabs.Street, icon: 'street', label: t('tabs.street') },
        { tab: Tabs.Secret, icon: 'secret', label: '???', disabled: true },
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
                            clickHandler={() => setCurrentTab(tab)}
                        >
                            <Icon type={icon} />
                            {label}
                        </Button>
                    ))}
                </div>
            )}

            <div className={styles.gameInfo}>
                <LanguageSwitcher />
                {displayTabs && <div>Round: 1/10</div>}
            </div>
        </header>
    );
};

export default Navbar;
