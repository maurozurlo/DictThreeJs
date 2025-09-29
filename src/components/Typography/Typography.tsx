import React from 'react'
import './Typography.module.css'

type TypographyProps = {
    variant: 'h1' | 'h2' | 'body' | 'caption';
    children?: React.ReactNode;
}

const Typography = ({ variant, children }: TypographyProps) => {
    return variant === 'h1' ? <h1>{children}</h1> :
        variant === 'h2' ? <h2>{children}</h2> :
            variant === 'body' ? <p>{children}</p> :
                variant === 'caption' ? <span>{children}</span> : null

}

export default Typography