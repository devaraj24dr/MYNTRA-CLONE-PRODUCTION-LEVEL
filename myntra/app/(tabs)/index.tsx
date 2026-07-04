import {
  ScrollView,
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Animated,
  Dimensions,
  Platform,
  ImageBackground,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Search, ChevronRight } from "lucide-react-native";
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import axios from "axios";
import API_URL from "@/constants/Api";
import { getRecentlyViewed, syncRecentlyViewed } from "@/utils/recentlyViewed";
import { useTheme } from "@/hooks/useTheme";
import { ThemeColors } from "@/types/theme";

// const categories = [
//   {
//     id: 1,
//     name: "Men",
//     image:
//       "https://images.unsplash.com/photo-1617137968427-85924c800a22?w=500&auto=format&fit=crop",
//   },
//   {
//     id: 2,
//     name: "Women",
//     image:
//       "https://images.unsplash.com/photo-1618244972963-dbad0c4abf18?w=500&auto=format&fit=crop",
//   },
//   {
//     id: 3,
//     name: "Kids",
//     image:
//       "https://images.unsplash.com/photo-1622290291468-a28f7a7dc6a8?w=500&auto=format&fit=crop",
//   },
//   {
//     id: 4,
//     name: "Beauty",
//     image:
//       "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=500&auto=format&fit=crop",
//   },
// ];

// const products = [
//   {
//     id: 1,
//     name: "Casual White T-Shirt",
//     brand: "Roadster",
//     price: "₹499",
//     discount: "60% OFF",
//     image:
//       "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500&auto=format&fit=crop",
//   },
//   {
//     id: 2,
//     name: "Denim Jacket",
//     brand: "Levis",
//     price: "₹2499",
//     discount: "40% OFF",
//     image:
//       "https://images.unsplash.com/photo-1523205771623-e0faa4d2813d?w=500&auto=format&fit=crop",
//   },
//   {
//     id: 3,
//     name: "Summer Dress",
//     brand: "ONLY",
//     price: "₹1299",
//     discount: "50% OFF",
//     image:
//       "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=500&auto=format&fit=crop",
//   },
//   {
//     id: 4,
//     name: "Classic Sneakers",
//     brand: "Nike",
//     price: "₹3499",
//     discount: "30% OFF",
//     image:
//       "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&auto=format&fit=crop",
//   },
// ];

const deals = [
  {
    id: 1,
    title: "Under ₹599",
    image:
      "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=500&auto=format&fit=crop",
  },
  {
    id: 2,
    title: "40-70% Off",
    image:
      "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=500&auto=format&fit=crop",
  },
];

const BANNERS = [
  {
    id: 1,
    badge: "EOSS | UP TO 70% OFF",
    headline: "Fashion Favourites",
    subline: "Trending Styles & Premium Brands",
    tag: "Free Shipping on First Order",
    image: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1000&auto=format&fit=crop",
  },
  {
    id: 2,
    badge: "SUMMER COUTURE 2025",
    headline: "Hottest Arrivals",
    subline: "Breezy Linens & Pastels",
    tag: "Easy 14-day Returns",
    image: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=1000&auto=format&fit=crop",
  },
  {
    id: 3,
    badge: "SNEAKERHEAD HEADQUARTERS",
    headline: "Step In Style",
    subline: "Nike, Adidas, Puma & Woodland",
    tag: "Flat ₹500 Cashback on UPI",
    image: "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=1000&auto=format&fit=crop",
  },
  {
    id: 4,
    badge: "FESTIVE GLAMOUR",
    headline: "Ethnic Elegance",
    subline: "BIBA, W, Aurelia & More",
    tag: "Get Extra 10% Off | Code: ETHNIC10",
    image: "https://images.unsplash.com/photo-1610030469668-93535c17b6b3?w=1000&auto=format&fit=crop",
  },
  {
    id: 5,
    badge: "PLAYTIME FAVOURITES",
    headline: "Tiny Trendsetters",
    subline: "Comfy Cottons & Cute Sets",
    tag: "Buy 2 Get 1 Free | USPA & Mothercare",
    image: "https://images.unsplash.com/photo-1622290291468-a28f7a7dc6a8?w=1000&auto=format&fit=crop",
  },
  {
    id: 6,
    badge: "WORKOUT BASICS",
    headline: "Chase Your Goals",
    subline: "High-Performance Activewear",
    tag: "Up to 50% Off | Adidas & HRX",
    image: "https://images.unsplash.com/photo-1518310383802-640c2de311b2?w=1000&auto=format&fit=crop",
  },
];

