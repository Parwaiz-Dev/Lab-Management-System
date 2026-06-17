import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: string;
  title: string;
  subtitle?: string;
  compact?: boolean;
  children?: ReactNode;
}

export default function EmptyState({ icon, title, subtitle, compact, children }: EmptyStateProps) {
  return (
    <div className={`empty-state${compact ? " empty-state--compact" : ""}`}>
      <div className="empty-state__icon">{icon}</div>
      <p className="empty-state__title">{title}</p>
      {subtitle && <p className="empty-state__subtitle">{subtitle}</p>}
      {children}
    </div>
  );
}