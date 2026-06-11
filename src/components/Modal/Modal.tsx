import React from 'react'
import styles from './Modal.module.css'
import clsx from 'clsx'

type ModalAlign = 'center' | 'start' | 'stretch'

interface ModalProps {
    children: React.ReactNode
    /** Controls vertical alignment of the inner content within the scrim. */
    align?: ModalAlign
    /** Background alpha for the scrim (0–1). Defaults to 0.85. */
    backgroundAlpha?: number
    /** Overrides the default z-index of 999. */
    zIndex?: number
}

/**
 * Full-viewport scrim used for modal dialogs and overlays.
 * Handles position, backdrop blur, and centering. Inner card styling
 * is the caller's responsibility — use ModalCard or a custom element.
 */
export const Modal = ({
    children,
    align = 'center',
    backgroundAlpha = 0.85,
    zIndex,
}: ModalProps) => {
    const alignClass = {
        center: styles.alignCenter,
        start: styles.alignStart,
        stretch: styles.alignStretch,
    }[align]

    return (
        <div
            className={clsx(styles.scrim, alignClass)}
            style={{
                background: `rgba(0, 0, 0, ${backgroundAlpha})`,
                ...(zIndex !== undefined ? { zIndex } : {}),
            }}
        >
            {children}
        </div>
    )
}

interface ModalCardProps {
    children: React.ReactNode
    /** Max width of the card. Defaults to '540px'. */
    maxWidth?: string
    /** Additional padding inside the card. Defaults to '3rem'. */
    padding?: string
    className?: string
}

/**
 * Styled panel used as the inner content container within a Modal.
 * Applies the project's standard hud-panel-bg + accent-color border styling.
 */
export const ModalCard = ({
    children,
    maxWidth = '540px',
    padding = '3rem',
    className,
}: ModalCardProps) => (
    <div
        className={clsx(styles.card, className)}
        style={{ maxWidth, padding }}
    >
        {children}
    </div>
)
