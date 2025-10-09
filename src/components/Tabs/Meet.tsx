import Typography from '../Typography/Typography'
import Button from '../Button/Button'
import { Icon } from '../Icon/Icon'
import styles from './Tabs.module.css'
import { useGameStore } from '../../Stores/GameState'

const Meet = () => {
    const selectedPower = useGameStore((s) => s.meet.selectedPower);

    return (
        <>
            <Typography variant='caption' className={styles.title}>Selected Faction: {selectedPower === 'military' ? 'Military' : selectedPower === 'people' ? 'People' : selectedPower === 'company' ? 'Elite' : 'None'}

            </Typography>
            <div className={styles.actionsContainer}>
                <Button>
                    <Icon type='bribe' /> Bribe
                </Button>


                <Button>
                    <Icon type='gun' /> Eliminate
                </Button>



                <Button>
                    <Icon type='takeover' /> Expropiate (+$100)
                </Button>
                <Button>
                    <Icon type='charisma' /> Dialogue
                </Button>
            </div>

        </>
    )
}

export default Meet