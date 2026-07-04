import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
  StatusBar,
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
  Bell,
} from "lucide-react-native";
import React from "react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import ThemeToggle from "@/components/ThemeToggle";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&auto=format&fit=crop";

const MENU_GROUPS = [
  [
    { icon: Package,     label: "My Orders",          route: "/orders" },
    { icon: Heart,       label: "Wishlist",            route: "/wishlist" },
  ],
  [
    { icon: CreditCard,  label: "Transaction History", route: "/transactions" },
    { icon: MapPin,      label: "Addresses",           route: "/addresses" },
    { icon: Bell,        label: "Notifications",       route: "/settings" },
    { icon: Settings,    label: "Settings",            route: "/settings" },
  ],
];

export default function Profile() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { theme } = useTheme();

  const handleLogout = () => {
    logout();
    router.replace("/");
  };

  const initials = user?.name
    ? user.name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.plainHeader, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <Text style={[styles.plainHeaderTitle, { color: theme.text }]}>Profile</Text>
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
      <StatusBar barStyle="light-content" />

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Hero Banner ── */}
        <ImageBackground
          source={{ uri: HERO_IMAGE }}
          style={styles.hero}
          imageStyle={styles.heroImage}
        >
          {/* Dark overlay for readability */}
          <View style={styles.heroOverlay} />

          {/* Avatar — sits at the bottom of the hero */}
          <View style={styles.heroContent}>
            <View style={[styles.avatar, { backgroundColor: theme.primary, borderColor: "#fff" }]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <Text style={styles.heroName}>{user.name}</Text>
            <Text style={styles.heroTagline}>
              Shop smart. Look brilliant.
            </Text>
          </View>
        </ImageBackground>

        {/* Email pill */}
        <View style={[styles.emailRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <User size={14} color={theme.secondaryText} />
          <Text style={[styles.emailText, { color: theme.secondaryText }]}>{user.email}</Text>
        </View>

        {/* ── Menu Groups ── */}
        {MENU_GROUPS.map((group, gi) => (
          <View
            key={gi}
            style={[styles.menuCard, { backgroundColor: theme.card, borderColor: theme.border }]}
          >
            {group.map((item, idx) => (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.menuRow,
                  idx < group.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border },
                ]}
                onPress={() => router.push(item.route as any)}
                activeOpacity={0.7}
              >
                <View style={styles.menuRowLeft}>
                  <View style={[styles.menuIconBox, { backgroundColor: theme.surface }]}>
                    <item.icon size={18} color={theme.primary} />
                  </View>
                  <Text style={[styles.menuLabel, { color: theme.text }]}>{item.label}</Text>
                </View>
                <ChevronRight size={18} color={theme.secondaryText} />
              </TouchableOpacity>
            ))}
          </View>
        ))}

        {/* ── Theme Picker ── */}
        <View style={[styles.menuCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.themeHeader}>
            <Text style={[styles.menuLabel, { color: theme.text }]}>Theme Mode</Text>
          </View>
          <ThemeToggle label="" />
        </View>

        {/* ── Logout ── */}
        <TouchableOpacity
          style={[styles.logoutBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <LogOut size={18} color="#e53935" />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },

  // Not-logged-in header
  plainHeader: {
    padding: 15,
    paddingTop: 50,
    borderBottomWidth: 1,
  },
  plainHeaderTitle: { fontSize: 24, fontWeight: "bold" },

  // Empty / not logged in
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    gap: 16,
  },
  emptyTitle: { fontSize: 18, textAlign: "center" },
  loginButton: {
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 10,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
  },

  // Hero
  hero: {
    width: "100%",
    height: 260,
    justifyContent: "flex-end",
  },
  heroImage: {
    resizeMode: "cover",
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  heroContent: {
    alignItems: "center",
    paddingBottom: 32,
    gap: 6,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  avatarText: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 1,
  },
  heroName: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  heroTagline: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    fontStyle: "italic",
  },

  // Email row
  emailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    marginBottom: 16,
  },
  emailText: { fontSize: 13 },

  // Menu cards
  menuCard: {
    marginHorizontal: 14,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  menuIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: "500",
  },

  // Theme section
  themeHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
  },

  // Logout
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginHorizontal: 14,
    marginTop: 4,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#e53935",
  },
});
