import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className = "", invalid = false, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      {...props}
      aria-invalid={invalid}
      className={["ui-input", invalid ? "ui-input--invalid" : "", className]
        .filter(Boolean)
        .join(" ")}
    />
  );
});

export default Input;