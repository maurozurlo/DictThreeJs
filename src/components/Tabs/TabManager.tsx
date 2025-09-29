import React from 'react'
import { useGameStore } from '../../Stores/GameState'
import { Tabs } from '../../types/Tabs';
import Menu from './Menu';
import Log from './Log'

const TabManager = () => {
    const currentTab = useGameStore((s) => s.tabs.activeTab);


    return (
        <>
            {currentTab}
            <Menu isActive={currentTab === Tabs.Menu} />
            <Log isActive={currentTab === Tabs.Log} />
        </>
    )
}

export default TabManager