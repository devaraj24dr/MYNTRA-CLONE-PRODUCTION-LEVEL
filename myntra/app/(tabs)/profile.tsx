import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import {
  User,
  Package,
  Heart,
  CreditCard,
  MapPin,
  Settings,
  LogOut,
  ChevronRight,
} from "lucide-react-native";
import React from "react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import ThemeToggle from "@/components/ThemeToggle";

const menuItems = [
  { icon: Package, label: "Orders", route: "/orders" },
  { icon: Heart, label: "Wishlist", route: "/wishlist" },
  { icon: CreditCard, label: "Transaction History", route: "/transactions" },
  { icon: MapPin, label: "Addresses", route: "/addresses" },
  { icon: Settings, label: "Settings", route: "/settings" },
];

export default function Profile() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { theme } = useTheme();

  const handleLogout = () => {
    logout();
    router.replace("/");
  };

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Profile</Text>
        </View>
        <View style={styles.emptyState}>
          <User size={64} color={theme.primary} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            Please login to view your profile
          </Text>
          <TouchableOpacity
            style={[styles.loginButton, { backgroundColor: theme.primary }]}
            onPress={() => router.push("/login")}
          >
            <Text style={styles.loginButtonText}>LOGIN</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Profile</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={[styles.userInfo, { backgroundColor: theme.card }]}>
          <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
            <User size={40} color="#fff" />
          </View>
          <View style={styles.userDetails}>
            <Text style={[styles.userName, { color: theme.text }]}>{user.name}</Text>
            <Text style={[styles.userEmail, { color: theme.secondaryText }]}>{user.email}</Text>
          </View>
        </View>

        <View style={styles.menuSection}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.menuItem, { backgroundColor: theme.card, borderBottomColor: theme.border }]}
              onPress={() => router.push(item.route as any)}
            >
              <View style={styles.menuItemLeft}>
                <item.icon size={24} color={theme.text} />
                <Text style={[styles.menuItemLabel, { color: theme.text }]}>{item.label}</Text>
              </View>
              <ChevronRight size={24} color={theme.text} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.themeSection, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.themeLabel, { color: theme.text }]}>Dark Mode preference</Text>
          <ThemeToggle />
        </View>

        <TouchableOpacity 
          style={[styles.logoutButton, { backgroundColor: theme.card, borderColor: theme.primary }]} 
          onPress={handleLogout}
        >
          <LogOut size={24} color={theme.primary} />
          <Text style={[styles.logoutText, { color: theme.primary }]}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 15,
    paddingTop: 50,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
  },
  content: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyTitle: {
    fontSize: 18,
    marginTop: 20,
    marginBottom: 20,
  },
  loginButton: {
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 10,
  },
  loginButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  userDetails: {
    marginLeft: 15,
  },
  userName: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 5,
  },
  userEmail: {
    fontSize: 14,
  },
  menuSection: {
    marginTop: 20,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 15,
    borderBottomWidth: 1,
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  menuItemLabel: {
    fontSize: 16,
    marginLeft: 15,
  },
  themeSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 15,
    marginTop: 20,
    borderWidth: 1,
    borderLeftWidth: 0,
    borderRightWidth: 0,
  },
  themeLabel: {
    fontSize: 16,
    fontWeight: "500",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 15,
    marginTop: 20,
    marginHorizontal: 15,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 30,
  },
  logoutText: {
    marginLeft: 10,
    fontSize: 16,
    fontWeight: "bold",
  },
});
