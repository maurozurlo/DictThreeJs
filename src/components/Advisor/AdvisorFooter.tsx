import Typography from '../Typography/Typography'
import styles from './AdvisorFooter.module.css'
import type { AdvisorLevel } from '../../types/Advisor';
import { ADVISOR_NAMES } from '../../Utils/Advisor';

type AdvisorFooterProps = {
    advisorLevel: AdvisorLevel;
    advisorText: string;

}

export function AdvisorFooter({ advisorLevel, advisorText }: AdvisorFooterProps) {
    return (
        <>
            <div className={styles.advisorMugshot}>
                <img src={`/assets/advisor_${advisorLevel}.png`} alt="Advisor" />
            </div>
            <div className={styles.advisorText}>
                <Typography variant="h3" className={styles.advisorName}>{ADVISOR_NAMES[advisorLevel]}</Typography>
                <Typography variant="body">{advisorText}</Typography>
            </div>

        </>
    )
}