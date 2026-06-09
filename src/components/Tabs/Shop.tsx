import TabLayout from './TabLayout'
import type { TabProps } from '../../types/Tabs'
import Card from '../Card/Card'
import { useGameStore } from '../../Stores/GameState'
import Button from '../Button/Button'
import Typography from '../Typography/Typography'
import type { ShopItemId } from '../../types/GameState'
import type { Power } from '../../types/Power'

const STATUE_COSTS = [100, 150, 200];

type FreezeItem = {
    id: ShopItemId;
    faction: Power;
    name: string;
    description: string;
};

const FREEZE_ITEMS: FreezeItem[] = [
    { id: 'media_coverage', faction: 'people', name: 'Specialized Media Coverage', description: 'Freezes all People relation changes at end of this round.' },
    { id: 'media_shielding', faction: 'military', name: 'Media Shielding', description: 'Freezes all Military relation changes at end of this round.' },
    { id: 'media_blackout', faction: 'business', name: 'Media Blackout', description: 'Freezes all Business relation changes at end of this round.' },
];

const Shop = ({ isActive }: TabProps) => {
    const treasury = useGameStore(s => s.budget.treasury);
    const frozenFactions = useGameStore(s => s.shop.frozenFactions);
    const statueCount = useGameStore(s => s.shop.statueCount);
    const buy = useGameStore(s => s.shop.buy);
    const phase = useGameStore(s => s.gameManagement.phase);
    const dayEnded = useGameStore(s => s.gameManagement.dayEnded);

    const canBuy = phase === 'start' && !dayEnded;

    return (
        <TabLayout headerTitle="Shop" isActive={isActive}>
            <Card>
                <Typography variant="h2">Treasury: ${treasury}M</Typography>
            </Card>

            {FREEZE_ITEMS.map(item => {
                const frozen = frozenFactions.has(item.faction);
                return (
                    <Card key={item.id}>
                        <Typography variant="h2">{item.name}</Typography>
                        <Typography variant="body">{item.description}</Typography>
                        <Typography variant="body">Cost: $80M</Typography>
                        {frozen && <Typography variant="body">Active this round</Typography>}
                        <Button
                            disabled={!canBuy || frozen || treasury < 80}
                            onClick={() => buy(item.id)}
                        >
                            Buy — $80M
                        </Button>
                    </Card>
                );
            })}

            <Card>
                <Typography variant="h2">Giant Statue</Typography>
                <Typography variant="body">
                    Permanently increases your Charisma by +1. A monument to your glory appears in the city.
                </Typography>
                <Typography variant="body">Owned: {statueCount} / 3</Typography>
                {statueCount < 3 && (
                    <Button
                        disabled={!canBuy || treasury < STATUE_COSTS[statueCount]}
                        onClick={() => buy('statue')}
                    >
                        Buy — ${STATUE_COSTS[statueCount]}M
                    </Button>
                )}
                {statueCount >= 3 && (
                    <Typography variant="body">The city cannot fit any more statues.</Typography>
                )}
            </Card>
        </TabLayout>
    );
};

export default Shop;
