import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";

export type InputSize = "sm" | "md" | "lg";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  invalid?: boolean;
  sizeVariant?: InputSize;
  size?: InputSize | number;
  label?: string;
  hint?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    className = "",
    invalid = false,
    sizeVariant = "md",
    size,
    label,
    hint,
    error,
    id,
    ...props
  },
  ref
) {
  const isInvalid = invalid || Boolean(error);
  const effectiveSize = (typeof size === "string" ? size : sizeVariant) as InputSize;
  const htmlSize = typeof size === "number" ? size : undefined;

  const inputElement = (
    <input
      ref={ref}
      id={id}
      size={htmlSize}
      {...props}
      aria-invalid={isInvalid}
      className={[
        "ui-input",
        `ui-input--${effectiveSize}`,
        isInvalid ? "ui-input--invalid" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    />
  );

  if (!label && !hint && !error) {
    return inputElement;
  }

  return (
    <div className="ui-input-wrapper">
      {label && (
        <label htmlFor={id} className="form-label">
          {label}
        </label>
      )}
      {inputElement}
      {error && <p className="form-error">{error}</p>}
      {hint && !error && <p className="form-hint">{hint}</p>}
    </div>
  );
});

export default Input;