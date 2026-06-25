import { ThemeColors } from "../types/theme";

export const lightTheme: ThemeColors = {
  background: "#FFFFFF",
  card: "#F8F9FA",
  surface: "#F1F3F5",
  text: "#1A1A1A",
  secondaryText: "#666666",
  border: "#E9ECEF",
  primary: "#FF3F6C",
  success: "#198754",
  warning: "#856404", // High contrast dark gold
  error: "#DC3545",
};

export const darkTheme: ThemeColors = {
  background: "#121212",
  card: "#1E1E1E",
  surface: "#2D2D2D",
  text: "#F5F5F5",
  secondaryText: "#A0A0A0",
  border: "#333333",
  primary: "#FF527B",
  success: "#75B798",
  warning: "#FFDA6A",
  error: "#EA868F",
};

export const THEMES = {
  light: lightTheme,
  dark: darkTheme,
};
export type ThemeName = keyof typeof THEMES;
