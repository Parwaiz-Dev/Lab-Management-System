export const colors = {
  primary: "#146c94",
  primaryStrong: "#0f5576",
  primarySoft: "#e0f2fe",

  success: "#12805c",
  successSoft: "#def7ec",

  warning: "#a16207",
  warningSoft: "#fef3c7",

  danger: "#b42318",
  dangerSoft: "#fee4e2",

  border: "#d9e3ec",
  borderStrong: "#c5d3e0",

  text: "#14213d",
  muted: "#66788a",
  faint: "#93a4b5",

  bg: "#eef3f8",
  surface: "#ffffff",
  surfaceSoft: "#f7fafc",
} as const;

export const radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 999,
} as const;

export const shadow = {
  sm: "0 6px 18px rgba(20, 33, 61, 0.06)",
  md: "0 16px 44px rgba(20, 33, 61, 0.08)",
  lg: "0 24px 70px rgba(20, 33, 61, 0.12)",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;
