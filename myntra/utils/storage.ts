import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

// Web fallback using localStorage since expo-secure-store only works on native
const storage = {
  async setItemAsync(key: string, value: string) {
    if (Platform.OS === "web") {
      localStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  },
  async getItemAsync(key: string): Promise<string | null> {
    if (Platform.OS === "web") {
      return localStorage.getItem(key);
    } else {
      return await SecureStore.getItemAsync(key);
    }
  },
  async deleteItemAsync(key: string) {
    if (Platform.OS === "web") {
      localStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  },
};

export const saveUserData = async (
  _id: string,
  name: string,
  email: string
) => {
  await storage.setItemAsync("userid", _id);
  await storage.setItemAsync("userName", name);
  await storage.setItemAsync("userEmail", email);
};

export const getUserData = async () => {
  const _id = await storage.getItemAsync("userid");
  const name = await storage.getItemAsync("userName");
  const email = await storage.getItemAsync("userEmail");
  return { _id, name, email };
};

export const clearUserData = async () => {
  await storage.deleteItemAsync("userid");
  await storage.deleteItemAsync("userName");
  await storage.deleteItemAsync("userEmail");
};
