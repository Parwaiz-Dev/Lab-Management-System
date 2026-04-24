import { colors, radius } from "./styles";

export default function Input(props: any) {
  return (
    <input
      {...props}
      style={{
        width: "100%",
        padding: "6px 8px",
        border: `1px solid ${colors.border}`,
        borderRadius: radius,
        fontSize: 13,
        outline: "none",
      }}
    />
  );
}