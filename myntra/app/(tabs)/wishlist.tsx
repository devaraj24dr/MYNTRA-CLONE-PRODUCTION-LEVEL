import { useAuth } from "@/context/AuthContext";
import axios from "axios";
import API_URL from "@/constants/Api";
import { useRouter } from "expo-router";
import { Heart, Trash2 } from "lucide-react-native";
import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
} from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { ThemeColors } from "@/types/theme";

export default function Wishlist() {
  const router = useRouter();
  const { user } = useAuth();
  const [wishlist, setwishlist] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { theme } = useTheme();

  const styles = useMemo(() => getStyles(theme), [theme]);

  useEffect(() => {
    fetchproduct();
  }, [user]);

  const fetchproduct = async () => {
    if (user) {
      try {
        setIsLoading(true);
        const bag = await axios.get(
          `${API_URL}/wishlist/${user._id}`
        );
        setwishlist(bag.data);
      } catch (error) {
        console.log(error);
        setIsLoading(false);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handledelete = async (itemid: any) => {
    try {
      await axios.delete(`${API_URL}/wishlist/${itemid}`);
      fetchproduct();
    } catch (error) {
      console.log(error);
    }
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Wishlist</Text>
        </View>
        <View style={styles.emptyState}>
          <Heart size={64} color={theme.primary} />
          <Text style={styles.emptyTitle}>
            Please login to view your wishlist
          </Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push("/login")}
          >
            <Text style={styles.loginButtonText}>LOGIN</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Wishlist</Text>
      </View>

      <ScrollView style={styles.content}>
        {wishlist?.filter((item: any) => item.productId).map((item: any) => (
          <View key={item._id} style={styles.wishlistItem}>
            <TouchableOpacity
              style={styles.itemTapArea}
              onPress={() => router.push({ pathname: "/product/[id]", params: { id: item.productId._id } })}
            >
              <Image source={{ uri: item.productId.images?.[0] || "" }} style={styles.itemImage} />
              <View style={styles.itemInfo}>
                <Text style={styles.brandName}>{item.productId.brand}</Text>
                <Text style={styles.itemName}>{item.productId.name}</Text>
                <View style={styles.priceContainer}>
                  <Text style={styles.price}>{item.productId.price}</Text>
                  <Text style={styles.discount}>{item.productId.discount}</Text>
                </View>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.removeButton} onPress={() => handledelete(item._id)}>
              <Trash2 size={24} color={theme.primary} />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const getStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    loaderContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.background,
    },
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      padding: 15,
      paddingTop: 50,
      backgroundColor: theme.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: "bold",
      color: theme.text,
    },
    content: {
      flex: 1,
      padding: 15,
    },
    emptyState: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    emptyTitle: {
      fontSize: 18,
      color: theme.text,
      marginTop: 20,
      marginBottom: 20,
    },
    loginButton: {
      backgroundColor: theme.primary,
      paddingHorizontal: 40,
      paddingVertical: 15,
      borderRadius: 10,
    },
    loginButtonText: {
      color: theme.textOnPrimary,
      fontSize: 16,
      fontWeight: "bold",
    },
    wishlistItem: {
      flexDirection: "row",
      backgroundColor: theme.card,
      borderRadius: 10,
      marginBottom: 15,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 3.84,
      elevation: 3,
      overflow: "hidden",
    },
    itemTapArea: {
      flexDirection: "row",
      flex: 1,
    },
    itemImage: {
      width: 100,
      height: 120,
      resizeMode: "cover",
    },
    itemInfo: {
      flex: 1,
      padding: 15,
    },
    brandName: {
      fontSize: 14,
      color: theme.secondaryText,
      marginBottom: 5,
    },
    itemName: {
      fontSize: 16,
      color: theme.text,
      marginBottom: 10,
    },
    priceContainer: {
      flexDirection: "row",
      alignItems: "center",
    },
    price: {
      fontSize: 16,
      fontWeight: "bold",
      color: theme.text,
      marginRight: 10,
    },
    discount: {
      fontSize: 14,
      color: theme.primary,
    },
    removeButton: {
      padding: 15,
      justifyContent: "center",
    },
  });
