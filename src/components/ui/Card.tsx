import { colors, radius, shadow } from "./styles";

export default function Card({ title, children, right }: any) {
  return (
    <div
      style={{
        background: colors.white,
        border: `1px solid ${colors.border}`,
        borderRadius: radius,
        padding: 12,
        boxShadow: shadow,
      }}
    >
      {title && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 8,
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          <span>{title}</span>
          {right}
        </div>
      )}

      {children}
    </div>
  );
}