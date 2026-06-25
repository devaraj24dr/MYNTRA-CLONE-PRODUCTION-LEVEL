import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Heart, ShoppingBag } from "lucide-react-native";
import React from "react";
import { useAuth } from "@/context/AuthContext";
import axios from "axios";
import API_URL from "@/constants/Api";
import { useTheme } from "@/hooks/useTheme";
import { addRecentlyViewed } from "@/utils/recentlyViewed";

export default function ProductDetails() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [selectedSize, setSelectedSize] = useState("");
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const autoScrollTimer = useRef<NodeJS.Timeout>();
  const { user } = useAuth();
  const [product, setproduct] = useState<any>(null);
  const [iswishlist, setiswishlist] = useState(false);
  const [similarProducts, setSimilarProducts] = useState<any[]>([]);
  const [isSimilarLoading, setIsSimilarLoading] = useState(false);
  const { theme, currentTheme } = useTheme();

  useEffect(() => {
    const fetchproduct = async () => {
      try {
        setIsLoading(true);
        const productResponse = await axios.get(
          `${API_URL}/product/${id}`
        );
        const productData = productResponse.data;
        setproduct(productData);
        if (productData) {
          addRecentlyViewed(productData, user?._id).catch((err) =>
            console.error("Error adding to recently viewed:", err)
          );

          // Log product view in recommendation engine
          if (user?._id) {
            axios.post(`${API_URL}/recommendations/view`, {
              userId: user._id,
              productId: productData._id,
            }).catch((err) => console.log("Error logging view history:", err));

            // Check if product is already wishlisted
            axios.get(`${API_URL}/wishlist/${user._id}`)
              .then((res) => {
                const already = res.data.some(
                  (w: any) => w.productId?._id?.toString() === productData._id?.toString()
                );
                setiswishlist(already);
              })
              .catch(() => {});
          }

          // Fetch similar products
          fetchSimilarProducts();
        }
      } catch (error) {
        console.log(error);
        setIsLoading(false);
      } finally {
        setIsLoading(false);
      }
    };
    fetchproduct();
  }, [id, user?._id]);

  const fetchSimilarProducts = async () => {
    try {
      setIsSimilarLoading(true);
      const res = await axios.get(`${API_URL}/recommendations/similar/${id}?userId=${user?._id || ""}&limit=4`);
      setSimilarProducts(res.data || []);
      
      // Track impressions for similar products
      if (user?._id && res.data && res.data.length > 0) {
        res.data.forEach((item: any) => {
          axios.post(`${API_URL}/recommendations/analytics`, {
            userId: user._id,
            recommendationId: item._id,
            clicked: false
          }).catch(err => console.log("Analytics impression error:", err));
        });
      }
    } catch (err) {
      console.log("Error fetching similar products:", err);
    } finally {
      setIsSimilarLoading(false);
    }
  };

  const handleSimilarPress = async (productId: string) => {
    if (user?._id) {
      axios.post(`${API_URL}/recommendations/analytics`, {
        userId: user._id,
        recommendationId: productId,
        clicked: true
      }).catch(err => console.log("Analytics click error:", err));
    }
    router.push(`/product/${productId}`);
  };

  useEffect(() => {
    // Start auto-scroll
    startAutoScroll();

    return () => {
      if (autoScrollTimer.current) {
        clearInterval(autoScrollTimer.current);
      }
    };
  }, [product]);

  const startAutoScroll = () => {
    if (autoScrollTimer.current) {
      clearInterval(autoScrollTimer.current);
    }
    autoScrollTimer.current = setInterval(() => {
      if (product && product.images && product.images.length > 0 && scrollViewRef.current) {
        const nextIndex = (currentImageIndex + 1) % product.images.length;
        scrollViewRef.current.scrollTo({
          x: nextIndex * width,
          animated: true,
        });
        setCurrentImageIndex(nextIndex);
      }
    }, 3000);
  };

  if (isLoading) {
    return (
      <View style={[styles.loaderContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: theme.text }}>Product not found</Text>
      </View>
    );
  }

  const handleAddwishlist = async () => {
    if (!user) {
      router.push("/login");
      return;
    }

    try {
      const res = await axios.post(`${API_URL}/wishlist`, {
        userId: user._id,
        productId: id,
      });
      if (res.data.removed) {
        setiswishlist(false);
      } else {
        setiswishlist(true);
        router.push("/(tabs)/wishlist");
      }
    } catch (error: any) {
      console.log("Wishlist error:", error?.response?.data || error?.message);
    }
  };

  const handleAddToBag = async () => {
    if (!user) {
      router.push("/login");
      return;
    }

    if (!selectedSize) {
      alert("Please select a size");
      return;
    }
    try {
      setLoading(true);
      await axios.post(`${API_URL}/bag`, {
        userId: user._id,
        productId: id,
        size: selectedSize,
        quantity: 1,
      });
      router.push("/(tabs)/bag");
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  const handleScroll = (event: any) => {
    const contentOffset = event.nativeEvent.contentOffset;
    const imageIndex = Math.round(contentOffset.x / width);
    setCurrentImageIndex(imageIndex);

    // Reset auto-scroll timer when user manually scrolls
    if (autoScrollTimer.current) {
      clearInterval(autoScrollTimer.current);
      startAutoScroll();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView>
        <View style={styles.carouselContainer}>
          <ScrollView
            ref={scrollViewRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
            {product.images.map((image: any, index: any) => (
              <Image
                key={index}
                source={{ uri: image }}
                style={[styles.productImage, { width }]}
                resizeMode="cover"
              />
            ))}
          </ScrollView>
          <View style={styles.pagination}>
            {product.images.map((_: any, index: any) => (
              <View
                key={index}
                style={[
                  styles.paginationDot,
                  currentImageIndex === index && styles.paginationDotActive,
                ]}
              />
            ))}
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.header}>
            <View>
              <Text style={[styles.brand, { color: theme.secondaryText }]}>{product.brand}</Text>
              <Text style={[styles.name, { color: theme.text }]}>{product.name}</Text>
            </View>
            <TouchableOpacity
              style={styles.wishlistButton}
              onPress={handleAddwishlist}
            >
              <Heart
                size={24}
                color={iswishlist ? theme.primary : theme.secondaryText}
                fill={iswishlist ? theme.primary : "none"}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.priceContainer}>
            <Text style={[styles.price, { color: theme.text }]}>₹{product.price}</Text>
            <Text style={[styles.discount, { color: theme.primary }]}>{product.discount}</Text>
          </View>

          <Text style={[styles.description, { color: theme.secondaryText }]}>{product.description}</Text>

          <View style={styles.sizeSection}>
            <Text style={[styles.sizeTitle, { color: theme.text }]}>Select Size</Text>
            <View style={styles.sizeGrid}>
              {product.sizes.map((size: any) => (
                <TouchableOpacity
                  key={size}
                  style={[
                    styles.sizeButton,
                    { borderColor: theme.border },
                    selectedSize === size && { borderColor: theme.primary, backgroundColor: currentTheme === "dark" ? "#2a151b" : "#fff4f4" },
                  ]}
                  onPress={() => setSelectedSize(size)}
                >
                  <Text
                    style={[
                      styles.sizeText,
                      { color: theme.text },
                      selectedSize === size && { color: theme.primary },
                    ]}
                  >
                    {size}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Similar Products Section */}
          <View style={styles.similarSection}>
            <Text style={[styles.similarTitle, { color: theme.text }]}>Similar Products</Text>
            {isSimilarLoading ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : similarProducts.length === 0 ? (
              <Text style={{ color: theme.secondaryText }}>No similar products available</Text>
            ) : (
              <View style={styles.similarGrid}>
                {similarProducts.map((item: any, idx: number) => (
                  <TouchableOpacity
                    key={`${item._id}-${idx}`}
                    style={[styles.similarCard, { backgroundColor: theme.card }]}
                    onPress={() => handleSimilarPress(item._id)}
                  >
                    <Image source={{ uri: item.images?.[0] }} style={styles.similarImage} />
                    <View style={styles.similarInfo}>
                      <Text style={[styles.similarBrand, { color: theme.text }]} numberOfLines={1}>{item.brand}</Text>
                      <Text style={[styles.similarName, { color: theme.secondaryText }]} numberOfLines={1}>{item.name}</Text>
                      <Text style={[styles.similarPrice, { color: theme.text }]}>₹{item.price}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
        <TouchableOpacity
          style={styles.addToBagButton}
          onPress={handleAddToBag}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <ShoppingBag size={20} color="#fff" />
              <Text style={styles.addToBagText}>ADD TO BAG</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  carouselContainer: {
    position: "relative",
  },
  productImage: {
    height: 400,
  },
  pagination: {
    position: "absolute",
    bottom: 16,
    flexDirection: "row",
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: "#fff",
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  content: {
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  brand: {
    fontSize: 16,
    marginBottom: 5,
  },
  name: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
  },
  wishlistButton: {
    padding: 10,
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  price: {
    fontSize: 20,
    fontWeight: "bold",
    marginRight: 10,
  },
  discount: {
    fontSize: 16,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
  },
  sizeSection: {
    marginBottom: 20,
  },
  sizeTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
  },
  sizeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  sizeButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  sizeText: {
    fontSize: 16,
  },
  similarSection: {
    marginTop: 25,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    paddingTop: 20,
  },
  similarTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
  },
  similarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  similarCard: {
    width: "48%",
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#f0f0f0",
    paddingBottom: 10,
  },
  similarImage: {
    width: "100%",
    height: 150,
  },
  similarInfo: {
    padding: 10,
  },
  similarBrand: {
    fontSize: 12,
    fontWeight: "bold",
  },
  similarName: {
    fontSize: 11,
    marginTop: 2,
  },
  similarPrice: {
    fontSize: 12,
    fontWeight: "bold",
    marginTop: 5,
  },
  footer: {
    padding: 15,
    borderTopWidth: 1,
  },
  addToBagButton: {
    backgroundColor: "#ff3f6c",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    padding: 15,
    borderRadius: 10,
    gap: 10,
  },
  addToBagText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
