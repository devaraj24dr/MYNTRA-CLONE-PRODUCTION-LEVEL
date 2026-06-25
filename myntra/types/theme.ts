export type ThemeMode = "light" | "dark" | "system";

export interface ThemeColors {
  background: string;
  card: string;
  surface: string;
  text: string;
  secondaryText: string;
  border: string;
  primary: string;
  success: string;
  warning: string;
  error: string;
}

export interface ThemeContextType {
  theme: ThemeColors;
  themeMode: ThemeMode;
  currentTheme: "light" | "dark";
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
}
