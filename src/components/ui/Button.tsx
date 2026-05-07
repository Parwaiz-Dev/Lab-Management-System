import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "success"
  | "danger"
  | "ghost";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    variant = "primary",
    loading = false,
    disabled = false,
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
        loading ? "ui-button--loading" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {loading && <span className="ui-spinner" aria-hidden="true" />}
      <span className="ui-button__content">{children}</span>
    </button>
  );
});

export default Button;