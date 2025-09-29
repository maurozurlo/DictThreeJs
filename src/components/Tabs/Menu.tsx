import styles from './Tabs.module.css'
import type { TabProps } from '../../types/Tabs'
import clsx from 'clsx'
import Typography from '../Typography/Typography'
import Button from '../Button/Button'
import { useGameStore } from '../../Stores/GameState'


const Menu = ({ isActive }: TabProps) => {
    const setGamePhase = useGameStore((s) => s.gameManagement.setPhase);
    return (
        <div className={clsx(styles.Tab, styles.TabMenu, { [styles.isActive]: isActive })}>

            <div className="centeredContainer">
                <Typography variant={'h1'}>
                    Dictator Simulator
                </Typography>
                <hr />

                <div className={styles.menuButtons}>
                    <Button variant='primary' clickHandler={() => setGamePhase('start')}>New Game</Button>
                    {/*<Button variant='primary'>Load Game</Button>*/}
                    <Button variant='primary'>Settings</Button>
                    <Button variant='primary'>Help</Button>
                    <Button variant='primary'>Credits</Button>
                </div>
            </div>
        </div>
    )
}

export default Menu