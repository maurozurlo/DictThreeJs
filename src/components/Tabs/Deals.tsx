import TabLayout from './TabLayout'
import { useTranslation } from 'react-i18next'
import type { TabProps } from '../../types/Tabs'
import Card from '../Card/Card'
import { useGameStore } from '../../Stores/GameState'
import styles from './Deals.module.css'
import Button from '../Button/Button'
import Typography from '../Typography/Typography'
import clsx from 'clsx'
import { useMemo } from 'react'
import { dumbifyText, educationToDumbScore } from '../../Utils/String'

const Deals = ({ isActive }: TabProps) => {
    const { t: menuT } = useTranslation('menu')
    const { t } = useTranslation('deals')
    const currentDeal = useGameStore(s => s.deals.current);
    const outcome = useGameStore(s => s.deals.lastDealOutcome)
    const dealDecided = useGameStore(s => s.deals.dealDecided)
    const actUponDeal = useGameStore(s => s.deals.actUponDeal)
    const education = useGameStore(s => s.budget.expenditures.education)
    const dealText = useMemo(
        () => currentDeal ? dumbifyText(t(currentDeal.text), educationToDumbScore(education)) : '',
        [currentDeal?.text, education]
    )
    return (
        <TabLayout headerTitle={menuT('tabs.deals')} isActive={isActive}>
            {currentDeal ?
                <Card>
                    <Typography variant='body' className={clsx({
                        [styles.isInactive]: dealDecided
                    })}>{dealText}</Typography>
                    <div className={styles.cardActions}>
                        <Button disabled={dealDecided} onClick={() => actUponDeal(true)}>{t('deals.accept')}</Button>
                        <Button disabled={dealDecided} onClick={() => actUponDeal(false)}>{t('deals.reject')}</Button>
                    </div>
                    {dealDecided ? <>
                        <Typography variant='h3'>{t('deals.outcome')}</Typography>
                        <Typography variant='body'>{outcome ? t(outcome) : ""}</Typography>
                    </> : null}
                </Card>

                : <Card>
                    <Typography variant='body'>
                        {t('deals.no_current_deals')}
                    </Typography>
                </Card>}

        </TabLayout>
    )
}
export default Deals