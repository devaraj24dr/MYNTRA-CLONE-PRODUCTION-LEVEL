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
  const [isThemeLoading, setIsThemeLoading] = useState(true);

  // Load saved theme preference from storage on mount
  useEffect(() => {
    const loadSavedTheme = async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved) {
          const validModes: ThemeMode[] = [
            "system",
            "light",
            "dark",
            "amoled",
            "blue_light",
            "blue_dark",
            "green_light",
            "green_dark",
            "corporate_light",
            "corporate_dark",
          ];
          if (validModes.includes(saved as ThemeMode)) {
            setThemeModeState(saved as ThemeMode);
          }
        }
      } catch (error) {
        console.error("Failed to load user theme mode preference:", error);
      } finally {
        setIsThemeLoading(false);
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

  // Determine active theme key
  const currentTheme = useMemo<keyof typeof THEMES>(() => {
    if (themeMode === "system") {
      return systemColorScheme === "dark" ? "dark" : "light";
    }
    return themeMode;
  }, [themeMode, systemColorScheme]);

  // Toggle between light and dark variants of active theme
  const toggleTheme = useCallback(async () => {
    let nextMode: ThemeMode;
    switch (currentTheme) {
      case "light":
        nextMode = "dark";
        break;
      case "dark":
        nextMode = "light";
        break;
      case "amoled":
        nextMode = "light";
        break;
      case "blue_light":
        nextMode = "blue_dark";
        break;
      case "blue_dark":
        nextMode = "blue_light";
        break;
      case "green_light":
        nextMode = "green_dark";
        break;
      case "green_dark":
        nextMode = "green_light";
        break;
      case "corporate_light":
        nextMode = "corporate_dark";
        break;
      case "corporate_dark":
        nextMode = "corporate_light";
        break;
      default:
        nextMode = "light";
    }
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
    isThemeLoading,
    setThemeMode,
    toggleTheme,
  }), [theme, themeMode, currentTheme, isThemeLoading, setThemeMode, toggleTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

