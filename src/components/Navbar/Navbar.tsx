import styles from './Navbar.module.css'
import Button from '../Button/Button'
import { Icon } from '../Icon/Icon'
import { useGameStore } from '../../Stores/GameState'
import { Tabs } from '../../types/Tabs'

const Navbar = () => {
    const setCurrentTab = useGameStore((s) => s.tabs.setActiveTab);
    const displayTabs = useGameStore((s) => s.tabs.shouldDisplayTabs);



    return (
        <header className={styles.navbar}>
            <div className={styles.navbarContent}>
                <div className={styles.gameTitle}>Dictator Simulator</div>
            </div>
            {displayTabs ?


                <div className={styles.buttonContainer}>
                    <Button variant='primary'
                        clickHandler={() => setCurrentTab(Tabs.Log)}


                    ><Icon type='news' />Log</Button>
                    <Button variant='primary'
                        clickHandler={() => setCurrentTab(Tabs.Meet)}
                    ><Icon type='meet' />Meet</Button>

                    <Button variant='primary'
                        clickHandler={() => setCurrentTab(Tabs.Laws)}
                    ><Icon type='law' />Laws</Button>

                    <Button variant='primary'
                        clickHandler={() => setCurrentTab(Tabs.Deals)}

                    ><Icon type='opportunity' />Deals</Button>
                    <Button variant='primary'
                        clickHandler={() => setCurrentTab(Tabs.Budget)}
                    ><Icon type='budget' />Budget</Button>

                    <Button variant='primary'
                        clickHandler={() => setCurrentTab(Tabs.Shop)}

                    ><Icon type='shop' />Shop</Button>
                    <Button variant='primary'

                        clickHandler={() => setCurrentTab(Tabs.Street)}
                    ><Icon type='street' />Street</Button>
                    <Button variant='primary'
                        clickHandler={() => setCurrentTab(Tabs.Secret)}

                    ><Icon type='secret' />???</Button>
                </div> : null}
            <div className={styles.gameInfo}>
                {displayTabs ? <div>Day: 1</div> : null}
            </div>
        </header>
    )
}

export default Navbar