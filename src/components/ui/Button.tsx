import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "danger"
  | "success"
  | "ghost";

export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    variant = "primary",
    size = "md",
    loading = false,
    disabled = false,
    icon,
    className = "",
    type = "button",
    ...props
  },
  ref
) {
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      {...props}
      type={type}
      disabled={isDisabled}
      aria-busy={loading}
      data-loading={loading ? "true" : "false"}
      className={[
        "ui-button",
        `ui-button--${variant}`,
        `ui-button--${size}`,
        loading ? "ui-button--loading" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {loading && (
        <span className="ui-spinner" aria-hidden="true" />
      )}
      {icon && !loading && <span className="ui-button__icon">{icon}</span>}
      <span className="ui-button__content">{children}</span>
    </button>
  );
});

export default Button;