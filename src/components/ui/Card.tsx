import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title?: string;
  eyebrow?: string;
  subtitle?: string;
  icon?: ReactNode;
  iconVariant?: "primary" | "secondary";
  iconSize?: "default" | "sm";
  badge?: ReactNode;
  children: ReactNode;
  right?: ReactNode;
  compact?: boolean;
  bodyClassName?: string;
}

export default function Card({
  title,
  eyebrow,
  subtitle,
  icon,
  iconVariant = "primary",
  iconSize = "default",
  badge,
  children,
  right,
  compact = false,
  className = "",
  bodyClassName = "",
  ...props
}: CardProps) {
  const hasHeader = Boolean(title || eyebrow || subtitle || icon || badge || right);

  return (
    <section
      {...props}
      className={["ui-card", compact ? "ui-card--compact" : "", className]
        .filter(Boolean)
        .join(" ")}
    >
      {hasHeader && (
        <div className="ui-card__header">
          <div className="ui-card__header-left">
            {icon && (
              <div
                className={[
                  "ui-card__icon",
                  iconVariant === "secondary" ? "ui-card__icon--secondary" : "",
                  iconSize === "sm" ? "ui-card__icon--sm" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {icon}
              </div>
            )}

            <div className="ui-card__header-text">
              {eyebrow && <div className="ui-card__eyebrow">{eyebrow}</div>}
              {title && <h2 className="ui-card__title">{title}</h2>}
              {subtitle && <p className="ui-card__subtitle">{subtitle}</p>}
            </div>
          </div>

          {badge && <div className="ui-card__badge">{badge}</div>}
          {right && <div className="ui-card__right">{right}</div>}
        </div>
      )}

      <div
        className={["ui-card__body", bodyClassName]
          .filter(Boolean)
          .join(" ")}
      >
        {children}
      </div>
    </section>
  );
}