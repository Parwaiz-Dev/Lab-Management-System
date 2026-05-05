import type { ReactNode } from "react";
import { colors } from "./styles";

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
}

export default function Badge({ children, tone = "neutral" }: BadgeProps) {
  const palette = {
    neutral: { background: colors.surfaceSoft, color: colors.muted, border: colors.border },
    success: { background: colors.successSoft, color: colors.success, border: "#b9ead7" },
    warning: { background: colors.warningSoft, color: colors.warning, border: "#fde68a" },
    danger: { background: colors.dangerSoft, color: colors.danger, border: "#fecdca" },
    info: { background: colors.primarySoft, color: colors.primary, border: "#bae6fd" },
  }[tone];

  return (
    <span
      style={{
        ...palette,
        display: "inline-flex",
        alignItems: "center",
        minHeight: 24,
        padding: "3px 9px",
        borderRadius: 999,
        border: `1px solid ${palette.border}`,
        fontSize: 11,
        fontWeight: 800,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}
