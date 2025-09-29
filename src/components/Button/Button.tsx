import React from 'react'
import styles from './Button.module.css'
import clsx from 'clsx';

type ButtonProps = {
    clickHandler?: () => void
    children?: React.ReactNode;
    variant?: 'primary' | 'secondary' | 'square';
}

const Button = ({ clickHandler, children, variant }: ButtonProps) => {
    return (
        <button onClick={clickHandler} className={clsx(styles.button, {
            [styles.primary]: variant === 'primary',
            [styles.secondary]: variant === 'secondary',
            [styles.square]: variant === 'square',
        })
        }>{children}</button>
    )
}

export default Button