import React from "react";
import clsx from "clsx";
import styles from "./Icon.module.css";

export type IconType =
  | "budget"
  | "law"
  | "secret"
  | "opportunity"
  | "needle"
  | "reject"
  | "clock"
  | "minus"
  | "plus"
  | "approve"
  | "meet"
  | "news"
  | "street"
  | "shop"
  | "charisma"
  | "checked"
  | "unchecked"
  | "company"
  | "people"
  | "military"
  | "gun"
  | "bribe"
  | "takeover"
  ;

export interface IconProps extends React.HTMLAttributes<HTMLSpanElement> {
  type: IconType;
  className?: string;
  children?: React.ReactNode;
}

export const Icon: React.FC<IconProps> = ({ type, className, children, ...props }) => {
  return (
    <span
      className={clsx(styles.icon, styles[`icon-${type}`], className)}
      {...props}
    >{children}</span>
  );
};
