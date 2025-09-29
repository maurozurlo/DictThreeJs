import React from 'react'
import './Typography.module.css'

type TypographyProps = {
    variant: 'h1' | 'h2' | 'body' | 'caption';
    children?: React.ReactNode;
    className?: string;
}

const Typography = ({ variant, children, className }: TypographyProps) => {
    return variant === 'h1' ? <h1 className={className}>{children}</h1> :
        variant === 'h2' ? <h2 className={className}>{children}</h2> :
            variant === 'body' ? <p className={className}>{children}</p> :
                variant === 'caption' ? <span className={className}>{children}</span> : null

}

export default Typography