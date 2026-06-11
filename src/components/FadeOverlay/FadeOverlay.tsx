import clsx from 'clsx';
import styles from './FadeOverlay.module.css';

interface FadeOverlayProps {
    /** When true the overlay is fully opaque (black screen). */
    visible: boolean;
}

/**
 * Full-viewport black overlay used for tab transitions.
 * Covers everything below the navbar (3D canvas + tab panels).
 * The navbar sits above this via a higher z-index.
 */
const FadeOverlay = ({ visible }: FadeOverlayProps) => (
    <div className={clsx(styles.overlay, { [styles.visible]: visible })} aria-hidden="true" />
);

export default FadeOverlay;
