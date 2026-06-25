import React from "react";
import { TouchableOpacity, Text, StyleSheet, View } from "react-native";
import { Sun, Moon } from "lucide-react-native";
import { useTheme } from "../hooks/useTheme";

export const ThemeToggle: React.FC = () => {
  const { theme, currentTheme, toggleTheme } = useTheme();

  return (
    <TouchableOpacity
      onPress={toggleTheme}
      style={[
        styles.container,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
      accessibilityLabel={`Switch theme. Current theme is ${currentTheme}`}
      accessibilityRole="button"
      activeOpacity={0.7}
    >
      <View style={styles.iconContainer}>
        {currentTheme === "light" ? (
          <Sun size={20} color={theme.primary} />
        ) : (
          <Moon size={20} color={theme.primary} />
        )}
      </View>
      <Text style={[styles.text, { color: theme.text }]}>
        {currentTheme === "light" ? "Light Mode" : "Dark Mode"}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  iconContainer: {
    marginRight: 8,
  },
  text: {
    fontSize: 14,
    fontWeight: "600",
  },
});
export default ThemeToggle;
