import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title?: string;
  eyebrow?: string;
  children: ReactNode;
  right?: ReactNode;
  compact?: boolean;
  bodyClassName?: string;
}

export default function Card({
  title,
  eyebrow,
  children,
  right,
  compact = false,
  className = "",
  bodyClassName = "",
  ...props
}: CardProps) {
  const hasHeader = Boolean(title || eyebrow || right);

  return (
    <section
      {...props}
      className={["ui-card", compact ? "ui-card--compact" : "", className]
        .filter(Boolean)
        .join(" ")}
    >
      {hasHeader && (
        <div className="ui-card__header">
          <div>
            {eyebrow && <div className="ui-card__eyebrow">{eyebrow}</div>}
            {title && <h2 className="ui-card__title">{title}</h2>}
          </div>

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