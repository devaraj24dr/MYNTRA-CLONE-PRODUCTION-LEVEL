import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";
import API_URL from "@/constants/Api";
import { useAuth } from "./AuthContext";
import { Platform } from "react-native";

let Notifications: any = null;
if (Platform.OS !== "web" && typeof window !== "undefined") {
  Notifications = require("expo-notifications");
}

export interface UserNotificationPreferences {
  orderUpdates: boolean;
  promotions: boolean;
  priceDrops: boolean;
  cartReminders: boolean;
}

interface NotificationContextType {
  expoPushToken: string | null;
  lastNotification: any;
  preferences: UserNotificationPreferences;
  isLoading: boolean;
  setExpoPushToken: (token: string | null) => void;
  setLastNotification: (notification: any) => void;
  updatePreferences: (newPreferences: Partial<UserNotificationPreferences>) => Promise<void>;
  fetchPreferences: () => Promise<void>;
  registerDeviceToken: (token: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [lastNotification, setLastNotification] = useState<Notifications.Notification | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [preferences, setPreferences] = useState<UserNotificationPreferences>({
    orderUpdates: true,
    promotions: true,
    priceDrops: true,
    cartReminders: true,
  });

  // Fetch preferences whenever user changes
  useEffect(() => {
    if (user?._id) {
      fetchPreferences();
    }
  }, [user?._id]);

  // Sync token to backend if user changes after we already have a token
  useEffect(() => {
    if (expoPushToken) {
      registerDeviceToken(expoPushToken);
    }
  }, [user?._id]);

  const fetchPreferences = async () => {
    if (!user?._id) return;
    try {
      const res = await axios.get(`${API_URL}/notifications/preferences`, {
        params: { userId: user._id },
      });
      if (res.data.success) {
        setPreferences(res.data.preferences);
      }
    } catch (error) {
      console.error("Error fetching notification preferences:", error);
    }
  };

  const updatePreferences = async (newPrefs: Partial<UserNotificationPreferences>) => {
    if (!user?._id) return;
    setIsLoading(true);
    try {
      const updatedPrefs = { ...preferences, ...newPrefs };
      const res = await axios.put(`${API_URL}/notifications/preferences`, {
        userId: user._id,
        preferences: updatedPrefs,
      });
      if (res.data.success) {
        setPreferences(res.data.preferences);
      }
    } catch (error) {
      console.error("Error updating notification preferences:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const registerDeviceToken = async (token: string) => {
    try {
      await axios.post(`${API_URL}/notifications/register`, {
        token,
        deviceType: "android", // Fallback, will be detailed by expo-device
        userId: user?._id || null,
      });
      console.log("Registered Expo push token to MongoDB successfully:", token);
    } catch (error) {
      console.error("Failed to register Expo push token to backend:", error);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        expoPushToken,
        lastNotification,
        preferences,
        isLoading,
        setExpoPushToken,
        setLastNotification,
        updatePreferences,
        fetchPreferences,
        registerDeviceToken,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotificationsContext = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotificationsContext must be used within a NotificationProvider");
  }
  return context;
};
