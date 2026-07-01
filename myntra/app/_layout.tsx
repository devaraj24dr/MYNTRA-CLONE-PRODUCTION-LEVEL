import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";

import React from "react";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { useTheme } from "@/hooks/useTheme";
import { NotificationProvider } from "@/context/NotificationContext";
import { useNotifications } from "@/hooks/useNotifications";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

function RootLayoutStack() {
  // Initialize Expo notifications registration and lifecycle listeners
  useNotifications();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="transactions" />
    </Stack>
  );
}

function RootLayoutContent() {
  const { currentTheme, theme } = useTheme();

  const isDark = currentTheme === "dark" || currentTheme === "amoled" || currentTheme.endsWith("_dark");
  const navTheme = isDark ? DarkTheme : DefaultTheme;
  const customNavTheme = {
    ...navTheme,
    colors: {
      ...navTheme.colors,
      primary: theme.primary,
      background: theme.background,
      card: theme.card,
      text: theme.text,
      border: theme.border,
    },
  };

  return (
    <NavThemeProvider value={customNavTheme}>
      <AuthProvider>
        <NotificationProvider>
          <RootLayoutStack />
          <StatusBar style={isDark ? "light" : "dark"} />
        </NotificationProvider>
      </AuthProvider>
    </NavThemeProvider>
  );
}

function RootLayoutInner() {
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });
  const { isThemeLoading } = useTheme();

  useEffect(() => {
    if (loaded && !isThemeLoading) {
      SplashScreen.hideAsync();
    }
  }, [loaded, isThemeLoading]);

  if (!loaded || isThemeLoading) {
    return null;
  }

  return <RootLayoutContent />;
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutInner />
    </ThemeProvider>
  );
}

