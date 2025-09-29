import React from 'react'
import styles from './Navbar.module.css'
import Button from '../Button/Button'
import { Icon } from '../Icon/Icon'

const Navbar = () => {
    return (
        <header className={styles.navbar}>
            <div className={styles.navbarContent}>
                <div className={styles.gameTitle}>Dictator Simulator</div>
            </div>
            <div className={styles.buttonContainer}>
                <Button variant='primary'><Icon type='news' />Log</Button>
                <Button variant='primary'><Icon type='meet' />Meet</Button>
                <Button variant='primary'><Icon type='law' />Laws</Button>
                <Button variant='primary'><Icon type='opportunity' />Deals</Button>
                <Button variant='primary'><Icon type='budget' />Budget</Button>
                <Button variant='primary'><Icon type='shop' />Shop</Button>
                <Button variant='primary'><Icon type='street' />Street</Button>
                <Button variant='primary'><Icon type='secret' />???</Button>
            </div>
            <div className={styles.gameInfo}>
                <div>Day: 1</div>
            </div>
        </header>
    )
}

export default Navbar