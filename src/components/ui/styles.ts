export const colors = {
  primary: "#4f46e5", // Indigo-600 (Matching Chavan reference)
  primaryStrong: "#4338ca", // Indigo-700
  primarySoft: "#eef2ff", // Indigo-50
  primaryHover: "#4338ca",
  primaryActive: "#3730a3",

  success: "#059669", // Emerald-600
  successSoft: "#d1fae5", // Emerald-100
  successText: "#047857",

  warning: "#d97706", // Amber-600
  warningSoft: "#fef3c7", // Amber-100
  warningText: "#b45309",

  danger: "#e11d48", // Rose-600
  dangerSoft: "#ffe4e6", // Rose-100
  dangerText: "#be123c",

  info: "#0284c7", // Sky-600
  infoSoft: "#e0f2fe", // Sky-100
  infoText: "#0369a1",

  border: "#e2e8f0", // Slate-200
  borderStrong: "#cbd5e1", // Slate-300
  borderLight: "#f1f5f9", // Slate-100

  text: "#0f172a", // Slate-900
  textSoft: "#334155", // Slate-700
  muted: "#64748b", // Slate-500
  faint: "#94a3b8", // Slate-400

  bg: "#f1f5f9", // Slate-100
  surface: "#ffffff",
  surfaceSoft: "#f8fafc", // Slate-50
  surfaceHover: "#f1f5f9",

  sidebarBg: "#0f172a", // Slate-900
  sidebarBorder: "#1e293b", // Slate-800
  sidebarHover: "#1e293b",
  sidebarActive: "#4f46e5",
} as const;

export const radius = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 999,
} as const;

export const shadow = {
  xs: "0 1px 2px rgba(15, 23, 42, 0.05)",
  sm: "0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)",
  md: "0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.04)",
  lg: "0 10px 15px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -4px rgba(15, 23, 42, 0.04)",
} as const;

export const spacing = {
  "2xs": 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;
