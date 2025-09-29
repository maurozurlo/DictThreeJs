import Typography from '../Typography/Typography'
import Button from '../Button/Button'
import { Icon } from '../Icon/Icon'
import styles from './Meet.module.css'

const Laws = () => {
    return (
        <>
            <Typography variant='caption' className={styles.title}>Law Proposal by People</Typography>
            <div className={styles.actionsContainer}>
                <Button>
                    <Icon type='approve' /> Approve Law
                </Button>


                <Button>
                    <Icon type='reject' /> Reject Law
                </Button>

            </div>
        </>
    )
}

export default Laws