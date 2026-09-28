import type { ReactNode } from "react";

export type BadgeTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "primary"
  | "slate"
  | "emerald"
  | "amber"
  | "rose"
  | "indigo";

export type BadgeSize = "sm" | "md" | "lg";

export interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  size?: BadgeSize;
  className?: string;
  title?: string;
}

export function Badge({
  children,
  tone = "neutral",
  size = "md",
  className = "",
  title,
}: BadgeProps) {
  return (
    <span
      className={[
        "ui-badge",
        `ui-badge--${tone}`,
        size === "sm" ? "ui-badge--sm" : size === "lg" ? "ui-badge--lg" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      title={title}
    >
      {children}
    </span>
  );
}

export default Badge;