const { width: SCREEN_WIDTH } = Dimensions.get("window");

function BannerCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const flatRef = useRef<any>(null);
  const timerRef = useRef<any>(null);

  const startAutoPlay = useCallback(() => {
    timerRef.current = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % BANNERS.length;
        flatRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, 4000);
  }, []);

  useEffect(() => {
    startAutoPlay();
    return () => clearInterval(timerRef.current);
  }, [startAutoPlay]);

  const goTo = (idx: number) => {
    clearInterval(timerRef.current);
    setActiveIndex(idx);
    flatRef.current?.scrollToIndex({ index: idx, animated: true });
    startAutoPlay();
  };

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: false }
  );

  const onMomentumScrollEnd = (e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    clearInterval(timerRef.current);
    setActiveIndex(idx);
    startAutoPlay();
  };

  return (
    <View style={carouselStyles.wrapper}>
      <Animated.FlatList
        ref={flatRef}
        data={BANNERS}
        keyExtractor={(b) => String(b.id)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        onMomentumScrollEnd={onMomentumScrollEnd}
        scrollEventThrottle={16}
        renderItem={({ item: b }) => (
          <ImageBackground
            source={{ uri: b.image }}
            style={[carouselStyles.slide, { width: SCREEN_WIDTH }]}
            imageStyle={carouselStyles.slideImageBg}
          >
            <View style={carouselStyles.overlay} />
            <View style={carouselStyles.textBlock}>
              <View style={carouselStyles.badgePill}>
                <Text style={carouselStyles.badgeText}>{b.badge}</Text>
              </View>
              <Text style={carouselStyles.headline}>{b.headline}</Text>
              <Text style={carouselStyles.subline}>{b.subline}</Text>
              <View style={carouselStyles.divider} />
              <Text style={carouselStyles.tagText}>{b.tag}</Text>
            </View>
          </ImageBackground>
        )}
      />

      {/* Left arrow */}
      {activeIndex > 0 && (
        <TouchableOpacity style={[carouselStyles.arrow, carouselStyles.arrowLeft]} onPress={() => goTo(activeIndex - 1)}>
          <Text style={carouselStyles.arrowText}>‹</Text>
        </TouchableOpacity>
      )}

      {/* Right arrow */}
      {activeIndex < BANNERS.length - 1 && (
        <TouchableOpacity style={[carouselStyles.arrow, carouselStyles.arrowRight]} onPress={() => goTo(activeIndex + 1)}>
          <Text style={carouselStyles.arrowText}>›</Text>
        </TouchableOpacity>
      )}

      {/* Dot indicators */}
      <View style={carouselStyles.dots}>
        {BANNERS.map((_, i) => (
          <TouchableOpacity key={i} onPress={() => goTo(i)}>
            <View
              style={[
                carouselStyles.dot,
                i === activeIndex ? carouselStyles.dotActive : carouselStyles.dotInactive,
              ]}
            />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const carouselStyles = StyleSheet.create({
  wrapper: {
    width: "100%",
    height: 200,
    position: "relative",
    overflow: "hidden",
  },
  slide: {
    height: 200,
    justifyContent: "center",
    paddingHorizontal: 30,
    position: "relative",
  },
  slideImageBg: {
    resizeMode: "cover",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  textBlock: {
    zIndex: 2,
    maxWidth: "80%",
  },
  badgePill: {
    alignSelf: "flex-start",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 6,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.4)",
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  headline: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "900",
    marginBottom: 2,
    textShadowColor: "rgba(0, 0, 0, 0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  subline: {
    fontSize: 14,
    fontWeight: "600",
    color: "#e0e0e0",
    marginBottom: 6,
  },
  divider: {
    width: 40,
    height: 2,
    backgroundColor: "#ff3f6c",
    marginBottom: 6,
  },
  tagText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "500",
  },
  arrow: {
    position: "absolute",
    top: "50%",
    marginTop: -20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  arrowLeft: { left: 8 },
  arrowRight: { right: 8 },
  arrowText: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "300",
    lineHeight: 30,
  },
  dots: {
    position: "absolute",
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    borderRadius: 4,
    height: 6,
  },
  dotActive: {
    width: 20,
    backgroundColor: "#fff",
  },
  dotInactive: {
    width: 6,
    backgroundColor: "rgba(255,255,255,0.45)",
  },
});

export default function Home() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [product, setproduct] = useState<any>(null);
  const [categories, setcategories] = useState<any>(null);
  const { user } = useAuth();
  const { theme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const [recentlyViewedList, setRecentlyViewedList] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [isRecsLoading, setIsRecsLoading] = useState(false);
  const handleProductPress = (productId: string) => {
    if (!user) {
      router.push("/login");
    } else {
      router.push(`/product/${productId}`);
    }
  };

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const load = async () => {
        const local = await getRecentlyViewed();
        if (active) {
          setRecentlyViewedList(local);
        }
        if (user?._id) {
          const synced = await syncRecentlyViewed(user._id);
          if (active) {
            setRecentlyViewedList(synced);
          }
        }
      };
      load();
      return () => {
        active = false;
      };
    }, [user?._id])
  );
  useEffect(() => {
    const fetchproduct = async () => {
      try {
        setIsLoading(true);
        const cat = await axios.get(`${API_URL}/category`);
        const product = await axios.get(`${API_URL}/product`);
        setcategories(cat.data);
        setproduct(product.data);
      } catch (error) {
        console.log(error);
        setIsLoading(false);
      } finally {
        setIsLoading(false);
      }
    };
    fetchproduct();
  }, []);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        setIsRecsLoading(true);
        const url = user?._id 
          ? `${API_URL}/recommendations/${user._id}?limit=6` 
          : `${API_URL}/recommendations/popular?limit=6`;
        const res = await axios.get(url);
        const recs = user?._id ? res.data.recommendations : res.data;
        setRecommendations(recs || []);

        // Track impressions for the recommended items
        if (user?._id && recs && recs.length > 0) {
          recs.forEach((rec: any) => {
            axios.post(`${API_URL}/recommendations/analytics`, {
              userId: user._id,
              recommendationId: rec._id,
              clicked: false
            }).catch(err => console.log("Impression error:", err));
          });
        }
      } catch (err) {
        console.log("Error fetching recommendations:", err);
      } finally {
        setIsRecsLoading(false);
      }
    };
    fetchRecommendations();
  }, [user?._id]);

  const handleRecommendationPress = async (productId: string) => {
    if (user?._id) {
      try {
        await axios.post(`${API_URL}/recommendations/analytics`, {
          userId: user._id,
          recommendationId: productId,
          clicked: true
        });
      } catch (err) {
        console.log("Error tracking recommendation click:", err);
      }
    }
    handleProductPress(productId);
  };
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>MYNTRA</Text>
        <TouchableOpacity 
          style={styles.searchButton}
          onPress={() => router.push({ pathname: "/categories", params: { focusSearch: "true" } })}
        >
          <Search size={24} color={theme.text} />
        </TouchableOpacity>
      </View>

      {/* ── Promotional Banner Carousel ── */}
      <BannerCarousel />

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>SHOP BY CATEGORY</Text>
          <TouchableOpacity style={styles.viewAll} onPress={() => router.push("/categories")}>
            <Text style={styles.viewAllText}>View All</Text>
            <ChevronRight size={20} color={theme.primary} />
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesScroll}
        >
          {isLoading ? (
            <ActivityIndicator
              size="large"
              color={theme.primary}
              style={styles.loader}
            />
          ) : !categories || categories.length === 0 ? (
            <Text style={styles.emptyText}>No categories available</Text>
          ) : (
            categories.map((category: any, idx: number) => (
              <TouchableOpacity
                key={`${category._id}-${idx}`}
                style={styles.categoryCard}
                onPress={() => router.push({
                  pathname: "/categories",
                  params: { categoryId: category._id }
                })}
              >
                <Image
                  source={{ uri: category.image }}
                  style={styles.categoryImage}
                />
                <Text style={styles.categoryName}>{category.name}</Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>DEALS OF THE DAY</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.dealsScroll}
        >
          {deals.map((deal, idx) => (
            <TouchableOpacity
              key={`${deal.id}-${idx}`}
              style={styles.dealCard}
              onPress={() => router.push({
                pathname: "/categories",
                params: { dealId: deal.id === 1 ? "under599" : "40-70off" }
              })}
            >
              <Image source={{ uri: deal.image }} style={styles.dealImage} />
              <View style={styles.dealOverlay}>
                <Text style={styles.dealTitle}>{deal.title}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {recentlyViewedList.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>RECENTLY VIEWED</Text>
          </View>
          <FlatList
            data={recentlyViewedList}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item, idx) => `${item.productId}-${idx}`}
            contentContainerStyle={styles.recentlyViewedScroll}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.recentlyViewedCard}
                onPress={() => handleProductPress(item.productId)}
              >
                <Image
                  source={{ uri: item.image }}
                  style={styles.recentlyViewedImage}
                />
                <View style={styles.recentlyViewedInfo}>
                  <Text style={styles.rvBrand} numberOfLines={1}>
                    {item.brand}
                  </Text>
                  <Text style={styles.rvName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <View style={styles.rvPriceRow}>
                    <Text style={styles.rvPrice}>₹{item.price}</Text>
                    {item.discount && (
                      <Text style={styles.rvDiscount}>{item.discount}</Text>
                    )}
                  </View>
                  <View style={styles.ratingRow}>
                    <Text style={styles.ratingText}>★ {item.rating || 4.2}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* You May Also Like Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>YOU MAY ALSO LIKE</Text>
        </View>
        {isRecsLoading ? (
          <ActivityIndicator size="small" color={theme.primary} style={styles.loader} />
        ) : recommendations.length === 0 ? (
          <Text style={styles.emptyText}>No recommendations available</Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.recsScroll}
          >
            {recommendations.map((item: any, idx: number) => (
              <TouchableOpacity
                key={`${item._id}-${idx}`}
                style={styles.recCard}
                onPress={() => handleRecommendationPress(item._id)}
              >
                <Image source={{ uri: item.images?.[0] }} style={styles.recImage} />
                <View style={styles.recInfo}>
                  <Text style={styles.recBrand} numberOfLines={1}>
                    {item.brand}
                  </Text>
                  <Text style={styles.recName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <View style={styles.recPriceRow}>
                    <Text style={styles.recPrice}>₹{item.price}</Text>
                    {item.discount && (
                      <Text style={styles.recDiscount}>{item.discount}</Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>TRENDING NOW</Text>
          <TouchableOpacity style={styles.viewAll} onPress={() => router.push("/categories")}>
            <Text style={styles.viewAllText}>View All</Text>
            <ChevronRight size={20} color={theme.primary} />
          </TouchableOpacity>
        </View>
        {isLoading ? (
          <ActivityIndicator size="large" color={theme.primary} style={styles.loader} />
        ) : !product || product.length === 0 ? (
          <Text style={styles.emptyText}>No Product available</Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.productsScroll}
          >
            {product.map((prod: any, idx: number) => (
              <TouchableOpacity
                key={`${prod._id}-${idx}`}
                style={styles.productCard}
                onPress={() => handleProductPress(prod._id)}
              >
                <Image
                  source={{ uri: prod.images?.[0] }}
                  style={styles.productImage}
                />
                <View style={styles.productInfo}>
                  <Text style={styles.brandName} numberOfLines={1}>{prod.brand}</Text>
                  <Text style={styles.productName} numberOfLines={1}>{prod.name}</Text>
                  <View style={styles.priceRow}>
                    <Text style={styles.productPrice}>{prod.price}</Text>
                    {prod.discount ? <Text style={styles.discount}>{prod.discount}</Text> : null}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    </ScrollView>
  );
}

const getStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 15,
      paddingTop: 50,
      backgroundColor: theme.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    emptyText: {
      textAlign: "center",
      marginTop: 20,
      fontSize: 16,
      color: theme.secondaryText,
    },
    logo: {
      fontSize: 24,
      fontWeight: "bold",
      color: theme.text,
    },
    searchButton: {
      padding: 8,
    },
    // banner style replaced by BannerCarousel component
    section: {
      padding: 15,
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 15,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: theme.text,
    },
    viewAll: {
      flexDirection: "row",
      alignItems: "center",
    },
    viewAllText: {
      color: theme.primary,
      marginRight: 5,
    },
    categoriesScroll: {
      marginHorizontal: -15,
    },
    categoryCard: {
      width: 100,
      marginHorizontal: 8,
    },
    categoryImage: {
      width: 100,
      height: 100,
      borderRadius: 50,
    },
    categoryName: {
      textAlign: "center",
      marginTop: 8,
      fontSize: 14,
      color: theme.text,
    },
    dealsScroll: {
      marginHorizontal: -15,
    },
    dealCard: {
      width: 280,
      height: 150,
      marginHorizontal: 8,
      borderRadius: 10,
      overflow: "hidden",
    },
    dealImage: {
      width: "100%",
      height: "100%",
    },
    dealOverlay: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: "rgba(0,0,0,0.4)",
      padding: 15,
    },
    dealTitle: {
      color: theme.textOnPrimary,
      fontSize: 18,
      fontWeight: "bold",
    },
    productsScroll: {
      paddingHorizontal: 4,
      gap: 10,
    },
    productCard: {
      width: 140,
      backgroundColor: theme.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
      overflow: "hidden",
    },
    productImage: {
      width: 140,
      height: 175,
      resizeMode: "cover",
    },
    productInfo: {
      padding: 7,
    },
    brandName: {
      fontSize: 10,
      color: theme.secondaryText,
      marginBottom: 1,
      textTransform: "uppercase",
      fontWeight: "600",
    },
    productName: {
      fontSize: 12,
      color: theme.text,
      marginBottom: 3,
      fontWeight: "500",
    },
    priceRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    productPrice: {
      fontSize: 12,
      fontWeight: "bold",
      color: theme.text,
    },
    discount: {
      fontSize: 10,
      color: theme.primary,
      fontWeight: "600",
    },
    loader: {
      marginTop: 50,
    },
    recentlyViewedScroll: {
      marginHorizontal: -8,
    },
    recentlyViewedCard: {
      width: 140,
      marginHorizontal: 8,
      backgroundColor: theme.card,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: "hidden",
    },
    recentlyViewedImage: {
      width: "100%",
      height: 140,
      resizeMode: "cover",
    },
    recentlyViewedInfo: {
      padding: 8,
    },
    rvBrand: {
      fontSize: 13,
      fontWeight: "bold",
      color: theme.text,
      marginBottom: 2,
    },
    rvName: {
      fontSize: 12,
      color: theme.secondaryText,
      marginBottom: 4,
    },
    rvPriceRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    rvPrice: {
      fontSize: 13,
      fontWeight: "bold",
      color: theme.text,
      marginRight: 6,
    },
    rvDiscount: {
      fontSize: 11,
      color: theme.primary,
      fontWeight: "600",
    },
    ratingRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 4,
    },
    ratingText: {
      fontSize: 11,
      color: theme.warning,
      fontWeight: "bold",
    },
    recsScroll: {
      marginHorizontal: -15,
    },
    recCard: {
      width: 140,
      marginHorizontal: 8,
      backgroundColor: theme.card,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: "hidden",
    },
    recImage: {
      width: "100%",
      height: 140,
      resizeMode: "cover",
    },
    recInfo: {
      padding: 8,
    },
    recBrand: {
      fontSize: 13,
      fontWeight: "bold",
      color: theme.text,
      marginBottom: 2,
    },
    recName: {
      fontSize: 12,
      color: theme.secondaryText,
      marginBottom: 4,
    },
    recPriceRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    recPrice: {
      fontSize: 13,
      fontWeight: "bold",
      color: theme.text,
      marginRight: 6,
    },
    recDiscount: {
      fontSize: 11,
      color: theme.primary,
      fontWeight: "600",
    },
  });
