import { useGameStore } from '../../Stores/GameState'
import { Tabs } from '../../types/Tabs';
import Menu from './Menu';
import Log from './Log'
import Budget from './Budget';


const TabManager = () => {
    const currentTab = useGameStore((s) => s.tabs.activeTab);

    return (
        <>
            <Menu isActive={currentTab === Tabs.Menu} />
            <Log isActive={currentTab === Tabs.Log} />
            <Budget isActive={currentTab === Tabs.Budget} />
        </>
    )
}

export default TabManager