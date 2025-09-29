import Typography from '../Typography/Typography'
import Button from '../Button/Button'
import { Icon } from '../Icon/Icon'
import styles from './Meet.module.css'

const Meet = () => {
    return (
        <>
            <Typography variant='caption' className={styles.title}>Selected Faction: Military</Typography>
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