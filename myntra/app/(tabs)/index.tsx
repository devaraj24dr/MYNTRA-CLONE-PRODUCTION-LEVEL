import {
  ScrollView,
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Search, ChevronRight } from "lucide-react-native";
import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import axios from "axios";
import API_URL from "@/constants/Api";
import { getRecentlyViewed, syncRecentlyViewed } from "@/utils/recentlyViewed";
import { useTheme } from "@/hooks/useTheme";

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

export default function Home() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [product, setproduct] = useState<any>(null);
  const [categories, setcategories] = useState<any>(null);
  const { user } = useAuth();
  const { theme } = useTheme();
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
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <Text style={[styles.logo, { color: theme.primary }]}>MYNTRA</Text>
        <TouchableOpacity style={styles.searchButton}>
          <Search size={24} color={theme.text} />
        </TouchableOpacity>
      </View>

      <Image
        source={{
          uri: "https://images.unsplash.com/photo-1445205170230-053b83016050?w=800&auto=format&fit=crop",
        }}
        style={styles.banner}
      />

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>SHOP BY CATEGORY</Text>
          <TouchableOpacity style={styles.viewAll}>
            <Text style={[styles.viewAllText, { color: theme.primary }]}>View All</Text>
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
            <Text style={[styles.emptyText, { color: theme.text }]}>No categories available</Text>
          ) : (
            categories.map((category: any, idx: number) => (
              <TouchableOpacity key={`${category._id}-${idx}`} style={styles.categoryCard}>
                <Image
                  source={{ uri: category.image }}
                  style={styles.categoryImage}
                />
                <Text style={[styles.categoryName, { color: theme.text }]}>{category.name}</Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>DEALS OF THE DAY</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.dealsScroll}
        >
          {deals.map((deal, idx) => (
            <TouchableOpacity key={`${deal.id}-${idx}`} style={styles.dealCard}>
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
            <Text style={[styles.sectionTitle, { color: theme.text }]}>RECENTLY VIEWED</Text>
          </View>
          <FlatList
            data={recentlyViewedList}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item, idx) => `${item.productId}-${idx}`}
            contentContainerStyle={styles.recentlyViewedScroll}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.recentlyViewedCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={() => handleProductPress(item.productId)}
              >
                <Image
                  source={{ uri: item.image }}
                  style={styles.recentlyViewedImage}
                />
                <View style={styles.recentlyViewedInfo}>
                  <Text style={[styles.rvBrand, { color: theme.text }]} numberOfLines={1}>
                    {item.brand}
                  </Text>
                  <Text style={[styles.rvName, { color: theme.secondaryText }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <View style={styles.rvPriceRow}>
                    <Text style={[styles.rvPrice, { color: theme.text }]}>₹{item.price}</Text>
                    {item.discount && (
                      <Text style={[styles.rvDiscount, { color: theme.primary }]}>{item.discount}</Text>
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
          <Text style={[styles.sectionTitle, { color: theme.text }]}>YOU MAY ALSO LIKE</Text>
        </View>
        {isRecsLoading ? (
          <ActivityIndicator size="small" color={theme.primary} style={styles.loader} />
        ) : recommendations.length === 0 ? (
          <Text style={[styles.emptyText, { color: theme.text }]}>No recommendations available</Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.recsScroll}
          >
            {recommendations.map((item: any, idx: number) => (
              <TouchableOpacity
                key={`${item._id}-${idx}`}
                style={[styles.recCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={() => handleRecommendationPress(item._id)}
              >
                <Image source={{ uri: item.images?.[0] }} style={styles.recImage} />
                <View style={styles.recInfo}>
                  <Text style={[styles.recBrand, { color: theme.text }]} numberOfLines={1}>
                    {item.brand}
                  </Text>
                  <Text style={[styles.recName, { color: theme.secondaryText }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <View style={styles.recPriceRow}>
                    <Text style={[styles.recPrice, { color: theme.text }]}>₹{item.price}</Text>
                    {item.discount && (
                      <Text style={[styles.recDiscount, { color: theme.primary }]}>{item.discount}</Text>
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
          <Text style={[styles.sectionTitle, { color: theme.text }]}>TRENDING NOW</Text>
        </View>
        <View style={styles.productsGrid}>
          {isLoading ? (
            <ActivityIndicator
              size="large"
              color={theme.primary}
              style={styles.loader}
            />
          ) : !product || product.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.text }]}>No Product available</Text>
          ) : ( 
            <View style={styles.productsGrid}>
              {product.map((product: any, idx: number) => (
                <TouchableOpacity
                  key={`${product._id}-${idx}`}
                  style={[styles.productCard, { backgroundColor: theme.card }]}
                  onPress={() => handleProductPress(product._id)}
                >
                  <Image
                    source={{ uri: product.images[0] }}
                    style={styles.productImage}
                  />
                  <View style={styles.productInfo}>
                    <Text style={[styles.brandName, { color: theme.secondaryText }]}>{product.brand}</Text>
                    <Text style={[styles.productName, { color: theme.text }]}>{product.name}</Text>
                    <View style={styles.priceRow}>
                      <Text style={[styles.productPrice, { color: theme.text }]}>{product.price}</Text>
                      <Text style={[styles.discount, { color: theme.primary }]}>{product.discount}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    paddingTop: 50,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  emptyText: {
    textAlign: "center",
    marginTop: 20,
    fontSize: 16,
    color: "#666",
  },
  logo: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#3e3e3e",
  },
  searchButton: {
    padding: 8,
  },
  banner: {
    width: "100%",
    height: 200,
    resizeMode: "cover",
  },
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
    color: "#3e3e3e",
  },
  viewAll: {
    flexDirection: "row",
    alignItems: "center",
  },
  viewAllText: {
    color: "#ff3f6c",
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
    color: "#3e3e3e",
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
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  productsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -8,
  },
  productCard: {
    width: "48%",
    marginHorizontal: "1%",
    marginBottom: 15,
    backgroundColor: "#fff",
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  productImage: {
    width: "100%",
    height: 200,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  productInfo: {
    padding: 10,
  },
  brandName: {
    fontSize: 14,
    color: "#666",
    marginBottom: 2,
  },
  productName: {
    fontSize: 16,
    marginBottom: 5,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  productPrice: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#3e3e3e",
    marginRight: 8,
  },
  discount: {
    fontSize: 14,
    color: "#ff3f6c",
    fontWeight: "500",
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
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#f0f0f0",
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
    color: "#3e3e3e",
    marginBottom: 2,
  },
  rvName: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  rvPriceRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  rvPrice: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#3e3e3e",
    marginRight: 6,
  },
  rvDiscount: {
    fontSize: 11,
    color: "#ff3f6c",
    fontWeight: "600",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  ratingText: {
    fontSize: 11,
    color: "#ffa000",
    fontWeight: "bold",
  },
  recsScroll: {
    marginHorizontal: -15,
  },
  recCard: {
    width: 140,
    marginHorizontal: 8,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#f0f0f0",
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
    color: "#3e3e3e",
    marginBottom: 2,
  },
  recName: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  recPriceRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  recPrice: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#3e3e3e",
    marginRight: 6,
  },
  recDiscount: {
    fontSize: 11,
    color: "#ff3f6c",
    fontWeight: "600",
  },
});
