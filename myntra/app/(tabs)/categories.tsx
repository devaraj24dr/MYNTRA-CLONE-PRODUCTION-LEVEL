import {
  StyleSheet,
  Image,
  Platform,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";

import { Collapsible } from "@/components/Collapsible";
import { ExternalLink } from "@/components/ExternalLink";
import ParallaxScrollView from "@/components/ParallaxScrollView";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { IconSymbol } from "@/components/ui/IconSymbol";
import React, { useEffect, useState, useMemo, useRef } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Search, X } from "lucide-react-native";
import axios from "axios";
import API_URL from "@/constants/Api";
import { useTheme } from "@/hooks/useTheme";
import { ThemeColors } from "@/types/theme";

// const categories = [
//   {
//     id: 1,
//     name: "Men",
//     subcategories: [
//       "T-Shirts",
//       "Shirts",
//       "Jeans",
//       "Trousers",
//       "Suits",
//       "Activewear",
//     ],
//     image:
//       "https://images.unsplash.com/photo-1617137968427-85924c800a22?w=500&auto=format&fit=crop",
//     products: [
//       {
//         id: 1,
//         name: "Casual White T-Shirt",
//         brand: "Roadster",
//         price: 499,
//         discount: "60% OFF",
//         image:
//           "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500&auto=format&fit=crop",
//       },
//       {
//         id: 2,
//         name: "Denim Jacket",
//         brand: "Levis",
//         price: 2499,
//         discount: "40% OFF",
//         image:
//           "https://images.unsplash.com/photo-1523205771623-e0faa4d2813d?w=500&auto=format&fit=crop",
//       },
//     ],
//   },
//   {
//     id: 2,
//     name: "Women",
//     subcategories: [
//       "Dresses",
//       "Tops",
//       "Ethnic Wear",
//       "Western Wear",
//       "Activewear",
//     ],
//     image:
//       "https://images.unsplash.com/photo-1618244972963-dbad0c4abf18?w=500&auto=format&fit=crop",
//     products: [
//       {
//         id: 3,
//         name: "Summer Dress",
//         brand: "ONLY",
//         price: 1299,
//         discount: "50% OFF",
//         image:
//           "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=500&auto=format&fit=crop",
//       },
//     ],
//   },
//   {
//     id: 3,
//     name: "Kids",
//     subcategories: [
//       "Boys Clothing",
//       "Girls Clothing",
//       "Infants",
//       "Toys",
//       "School Essentials",
//     ],
//     image:
//       "https://images.unsplash.com/photo-1622290291468-a28f7a7dc6a8?w=500&auto=format&fit=crop",
//     products: [],
//   },
//   {
//     id: 4,
//     name: "Beauty",
//     subcategories: [
//       "Makeup",
//       "Skincare",
//       "Haircare",
//       "Fragrances",
//       "Personal Care",
//     ],
//     image:
//       "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=500&auto=format&fit=crop",
//     products: [],
//   },
//   {
//     id: 5,
//     name: "Accessories",
//     subcategories: ["Watches", "Bags", "Jewellery", "Sunglasses", "Belts"],
//     image:
//       "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop",
//     products: [],
//   },
// ];

