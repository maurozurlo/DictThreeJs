import TabLayout from './TabLayout'
import { useTranslation } from 'react-i18next'
import type { TabProps } from '../../types/Tabs'

const Deals = ({ isActive }: TabProps) => {
    const { t } = useTranslation()
    return (
        <TabLayout headerTitle={t('tabs.deals')} isActive={isActive}>
            something here...
        </TabLayout>
    )
}
export default Deals