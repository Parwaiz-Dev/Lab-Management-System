import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "success" | "danger" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  loading?: boolean;
}

export default function Button({
  children,
  variant = "primary",
  loading = false,
  disabled = false,
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading}
      className={[
        "ui-button",
        `ui-button--${variant}`,
        loading ? "ui-button--loading" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {loading && <span className="ui-spinner" />}
      {children}
    </button>
  );
}
