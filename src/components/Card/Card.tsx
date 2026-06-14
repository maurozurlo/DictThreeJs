import React from 'react'
import styles from './Card.module.css'
import clsx from 'clsx';

type CardProps = {
    children?: React.ReactNode;
    className?: string;
}

const Card = ({ children, className }: CardProps) => {
    return (
        <div className={clsx(styles.card, className)}>
            {children}
        </div>
    )
}

export default Card