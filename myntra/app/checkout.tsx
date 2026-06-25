import { useAuth } from "@/context/AuthContext";
import axios from "axios";
import API_URL from "@/constants/Api";
import { useRouter } from "expo-router";
import { CreditCard, MapPin, Truck, AlertTriangle, CheckCircle } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useTheme } from "@/hooks/useTheme";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface ValidationError {
  type: "OUT_OF_STOCK" | "DISCONTINUED" | "EMPTY_CART";
  detail: string;
  productName?: string;
}

interface ValidationWarning {
  type: "PRICE_CHANGED";
  detail: string;
  productName?: string;
  priceAtAdd?: number;
  currentPrice?: number;
}

interface CartTotals {
  itemCount: number;
  activeTotal: number;
}

const PAYMENT_METHODS = ["Card", "UPI", "Net Banking", "Wallet"];

export default function Checkout() {
  const { user } = useAuth();
  const router = useRouter();
  const { theme } = useTheme();

  // Form state
  const [address, setAddress] = useState({
    fullName: user?.name || "John Doe",
    line1: "123 Main Street",
    line2: "Apt 4B",
    city: "Bangalore",
    state: "Karnataka",
    postal: "560001",
    country: "India",
  });
  const [selectedPayment, setSelectedPayment] = useState("Card");

  // Cart state fetched from new /cart API
  const [cartTotals, setCartTotals] = useState<CartTotals | null>(null);
  const [cartVersion, setCartVersion] = useState<number>(0);
  const [loadingCart, setLoadingCart] = useState(true);

  // Validation state
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<ValidationWarning[]>([]);
  const [validated, setValidated] = useState(false);
  const [validating, setValidating] = useState(false);

  // Order placement
  const [placingOrder, setPlacingOrder] = useState(false);

  // ── Load cart totals ─────────────────────────────
  useEffect(() => {
    if (!user?._id) return;
    const load = async () => {
      try {
        setLoadingCart(true);
        const res = await axios.get(`${API_URL}/cart/${user._id}`);
        setCartTotals(res.data.totals);
        setCartVersion(res.data.cart.version);
      } catch (err) {
        console.error("Failed to load cart:", err);
      } finally {
        setLoadingCart(false);
      }
    };
    load();
  }, [user?._id]);

  // ── Run checkout validation ──────────────────────
  const runValidation = async (): Promise<boolean> => {
    if (!user?._id) return false;
    try {
      setValidating(true);
      const res = await axios.post(`${API_URL}/cart/validate`, { userId: user._id });
      const { valid, errors = [], warnings = [] } = res.data;

      setValidationErrors(errors);
      setValidationWarnings(warnings);
      setValidated(true);

      return valid;
    } catch (err: any) {
      Alert.alert("Validation Error", "Could not validate cart. Please go back and try again.");
      return false;
    } finally {
      setValidating(false);
    }
  };

  // ── Place order ──────────────────────────────────
  const handlePlaceOrder = async () => {
    if (!user) {
      router.push("/login");
      return;
    }

    // 1. Validate cart first
    const isValid = await runValidation();
    if (!isValid) {
      Alert.alert(
        "Cannot Place Order",
        "Please resolve the stock or availability issues shown below before placing your order."
      );
      return;
    }

    // 2. If price warnings exist, prompt to accept and refresh prices
    if (validationWarnings.length > 0) {
      const warnMsg = validationWarnings.map((w) => `• ${w.detail}`).join("\n");
      const accept = await new Promise<boolean>((resolve) => {
        Alert.alert(
          "Price Changes Detected",
          `Some prices in your cart have changed:\n\n${warnMsg}\n\nDo you accept these updated prices?`,
          [
            { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
            { text: "Accept & Refresh", onPress: () => resolve(true) },
          ]
        );
      });
      if (!accept) return;

      try {
        setPlacingOrder(true);
        // Refresh prices
        const refreshRes = await axios.post(`${API_URL}/cart/refresh-prices`, {
          userId: user._id,
          version: cartVersion,
        });
        setCartTotals({
          itemCount: refreshRes.data.cart.activeItems.reduce(
            (s: number, i: any) => s + i.quantity,
            0
          ),
          activeTotal: refreshRes.data.cart.activeItems.reduce((s: number, i: any) => {
            const price = i.productId?.price ?? i.priceAtAdd;
            return s + price * i.quantity;
          }, 0),
        });
        setCartVersion(refreshRes.data.cart.version);
        
        // Re-run validation to ensure clean slate
        const reVal = await runValidation();
        if (!reVal) {
          Alert.alert("Validation Failed", "Cart validation failed after refreshing prices.");
          return;
        }
      } catch (err: any) {
        const msg = err.response?.data?.message || "Failed to update prices. Please try again.";
        Alert.alert("Refresh Failed", msg);
        return;
      } finally {
        setPlacingOrder(false);
      }
    }

    // 3. Build shipping address string
    const shippingAddress = [
      address.fullName,
      address.line1,
      address.line2,
      address.city,
      address.state,
      address.postal,
      address.country,
    ]
      .filter(Boolean)
      .join(", ");

    try {
      setPlacingOrder(true);
      await axios.post(`${API_URL}/Order/create/${user._id}`, {
        shippingAddress,
        paymentMethod: selectedPayment,
      });
      router.replace("/orders");
    } catch (err: any) {
      const msg = err.response?.data?.message || "Failed to place order. Please try again.";
      Alert.alert("Order Failed", msg);
    } finally {
      setPlacingOrder(false);
    }
  };

  // ─────────────────────────────────────────────
  // Render guard
  // ─────────────────────────────────────────────
  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Checkout</Text>
        </View>
        <View style={styles.center}>
          <Text style={{ color: theme.secondaryText }}>Please login to checkout.</Text>
          <TouchableOpacity
            style={[styles.placeOrderButton, { backgroundColor: theme.primary, marginTop: 16 }]}
            onPress={() => router.push("/login")}
          >
            <Text style={styles.placeOrderButtonText}>LOGIN</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backBtnText, { color: theme.primary }]}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Checkout</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 24 }}>

        {/* Validation Banner */}
        {validated && validationErrors.length > 0 && (
          <View style={[styles.validationBanner, { backgroundColor: "#fee2e2", borderColor: "#ef4444" }]}>
            <AlertTriangle size={18} color="#ef4444" />
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>Cannot place order:</Text>
              {validationErrors.map((e, i) => (
                <Text key={i} style={styles.bannerItem}>• {e.detail}</Text>
              ))}
            </View>
          </View>
        )}

        {validated && validationErrors.length === 0 && (
          <View style={[styles.validationBanner, { backgroundColor: "#dcfce7", borderColor: "#22c55e" }]}>
            <CheckCircle size={18} color="#22c55e" />
            <Text style={styles.bannerSuccess}>Cart validated — ready to order!</Text>
          </View>
        )}

        {validated && validationWarnings.length > 0 && (
          <View style={[styles.validationBanner, { backgroundColor: "#fef9c3", borderColor: "#eab308" }]}>
            <AlertTriangle size={18} color="#eab308" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.bannerTitle, { color: "#854d0e" }]}>Price changes:</Text>
              {validationWarnings.map((w, i) => (
                <Text key={i} style={[styles.bannerItem, { color: "#854d0e" }]}>• {w.detail}</Text>
              ))}
            </View>
          </View>
        )}

        {/* Shipping Address Section */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <View style={styles.sectionHeader}>
            <MapPin size={22} color={theme.primary} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Shipping Address</Text>
          </View>
          <View style={styles.form}>
            {[
              { label: "Full Name", key: "fullName" },
              { label: "Address Line 1", key: "line1" },
              { label: "Address Line 2 (Optional)", key: "line2" },
            ].map(({ label, key }) => (
              <TextInput
                key={key}
                style={[styles.input, { backgroundColor: theme.surface, color: theme.text }]}
                placeholder={label}
                placeholderTextColor={theme.secondaryText}
                value={(address as any)[key]}
                onChangeText={(v) => setAddress((a) => ({ ...a, [key]: v }))}
              />
            ))}
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.halfInput, { backgroundColor: theme.surface, color: theme.text }]}
                placeholder="City"
                placeholderTextColor={theme.secondaryText}
                value={address.city}
                onChangeText={(v) => setAddress((a) => ({ ...a, city: v }))}
              />
              <TextInput
                style={[styles.input, styles.halfInput, { backgroundColor: theme.surface, color: theme.text }]}
                placeholder="State"
                placeholderTextColor={theme.secondaryText}
                value={address.state}
                onChangeText={(v) => setAddress((a) => ({ ...a, state: v }))}
              />
            </View>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.halfInput, { backgroundColor: theme.surface, color: theme.text }]}
                placeholder="Postal Code"
                placeholderTextColor={theme.secondaryText}
                value={address.postal}
                keyboardType="numeric"
                onChangeText={(v) => setAddress((a) => ({ ...a, postal: v }))}
              />
              <TextInput
                style={[styles.input, styles.halfInput, { backgroundColor: theme.surface, color: theme.text }]}
                placeholder="Country"
                placeholderTextColor={theme.secondaryText}
                value={address.country}
                onChangeText={(v) => setAddress((a) => ({ ...a, country: v }))}
              />
            </View>
          </View>
        </View>

        {/* Payment Section */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <View style={styles.sectionHeader}>
            <CreditCard size={22} color={theme.primary} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Payment Method</Text>
          </View>
          <View style={styles.paymentOptions}>
            {PAYMENT_METHODS.map((method) => (
              <TouchableOpacity
                key={method}
                style={[
                  styles.paymentOption,
                  { borderColor: selectedPayment === method ? theme.primary : theme.border },
                  selectedPayment === method && { backgroundColor: `${theme.primary}15` },
                ]}
                onPress={() => setSelectedPayment(method)}
              >
                <View
                  style={[
                    styles.radioCircle,
                    { borderColor: selectedPayment === method ? theme.primary : theme.secondaryText },
                  ]}
                >
                  {selectedPayment === method && (
                    <View style={[styles.radioFill, { backgroundColor: theme.primary }]} />
                  )}
                </View>
                <Text style={[styles.paymentLabel, { color: theme.text }]}>{method}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Order Summary */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <View style={styles.sectionHeader}>
            <Truck size={22} color={theme.primary} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Order Summary</Text>
          </View>
          {loadingCart ? (
            <ActivityIndicator color={theme.primary} />
          ) : (
            <View style={styles.summary}>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: theme.secondaryText }]}>
                  Subtotal ({cartTotals?.itemCount ?? 0} items)
                </Text>
                <Text style={[styles.summaryValue, { color: theme.text }]}>
                  ₹{cartTotals?.activeTotal ?? 0}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: theme.secondaryText }]}>Shipping</Text>
                <Text style={[styles.summaryValue, { color: "#22c55e" }]}>FREE</Text>
              </View>
              <View style={[styles.summaryRow, styles.totalRow, { borderTopColor: theme.border }]}>
                <Text style={[styles.totalLabel, { color: theme.text }]}>Total</Text>
                <Text style={[styles.totalValue, { color: theme.primary }]}>
                  ₹{cartTotals?.activeTotal ?? 0}
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Footer CTA */}
      <View style={[styles.footer, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
        <TouchableOpacity
          style={[
            styles.placeOrderButton,
            { backgroundColor: placingOrder || validating ? theme.secondaryText : theme.primary },
          ]}
          onPress={handlePlaceOrder}
          disabled={placingOrder || validating}
        >
          {placingOrder || validating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.placeOrderButtonText}>
              {validating ? "VALIDATING…" : "PLACE ORDER"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  header: {
    paddingTop: 52,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: { paddingRight: 6 },
  backBtnText: { fontSize: 18 },
  headerTitle: { fontSize: 22, fontWeight: "bold" },

  content: { flex: 1, padding: 14 },

  validationBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 14,
  },
  bannerTitle: { fontWeight: "700", fontSize: 14, color: "#b91c1c", marginBottom: 4 },
  bannerItem: { fontSize: 13, color: "#b91c1c" },
  bannerSuccess: { fontSize: 14, fontWeight: "600", color: "#166534" },

  section: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 17, fontWeight: "bold" },

  form: { gap: 0 },
  input: {
    padding: 13,
    borderRadius: 8,
    fontSize: 15,
    marginBottom: 10,
  },
  row: { flexDirection: "row", gap: 10 },
  halfInput: { flex: 1 },

  paymentOptions: { gap: 8 },
  paymentOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  radioFill: { width: 10, height: 10, borderRadius: 5 },
  paymentLabel: { fontSize: 15, fontWeight: "500" },

  summary: { gap: 10 },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  summaryLabel: { fontSize: 15 },
  summaryValue: { fontSize: 15, fontWeight: "600" },
  totalRow: {
    borderTopWidth: 1,
    marginTop: 6,
    paddingTop: 10,
  },
  totalLabel: { fontSize: 17, fontWeight: "bold" },
  totalValue: { fontSize: 19, fontWeight: "bold" },

  footer: {
    padding: 14,
    borderTopWidth: 1,
  },
  placeOrderButton: {
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  placeOrderButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});
