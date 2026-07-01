import { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import React from "react";
import { Eye, EyeOff } from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { ThemeColors } from "@/types/theme";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isloading, setisloading] = useState(false);
  const { width } = useWindowDimensions();
  const { theme } = useTheme();

  const styles = useMemo(() => getStyles(theme), [theme]);
  const isDesktop = width > 768;

  const handleLogin = async () => {
    try {
      setisloading(true);
      await login(email, password);
      router.replace("/(tabs)");
    } catch (error) {
      console.error(error);
    } finally {
      setisloading(false);
    }
  };

  return (
    <View style={[styles.container, isDesktop && styles.desktopContainer]}>
      <Image
        source={{
          uri: "https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&w=2070&auto=format&fit=crop",
        }}
        style={[styles.backgroundImage, isDesktop && styles.desktopImage]}
        resizeMode="cover"
      />
      <View style={[styles.formContainer, isDesktop && styles.desktopFormContainer]}>
        <View style={isDesktop ? styles.desktopFormContent : null}>
          <Text style={styles.title}>Welcome to Myntra</Text>
          <Text style={styles.subtitle}>Login to continue shopping</Text>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={theme.secondaryText}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Password"
              placeholderTextColor={theme.secondaryText}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff size={20} color={theme.secondaryText} />
              ) : (
                <Eye size={20} color={theme.secondaryText} />
              )}
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.button}
            onPress={handleLogin}
            disabled={isloading}
          >
            {isloading ? (
              <ActivityIndicator color={theme.textOnPrimary} />
            ) : (
              <Text style={styles.buttonText}>LOGIN</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.signupLink}
            onPress={() => router.push("/signup")}
          >
            <Text style={styles.signupText}>Don't have an account? Sign Up</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const getStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    desktopContainer: {
      flexDirection: "row",
      alignItems: "stretch",
    },
    backgroundImage: {
      width: "100%",
      height: "50%",
      position: "absolute",
      top: 0,
    },
    desktopImage: {
      position: "relative",
      width: "55%",
      height: "100%",
    },
    formContainer: {
      flex: 1,
      justifyContent: "center",
      padding: 20,
      backgroundColor: theme.card + "E6", // 90% opacity overlay
      marginTop: "60%",
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
    },
    desktopFormContainer: {
      width: "45%",
      marginTop: 0,
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      backgroundColor: theme.card,
      padding: 60,
      alignItems: "center",
    },
    desktopFormContent: {
      width: "100%",
      maxWidth: 400,
    },
    title: {
      fontSize: 28,
      fontWeight: "bold",
      marginBottom: 10,
      color: theme.text,
    },
    subtitle: {
      fontSize: 16,
      color: theme.secondaryText,
      marginBottom: 30,
    },
    input: {
      backgroundColor: theme.surface,
      padding: 15,
      borderRadius: 10,
      marginBottom: 15,
      fontSize: 16,
      color: theme.text,
    },
    passwordContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.surface,
      borderRadius: 10,
      marginBottom: 15,
    },
    passwordInput: {
      flex: 1,
      padding: 15,
      fontSize: 16,
      color: theme.text,
    },
    eyeIcon: {
      padding: 15,
    },
    button: {
      backgroundColor: theme.primary,
      padding: 15,
      borderRadius: 10,
      alignItems: "center",
      marginTop: 10,
    },
    buttonText: {
      color: theme.textOnPrimary,
      fontSize: 16,
      fontWeight: "bold",
    },
    signupLink: {
      marginTop: 20,
      alignItems: "center",
    },
    signupText: {
      color: theme.primary,
      fontSize: 16,
    },
  });

