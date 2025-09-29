import React from 'react'
import styles from './Tabs.module.css'
import type { TabProps } from '../../types/Tabs'
import clsx from 'clsx'
import Newspaper from '../Newspaper/Newspaper'
import Typography from '../Typography/Typography'
import Card from '../Card/Card'


const Log = ({ isActive }: TabProps) => {
    return (
        <div className={clsx(styles.Tab, { [styles.isActive]: isActive })}>
            <div className={styles.pageContainer}>
                <Typography variant='h2'>Today's paper</Typography>
                <Newspaper />
                <Typography variant='h2'>Log</Typography>
                <Card>Approved Law #1: Give companies the power to do stuff</Card>
            </div>
        </div>
    )
}

export default Log