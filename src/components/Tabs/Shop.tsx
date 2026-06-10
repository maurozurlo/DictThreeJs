import TabLayout from './TabLayout'
import type { TabProps } from '../../types/Tabs'
import Card from '../Card/Card'
import { useGameStore } from '../../Stores/GameState'
import Button from '../Button/Button'
import Typography from '../Typography/Typography'
import type { ShopItemId } from '../../types/GameState'
import type { Power } from '../../types/Power'
import { useTranslation } from 'react-i18next'

const STATUE_COSTS = [100, 150, 200];

type FreezeItem = {
    id: ShopItemId;
    faction: Power;
};

const FREEZE_ITEMS: FreezeItem[] = [
    { id: 'media_coverage', faction: 'people' },
    { id: 'media_shielding', faction: 'military' },
    { id: 'media_blackout', faction: 'business' },
];

const Shop = ({ isActive }: TabProps) => {
    const { t } = useTranslation('shop')
    const { t: menuT } = useTranslation('menu')
    const treasury = useGameStore(s => s.budget.treasury);
    const frozenFactions = useGameStore(s => s.shop.frozenFactions);
    const statueCount = useGameStore(s => s.shop.statueCount);
    const buy = useGameStore(s => s.shop.buy);
    const phase = useGameStore(s => s.gameManagement.phase);
    const dayEnded = useGameStore(s => s.gameManagement.dayEnded);

    const canBuy = phase === 'start' && !dayEnded;

    return (
        <TabLayout headerTitle={menuT('tabs.shop')} isActive={isActive}>
            <Card>
                <Typography variant="h2">{t('shop.treasury', { amount: treasury })}</Typography>
            </Card>

            {FREEZE_ITEMS.map(item => {
                const frozen = frozenFactions.has(item.faction);
                return (
                    <Card key={item.id}>
                        <Typography variant="h2">{t(`shop.${item.id}.name`)}</Typography>
                        <Typography variant="body">{t(`shop.${item.id}.description`)}</Typography>
                        <Typography variant="body">{t('shop.cost', { amount: 80 })}</Typography>
                        {frozen && <Typography variant="body">{t('shop.active_this_round')}</Typography>}
                        <Button
                            disabled={!canBuy || frozen || treasury < 80}
                            onClick={() => buy(item.id)}
                        >
                            {t('shop.buy', { amount: 80 })}
                        </Button>
                    </Card>
                );
            })}

            <Card>
                <Typography variant="h2">{t('shop.statue.name')}</Typography>
                <Typography variant="body">{t('shop.statue.description')}</Typography>
                <Typography variant="body">{t('shop.statue.owned', { count: statueCount })}</Typography>
                {statueCount < 3 && (
                    <Button
                        disabled={!canBuy || treasury < STATUE_COSTS[statueCount]}
                        onClick={() => buy('statue')}
                    >
                        {t('shop.buy', { amount: STATUE_COSTS[statueCount] })}
                    </Button>
                )}
                {statueCount >= 3 && (
                    <Typography variant="body">{t('shop.statue.full')}</Typography>
                )}
            </Card>
        </TabLayout>
    );
};

export default Shop;
