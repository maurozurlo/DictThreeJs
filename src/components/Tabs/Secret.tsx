import TabLayout from './TabLayout'
import type { TabProps } from '../../types/Tabs'
import Card from '../Card/Card'
import { useGameStore } from '../../Stores/GameState'
import Button from '../Button/Button'
import Typography from '../Typography/Typography'
import { useTranslation } from 'react-i18next'

const Secret = ({ isActive }: TabProps) => {
    const { t } = useTranslation('secret')
    const available = useGameStore(s => s.specialEnding.available);
    const faction = useGameStore(s => s.specialEnding.faction);
    const used = useGameStore(s => s.specialEnding.used);
    const use = useGameStore(s => s.specialEnding.use);

    if (!available || !faction) return null;

    return (
        <TabLayout headerTitle={t('header')} isActive={isActive}>
            <Card>
                <Typography variant="h2">{t(`${faction}.title`)}</Typography>
                <Typography variant="body">{t(`${faction}.description`)}</Typography>
                {!used ? (
                    <Button onClick={use}>{t(`${faction}.button`)}</Button>
                ) : (
                    <Typography variant="body">{t('done')}</Typography>
                )}
            </Card>
        </TabLayout>
    );
};

export default Secret;
