import { ThemeColors } from "../types/theme";

export const lightTheme: ThemeColors = {
  background: "#FFFFFF",
  card: "#F8F9FA",
  surface: "#F1F3F5",
  text: "#1A1A1A",
  secondaryText: "#666666",
  border: "#E9ECEF",
  divider: "#DEE2E6",
  primary: "#FF3F6C", // Myntra Pink
  secondary: "#1A1A1A",
  success: "#198754",
  warning: "#D97706",
  error: "#DC3545",
  info: "#0D6EFD",
  textOnPrimary: "#FFFFFF",
};

export const darkTheme: ThemeColors = {
  background: "#121212",
  card: "#1E1E1E",
  surface: "#2D2D2D",
  text: "#F5F5F5",
  secondaryText: "#A0A0A0",
  border: "#333333",
  divider: "#444444",
  primary: "#FF527B", // Bright Pink
  secondary: "#F5F5F5",
  success: "#75B798",
  warning: "#FFDA6A",
  error: "#EA868F",
  info: "#6EA8FE",
  textOnPrimary: "#FFFFFF",
};

export const amoledTheme: ThemeColors = {
  background: "#000000",
  card: "#0D0D0D",
  surface: "#1A1A1A",
  text: "#FFFFFF",
  secondaryText: "#888888",
  border: "#222222",
  divider: "#333333",
  primary: "#FF3F6C",
  secondary: "#FFFFFF",
  success: "#2EC4B6",
  warning: "#FF9F1C",
  error: "#FF1E27",
  info: "#0077B6",
  textOnPrimary: "#FFFFFF",
};

export const blueLightTheme: ThemeColors = {
  background: "#F0F4F8",
  card: "#FFFFFF",
  surface: "#E1E8ED",
  text: "#102A43",
  secondaryText: "#486581",
  border: "#D9E2EC",
  divider: "#BCCCDC",
  primary: "#1A73E8", // Blue primary
  secondary: "#102A43",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  info: "#3B82F6",
  textOnPrimary: "#FFFFFF",
};

export const blueDarkTheme: ThemeColors = {
  background: "#0B1D33",
  card: "#102A43",
  surface: "#1F385C",
  text: "#F0F4F8",
  secondaryText: "#9FB3C8",
  border: "#243B53",
  divider: "#334E68",
  primary: "#4285F4",
  secondary: "#F0F4F8",
  success: "#34D399",
  warning: "#FBBF24",
  error: "#F87171",
  info: "#60A5FA",
  textOnPrimary: "#FFFFFF",
};

export const greenLightTheme: ThemeColors = {
  background: "#F4F9F4",
  card: "#FFFFFF",
  surface: "#E8F5E9",
  text: "#1B5E20",
  secondaryText: "#4E7055",
  border: "#C8E6C9",
  divider: "#A5D6A7",
  primary: "#10B981", // Green primary
  secondary: "#1B5E20",
  success: "#059669",
  warning: "#D97706",
  error: "#DC3545",
  info: "#2563EB",
  textOnPrimary: "#FFFFFF",
};

export const greenDarkTheme: ThemeColors = {
  background: "#061A0C",
  card: "#0D2E16",
  surface: "#184523",
  text: "#E8F5E9",
  secondaryText: "#A5D6A7",
  border: "#2E5E3A",
  divider: "#3B7D4D",
  primary: "#34D399",
  secondary: "#E8F5E9",
  success: "#10B981",
  warning: "#FBBF24",
  error: "#F87171",
  info: "#60A5FA",
  textOnPrimary: "#FFFFFF",
};

export const corporateLightTheme: ThemeColors = {
  background: "#F3F4F6",
  card: "#FFFFFF",
  surface: "#E5E7EB",
  text: "#1F2937",
  secondaryText: "#4B5563",
  border: "#D1D5DB",
  divider: "#E5E7EB",
  primary: "#4F46E5", // Indigo corporate
  secondary: "#1F2937",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  info: "#3B82F6",
  textOnPrimary: "#FFFFFF",
};

export const corporateDarkTheme: ThemeColors = {
  background: "#111827",
  card: "#1F2937",
  surface: "#374151",
  text: "#F9FAFB",
  secondaryText: "#9CA3AF",
  border: "#374151",
  divider: "#4B5563",
  primary: "#6366F1",
  secondary: "#F9FAFB",
  success: "#34D399",
  warning: "#FBBF24",
  error: "#F87171",
  info: "#60A5FA",
  textOnPrimary: "#FFFFFF",
};

export const THEMES = {
  light: lightTheme,
  dark: darkTheme,
  amoled: amoledTheme,
  blue_light: blueLightTheme,
  blue_dark: blueDarkTheme,
  green_light: greenLightTheme,
  green_dark: greenDarkTheme,
  corporate_light: corporateLightTheme,
  corporate_dark: corporateDarkTheme,
};

export type ThemeName = keyof typeof THEMES;

