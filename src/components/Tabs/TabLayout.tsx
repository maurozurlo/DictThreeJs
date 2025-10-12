import styles from './Tabs.module.css'
import type { TabProps } from '../../types/Tabs'
import clsx from 'clsx'
import Typography from '../Typography/Typography'



const TabLayout = ({ isActive, children, headerTitle, sideMenu }: TabProps) => {

    return (
        <div className={clsx(styles.Tab, { [styles.isActive]: isActive })}>
            <div className={clsx(styles.pageContainer, styles.card)}>
                <div className={styles.tabsHeader}>
                    <Typography variant="h2">{headerTitle}</Typography>
                    {sideMenu ? <div className={styles.values}>
                        {sideMenu}
                    </div> : null}

                </div>
                {children}

            </div>
        </div>
    )
}

export default TabLayout