import styles from './AdvisorModal.module.css';
import { Icon } from '../Icon/Icon';

interface Props {
    name: string;
    text: string;
    onClose: () => void;
}

const AdvisorModal = ({ name, text, onClose }: Props) => {
    return (
        <div className={styles.popover}>
            <div className={styles.header}>
                <span className={styles.name}>{name}</span>
                <button className={styles.closeButton} onClick={onClose} aria-label="Close advisor"><Icon type="reject" /></button>
            </div>
            <p className={styles.text}>{text}</p>
        </div>
    );
};

export default AdvisorModal;
