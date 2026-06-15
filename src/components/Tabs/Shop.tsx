import TabLayout from './TabLayout'
import type { TabProps } from '../../types/Tabs'
import Card from '../Card/Card'
import { useGameStore } from '../../Stores/GameState'
import Button from '../Button/Button'
import Typography from '../Typography/Typography'
import { useTranslation } from 'react-i18next'
import { STATUES, MEDIA_PACKAGES, ADVISOR_ITEMS } from '../../assets/ShopItems'
import { countModifiersByType } from '../../Utils/Modifiers'

const Shop = ({ isActive }: TabProps) => {
    const { t } = useTranslation('shop')
    const { t: menuT } = useTranslation('menu')
    const treasury = useGameStore(s => s.budget.treasury);
    const frozenFactions = useGameStore(s => s.shop.frozenFactions);
    const statueCount = useGameStore(s => countModifiersByType(s.gameManagement.modifiers, 'statue'));
    const advisorLevel = useGameStore(s => s.shop.advisorLevel);
    const buy = useGameStore(s => s.shop.buy);
    const phase = useGameStore(s => s.gameManagement.phase);
    const dayEnded = useGameStore(s => s.gameManagement.dayEnded);

    const canBuy = phase === 'start' && !dayEnded;

    return (
        <TabLayout headerTitle={menuT('tabs.shop')} isActive={isActive}>
            <Card>
                <Typography variant="h2">{t('shop.treasury', { amount: treasury })}</Typography>
            </Card>

            {MEDIA_PACKAGES.map(item => {
                const frozen = frozenFactions.has(item.faction);
                return (
                    <Card key={item.id}>
                        <Typography variant="h2">{t(`shop.${item.id}.name`)}</Typography>
                        <Typography variant="body">{t(`shop.${item.id}.description`)}</Typography>
                        <Typography variant="body">{t('shop.cost', { amount: item.price })}</Typography>
                        {frozen && <Typography variant="body">{t('shop.active_this_round')}</Typography>}
                        <Button
                            disabled={!canBuy || frozen || treasury < item.price}
                            onClick={() => buy(item.id)}
                        >
                            {t('shop.buy', { amount: item.price })}
                        </Button>
                    </Card>
                );
            })}

            {ADVISOR_ITEMS.filter(item => item.targetLevel === advisorLevel + 1).map(item => (
                <Card key={item.id}>
                    <Typography variant="h2">{t(`shop.${item.id}.name`)}</Typography>
                    <Typography variant="body">{t(`shop.${item.id}.description`)}</Typography>
                    <Button
                        disabled={!canBuy || treasury < item.cost}
                        onClick={() => buy(item.id)}
                    >
                        {t('shop.buy', { amount: item.cost })}
                    </Button>
                </Card>
            ))}
            <Card>
                <Typography variant="caption">{t('shop.advisor_your')}</Typography>
                <Typography variant="h2">{t(`shop.advisor_${advisorLevel}.name`)}</Typography>
                <Typography variant="body">{t(`shop.advisor_${advisorLevel}.description`)}</Typography>
            </Card>

            {STATUES.slice(statueCount, statueCount + 1).map(item => (
                <Card key={item.id}>
                    <Typography variant="h2">{t(item.nameKey)}</Typography>
                    <Typography variant="body">{t(item.descriptionKey)}</Typography>
                    <Typography variant="body">{t('shop.statue.owned', { count: statueCount })}</Typography>
                    <Button
                        disabled={!canBuy || treasury < item.price}
                        onClick={() => buy('statue')}
                    >
                        {t('shop.buy', { amount: item.price })}
                    </Button>
                </Card>
            ))}
            {statueCount >= STATUES.length && (
                <Card>
                    <Typography variant="body">{t('shop.statue.full')}</Typography>
                </Card>
            )}
        </TabLayout>
    );
};

export default Shop;
