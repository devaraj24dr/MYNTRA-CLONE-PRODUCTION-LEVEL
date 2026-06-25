import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { THEMES } from "../constants/themes";
import { ThemeContextType, ThemeMode, ThemeColors } from "../types/theme";

const THEME_STORAGE_KEY = "user_theme_mode";

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>("system");

  // Load saved theme preference from storage on mount
  useEffect(() => {
    const loadSavedTheme = async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved === "light" || saved === "dark" || saved === "system") {
          setThemeModeState(saved);
        }
      } catch (error) {
        console.error("Failed to load user theme mode preference:", error);
      }
    };
    loadSavedTheme();
  }, []);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    try {
      setThemeModeState(mode);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (error) {
      console.error("Failed to save theme mode preference:", error);
    }
  }, []);

  // Determine active theme ('light' | 'dark')
  const currentTheme = useMemo<"light" | "dark">(() => {
    if (themeMode === "system") {
      return systemColorScheme === "dark" ? "dark" : "light";
    }
    return themeMode;
  }, [themeMode, systemColorScheme]);

  // Toggle between light and dark modes
  const toggleTheme = useCallback(async () => {
    const nextMode: ThemeMode = currentTheme === "light" ? "dark" : "light";
    await setThemeMode(nextMode);
  }, [currentTheme, setThemeMode]);

  // Retrieve theme color values
  const theme = useMemo<ThemeColors>(() => {
    return THEMES[currentTheme] || THEMES.light;
  }, [currentTheme]);

  const value = useMemo<ThemeContextType>(() => ({
    theme,
    themeMode,
    currentTheme,
    setThemeMode,
    toggleTheme,
  }), [theme, themeMode, currentTheme, setThemeMode, toggleTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
