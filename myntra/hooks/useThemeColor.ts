import { useTheme } from "@/hooks/useTheme";
import { ThemeColors } from "@/types/theme";

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof ThemeColors
) {
  const { currentTheme, theme } = useTheme();
  const colorFromProps = props[currentTheme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return theme[colorName];
  }
}
