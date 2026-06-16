import styles from './AdvisorModal.module.css';
import { Icon } from '../Icon/Icon';
import clsx from 'clsx';

interface Props {
    name: string;
    text: string;
    position?: 'top' | 'bottom';
    onClose: () => void;
}

const AdvisorModal = ({ name, text, onClose, position = 'top' }: Props) => {
    return (
        <div className={clsx(styles.popover, position === 'bottom' && styles.bottom)}>
            <div className={styles.header}>
                <span className={styles.name}>{name}</span>
                <button className={styles.closeButton} onClick={onClose} aria-label="Close advisor"><Icon type="reject" /></button>
            </div>
            <p className={styles.text}>{text}</p>
        </div>
    );
};

export default AdvisorModal;
