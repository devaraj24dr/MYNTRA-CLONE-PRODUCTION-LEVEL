export type ThemeMode =
  | "system"
  | "light"
  | "dark"
  | "amoled"
  | "blue_light"
  | "blue_dark"
  | "green_light"
  | "green_dark"
  | "corporate_light"
  | "corporate_dark";

export interface ThemeColors {
  background: string;
  card: string;
  surface: string;
  text: string;
  secondaryText: string;
  border: string;
  primary: string;
  secondary: string;
  divider: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  textOnPrimary: string;
}

export interface ThemeContextType {
  theme: ThemeColors;
  themeMode: ThemeMode;
  currentTheme: "light" | "dark" | "amoled" | "blue_light" | "blue_dark" | "green_light" | "green_dark" | "corporate_light" | "corporate_dark";
  isThemeLoading: boolean;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
}