export default function TabTwoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { categoryId, dealId, focusSearch } = params;
  const { theme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [categories, setcategories] = useState<any>(null);

  const searchInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (focusSearch === "true") {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 200);
      router.setParams({ focusSearch: "" });
    }
  }, [focusSearch]);

  useEffect(() => {
    if (categoryId) {
      setSelectedCategory(categoryId as string);
      setSelectedDeal(null);
      setSelectedSubcategory(null);
      setSearchQuery("");
      router.setParams({ categoryId: "" });
    }
  }, [categoryId]);

  useEffect(() => {
    if (dealId) {
      setSelectedDeal(dealId as string);
      setSelectedCategory(null);
      setSelectedSubcategory(null);
      setSearchQuery("");
      router.setParams({ dealId: "" });
    }
  }, [dealId]);
  useEffect(() => {
    const fetchproduct = async () => {
      try {
        setIsLoading(true);
        const cat = await axios.get(`${API_URL}/category`);
        setcategories(cat.data);
      } catch (error) {
        console.log(error);
        setIsLoading(false);
      } finally {
        setIsLoading(false);
      }
    };
    fetchproduct();
  }, []);
  if (isLoading) {
    return (
      <View style={[styles.loaderContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }
  if (!categories) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.text }}>Categories not found</Text>
      </View>
    );
  }
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setSelectedCategory(null);
    setSelectedDeal(null);
    setSelectedSubcategory(null);
  };
  const clearSearch = () => {
    setSearchQuery("");
    setSelectedCategory(null);
    setSelectedDeal(null);
    setSelectedSubcategory(null);
  };
  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setSelectedDeal(null);
    setSelectedSubcategory(null);
    setSearchQuery("");
  };
  const handleSubcategorySelect = (subcategoryId: string) => {
    setSelectedSubcategory(subcategoryId);
    setSearchQuery("");
  };
  const filtercategories = categories?.filter(
    (category: any) =>
      category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      category.subcategory.some((subcategory: any) =>
        subcategory.toLowerCase().includes(searchQuery.toLowerCase())
      ) ||
      category.productId.some(
        (product: any) =>
          product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          product.brand.toLowerCase().includes(searchQuery.toLowerCase())
      )
  );
  const selectedcategorydata = selectedCategory
    ? categories?.find((cat: any) => cat._id === selectedCategory)
    : null;

  const getFilteredProducts = (products: any) => {
    if (!products) return [];
    if (!selectedSubcategory) return products;
    return products.filter((product: any) => 
      product.name.toLowerCase().includes(selectedSubcategory.toLowerCase()) ||
      product.description?.toLowerCase().includes(selectedSubcategory.toLowerCase())
    );
  };

  const getAllDealProducts = () => {
    if (!categories) return [];
    const allProducts = categories.flatMap((cat: any) => cat.productId || []);
    const uniqueProductsMap = new Map();
    allProducts.forEach((prod: any) => {
      if (prod && prod._id) {
        uniqueProductsMap.set(prod._id.toString(), prod);
      }
    });
    const uniqueProducts = Array.from(uniqueProductsMap.values());
    
    if (selectedDeal === "under599") {
      return uniqueProducts.filter((prod: any) => {
        const priceNum = typeof prod.price === "number" 
          ? prod.price 
          : parseFloat(String(prod.price).replace(/[^0-9.]/g, ""));
        return priceNum < 599;
      });
    } else if (selectedDeal === "40-70off") {
      return uniqueProducts.filter((prod: any) => {
        const discountNum = parseFloat(String(prod.discount).replace(/[^0-9.]/g, ""));
        return discountNum >= 40 && discountNum <= 70;
      });
    }
    return [];
  };
  const renderProducts = (products: any) => {
    return products?.map((product: any) => (
      <TouchableOpacity
        key={product._id}
        style={[styles.productCard, { backgroundColor: theme.card }]}
        onPress={() => router.push(`/product/${product._id}`)}
      >
        <Image source={{ uri: product.images[0] }} style={styles.productImage} />
        <View style={styles.productInfo}>
          <Text style={[styles.brandName, { color: theme.secondaryText }]}>{product.brand}</Text>
          <Text style={[styles.productName, { color: theme.text }]}>{product.name}</Text>
          <View style={styles.priceRow}>
            <Text style={[styles.price, { color: theme.text }]}>₹{product.price}</Text>
            <Text style={[styles.discount, { color: theme.primary }]}>{product.discount}</Text>
          </View>
        </View>
      </TouchableOpacity>
    ));
  };
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Categories</Text>
      </View>

      <View style={[styles.searchContainer, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <View style={[styles.searchInputContainer, { backgroundColor: theme.surface }]}>
          <Search size={20} color={theme.secondaryText} style={styles.searchIcon} />
          <TextInput
            ref={searchInputRef}
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search for products, brands and more"
            placeholderTextColor={theme.secondaryText}
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchQuery !== "" && (
            <TouchableOpacity onPress={clearSearch}>
              <X size={20} color={theme.secondaryText} />
            </TouchableOpacity>
          )}
        </View>
      </View>
      <ScrollView style={styles.content}>
        {!selectedCategory && !selectedDeal && (
          <View style={styles.categoriesGrid}>
            {filtercategories?.map((category: any) => {
              // Calculate starting price
              let startingPrice = "₹299";
              if (category.productId && category.productId.length > 0) {
                const prices = category.productId
                  .map((p: any) => {
                    const val = typeof p.price === "number" ? p.price : parseFloat(String(p.price).replace(/[^0-9.]/g, ""));
                    return isNaN(val) ? null : val;
                  })
                  .filter((v: any) => v !== null);
                if (prices.length > 0) {
                  startingPrice = `₹${Math.min(...prices)}`;
                }
              }

              return (
                <TouchableOpacity
                  key={category._id}
                  style={[styles.categoryCard, { backgroundColor: theme.card }]}
                  onPress={() => handleCategorySelect(category._id)}
                  activeOpacity={0.8}
                >
                  <Image
                    source={{ uri: category.image }}
                    style={styles.categoryImage}
                  />
                  <View style={styles.categoryInfo}>
                    <Text style={[styles.categoryName, { color: theme.text }]}>
                      {category.name}
                    </Text>
                    <Text style={[styles.categorySubtext, { color: theme.secondaryText }]}>
                      Starting from {startingPrice}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {selectedcategorydata && (
          <View style={styles.categoryDetail}>
            <View style={styles.categoryHeader}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setSelectedCategory(null)}
              >
                <Text style={[styles.backButtonText, { color: theme.primary }]}>← Back to Categories</Text>
              </TouchableOpacity>
              <Text style={[styles.categoryTitle, { color: theme.text }]}>
                {selectedcategorydata.name}
              </Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.subcategoriesScroll}
            >
              {selectedcategorydata.subcategory.map(
                (sub: any, index: any) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.subcategoryButton,
                      { backgroundColor: selectedSubcategory === sub ? theme.primary : theme.surface },
                    ]}
                    onPress={() => handleSubcategorySelect(sub)}
                  >
                    <Text
                      style={[
                        styles.subcategoryButtonText,
                        { color: selectedSubcategory === sub ? theme.textOnPrimary : theme.text },
                      ]}
                    >
                      {sub}
                    </Text>
                  </TouchableOpacity>
                )
              )}
            </ScrollView>
            <View style={styles.productsGrid}>
              {renderProducts(getFilteredProducts(selectedcategorydata?.productId))}
            </View>
          </View>
        )}

        {selectedDeal && (
          <View style={styles.categoryDetail}>
            <View style={styles.categoryHeader}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setSelectedDeal(null)}
              >
                <Text style={[styles.backButtonText, { color: theme.primary }]}>← Back to Categories</Text>
              </TouchableOpacity>
              <Text style={[styles.categoryTitle, { color: theme.text }]}>
                {selectedDeal === "under599" ? "Deals Under ₹599" : "Deals: 40-70% Off"}
              </Text>
            </View>

            <View style={styles.productsGrid}>
              {getAllDealProducts().length === 0 ? (
                <Text style={[styles.emptyText, { color: theme.text }]}>No products found for this deal</Text>
              ) : (
                renderProducts(getAllDealProducts())
              )}
            </View>
          </View>
        )}
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
    searchContainer: {
      padding: 15,
      backgroundColor: theme.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    searchInputContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.surface,
      borderRadius: 10,
      padding: 10,
    },
    searchIcon: {
      marginRight: 10,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      color: theme.text,
    },
    content: {
      flex: 1,
    },
    categoriesGrid: {
      padding: 15,
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
    },
    categoryCard: {
      width: "48%",
      backgroundColor: theme.card,
      borderRadius: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 3.84,
      elevation: 3,
      overflow: "hidden",
    },
    categoryImage: {
      width: "100%",
      height: 220,
      resizeMode: "cover",
    },
    categoryInfo: {
      paddingVertical: 12,
      paddingHorizontal: 8,
      alignItems: "center",
    },
    categoryName: {
      fontSize: 16,
      fontWeight: "bold",
      color: theme.text,
      marginBottom: 4,
      textAlign: "center",
    },
    categorySubtext: {
      fontSize: 13,
      color: theme.secondaryText,
      textAlign: "center",
    },
    subcategories: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    subcategoryTag: {
      backgroundColor: theme.surface,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 15,
      marginRight: 8,
      marginBottom: 8,
    },
    subcategoryText: {
      fontSize: 14,
      color: theme.secondaryText,
    },
    categoryDetail: {
      flex: 1,
      padding: 15,
    },
    categoryHeader: {
      marginBottom: 15,
    },
    backButton: {
      marginBottom: 10,
    },
    backButtonText: {
      color: theme.primary,
      fontSize: 16,
    },
    categoryTitle: {
      fontSize: 24,
      fontWeight: "bold",
      color: theme.text,
    },
    subcategoriesScroll: {
      marginBottom: 15,
    },
    subcategoryButton: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: theme.surface,
      marginRight: 10,
    },
    selectedSubcategory: {
      backgroundColor: theme.primary,
    },
    subcategoryButtonText: {
      fontSize: 14,
      color: theme.text,
    },
    selectedSubcategoryText: {
      color: theme.textOnPrimary,
    },
    productsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
    },
    productCard: {
      width: "48%",
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
    productImage: {
      width: "100%",
      height: 200,
      resizeMode: "cover",
    },
    productInfo: {
      padding: 10,
    },
    brandName: {
      fontSize: 14,
      color: theme.secondaryText,
      marginBottom: 4,
    },
    productName: {
      fontSize: 16,
      color: theme.text,
      marginBottom: 8,
    },
    priceRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    price: {
      fontSize: 16,
      fontWeight: "bold",
      color: theme.text,
      marginRight: 8,
    },
    discount: {
      fontSize: 14,
      color: theme.primary,
    },
    emptyText: {
      fontSize: 16,
      color: theme.secondaryText,
      textAlign: "center",
      marginTop: 20,
    },
  });

