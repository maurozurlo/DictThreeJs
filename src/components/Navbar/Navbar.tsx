import styles from './Navbar.module.css'
import clsx from 'clsx'
import Button from '../Button/Button'
import { Icon, type IconType } from '../Icon/Icon'
import { useGameStore } from '../../Stores/GameState'
import { Tabs } from '../../types/Tabs'
import { useTranslation } from 'react-i18next';

interface NavbarProps {
    /** Triggers a fade-to-black transition before switching to the given tab. */
    transitionTo: (tab: Tabs) => void;
}

const Navbar = ({ transitionTo }: NavbarProps) => {
    const activeTab = useGameStore((s) => s.tabs.activeTab);
    const displayTabs = activeTab !== Tabs.Menu;
    const tabsLocked = useGameStore(s => s.tabs.tabsLocked)
    const secretAvailable = useGameStore(s => s.specialEnding.available)
    const debugEnabled = useGameStore(s => s.debug.enabled)
    const phase = useGameStore(s => s.gameManagement.phase)
    const dayEnded = useGameStore(s => s.gameManagement.dayEnded)
    const lawDecided = useGameStore(s => s.law.lawDecided)
    const dealDecided = useGameStore(s => s.deals.dealDecided)
    const meetTaken = useGameStore(s => s.meet.actionTaken.taken)
    const requestAdvanceRound = useGameStore(s => s.gameManagement.requestAdvanceRound)
    const miniChallengePending = useGameStore(s => s.miniChallenge.current !== null && !s.miniChallenge.decided)
    const coupWarningFaction = useGameStore(s => s.gameManagement.coupWarningFaction)
    const coupArmedLastRound = useGameStore(s => s.gameManagement.coupArmedLastRound)
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
        { tab: Tabs.Street, icon: 'street', label: t('tabs.street') },
        ...((secretAvailable || debugEnabled) ? [{ tab: Tabs.Secret, icon: 'secret' as IconType, label: '???' }] : []),
    ];

    const allActionsDone = meetTaken && lawDecided && dealDecided
    const canGoHome = phase !== 'idle' && activeTab !== Tabs.Menu;

    return (
        <header className={styles.navbar}>
            <div className={styles.navbarContent}>
                <div
                    className={clsx(styles.gameTitle, { [styles.gameTitleClickable]: canGoHome })}
                    onClick={() => canGoHome && transitionTo(Tabs.Menu)}
                >
                    {t('gameTitle')}
                </div>
            </div>

            {displayTabs && (
                <div className={styles.buttonContainer} data-tutorial="tab-buttons">
                    {tabConfig.map(({ tab, icon, label, disabled }) => (
                        <div key={tab} className={styles.tabWrapper} data-tutorial={`tab-${tab}`}>
                            <Button
                                variant="primary"
                                disabled={disabled}
                                onClick={() => transitionTo(tab)}
                            >
                                <Icon type={icon} />
                                {label}
                            </Button>
                            {pending.has(tab) && <span className={styles.dot} />}
                        </div>
                    ))}
                </div>
            )}

            <div className={styles.navRight}>
                {displayTabs && coupWarningFaction && (
                    <span className={clsx(styles.coupBadge, { [styles.coupBadgeDanger]: coupArmedLastRound })}>
                        <Icon type={coupArmedLastRound ? 'danger' : 'warning'} />
                        <span className={styles.coupTooltip}>
                            {coupArmedLastRound
                                ? t('hud.coup_danger', { faction: t(`power.${coupWarningFaction}`) })
                                : t('hud.coup_warning', { faction: t(`power.${coupWarningFaction}`) })}
                        </span>
                    </span>
                )}
                {displayTabs && phase === 'start' && !dayEnded && (
                    <div className={clsx(styles.advanceWrapper, { [styles.glowing]: allActionsDone })}>
                        <div className={styles.advanceRing} />
                        <Button variant="primary" className={styles.advanceButton} onClick={requestAdvanceRound} data-tutorial="advance-btn">
                            {allActionsDone ? '>>' : '>'}
                        </Button>
                        {allActionsDone && (
                            <span className={styles.advanceHint}>{t('hud.advance_ready')}</span>
                        )}
                    </div>
                )}
            </div>
        </header>
    );
};

export default Navbar;
