import React, { useMemo } from "react";
import { TouchableOpacity, Text, StyleSheet, View, ScrollView } from "react-native";
import { useTheme } from "../hooks/useTheme";
import { THEMES } from "../constants/themes";
import { ThemeMode, ThemeColors } from "../types/theme";

interface ThemeOption {
  id: ThemeMode;
  name: string;
}

const THEME_OPTIONS: ThemeOption[] = [
  { id: "system", name: "System Default" },
  { id: "light", name: "Classic Light" },
  { id: "dark", name: "Classic Dark" },
  { id: "amoled", name: "AMOLED Dark" },
  { id: "blue_light", name: "Ocean Blue (Light)" },
  { id: "blue_dark", name: "Ocean Blue (Dark)" },
  { id: "green_light", name: "Forest Green (Light)" },
  { id: "green_dark", name: "Forest Green (Dark)" },
  { id: "corporate_light", name: "Corporate (Light)" },
  { id: "corporate_dark", name: "Corporate (Dark)" },
];

interface ThemeToggleProps {
  label?: string;
  hideLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ label = "Theme Mode", hideLabel = false }) => {
  const { theme, themeMode, setThemeMode } = useTheme();

  const styles = useMemo(() => getStyles(theme), [theme]);

  const activeOption = useMemo(() => {
    return THEME_OPTIONS.find((o) => o.id === themeMode);
  }, [themeMode]);

  const renderPreviewIndicator = (id: ThemeMode, isSelected: boolean) => {
    if (id === "system") {
      return (
        <View style={styles.systemSwatch}>
          <View style={styles.systemSwatchLeft} />
          <View style={styles.systemSwatchRight} />
        </View>
      );
    }

    const targetTheme = THEMES[id as keyof typeof THEMES];
    if (!targetTheme) return null;

    return (
      <View style={[styles.swatchInner, { backgroundColor: targetTheme.background }]}>
        <View style={[styles.swatchDot, { backgroundColor: targetTheme.primary }]} />
      </View>
    );
  };

  const renderSwatches = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContainer}
    >
      {THEME_OPTIONS.map((option) => {
        const isSelected = themeMode === option.id;
        return (
          <TouchableOpacity
            key={option.id}
            style={[
              styles.swatchTouch,
              isSelected && styles.swatchTouchSelected,
            ]}
            onPress={() => setThemeMode(option.id)}
            accessibilityLabel={`Select theme: ${option.name}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected }}
            activeOpacity={0.8}
          >
            {renderPreviewIndicator(option.id, isSelected)}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {!hideLabel && (
        <View style={styles.textContainer}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.subLabel}>{activeOption?.name}</Text>
        </View>
      )}

      <View style={styles.scrollWrapper}>
        {renderSwatches()}
      </View>
    </View>
  );
};

const getStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    container: {
      flexDirection: "column",
      alignItems: "stretch",
      width: "100%",
    },
    textContainer: {
      alignItems: "flex-start",
      justifyContent: "center",
      marginBottom: 12,
    },
    label: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.text,
      textAlign: "left",
    },
    subLabel: {
      fontSize: 12,
      color: theme.secondaryText,
      marginTop: 2,
      textAlign: "left",
    },
    scrollWrapper: {
      width: "100%",
      alignItems: "center",
      justifyContent: "center",
    },
    scrollContainer: {
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      paddingHorizontal: 4,
      flexGrow: 1,
    },
    swatchTouch: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: "transparent",
      justifyContent: "center",
      alignItems: "center",
    },
    swatchTouchSelected: {
      borderColor: theme.primary,
    },
    swatchInner: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      justifyContent: "center",
      alignItems: "center",
    },
    swatchDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    systemSwatch: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      flexDirection: "row",
      overflow: "hidden",
    },
    systemSwatchLeft: {
      flex: 1,
      backgroundColor: THEMES.light.background,
    },
    systemSwatchRight: {
      flex: 1,
      backgroundColor: THEMES.dark.background,
    },
  });

export default ThemeToggle;
