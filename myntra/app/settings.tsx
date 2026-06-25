import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Switch,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Clipboard,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import {
  ChevronLeft,
  Bell,
  Package,
  Heart,
  Tag,
  Clock,
  Smartphone,
  Copy,
  Sparkles,
  Send,
  Zap,
} from "lucide-react-native";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useNotificationsContext } from "@/context/NotificationContext";
import axios from "axios";
import API_URL from "@/constants/Api";

export default function SettingsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { preferences, isLoading, updatePreferences, expoPushToken } = useNotificationsContext();
  const [debugLoading, setDebugLoading] = useState<string | null>(null);

  const handleTogglePreference = async (key: "orderUpdates" | "promotions" | "priceDrops" | "cartReminders") => {
    const currentValue = preferences[key];
    await updatePreferences({ [key]: !currentValue });
  };

  const handleCopyToken = () => {
    if (expoPushToken) {
      Clipboard.setString(expoPushToken);
      Alert.alert("Success", "Expo Push Token copied to clipboard!");
    } else {
      Alert.alert("Error", "Push Token not available");
    }
  };

  const triggerTestNotification = async (type: string) => {
    if (!expoPushToken) {
      Alert.alert("Error", "No Expo Push Token found. Please check notification permissions.");
      return;
    }

    setDebugLoading(type);
    try {
      let endpoint = `${API_URL}/notifications/send`;
      let payload: any = {
        userId: user?._id || null,
        title: "",
        body: "",
        eventType: "",
        data: {
          token: expoPushToken,
        },
      };

      switch (type) {
        case "order_placed":
          payload.title = "🛍️ Order Confirmed!";
          payload.body = "Thank you! Your order for 'Roadster Men Casual Shirt' has been successfully received.";
          payload.eventType = "Order Placed";
          payload.data.orderId = "ord_102948";
          break;
        case "order_shipped":
          payload.title = "🚚 Order Shipped!";
          payload.body = "Your package has been handed to our delivery partner. Track delivery details inside.";
          payload.eventType = "Order Shipped";
          payload.data.orderId = "ord_102948";
          break;
        case "price_drop":
          payload.title = "📉 Price Drop Alert!";
          payload.body = "Hurry! An item in your Wishlist: 'Levis 501 Original Fit Jeans' has dropped by ₹400!";
          payload.eventType = "Wishlist Price Drop";
          payload.data.productId = "prod_9876";
          break;
        case "back_in_stock":
          payload.title = "⚡ Back In Stock!";
          payload.body = "The 'Puma Roadster Running Shoes' you viewed are back in stock. Buy before they sell out!";
          payload.eventType = "Back In Stock";
          payload.data.productId = "prod_1234";
          break;
        case "flash_sales":
          payload.title = "🔥 Flash Sale Alert!";
          payload.body = "Flat 50% Off on select jackets and winter wear! Live for the next 2 hours only.";
          payload.eventType = "Flash Sales";
          break;
        case "cart_reminder":
          endpoint = `${API_URL}/notifications/schedule`;
          payload.title = "🛒 Still thinking about it?";
          payload.body = "We saved your items. Complete checkout now to secure the Roadster T-Shirt before it sells out.";
          payload.eventType = "Cart Abandonment";
          // Schedule for 10 seconds in the future
          payload.runAt = new Date(Date.now() + 10000).toISOString();
          break;
        default:
          return;
      }

      const res = await axios.post(endpoint, payload);
      if (res.data.success) {
        if (type === "cart_reminder") {
          Alert.alert(
            "Scheduled Successfully",
            "Cart Abandonment reminder scheduled for 10 seconds from now. Feel free to minimize/close the app to test background delivery!"
          );
        } else {
          Alert.alert(
            "Notification Queued",
            "Notification dispatched to Job Queue. The background worker should deliver it in a few seconds."
          );
        }
      }
    } catch (error: any) {
      console.error("Error triggering notification:", error);
      Alert.alert(
        "Failed",
        error.response?.data?.error || "Failed to communicate with notification service."
      );
    } finally {
      setDebugLoading(null);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Notification Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* User Preferences Section */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.secondaryText }]}>USER PREFERENCES</Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {/* Order Updates */}
          <View style={[styles.row, { borderBottomColor: theme.border }]}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconWrapper, { backgroundColor: "#E6F4EA" }]}>
                <Package size={20} color="#137333" />
              </View>
              <View style={styles.labelWrapper}>
                <Text style={[styles.label, { color: theme.text }]}>Order Updates</Text>
                <Text style={[styles.subLabel, { color: theme.secondaryText }]}>Confirmations, shipping, and delivery notifications</Text>
              </View>
            </View>
            <Switch
              value={preferences.orderUpdates}
              onValueChange={() => handleTogglePreference("orderUpdates")}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor={Platform.OS === "android" ? "#fff" : undefined}
            />
          </View>

          {/* Promotions */}
          <View style={[styles.row, { borderBottomColor: theme.border }]}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconWrapper, { backgroundColor: "#FEF7E0" }]}>
                <Zap size={20} color="#B06000" />
              </View>
              <View style={styles.labelWrapper}>
                <Text style={[styles.label, { color: theme.text }]}>Promotions & Sales</Text>
                <Text style={[styles.subLabel, { color: theme.secondaryText }]}>Flash sales, coupons, and personalized offers</Text>
              </View>
            </View>
            <Switch
              value={preferences.promotions}
              onValueChange={() => handleTogglePreference("promotions")}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor={Platform.OS === "android" ? "#fff" : undefined}
            />
          </View>

          {/* Price Drops */}
          <View style={[styles.row, { borderBottomColor: theme.border }]}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconWrapper, { backgroundColor: "#FCE8E6" }]}>
                <Tag size={20} color="#C5221F" />
              </View>
              <View style={styles.labelWrapper}>
                <Text style={[styles.label, { color: theme.text }]}>Wishlist Price Drops</Text>
                <Text style={[styles.subLabel, { color: theme.secondaryText }]}>Alerts when items in your wishlist drop in price</Text>
              </View>
            </View>
            <Switch
              value={preferences.priceDrops}
              onValueChange={() => handleTogglePreference("priceDrops")}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor={Platform.OS === "android" ? "#fff" : undefined}
            />
          </View>

          {/* Cart Reminders */}
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconWrapper, { backgroundColor: "#E8F0FE" }]}>
                <Clock size={20} color="#1A73E8" />
              </View>
              <View style={styles.labelWrapper}>
                <Text style={[styles.label, { color: theme.text }]}>Cart Reminders</Text>
                <Text style={[styles.subLabel, { color: theme.secondaryText }]}>Reminders about items left behind in your shopping bag</Text>
              </View>
            </View>
            <Switch
              value={preferences.cartReminders}
              onValueChange={() => handleTogglePreference("cartReminders")}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor={Platform.OS === "android" ? "#fff" : undefined}
            />
          </View>
        </View>

        {/* Device Registration Section */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.secondaryText }]}>DEVICE STATUS</Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.deviceRow}>
            <Smartphone size={24} color={theme.text} />
            <View style={styles.deviceDetails}>
              <Text style={[styles.deviceLabel, { color: theme.text }]}>Expo Push Token</Text>
              <Text
                style={[styles.deviceTokenText, { color: theme.secondaryText }]}
                numberOfLines={1}
                ellipsizeMode="middle"
              >
                {expoPushToken || "Fetching or permissions disabled..."}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.copyButton, { borderColor: theme.primary }]}
              onPress={handleCopyToken}
              disabled={!expoPushToken}
            >
              <Copy size={16} color={theme.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Debug Dashboard */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.secondaryText }]}>DEVELOPER TESTING DASHBOARD</Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, marginBottom: 40 }]}>
          <View style={styles.debugInfo}>
            <Sparkles size={18} color={theme.primary} />
            <Text style={[styles.debugInfoText, { color: theme.secondaryText }]}>
              Trigger mock notification events to test device state handling, queue retries, and rate limits.
            </Text>
          </View>

          {/* Test Buttons */}
          <View style={styles.btnGrid}>
            <TouchableOpacity
              style={[styles.debugButton, { backgroundColor: theme.surface }]}
              onPress={() => triggerTestNotification("order_placed")}
              disabled={debugLoading !== null}
            >
              {debugLoading === "order_placed" ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <>
                  <Package size={16} color={theme.text} style={styles.btnIcon} />
                  <Text style={[styles.debugButtonText, { color: theme.text }]}>Order Placed</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.debugButton, { backgroundColor: theme.surface }]}
              onPress={() => triggerTestNotification("order_shipped")}
              disabled={debugLoading !== null}
            >
              {debugLoading === "order_shipped" ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <>
                  <Send size={16} color={theme.text} style={styles.btnIcon} />
                  <Text style={[styles.debugButtonText, { color: theme.text }]}>Order Shipped</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.debugButton, { backgroundColor: theme.surface }]}
              onPress={() => triggerTestNotification("price_drop")}
              disabled={debugLoading !== null}
            >
              {debugLoading === "price_drop" ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <>
                  <Tag size={16} color={theme.text} style={styles.btnIcon} />
                  <Text style={[styles.debugButtonText, { color: theme.text }]}>Price Drop</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.debugButton, { backgroundColor: theme.surface }]}
              onPress={() => triggerTestNotification("back_in_stock")}
              disabled={debugLoading !== null}
            >
              {debugLoading === "back_in_stock" ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <>
                  <Bell size={16} color={theme.text} style={styles.btnIcon} />
                  <Text style={[styles.debugButtonText, { color: theme.text }]}>Back In Stock</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.debugButton, { backgroundColor: theme.surface }]}
              onPress={() => triggerTestNotification("flash_sales")}
              disabled={debugLoading !== null}
            >
              {debugLoading === "flash_sales" ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <>
                  <Zap size={16} color={theme.text} style={styles.btnIcon} />
                  <Text style={[styles.debugButtonText, { color: theme.text }]}>Flash Sale</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.debugButton, { backgroundColor: theme.surface }]}
              onPress={() => triggerTestNotification("cart_reminder")}
              disabled={debugLoading !== null}
            >
              {debugLoading === "cart_reminder" ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <>
                  <Clock size={16} color={theme.text} style={styles.btnIcon} />
                  <Text style={[styles.debugButtonText, { color: theme.text }]}>Cart Reminder (10s)</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 15,
    paddingTop: 50,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  content: {
    flex: 1,
    paddingHorizontal: 15,
  },
  sectionHeader: {
    marginTop: 25,
    marginBottom: 8,
    paddingLeft: 5,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    padding: 15,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  labelWrapper: {
    flex: 1,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
  },
  subLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  deviceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  deviceDetails: {
    flex: 1,
    marginLeft: 15,
    marginRight: 10,
  },
  deviceLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  deviceTokenText: {
    fontSize: 11,
    marginTop: 3,
  },
  copyButton: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  debugInfo: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 15,
  },
  debugInfoText: {
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  btnGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  debugButton: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  btnIcon: {
    marginRight: 8,
  },
  debugButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
});
