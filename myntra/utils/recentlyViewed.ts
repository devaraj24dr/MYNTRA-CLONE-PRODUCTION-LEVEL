import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import API_URL from "@/constants/Api";

const RECENTLY_VIEWED_KEY = "recently_viewed_products";

export interface RecentlyViewedItem {
  productId: string;
  name: string;
  brand: string;
  image: string;
  price: number;
  discount: string;
  rating?: number;
  viewedAt: string;
}

/**
 * Remove duplicates based on product ID, keeping the first occurrence (most recent).
 */
export const removeDuplicates = (items: RecentlyViewedItem[]): RecentlyViewedItem[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item.productId || seen.has(item.productId)) {
      return false;
    }
    seen.add(item.productId);
    return true;
  });
};

/**
 * Limit list to a maximum of 10 items.
 */
export const limitToTenProducts = (items: RecentlyViewedItem[]): RecentlyViewedItem[] => {
  return items.slice(0, 10);
};

/**
 * Fetch local recently viewed history from AsyncStorage.
 */
export const getRecentlyViewed = async (): Promise<RecentlyViewedItem[]> => {
  try {
    const data = await AsyncStorage.getItem(RECENTLY_VIEWED_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("AsyncStorage error retrieving recently viewed:", error);
    return [];
  }
};

/**
 * Add a product to the local recently viewed list, and sync to server if authenticated.
 */
export const addRecentlyViewed = async (
  product: any,
  userId?: string | null
): Promise<RecentlyViewedItem[]> => {
  if (!product || (!product._id && !product.productId)) return [];

  try {
    const localItems = await getRecentlyViewed();
    
    const newItem: RecentlyViewedItem = {
      productId: product._id || product.productId,
      name: product.name,
      brand: product.brand || "",
      image: Array.isArray(product.images) ? product.images[0] : (product.image || ""),
      price: product.price,
      discount: product.discount || "",
      rating: product.rating || 4.2, // Fallback mock rating since schema lacks it
      viewedAt: new Date().toISOString(),
    };

    // Place new item at the top, deduplicate, and limit to 10
    let updatedList = [newItem, ...localItems];
    updatedList = removeDuplicates(updatedList);
    updatedList = limitToTenProducts(updatedList);

    await AsyncStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(updatedList));

    // Sync to server if user is logged in
    if (userId) {
      axios.post(`${API_URL}/recently-viewed`, {
        userId,
        productId: newItem.productId,
      }).catch((err) => {
        console.warn("Recently viewed background sync failed (working offline):", err.message);
      });
    }

    return updatedList;
  } catch (error) {
    console.error("Error in addRecentlyViewed:", error);
    return [];
  }
};

/**
 * Merges local and remote viewed history, removes duplicates, sorts by latest viewedAt, and persists.
 */
export const syncRecentlyViewed = async (userId: string): Promise<RecentlyViewedItem[]> => {
  if (!userId) return [];

  try {
    let remoteItems: RecentlyViewedItem[] = [];
    
    // Fetch remote list from server
    try {
      const response = await axios.get(`${API_URL}/recently-viewed/${userId}`);
      if (response.data && response.data.products) {
        remoteItems = response.data.products.map((item: any) => {
          const prod = item.productId;
          if (!prod) return null;
          return {
            productId: prod._id,
            name: prod.name,
            brand: prod.brand || "",
            image: prod.images?.[0] || "",
            price: prod.price,
            discount: prod.discount || "",
            rating: prod.rating || 4.2,
            viewedAt: item.viewedAt || new Date().toISOString(),
          };
        }).filter((x: any) => x !== null);
      }
    } catch (apiError: any) {
      console.warn("Failed to fetch remote history, working offline:", apiError.message);
      return await getRecentlyViewed();
    }

    // Fetch local list
    const localItems = await getRecentlyViewed();

    // Merge lists
    const mergedList = [...localItems, ...remoteItems];

    // Sort by viewedAt descending (most recent first)
    mergedList.sort((a, b) => new Date(b.viewedAt).getTime() - new Date(a.viewedAt).getTime());

    // Deduplicate and limit to 10
    let finalizedList = removeDuplicates(mergedList);
    finalizedList = limitToTenProducts(finalizedList);

    // Save back to local storage
    await AsyncStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(finalizedList));

    // Save back to database
    axios.post(`${API_URL}/recently-viewed`, {
      userId,
      productIds: finalizedList.map(item => item.productId),
    }).catch((dbSyncErr) => {
      console.warn("Failed to push merged history to server:", dbSyncErr.message);
    });

    return finalizedList;
  } catch (error) {
    console.error("Critical error in syncRecentlyViewed:", error);
    return await getRecentlyViewed();
  }
};
