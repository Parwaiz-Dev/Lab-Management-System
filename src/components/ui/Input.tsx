import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export default function Input({
  className = "",
  invalid = false,
  ...props
}: InputProps) {
  return (
    <input
      {...props}
      aria-invalid={invalid}
      className={["ui-input", invalid ? "ui-input--invalid" : "", className]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
