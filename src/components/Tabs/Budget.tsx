import styles from './Tabs.module.css'
import type { TabProps } from '../../types/Tabs'
import clsx from 'clsx'
import { useTranslation } from 'react-i18next'
import Typography from '../Typography/Typography'
import Button from '../Button/Button'
import { useMemo } from 'react'
import { Icon } from '../Icon/Icon'


const Budget = ({ isActive }: TabProps) => {
    const { t } = useTranslation();


    const expenditures = useMemo(() => {
        return [
            {
                id: 'health',
                currentValue: 1, // this will come from store,
                label: 'budget.health'
            },
            {
                id: 'infrastructure',
                currentValue: 1, // this will come from store,
                label: 'budget.infrastructure'
            },
            {
                id: 'security',
                currentValue: 1, // this will come from store,
                label: 'budget.security'
            },
            {
                id: 'education',
                currentValue: 1, // this will come from store,
                label: 'budget.education'
            },
        ]
    }, [])

    const taxes = useMemo(() => {
        return [
            {
                id: 'peopleTax',
                currentValue: 1, // this will come from store,
                label: 'budget.peopleTax'
            },
            {
                id: 'businessTax',
                currentValue: 1, // this will come from store,
                label: 'budget.businessTax'
            }
        ]
    }, [])

    return (
        <div className={clsx(styles.Tab, { [styles.isActive]: isActive })}>
            <div className={clsx(styles.pageContainer, styles.card)}>
                <div className={styles.tabsHeader}>
                    <Typography variant='h2'>{t('tabs.budget')}</Typography>
                    <Typography variant='h3'>{t('budget.totalExpenses')}: 500m</Typography>

                </div>

                <div className={styles.columns}>
                    <div className={styles.column}>
                        <Typography variant='h3'>{t("budget.expenditures")}</Typography>
                        {expenditures.map(expenditure => (
                            <div key={expenditure.id} className={styles.budgetRow}>

                                <Typography variant='body'>
                                    {t(expenditure.label)}
                                </Typography>
                                <div className={styles.amountControl}>
                                    <Button><Icon type='minus'></Icon></Button>
                                    <Typography variant='body' color='accent'>
                                        {expenditure.currentValue * 50 /* This will come from store */}
                                    </Typography>

                                    <Button><Icon type='plus'></Icon></Button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className={styles.column}>
                        <Typography variant='h3'>{t("budget.taxes")}</Typography>
                        {taxes.map(tax => (
                            <div key={tax.id} className={styles.budgetRow}>

                                <Typography variant='body'>
                                    {t(tax.label)}
                                </Typography>
                                <div className={styles.amountControl}>
                                    <Button><Icon type='minus'></Icon>5</Button>
                                    <Button><Icon type='minus'></Icon></Button>
                                    <Typography variant='body' color='accent'>
                                        {tax.currentValue}
                                    </Typography>

                                    <Button><Icon type='plus'></Icon></Button>
                                    <Button><Icon type='plus'></Icon>5</Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Budget