import { colors, radius } from "./styles";

export default function Button({
  children,
  onClick,
  variant = "primary",
}: any) {
  const bg =
    variant === "primary"
      ? colors.primary
      : variant === "success"
      ? colors.success
      : variant === "danger"
      ? colors.danger
      : "#94a3b8";

  return (
    <button
      onClick={onClick}
      style={{
        background: bg,
        color: "white",
        border: "none",
        padding: "6px 12px",
        borderRadius: radius,
        cursor: "pointer",
        fontSize: 13,
      }}
    >
      {children}
    </button>
  );
}