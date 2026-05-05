import type { InputHTMLAttributes } from "react";
import { colors, radius } from "./styles";

export default function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: "100%",
        minHeight: 34,
        padding: "6px 9px",
        border: `1px solid ${colors.borderStrong}`,
        borderRadius: radius,
        background: colors.surface,
        color: colors.text,
        fontSize: 13,
        outline: "none",
        ...props.style,
      }}
    />
  );
}
