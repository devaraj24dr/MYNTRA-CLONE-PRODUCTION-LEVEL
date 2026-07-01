import { useTheme } from "@/hooks/useTheme";
import { ThemeColors } from "@/types/theme";

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof ThemeColors
) {
  const { currentTheme, theme } = useTheme();
  const isDark = currentTheme === "dark" || currentTheme === "amoled" || currentTheme.endsWith("_dark");
  const activePropMode = isDark ? "dark" : "light";
  const colorFromProps = props[activePropMode];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return theme[colorName];
  }
}
