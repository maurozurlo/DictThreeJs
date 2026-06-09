import TabLayout from './TabLayout'
import type { TabProps } from '../../types/Tabs'
import Card from '../Card/Card'
import { useGameStore } from '../../Stores/GameState'
import Button from '../Button/Button'
import Typography from '../Typography/Typography'
import type { Power } from '../../types/Power'

type RoomConfig = {
    title: string;
    description: string;
    buttonLabel: string;
};

const ROOM_CONFIGS: Record<Power, RoomConfig> = {
    military: {
        title: 'The Bunker',
        description: 'Deep beneath the palace, the generals have shown you their greatest secret. A command console. One button. One red button. Whatever happens next, there is no going back.',
        buttonLabel: 'Nuke',
    },
    business: {
        title: 'The Vault',
        description: 'The elite have offered you an exit. A private vault, filled with untraceable accounts. A jet waiting on the tarmac with engines running. You could disappear tonight.',
        buttonLabel: 'Run',
    },
    people: {
        title: 'The Zen Garden',
        description: 'The people have built you this. Flowers, stone paths, absolute silence. A panel on the wall bears a single instruction: let go. For the first time in years, no one is watching.',
        buttonLabel: 'Relax',
    },
};

const Secret = ({ isActive }: TabProps) => {
    const available = useGameStore(s => s.specialEnding.available);
    const faction = useGameStore(s => s.specialEnding.faction);
    const used = useGameStore(s => s.specialEnding.used);
    const use = useGameStore(s => s.specialEnding.use);

    if (!available || !faction) return null;

    const config = ROOM_CONFIGS[faction];

    return (
        <TabLayout headerTitle="???" isActive={isActive}>
            <Card>
                <Typography variant="h2">{config.title}</Typography>
                <Typography variant="body">{config.description}</Typography>
                {!used ? (
                    <Button onClick={use}>{config.buttonLabel}</Button>
                ) : (
                    <Typography variant="body">It is done.</Typography>
                )}
            </Card>
        </TabLayout>
    );
};

export default Secret;
