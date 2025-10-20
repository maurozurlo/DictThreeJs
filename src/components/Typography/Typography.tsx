import React from "react";
import clsx from "clsx";
import styles from "./Typography.module.css";

type TypographyVariant = "h1" | "h2" | "h3" | "body" | "caption";
type TypographyColor = "normal" | "accent" | "dark";

type TypographyProps = {
    variant: TypographyVariant;
    children?: React.ReactNode;
    className?: string;
    color?: TypographyColor;
    style?: React.CSSProperties;
};

const tagMap = {
    h1: "h1",
    h2: "h2",
    h3: "h3",
    body: "p",
    caption: "span",
} as const;

const Typography = ({
    variant,
    children,
    color = "normal",
    className,
    style,
}: TypographyProps) => {
    const Tag = tagMap[variant];
    const colorClass =
        color === "normal"
            ? undefined
            : color === "accent"
                ? styles.accent
                : styles.dark;

    return (
        <Tag className={clsx(className, colorClass)} style={style}>
            {children}
        </Tag>
    );
};

export default Typography;
