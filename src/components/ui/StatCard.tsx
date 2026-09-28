import type { ReactNode } from "react";

export type StatTone = "indigo" | "emerald" | "amber" | "rose" | "sky" | "slate";

interface StatCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon?: ReactNode;
  tone?: StatTone;
  trend?: string;
  onClick?: () => void;
  className?: string;
}

export function StatCard({
  title,
  value,
  subtext,
  icon,
  tone = "indigo",
  trend,
  onClick,
  className = "",
}: StatCardProps) {
  return (
    <div
      onClick={onClick}
      className={[
        "stat-card",
        `stat-card--${tone}`,
        onClick ? "stat-card--clickable" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="stat-card__content">
        <span className="stat-card__title">{title}</span>
        <div className="stat-card__value">{value}</div>
        {(subtext || trend) && (
          <div className="stat-card__footer">
            {trend && <span className="stat-card__trend">{trend}</span>}
            {subtext && <span className="stat-card__subtext">{subtext}</span>}
          </div>
        )}
      </div>

      {icon && (
        <div className={`stat-card__icon stat-card__icon--${tone}`}>
          {icon}
        </div>
      )}
    </div>
  );
}

export default StatCard;
