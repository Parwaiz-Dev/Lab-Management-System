import type { CSSProperties, ReactNode } from "react";
import { colors, radius, shadowSm } from "./styles";

interface CardProps {
  title?: string;
  eyebrow?: string;
  children: ReactNode;
  right?: ReactNode;
  compact?: boolean;
  style?: CSSProperties;
}

export default function Card({ title, eyebrow, children, right, compact = false, style }: CardProps) {
  return (
    <section
      style={{
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: radius,
        padding: compact ? 10 : 13,
        boxShadow: shadowSm,
        ...style,
      }}
    >
      {(title || right) && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
            marginBottom: compact ? 8 : 10,
          }}
        >
          <div>
            {eyebrow && (
              <div
                style={{
                  color: colors.muted,
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: 0,
                  textTransform: "uppercase",
                  marginBottom: 3,
                }}
              >
                {eyebrow}
              </div>
            )}
            {title && (
              <h2
                style={{
                  color: colors.text,
                  fontSize: compact ? 14 : 16,
                  lineHeight: 1.2,
                  fontWeight: 800,
                }}
              >
                {title}
              </h2>
            )}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}
