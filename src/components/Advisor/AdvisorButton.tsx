import { useMemo, useState } from 'react';
import { useGameStore } from '../../Stores/GameState';
import { useTranslation } from 'react-i18next';
import type { AdvisorCategory, AdvisorOverrideTrigger, AdvisorVerdict } from '../../types/Advisor';
import { getAdvisorLine, ADVISOR_NAMES } from '../../Utils/Advisor';
import AdvisorModal from './AdvisorModal';
import styles from './AdvisorButton.module.css';
import { Icon } from '../Icon/Icon';

interface Props {
    category: AdvisorCategory;
    verdict: AdvisorVerdict;
    trigger?: AdvisorOverrideTrigger;
}

/** Info button that reveals a context-aware adviser quote in a popover. */
const AdvisorButton = ({ category, verdict, trigger }: Props) => {
    const [open, setOpen] = useState(false);
    const advisorLevel = useGameStore(s => s.shop.advisorLevel);
    const { t } = useTranslation('advisor');

    const key = useMemo(
        () => getAdvisorLine({ category, verdict, level: advisorLevel, trigger }),
        [category, verdict, advisorLevel, trigger]
    );
    const text = key === 'No advice available.' ? key : t(key);

    return (
        <div className={styles.wrapper}>
            <button
                className={styles.infoButton}
                onClick={() => setOpen(prev => !prev)}
                title={ADVISOR_NAMES[advisorLevel]}
                aria-label="Ask advisor"
            >
                <Icon type="info" />
            </button>
            {open && (
                <AdvisorModal
                    name={ADVISOR_NAMES[advisorLevel]}
                    text={text}
                    onClose={() => setOpen(false)}
                />
            )}
        </div>
    );
};

export default AdvisorButton;
