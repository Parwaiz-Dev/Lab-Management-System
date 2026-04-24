import { radius } from "./styles";

export default function Badge({ children, color = "green" }: any) {
  return (
    <span
      style={{
        background: "#dcfce7",
        color: "#166534",
        padding: "2px 8px",
        borderRadius: 20,
        fontSize: 11,
      }}
    >
      {children}
    </span>
  );
}