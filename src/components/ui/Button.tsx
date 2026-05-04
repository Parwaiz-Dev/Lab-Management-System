import { colors, radius } from "./styles";
import type { ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "success" | "danger" | "ghost";

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
}

export default function Button({
  children,
  onClick,
  variant = "primary",
  disabled = false,
  type = "button",
}: ButtonProps) {
  const palette = {
    primary: { background: colors.primary, color: "#fff", border: colors.primary },
    secondary: { background: colors.surface, color: colors.text, border: colors.borderStrong },
    success: { background: colors.success, color: "#fff", border: colors.success },
    danger: { background: colors.danger, color: "#fff", border: colors.danger },
    ghost: { background: "transparent", color: colors.primary, border: "transparent" },
  }[variant];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...palette,
        minHeight: 34,
        padding: "7px 11px",
        border: `1px solid ${palette.border}`,
        borderRadius: radius,
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: 13,
        fontWeight: 700,
        opacity: disabled ? 0.55 : 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}
