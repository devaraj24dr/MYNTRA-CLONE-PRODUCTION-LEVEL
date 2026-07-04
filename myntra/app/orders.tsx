import { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Package,
  ChevronRight,
  MapPin,
  Truck,
  Clock,
  Calendar,
  CreditCard,
} from "lucide-react-native";
import React from "react";
import axios from "axios";
import API_URL from "@/constants/Api";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { ThemeColors } from "@/types/theme";

export default function Orders() {
  const router = useRouter();
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const [orders, setorder] = useState<any>(null);
  const { theme } = useTheme();

  const styles = useMemo(() => getStyles(theme), [theme]);

  useEffect(() => {
    const fetchorder = async () => {
      if (user) {
        try {
          setIsLoading(true);
          const product = await axios.get(
            `${API_URL}/order/user/${user._id}`
          );
          setorder(product.data);
        } catch (error) {
          console.log(error);
          setIsLoading(false);
        } finally {
          setIsLoading(false);
        }
      }
    };
    fetchorder();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const toggleOrderDetails = (orderId: string) => {
    setExpandedOrder(expandedOrder === orderId ? null : orderId);
  };

  if (!orders) {
    return (
      <View style={styles.container}>
        <Text style={styles.notFoundText}>Order not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Orders</Text>
      </View>

      <ScrollView style={styles.content}>
        {orders.map((order: any) => (
          <View key={order._id} style={styles.orderCard}>
            <TouchableOpacity
              style={styles.orderHeader}
              onPress={() => toggleOrderDetails(order._id)}
            >
              <View>
                <Text style={styles.orderId}>Order #{String(order._id).slice(-8).toUpperCase()}</Text>
                <Text style={styles.orderDate}>{new Date(order.date).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}</Text>
              </View>
              <View style={styles.statusContainer}>
                <Package size={16} color={theme.success} />
                <Text style={styles.orderStatus}>{order.status}</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.itemsContainer}>
              {order.items.map((item: any) => {
                const prod = item.productId; // may be null if product was deleted
                return (
                  <View key={item._id} style={styles.orderItem}>
                    {prod?.images?.[0] ? (
                      <Image
                        source={{ uri: prod.images[0] }}
                        style={styles.itemImage}
                      />
                    ) : (
                      <View style={[styles.itemImage, styles.imagePlaceholder]}>
                        <Text style={styles.placeholderText}>No Image</Text>
                      </View>
                    )}
                    <View style={styles.itemInfo}>
                      <Text style={styles.brandName}>{prod?.brand ?? 'Unknown Brand'}</Text>
                      <Text style={styles.itemName}>{prod?.name ?? 'Deleted Product'}</Text>
                      <Text style={styles.itemSize}>Size: {item.size}  ×{item.quantity}</Text>
                      <Text style={styles.itemPrice}>₹{item.price ?? prod?.price ?? 0}</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {expandedOrder === order._id && (
              <View style={styles.orderDetails}>
                <View style={styles.detailSection}>
                  <View style={styles.detailHeader}>
                    <MapPin size={20} color={theme.text} />
                    <Text style={styles.detailTitle}>Shipping Address</Text>
                  </View>
                  <Text style={styles.detailText}>{order.shippingAddress}</Text>
                </View>

                <View style={styles.detailSection}>
                  <View style={styles.detailHeader}>
                    <CreditCard size={20} color={theme.text} />
                    <Text style={styles.detailTitle}>Payment Method</Text>
                  </View>
                  <Text style={styles.detailText}>{order.paymentMethod}</Text>
                </View>

                <View style={styles.detailSection}>
                  <View style={styles.detailHeader}>
                    <Truck size={20} color={theme.text} />
                    <Text style={styles.detailTitle}>Tracking Information</Text>
                  </View>
                  <View style={styles.trackingInfo}>
                    <Text style={styles.trackingText}>
                      Tracking Number: {order.tracking.number}
                    </Text>
                    <Text style={styles.trackingText}>
                      Carrier: {order.tracking.carrier}
                    </Text>
                  </View>

                  <View style={styles.timeline}>
                    {order.tracking.timeline.map((event: any, index: any) => (
                      <View key={index} style={styles.timelineEvent}>
                        <View style={styles.timelinePoint} />
                        <View style={styles.timelineContent}>
                          <Text style={styles.timelineStatus}>
                            {event.status}
                          </Text>
                          <Text style={styles.timelineLocation}>
                            {event.location}
                          </Text>
                          <Text style={styles.timelineTimestamp}>
                            {event.timestamp}
                          </Text>
                        </View>
                        {index !== order.tracking.timeline.length - 1 && (
                          <View style={styles.timelineLine} />
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            )}

            <View style={styles.orderFooter}>
              <View style={styles.totalContainer}>
                <Text style={styles.totalLabel}>Order Total</Text>
                <Text style={styles.totalAmount}>₹{order.total}</Text>
              </View>
              <TouchableOpacity
                style={styles.detailsButton}
                onPress={() => toggleOrderDetails(order._id)}
              >
                <Text style={styles.detailsButtonText}>
                  {expandedOrder === order._id ? "Hide Details" : "View Details"}
                </Text>
                <ChevronRight size={20} color={theme.primary} />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const getStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    loaderContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
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
    notFoundText: {
      color: theme.text,
      textAlign: "center",
      marginTop: 40,
    },
    content: {
      flex: 1,
      padding: 15,
    },
    orderCard: {
      backgroundColor: theme.card,
      borderRadius: 10,
      marginBottom: 15,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.05,
      shadowRadius: 3.84,
      elevation: 3,
      overflow: "hidden",
    },
    orderHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 15,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    orderId: {
      fontSize: 16,
      fontWeight: "bold",
      color: theme.text,
    },
    orderDate: {
      fontSize: 14,
      color: theme.secondaryText,
      marginTop: 2,
    },
    statusContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.success + "15",
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 15,
    },
    orderStatus: {
      fontSize: 14,
      color: theme.success,
      marginLeft: 5,
      fontWeight: "500",
    },
    itemsContainer: {
      padding: 15,
    },
    orderItem: {
      flexDirection: "row",
      marginBottom: 15,
    },
    itemImage: {
      width: 80,
      height: 100,
      borderRadius: 8,
      resizeMode: "cover",
    },
    imagePlaceholder: {
      backgroundColor: theme.surface,
      justifyContent: "center",
      alignItems: "center",
    },
    placeholderText: {
      fontSize: 10,
      color: theme.secondaryText,
    },
    itemInfo: {
      flex: 1,
      marginLeft: 15,
    },
    brandName: {
      fontSize: 13,
      color: theme.secondaryText,
      marginBottom: 2,
      fontWeight: "600",
    },
    itemName: {
      fontSize: 15,
      color: theme.text,
      marginBottom: 4,
      fontWeight: "500",
    },
    itemSize: {
      fontSize: 12,
      color: theme.secondaryText,
      marginBottom: 4,
    },
    itemPrice: {
      fontSize: 16,
      fontWeight: "bold",
      color: theme.primary,
    },
    orderDetails: {
      padding: 15,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    detailSection: {
      marginBottom: 20,
    },
    detailHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 10,
      gap: 10,
    },
    detailTitle: {
      fontSize: 16,
      fontWeight: "bold",
      color: theme.text,
    },
    detailText: {
      fontSize: 14,
      color: theme.secondaryText,
      lineHeight: 20,
    },
    trackingInfo: {
      marginBottom: 15,
    },
    trackingText: {
      fontSize: 14,
      color: theme.secondaryText,
      marginBottom: 5,
    },
    timeline: {
      marginTop: 15,
    },
    timelineEvent: {
      flexDirection: "row",
      marginBottom: 20,
      position: "relative",
    },
    timelinePoint: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: theme.primary,
      marginTop: 5,
      zIndex: 1,
    },
    timelineLine: {
      position: "absolute",
      left: 5,
      top: 17,
      width: 2,
      height: "100%",
      backgroundColor: theme.divider,
    },
    timelineContent: {
      marginLeft: 15,
      flex: 1,
    },
    timelineStatus: {
      fontSize: 14,
      fontWeight: "bold",
      color: theme.text,
      marginBottom: 2,
    },
    timelineLocation: {
      fontSize: 14,
      color: theme.secondaryText,
      marginBottom: 2,
    },
    timelineTimestamp: {
      fontSize: 12,
      color: theme.secondaryText,
    },
    orderFooter: {
      padding: 15,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    totalContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    },
    totalLabel: {
      fontSize: 16,
      color: theme.secondaryText,
    },
    totalAmount: {
      fontSize: 18,
      fontWeight: "bold",
      color: theme.text,
    },
    detailsButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
    },
    detailsButtonText: {
      fontSize: 16,
      color: theme.primary,
      marginRight: 5,
      fontWeight: "600",
    },
  });

