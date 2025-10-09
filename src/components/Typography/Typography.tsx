import React from 'react'
import styles from './Typography.module.css'
import clsx from 'clsx';

type TypographyProps = {
    variant: 'h1' | 'h2' | 'h3' | 'body' | 'caption';
    children?: React.ReactNode;
    className?: string;
    color?: 'normal' | 'accent' | 'dark'
}

const Typography = ({ variant, children, color = 'normal', className }: TypographyProps) => {
    return variant === 'h1' ? <h1 className={clsx(className, {
        [styles.accent]: color === 'accent',
        [styles.dark]: color === 'dark'
    })}>{children}</h1> :
        variant === 'h2' ? <h2 className={className}>{children}</h2> :
            variant === 'h3' ? <h3 className={className}>{children}</h3> :
                variant === 'body' ? <p className={clsx(className, {
                    [styles.accent]: color === 'accent',
                    [styles.dark]: color === 'dark'
                })}>{children}</p> :
                    variant === 'caption' ? <span className={className}>{children}</span> : null

}

export default Typography