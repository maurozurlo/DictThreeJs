import React from 'react'
import styles from './Button.module.css'
import clsx from 'clsx';

type ButtonProps = {
    onClick?: () => void
    children?: React.ReactNode;
    variant?: 'primary' | 'secondary' | 'square';
    disabled?: boolean;
}

const Button = ({ onClick, children, variant, disabled = false }: ButtonProps) => {
    return (
        <button onClick={onClick} disabled={disabled} className={clsx(styles.button, {
            [styles.primary]: variant === 'primary',
            [styles.secondary]: variant === 'secondary',
            [styles.square]: variant === 'square',
        })
        }>{children}</button>
    )
}

export default Button