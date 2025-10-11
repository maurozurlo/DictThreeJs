import Typography from '../Typography/Typography'
import Button from '../Button/Button'
import { Icon } from '../Icon/Icon'
import styles from './Tabs.module.css'
import { useGameStore } from '../../Stores/GameState'
import { useTranslation } from 'react-i18next'
import { MEET_VALUES } from '../../Constants/Meet'
import { MoneyNumberFormatter } from '../../Constants/Budget'

const Meet = () => {
    const { t } = useTranslation();
    const selectedPower = useGameStore((s) => s.meet.selectedPower);
    /*    "meet": {
        "bribe": "Bribe",
        "eliminate": "Eliminate",
        "expropiate": "Expropiate",
        "dialogue": "Dialogue"
    },
    "power": {
        "military": "Military",
        "people": "People",
        "company": "Elite"
    }*/

    return selectedPower === 'none' ? (
        <Typography variant='caption' className={styles.title}>
            {t('meet.none_selected')}

        </Typography>
    ) : (
        <>
            <Typography variant='caption' className={styles.title}>
                {t('meet.selected')}: {t(`power.${selectedPower}`)}

            </Typography>
            <div className={styles.actionsContainer}>
                <Button>
                    <Icon type='bribe' /> {t('meet.bribe')} (-{MoneyNumberFormatter(MEET_VALUES[selectedPower].bribe)})
                </Button>


                <Button>
                    <Icon type='gun' /> {t('meet.eliminate')}
                </Button>



                <Button>
                    <Icon type='takeover' /> {t('meet.expropiate')} (+{MoneyNumberFormatter(MEET_VALUES[selectedPower].expropiate)})
                </Button>
                <Button>
                    <Icon type='charisma' /> {t('meet.dialogue')}
                </Button>
            </div>

        </>
    )
}

export default Meet