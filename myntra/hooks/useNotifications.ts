import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Device from "expo-device";
let Notifications: any = null;
if (Platform.OS !== "web" && typeof window !== "undefined") {
  Notifications = require("expo-notifications");
}
import Constants from "expo-constants";
import { useNotificationsContext } from "@/context/NotificationContext";
import { useAuth } from "@/context/AuthContext";

// Configure foreground notification presentation rules
if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

export const useNotifications = () => {
  const { user } = useAuth();
  const { setExpoPushToken, setLastNotification, registerDeviceToken } = useNotificationsContext();
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();

  useEffect(() => {
    if (!Notifications) return;

    // 1. Initialize and Register Device
    registerForPushNotificationsAsync()
      .then((token) => {
        if (token) {
          setExpoPushToken(token);
          registerDeviceToken(token);
        }
      })
      .catch((err) => console.error("[useNotifications] Token generation failed:", err));

    // 2. Listener for foreground notifications
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      console.log("[useNotifications] Foreground notification received:", notification);
      setLastNotification(notification);
    });

    // 3. Listener for background/interaction notifications (Taps)
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log("[useNotifications] Notification response received (tap):", response);
      // You can extract custom data and navigate to specific screens:
      const data = response.notification.request.content.data;
      handleNotificationTap(data);
    });

    // 4. Handle notification that launched the app from a terminated state
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        console.log("[useNotifications] App launched by tapping notification from terminated state:", response);
        const data = response.notification.request.content.data;
        handleNotificationTap(data);
      }
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [user?._id]);

  // Handle route navigation when a user clicks on a notification
  const handleNotificationTap = (data: any) => {
    if (!data) return;
    console.log("[useNotifications] Handling deep link / tap action with data:", data);
    // E.g., if (data.orderId) router.push(`/orders?id=${data.orderId}`)
    // If we have product details: router.push(`/product/${data.productId}`)
  };

  /**
   * Helper to request permissions and fetch Expo Push Token.
   */
  async function registerForPushNotificationsAsync() {
    if (!Notifications) return null;
    let token;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
        sound: "default",
      });
    }

    // Expo Push Notifications require a physical device or a configured emulator with Play Services
    if (Device.isDevice || Platform.OS === "android") {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        console.warn("[useNotifications] Permission not granted for push notifications!");
        return null;
      }

      // Obtain EAS Project ID
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ||
        Constants.easConfig?.projectId ||
        "f9b38ac7-9f10-4d68-8789-b6b79a4410f5";

      try {
        token = (
          await Notifications.getExpoPushTokenAsync({
            projectId,
          })
        ).data;
        console.log("[useNotifications] expoPushToken generated:", token);
      } catch (error: any) {
        console.error("[useNotifications] Error generating Expo Push Token:", error);
      }
    } else {
      console.warn("[useNotifications] Must use physical device for iOS Push Notifications");
    }

    return token;
  }
};
