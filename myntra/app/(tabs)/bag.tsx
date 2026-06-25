import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import {
  ShoppingBag,
  Minus,
  Plus,
  Trash2,
  Bookmark,
  ShoppingCart,
  AlertTriangle,
  RefreshCw,
} from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import axios from "axios";
import API_URL from "@/constants/Api";
import { useTheme } from "@/hooks/useTheme";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface CartItem {
  _id: string;
  productId: {
    _id: string;
    name: string;
    brand: string;
    price: number;
    images: string[];
    stock: number;
    isActive: boolean;
  };
  size: string;
  quantity: number;
  priceAtAdd: number;
}

interface Cart {
  _id: string;
  version: number;
  activeItems: CartItem[];
  savedItems: CartItem[];
}

interface Totals {
  itemCount: number;
  activeTotal: number;
  savedCount: number;
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
export default function Bag() {
  const router = useRouter();
  const { user } = useAuth();
  const { theme, currentTheme } = useTheme();

  const [cart, setCart] = useState<Cart | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"cart" | "saved">("cart");

  // ── Fetch cart ──────────────────────────────
  const fetchCart = useCallback(async () => {
    if (!user?._id) return;
    try {
      setIsLoading(true);
      const res = await axios.get(`${API_URL}/cart/${user._id}`);
      setCart(res.data.cart);
      setTotals(res.data.totals);
    } catch (err) {
      console.error("Failed to fetch cart:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user?._id]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  // ── Conflict handler: sync server cart and alert user ───────────
  const handleConflict = useCallback(
    (serverCart: Cart) => {
      setCart(serverCart);
      setTotals({
        itemCount: serverCart.activeItems.reduce(
          (s: number, i: CartItem) => s + i.quantity,
          0
        ),
        activeTotal: serverCart.activeItems.reduce((s: number, i: CartItem) => {
          const price = i.productId?.price ?? i.priceAtAdd;
          return s + price * i.quantity;
        }, 0),
        savedCount: serverCart.savedItems.length,
      });
      Alert.alert(
        "Cart Updated",
        "Your cart was updated from another device. Changes have been synced.",
        [{ text: "OK" }]
      );
    },
    []
  );

  // ── Generic mutation helper ─────────────────
  const cartMutation = useCallback(
    async (
      method: "post" | "put" | "delete",
      path: string,
      payload: object,
      itemId: string
    ) => {
      if (!cart) return;
      setUpdatingItemId(itemId);
      try {
        const url = `${API_URL}/cart/${path}`;
        const data = {
          ...payload,
          userId: user!._id,
          version: cart.version,
        };
        const res = method === "delete"
          ? await axios.delete(url, { data })
          : await axios[method](url, data);
        setCart(res.data.cart);
        setTotals({
          itemCount: res.data.cart.activeItems.reduce(
            (s: number, i: CartItem) => s + i.quantity,
            0
          ),
          activeTotal: res.data.cart.activeItems.reduce((s: number, i: CartItem) => {
            const price = i.productId?.price ?? i.priceAtAdd;
            return s + price * i.quantity;
          }, 0),
          savedCount: res.data.cart.savedItems.length,
        });
      } catch (err: any) {
        if (err.response?.status === 409) {
          handleConflict(err.response.data.serverCart);
        } else {
          Alert.alert("Error", err.response?.data?.error || "Something went wrong");
        }
      } finally {
        setUpdatingItemId(null);
      }
    },
    [cart, user, handleConflict]
  );

  // ── Refresh Live Prices ──────────────────────
  const handleRefreshPrices = async () => {
    if (!user || !cart) return;
    try {
      setIsLoading(true);
      const res = await axios.post(`${API_URL}/cart/refresh-prices`, {
        userId: user._id,
        version: Math.max(cart.version, 0),
      });
      setCart(res.data.cart);
      setTotals({
        itemCount: res.data.cart.activeItems.reduce(
          (s: number, i: CartItem) => s + i.quantity,
          0
        ),
        activeTotal: res.data.cart.activeItems.reduce((s: number, i: CartItem) => {
          const price = i.productId?.price ?? i.priceAtAdd;
          return s + price * i.quantity;
        }, 0),
        savedCount: res.data.cart.savedItems.length,
      });
      Alert.alert("Prices Refreshed", "Prices have been updated to the latest catalog rates.");
    } catch (err: any) {
      if (err.response?.status === 409) {
        handleConflict(err.response.data.serverCart);
      } else {
        Alert.alert("Error", err.response?.data?.error || "Could not refresh prices");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ── Cart actions ────────────────────────────
  const handleUpdateQuantity = (item: CartItem, delta: number) => {
    const newQty = item.quantity + delta;
    cartMutation("put", "update", { itemId: item._id, quantity: newQty }, item._id);
  };

  const handleRemove = (item: CartItem) => {
    cartMutation("delete", "remove", { itemId: item._id }, item._id);
  };

  const handleSaveForLater = (item: CartItem) => {
    cartMutation("post", "save-for-later", { itemId: item._id }, item._id);
  };

  const handleMoveToCart = (item: CartItem) => {
    cartMutation("post", "move-to-cart", { savedItemId: item._id }, item._id);
  };

  const handleRemoveSaved = (item: CartItem) => {
    cartMutation("delete", "remove", { itemId: item._id }, item._id);
  };

  // ── Checkout ────────────────────────────────
  const handleCheckout = async () => {
    if (!user || !cart) return;
    try {
      const res = await axios.post(`${API_URL}/cart/validate`, { userId: user._id });
      const { valid, errors, warnings } = res.data;

      if (!valid) {
        const errorMessages = errors.map((e: any) => `• ${e.detail}`).join("\n");
        Alert.alert("Cannot Checkout", `Please resolve the following:\n\n${errorMessages}`);
        return;
      }

      if (warnings.length > 0) {
        const warnMessages = warnings.map((w: any) => `• ${w.detail}`).join("\n");
        Alert.alert(
          "Price Changed",
          `Some prices in your bag have changed:\n\n${warnMessages}\n\nYou must refresh your bag before placing the order.`,
          [
            { text: "Cancel", style: "cancel" },
            { text: "Refresh Prices", onPress: handleRefreshPrices },
          ]
        );
      } else {
        router.push("/checkout");
      }
    } catch (err: any) {
      Alert.alert("Error", "Could not validate cart. Please try again.");
    }
  };

  // ─────────────────────────────────────────────
  // Guards
  // ─────────────────────────────────────────────
  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Shopping Bag</Text>
        </View>
        <View style={styles.emptyState}>
          <ShoppingBag size={64} color={theme.primary} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            Please login to view your bag
          </Text>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
            onPress={() => router.push("/login")}
          >
            <Text style={styles.primaryButtonText}>LOGIN</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.loaderContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.secondaryText }]}>
          Loading your cart…
        </Text>
      </View>
    );
  }

  const activeItems = cart?.activeItems ?? [];
  const savedItems = cart?.savedItems ?? [];
  const isCartEmpty = activeItems.length === 0;
  const isSavedEmpty = savedItems.length === 0;

  // ─────────────────────────────────────────────
  // Renderers
  // ─────────────────────────────────────────────
  const renderCartItem = (item: CartItem) => {
    const isUpdating = updatingItemId === item._id;
    const currentPrice = item.productId?.price ?? item.priceAtAdd;
    const priceChanged = currentPrice !== item.priceAtAdd;

    return (
      <View
        key={item._id}
        style={[
          styles.cartItem,
          {
            backgroundColor: theme.card,
            shadowColor: currentTheme === "dark" ? "#000" : "#ccc",
          },
        ]}
      >
        <Image
          source={{ uri: item.productId?.images?.[0] }}
          style={styles.itemImage}
        />
        <View style={styles.itemContent}>
          <Text style={[styles.brandName, { color: theme.secondaryText }]}>
            {item.productId?.brand}
          </Text>
          <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={2}>
            {item.productId?.name}
          </Text>
          <Text style={[styles.itemSize, { color: theme.secondaryText }]}>
            Size: {item.size}
          </Text>

          {/* Price row — highlight if changed */}
          <View style={styles.priceRow}>
            <Text style={[styles.itemPrice, { color: theme.text }]}>
              ₹{currentPrice}
            </Text>
            {priceChanged && (
              <View style={styles.priceChangedBadge}>
                <AlertTriangle size={10} color="#fff" />
                <Text style={styles.priceChangedText}>
                  Was ₹{item.priceAtAdd}
                </Text>
              </View>
            )}
          </View>

          {/* Quantity controls */}
          <View style={styles.actionsRow}>
            <View style={[styles.qtyControl, { backgroundColor: theme.surface }]}>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => handleUpdateQuantity(item, -1)}
                disabled={isUpdating || item.quantity <= 1}
              >
                <Minus
                  size={16}
                  color={item.quantity <= 1 ? theme.secondaryText : theme.text}
                />
              </TouchableOpacity>
              {isUpdating ? (
                <ActivityIndicator size="small" color={theme.primary} style={styles.qtyLoader} />
              ) : (
                <Text style={[styles.qtyText, { color: theme.text }]}>
                  {item.quantity}
                </Text>
              )}
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => handleUpdateQuantity(item, 1)}
                disabled={isUpdating || item.quantity >= 10}
              >
                <Plus
                  size={16}
                  color={item.quantity >= 10 ? theme.secondaryText : theme.text}
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => handleSaveForLater(item)}
              disabled={isUpdating}
            >
              <Bookmark size={18} color={theme.primary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => handleRemove(item)}
              disabled={isUpdating}
            >
              <Trash2 size={18} color={theme.error ?? "#dc3545"} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderSavedItem = (item: CartItem) => {
    const isUpdating = updatingItemId === item._id;
    const currentPrice = item.productId?.price ?? item.priceAtAdd;

    return (
      <View
        key={item._id}
        style={[
          styles.cartItem,
          {
            backgroundColor: theme.card,
            shadowColor: currentTheme === "dark" ? "#000" : "#ccc",
          },
        ]}
      >
        <Image
          source={{ uri: item.productId?.images?.[0] }}
          style={styles.itemImage}
        />
        <View style={styles.itemContent}>
          <Text style={[styles.brandName, { color: theme.secondaryText }]}>
            {item.productId?.brand}
          </Text>
          <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={2}>
            {item.productId?.name}
          </Text>
          <Text style={[styles.itemSize, { color: theme.secondaryText }]}>
            Size: {item.size} · Qty: {item.quantity}
          </Text>
          <Text style={[styles.itemPrice, { color: theme.text }]}>₹{currentPrice}</Text>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.moveBtn, { backgroundColor: theme.primary }]}
              onPress={() => handleMoveToCart(item)}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <ShoppingCart size={14} color="#fff" />
                  <Text style={styles.moveBtnText}>Move to Cart</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => handleRemoveSaved(item)}
              disabled={isUpdating}
            >
              <Trash2 size={18} color={theme.error ?? "#dc3545"} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Shopping Bag</Text>
        {cart && (
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={handleRefreshPrices} style={styles.refreshIconBtn} title="Sync Prices">
              <RefreshCw size={18} color={theme.primary} />
            </TouchableOpacity>
            <Text style={[styles.headerSub, { color: theme.secondaryText }]}>
              {totals?.itemCount ?? 0} item{(totals?.itemCount ?? 0) !== 1 ? "s" : ""}
            </Text>
          </View>
        )}
      </View>

      {/* Tab switcher */}
      <View style={[styles.tabBar, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "cart" && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveTab("cart")}
        >
          <Text style={[styles.tabText, { color: activeTab === "cart" ? theme.primary : theme.secondaryText }]}>
            Cart ({activeItems.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "saved" && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveTab("saved")}
        >
          <Text style={[styles.tabText, { color: activeTab === "saved" ? theme.primary : theme.secondaryText }]}>
            Saved ({savedItems.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {activeTab === "cart" ? (
          isCartEmpty ? (
            <View style={styles.emptyState}>
              <ShoppingBag size={64} color={theme.secondaryText} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Your cart is empty</Text>
              <Text style={[styles.emptySubtitle, { color: theme.secondaryText }]}>
                Add items to get started
              </Text>
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: theme.primary }]}
                onPress={() => router.push("/")}
              >
                <Text style={styles.primaryButtonText}>SHOP NOW</Text>
              </TouchableOpacity>
            </View>
          ) : (
            activeItems.map(renderCartItem)
          )
        ) : isSavedEmpty ? (
          <View style={styles.emptyState}>
            <Bookmark size={64} color={theme.secondaryText} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No saved items</Text>
            <Text style={[styles.emptySubtitle, { color: theme.secondaryText }]}>
              Save items to buy later
            </Text>
          </View>
        ) : (
          savedItems.map(renderSavedItem)
        )}
      </ScrollView>

      {/* Footer — only shown on cart tab with items */}
      {activeTab === "cart" && !isCartEmpty && (
        <View style={[styles.footer, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
          {/* Price summary */}
          <View style={[styles.priceSummary, { borderColor: theme.border }]}>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: theme.secondaryText }]}>
                Subtotal ({totals?.itemCount ?? 0} items)
              </Text>
              <Text style={[styles.summaryValue, { color: theme.text }]}>
                ₹{totals?.activeTotal ?? 0}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: theme.secondaryText }]}>Delivery</Text>
              <Text style={[styles.deliveryFree, { color: "#198754" }]}>FREE</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <View style={styles.summaryRow}>
              <Text style={[styles.totalLabel, { color: theme.text }]}>Total</Text>
              <Text style={[styles.totalAmount, { color: theme.text }]}>
                ₹{totals?.activeTotal ?? 0}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.checkoutButton, { backgroundColor: theme.primary }]}
            onPress={handleCheckout}
          >
            <Text style={styles.checkoutButtonText}>PLACE ORDER</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  loaderContainer: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText: { fontSize: 14 },

  header: {
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 14,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  headerTitle: { fontSize: 22, fontWeight: "bold" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  refreshIconBtn: { padding: 4 },
  headerSub: { fontSize: 14 },

  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  tabText: { fontSize: 14, fontWeight: "600" },

  content: { flex: 1 },
  contentContainer: { padding: 14 },

  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: { fontSize: 18, fontWeight: "600" },
  emptySubtitle: { fontSize: 14 },

  primaryButton: {
    paddingHorizontal: 36,
    paddingVertical: 13,
    borderRadius: 8,
    marginTop: 8,
  },
  primaryButtonText: { color: "#fff", fontSize: 15, fontWeight: "bold" },

  cartItem: {
    flexDirection: "row",
    borderRadius: 12,
    marginBottom: 14,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    overflow: "hidden",
  },
  itemImage: { width: 110, height: 130 },
  itemContent: { flex: 1, padding: 12 },

  brandName: { fontSize: 12, marginBottom: 2 },
  itemName: { fontSize: 15, fontWeight: "600", marginBottom: 3 },
  itemSize: { fontSize: 12, marginBottom: 6 },

  priceRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  itemPrice: { fontSize: 16, fontWeight: "bold" },
  priceChangedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#f59e0b",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priceChangedText: { color: "#fff", fontSize: 10, fontWeight: "600" },

  actionsRow: { flexDirection: "row", alignItems: "center", gap: 10 },

  qtyControl: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    paddingHorizontal: 4,
    height: 34,
  },
  qtyBtn: { padding: 6 },
  qtyLoader: { width: 36 },
  qtyText: { fontSize: 15, fontWeight: "600", minWidth: 24, textAlign: "center" },

  iconBtn: { padding: 6 },

  moveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 7,
  },
  moveBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },

  footer: {
    padding: 14,
    borderTopWidth: 1,
  },
  priceSummary: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryLabel: { fontSize: 14 },
  summaryValue: { fontSize: 14, fontWeight: "600" },
  deliveryFree: { fontSize: 14, fontWeight: "600" },
  divider: { height: 1, marginVertical: 4 },
  totalLabel: { fontSize: 16, fontWeight: "bold" },
  totalAmount: { fontSize: 18, fontWeight: "bold" },

  checkoutButton: {
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  checkoutButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});
