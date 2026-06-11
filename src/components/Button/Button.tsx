import React from 'react'
import styles from './Button.module.css'
import clsx from 'clsx';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary' | 'square';
}

const Button = ({ children, variant, className, ...rest }: ButtonProps) => {
    return (
        <button
            className={clsx(styles.button, {
                [styles.primary]: variant === 'primary',
                [styles.secondary]: variant === 'secondary',
                [styles.square]: variant === 'square',
            }, className)}
            {...rest}
        >{children}</button>
    )
}

export default Button