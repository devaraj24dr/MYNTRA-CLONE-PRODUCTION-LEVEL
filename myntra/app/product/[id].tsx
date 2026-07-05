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
import { Heart, ShoppingBag, Bookmark } from "lucide-react-native";
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
  const imageWidth = Math.min(width, 500);
  const [selectedSize, setSelectedSize] = useState("");
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const autoScrollTimer = useRef<NodeJS.Timeout>();
  const { user } = useAuth();
  const [product, setproduct] = useState<any>(null);
  const [iswishlist, setiswishlist] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
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
          x: nextIndex * imageWidth,
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

  const handleSaveProduct = async () => {
    if (!user) {
      router.push("/login");
      return;
    }
    if (!selectedSize) {
      alert("Please select a size first");
      return;
    }
    try {
      setSaveLoading(true);
      const res = await axios.post(`${API_URL}/cart/save-direct`, {
        userId: user._id,
        productId: id,
        size: selectedSize,
      });
      if (res.data.alreadySaved) {
        alert("This item is already in your Saved list!");
      } else {
        setIsSaved(true);
        alert("Saved for later! Find it in your Bag → Saved items.");
      }
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Failed to save product. Please try again.";
      alert(msg);
    } finally {
      setSaveLoading(false);
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

      // Step 1: Fetch the current cart version to avoid optimistic-lock conflicts
      let currentVersion = 0;
      try {
        const cartRes = await axios.get(`${API_URL}/cart/${user._id}`);
        currentVersion = cartRes.data?.cart?.version ?? 0;
      } catch {
        // If cart doesn't exist yet, version 0 is correct
        currentVersion = 0;
      }

      // Step 2: Add item using the correct server version
      await axios.post(`${API_URL}/cart/add`, {
        userId: user._id,
        productId: id,
        size: selectedSize,
        quantity: 1,
        version: currentVersion,
      });

      router.push("/(tabs)/bag");
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Failed to add item to bag. Please try again.";
      alert(msg);
      console.log("Add to bag error:", error?.response?.data || error);
    } finally {
      setLoading(false);
    }
  };

  const handleScroll = (event: any) => {
    const contentOffset = event.nativeEvent.contentOffset;
    const imageIndex = Math.round(contentOffset.x / imageWidth);
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
                style={[styles.productImage, { width: imageWidth }]}
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
                  { backgroundColor: theme.text + "50" },
                  currentImageIndex === index && [
                    styles.paginationDotActive,
                    { backgroundColor: theme.text },
                  ],
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
                    selectedSize === size && { borderColor: theme.primary, backgroundColor: theme.primary + "15" },
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
          <View style={[styles.similarSection, { borderTopColor: theme.border }]}>
            <Text style={[styles.similarTitle, { color: theme.text }]}>Similar Products</Text>
            {isSimilarLoading ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : similarProducts.length === 0 ? (
              <Text style={{ color: theme.secondaryText }}>No similar products available</Text>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.similarScroll}
              >
                {similarProducts.map((item: any, idx: number) => (
                  <TouchableOpacity
                    key={`${item._id}-${idx}`}
                    style={[styles.similarCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                    onPress={() => handleSimilarPress(item._id)}
                  >
                    <Image source={{ uri: item.images?.[0] }} style={styles.similarImage} />
                    <View style={styles.similarInfo}>
                      <Text style={[styles.similarBrand, { color: theme.text }]} numberOfLines={1}>
                        {item.brand}
                      </Text>
                      <Text style={[styles.similarName, { color: theme.secondaryText }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <View style={styles.similarPriceRow}>
                        <Text style={[styles.similarPrice, { color: theme.text }]}>₹{item.price}</Text>
                        {item.discount && (
                          <Text style={[styles.similarDiscount, { color: theme.primary }]}>
                            {item.discount}
                          </Text>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: theme.surface, borderColor: theme.primary }]}
          onPress={handleSaveProduct}
          disabled={saveLoading || isSaved}
        >
          {saveLoading ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <>
              <Bookmark size={20} color={isSaved ? theme.primary : theme.secondaryText} fill={isSaved ? theme.primary : "none"} />
              <Text style={[styles.saveButtonText, { color: isSaved ? theme.primary : theme.secondaryText }]}>
                {isSaved ? "SAVED" : "SAVE"}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.addToBagButton, { backgroundColor: theme.primary }]}
          onPress={handleAddToBag}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={theme.textOnPrimary} />
          ) : (
            <>
              <ShoppingBag size={20} color={theme.textOnPrimary} />
              <Text style={[styles.addToBagText, { color: theme.textOnPrimary }]}>ADD TO BAG</Text>
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
    alignSelf: "center",
    width: "100%",
    maxWidth: 500,
  },
  productImage: {
    height: 550,
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
    backgroundColor: "transparent",
    marginHorizontal: 4,
  },
  paginationDotActive: {
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
    paddingTop: 20,
  },
  similarTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
  },
  similarScroll: {
    marginHorizontal: -8,
  },
  similarCard: {
    width: 140,
    marginHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
    paddingBottom: 8,
  },
  similarImage: {
    width: "100%",
    height: 140,
    resizeMode: "cover",
  },
  similarInfo: {
    padding: 8,
  },
  similarBrand: {
    fontSize: 13,
    fontWeight: "bold",
    marginBottom: 2,
  },
  similarName: {
    fontSize: 12,
    marginBottom: 4,
  },
  similarPriceRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  similarPrice: {
    fontSize: 13,
    fontWeight: "bold",
    marginRight: 6,
  },
  similarDiscount: {
    fontSize: 11,
    fontWeight: "600",
  },
  footer: {
    padding: 15,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  saveButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    gap: 8,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: "bold",
  },
  addToBagButton: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    padding: 15,
    borderRadius: 10,
    gap: 10,
  },
  addToBagText: {
    fontSize: 16,
    fontWeight: "bold",
  },
});
