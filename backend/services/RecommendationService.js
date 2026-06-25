const mongoose = require("mongoose");
const UserViewHistory = require("../models/UserViewHistory");
const RecommendationAnalytics = require("../models/RecommendationAnalytics");
const Product = require("../models/Product");
const Wishlist = require("../models/Wishlist");
const Cart = require("../models/Cart");
const Order = require("../models/Order");

// ─────────────────────────────────────────────
// Caching Mechanism
// ─────────────────────────────────────────────
class RecommendationCache {
  constructor(ttlMs = 15000) {
    this.cache = new Map();
    this.ttlMs = ttlMs;
  }

  get(userId) {
    const key = userId.toString();
    const cached = this.cache.get(key);
    if (!cached) return null;
    if (Date.now() - cached.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }
    return cached.data;
  }

  set(userId, data) {
    const key = userId.toString();
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  invalidate(userId) {
    if (!userId) return;
    const key = userId.toString();
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }
}

const recCache = new RecommendationCache(15000); // 15 seconds short-lived cache

// Global Popularity Caches to avoid running expensive aggregate queries on every single request
let cachedPopularity = null;
let lastPopularityFetch = 0;
const POPULARITY_CACHE_TTL = 30000; // 30 seconds

let cachedPopularProducts = null;
let lastPopularProductsFetch = 0;
const POPULAR_PRODUCTS_CACHE_TTL = 30000; // 30 seconds

async function getPopularitySalesMap() {
  const now = Date.now();
  if (cachedPopularity && now - lastPopularityFetch < POPULARITY_CACHE_TTL) {
    return cachedPopularity;
  }

  const salesCounts = await Order.aggregate([
    { $unwind: "$items" },
    { $group: { _id: "$items.productId", count: { $sum: "$items.quantity" } } },
  ]);
  
  const salesMap = {};
  salesCounts.forEach((s) => {
    if (s._id) salesMap[s._id.toString()] = s.count;
  });
  
  const maxSalesCount = Object.values(salesMap).reduce((max, val) => Math.max(max, val), 0);

  cachedPopularity = { salesMap, maxSalesCount };
  lastPopularityFetch = now;
  return cachedPopularity;
}

// ─────────────────────────────────────────────
// Helper Services
// ─────────────────────────────────────────────

/**
 * Record a product view.
 * Ensures uniqueness (only 1 record per user+product) and maintains limit of last 50 unique views.
 */
async function recordView(userId, productId) {
  if (!userId || !productId) {
    throw new Error("userId and productId are required to record a view.");
  }

  // 1. Invalidate cache for this user
  recCache.invalidate(userId);

  // Fetch product category to store denormalized
  const product = await Product.findById(productId).select("category");
  if (!product) {
    throw new Error(`Product ${productId} not found.`);
  }

  // 2. Upsert the view (updates viewedAt to now if already viewed, ensuring uniqueness)
  const view = await UserViewHistory.findOneAndUpdate(
    { userId, productId },
    { viewedAt: new Date(), category: product.category },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // 3. Keep only the last 50 unique viewed products per user
  const views = await UserViewHistory.find({ userId })
    .sort({ viewedAt: -1 })
    .skip(50)
    .select("_id");

  if (views.length > 0) {
    const idsToDelete = views.map((v) => v._id);
    await UserViewHistory.deleteMany({ _id: { $in: idsToDelete } });
  }

  return view;
}

/**
 * Fetches popular products globally.
 * Aggregates orders to count purchases, falls back to view counts, and then active products.
 */
async function getPopularProducts(limit = 10, excludeProductIds = []) {
  const now = Date.now();
  let popular;
  
  if (cachedPopularProducts && now - lastPopularProductsFetch < POPULAR_PRODUCTS_CACHE_TTL) {
    popular = cachedPopularProducts;
  } else {
    // 1. Get ordered quantities per product
    const orderedProducts = await Order.aggregate([
      { $unwind: "$items" },
      { $group: { _id: "$items.productId", count: { $sum: "$items.quantity" } } },
      { $sort: { count: -1 } },
      { $limit: 50 },
    ]);

    let popularIds = orderedProducts.map((p) => p._id).filter(Boolean);

    // 2. Pad with most viewed products from UserViewHistory
    if (popularIds.length < 50) {
      const padViews = await UserViewHistory.aggregate([
        { $match: { productId: { $nin: popularIds } } },
        { $group: { _id: "$productId", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 50 - popularIds.length },
      ]);
      popularIds = [...popularIds, ...padViews.map((pv) => pv._id).filter(Boolean)];
    }

    // 3. Pad with any active products
    if (popularIds.length < 50) {
      const padActive = await Product.find({
        _id: { $nin: popularIds },
        isActive: true,
      })
        .limit(50 - popularIds.length)
        .select("_id");
      popularIds = [...popularIds, ...padActive.map((p) => p._id)];
    }

    popular = await Product.find({ _id: { $in: popularIds }, isActive: true });
    cachedPopularProducts = popular;
    lastPopularProductsFetch = now;
  }

  // Filter exclusions in memory (extremely fast)
  const excludeStr = new Set(excludeProductIds.map((id) => id.toString()));
  return popular.filter((p) => !excludeStr.has(p._id.toString())).slice(0, limit);
}

/**
 * Fetches browsing history recommendations (products in same categories as viewed, excluding viewed).
 */
async function getBrowsingHistoryRecommendations(userId, limit = 10, excludeProductIds = []) {
  const history = await UserViewHistory.find({ userId })
    .sort({ viewedAt: -1 })
    .limit(10);

  const historyProductIds = history.map((h) => h.productId).filter(Boolean);
  const categories = [...new Set(history.map((h) => h.category).filter(Boolean))];

  if (categories.length === 0) return [];

  const allExcludes = [...excludeProductIds, ...historyProductIds].map((id) => id.toString());

  return await Product.find({
    category: { $in: categories },
    _id: { $nin: allExcludes },
    isActive: true,
  }).limit(limit);
}

/**
 * Fetches wishlist recommendations using collaborative filtering (wishlist overlap).
 * Falls back to category similarity for wishlist items.
 */
async function getWishlistRecommendations(userId, limit = 10, excludeProductIds = []) {
  const userWishlist = await Wishlist.find({ userId });
  if (userWishlist.length === 0) return [];

  const userProductIds = userWishlist.map((w) => w.productId);
  const excludeIds = [...excludeProductIds, ...userProductIds].map((id) => id.toString());

  // 1. Wishlist Overlap (Collaborative Filtering)
  const otherWishlists = await Wishlist.find({
    productId: { $in: userProductIds },
    userId: { $ne: userId },
  }).select("userId");

  const otherUserIds = [...new Set(otherWishlists.map((w) => w.userId))];

  let recommendedProductIds = [];
  if (otherUserIds.length > 0) {
    const overlap = await Wishlist.aggregate([
      {
        $match: {
          userId: { $in: otherUserIds },
          productId: { $nin: excludeIds.map((id) => new mongoose.Types.ObjectId(id)) },
        },
      },
      { $group: { _id: "$productId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]);
    recommendedProductIds = overlap.map((o) => o._id);
  }

  // 2. Fallback to category similarity of user's wishlisted items
  if (recommendedProductIds.length < limit) {
    const wishlistedProducts = await Product.find({ _id: { $in: userProductIds } }).select("category");
    const categories = [...new Set(wishlistedProducts.map((p) => p.category).filter(Boolean))];

    if (categories.length > 0) {
      const categoryMatched = await Product.find({
        category: { $in: categories },
        _id: { $nin: [...excludeIds, ...recommendedProductIds].map((id) => id.toString()) },
        isActive: true,
      })
        .limit(limit - recommendedProductIds.length)
        .select("_id");

      recommendedProductIds = [...recommendedProductIds, ...categoryMatched.map((p) => p._id)];
    }
  }

  return await Product.find({ _id: { $in: recommendedProductIds }, isActive: true });
}

/**
 * Fetches general category recommendations based on aggregated categories.
 */
async function getCategoryRecommendations(userId, limit = 10, excludeProductIds = []) {
  const [history, wishlist] = await Promise.all([
    UserViewHistory.find({ userId }),
    Wishlist.find({ userId }),
  ]);

  const userProductIds = wishlist.map(w => w.productId);
  const wishlistedProducts = await Product.find({ _id: { $in: userProductIds } }).select("category");

  const categoryCounts = {};
  const increment = (cat) => {
    if (!cat) return;
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  };

  history.forEach((h) => increment(h.category));
  wishlistedProducts.forEach((p) => increment(p.category));

  const sortedCategories = Object.keys(categoryCounts).sort(
    (a, b) => categoryCounts[b] - categoryCounts[a]
  );

  if (sortedCategories.length === 0) return [];

  const excludeIds = excludeProductIds.map((id) => id.toString());

  return await Product.find({
    category: { $in: sortedCategories },
    _id: { $nin: excludeIds },
    isActive: true,
  }).limit(limit);
}

/**
 * Fetches similar products for a product detail screen.
 * Recommends items in the same category, excluding current product, cart, and purchases.
 */
async function getSimilarProducts(productId, userId = null, limit = 6) {
  const targetProduct = await Product.findById(productId);
  if (!targetProduct) return [];

  const excludeProductIds = [new mongoose.Types.ObjectId(productId)];

  if (userId) {
    // Exclude cart products
    const cart = await Cart.findOne({ userId });
    if (cart) {
      cart.activeItems.forEach((i) => excludeProductIds.push(i.productId));
    }
    // Exclude purchased products
    const orders = await Order.find({ userId }).select("items.productId");
    orders.forEach((o) => {
      o.items.forEach((i) => {
        if (i.productId) excludeProductIds.push(i.productId);
      });
    });
  }

  // Get products of same category
  let similar = await Product.find({
    category: targetProduct.category,
    _id: { $nin: excludeProductIds },
    isActive: true,
  }).limit(limit);

  // Fallback to popular if not enough
  if (similar.length < limit) {
    const popular = await getPopularProducts(limit - similar.length, excludeProductIds);
    similar = [...similar, ...popular];
  }

  return similar.slice(0, limit);
}

/**
 * Generate Hybrid Personalized Recommendations using scoring weights:
 *   - Category Similarity = 50%
 *   - Wishlist Overlap = 25%
 *   - Browsing History = 15%
 *   - Popularity = 10%
 */
async function generateRecommendations(userId, limit = 10) {
  const startTime = Date.now();

  // 1. Check cache first
  const cachedRecs = recCache.get(userId);
  if (cachedRecs) {
    const hitTime = Date.now() - startTime;
    return {
      recommendations: cachedRecs,
      benchmark: {
        timeMs: hitTime,
        cacheHit: true,
      },
    };
  }

  // 2. Fetch User Profile Context (Roundtrip 1)
  const [cart, orders, wishlist, history] = await Promise.all([
    Cart.findOne({ userId }),
    Order.find({ userId }),
    Wishlist.find({ userId }), 
    UserViewHistory.find({ userId }).sort({ viewedAt: -1 }).limit(50), 
  ]);

  // If no wishlist and no browsing history, trigger cold-start logic
  const isColdStart = wishlist.length === 0 && history.length === 0;

  // Gather exclusions: cart + purchased
  const excludeProductIds = new Set();
  if (cart) {
    cart.activeItems.forEach((item) => excludeProductIds.add(item.productId.toString()));
  }
  orders.forEach((order) => {
    order.items.forEach((item) => {
      if (item.productId) excludeProductIds.add(item.productId.toString());
    });
  });

  const excludeList = Array.from(excludeProductIds).map((id) => new mongoose.Types.ObjectId(id));

  if (isColdStart) {
    // Cold Start: Return popular/trending directly
    const popularRecs = await getPopularProducts(limit, excludeList);
    const executionTime = Date.now() - startTime;

    recCache.set(userId, popularRecs);

    return {
      recommendations: popularRecs,
      benchmark: {
        timeMs: executionTime,
        cacheHit: false,
        coldStart: true,
      },
    };
  }

  // ─────────────────────────────────────────────
  // Parallelized Personalized DB Query Block (Roundtrip 2)
  // ─────────────────────────────────────────────
  const userWishlistedIds = wishlist.map((w) => w.productId).filter(Boolean);

  const [otherWishlists, wishlistedProducts, candidates, popularityData] = await Promise.all([
    // A. Find overlapping wishlist users
    Wishlist.find({
      productId: { $in: userWishlistedIds },
      userId: { $ne: userId },
    }).select("userId"),
    
    // B. Fetch categories of wishlisted products (no populate overhead)
    Product.find({ _id: { $in: userWishlistedIds } }).select("category"),

    // C. Fetch all candidates (excluding purchased/cart items)
    Product.find({
      _id: { $nin: excludeList },
      isActive: true,
    }),

    // D. Fetch popular sales mappings
    getPopularitySalesMap()
  ]);

  // ─────────────────────────────────────────────
  // Fetch Wishlist Overlap Count (Roundtrip 3)
  // ─────────────────────────────────────────────
  const otherUserIds = [...new Set(otherWishlists.map((w) => w.userId))];
  
  let wishlistOverlapCounts = {};
  let maxOverlapCount = 0;

  if (otherUserIds.length > 0) {
    const overlaps = await Wishlist.find({
      userId: { $in: otherUserIds },
      productId: { $nin: userWishlistedIds },
    }).select("productId");

    overlaps.forEach((o) => {
      const pid = o.productId.toString();
      wishlistOverlapCounts[pid] = (wishlistOverlapCounts[pid] || 0) + 1;
    });

    maxOverlapCount = Object.values(wishlistOverlapCounts).reduce((max, val) => Math.max(max, val), 0);
  }

  // ─────────────────────────────────────────────
  // Personalized Scoring Calculations
  // ─────────────────────────────────────────────

  // A. Category Similarity counts (50%)
  const categoryInteractions = {};
  history.forEach((h) => {
    const cat = h.category;
    if (cat) categoryInteractions[cat] = (categoryInteractions[cat] || 0) + 1;
  });
  wishlistedProducts.forEach((p) => {
    const cat = p.category;
    if (cat) categoryInteractions[cat] = (categoryInteractions[cat] || 0) + 2; // Wishlist items get higher weight
  });

  const totalCatInteractions = Object.values(categoryInteractions).reduce((a, b) => a + b, 0);

  // B. Browsing History Recency (15%)
  const categoryRecencyWeight = {};
  history.forEach((h, index) => {
    const cat = h.category;
    if (cat && !categoryRecencyWeight[cat]) {
      categoryRecencyWeight[cat] = Math.max(0.1, (50 - index) / 50);
    }
  });

  // C. Popularity (10%)
  const salesMap = popularityData.salesMap;
  const maxSalesCount = popularityData.maxSalesCount;

  // D. Compute final scored candidates
  const scoredCandidates = candidates.map((p) => {
    const pid = p._id.toString();

    // 1. Category Similarity Score
    const catInteractionCount = categoryInteractions[p.category] || 0;
    const catSimilarityScore = totalCatInteractions > 0 ? catInteractionCount / totalCatInteractions : 0;

    // 2. Wishlist Overlap Score
    const overlapCount = wishlistOverlapCounts[pid] || 0;
    const wishlistOverlapScore = maxOverlapCount > 0 ? overlapCount / maxOverlapCount : 0;

    // 3. Browsing History Score
    const browsingHistoryScore = categoryRecencyWeight[p.category] || 0;

    // 4. Popularity Score
    const productSales = salesMap[pid] || 0;
    const popularityScore = maxSalesCount > 0 ? productSales / maxSalesCount : 0;

    // Weighted Combined Score
    const finalScore =
      0.50 * catSimilarityScore +
      0.25 * wishlistOverlapScore +
      0.15 * browsingHistoryScore +
      0.10 * popularityScore;

    return {
      product: p,
      score: finalScore,
    };
  });

  // Sort candidates by final score descending
  scoredCandidates.sort((a, b) => b.score - a.score);

  // Extract products
  const recommendations = scoredCandidates.slice(0, limit).map((sc) => sc.product);

  // In case candidates are extremely sparse, pad with popular items
  if (recommendations.length < limit) {
    const seenIds = new Set(recommendations.map((r) => r._id.toString()));
    const padExcludeList = [...excludeList, ...Array.from(seenIds).map((id) => new mongoose.Types.ObjectId(id))];
    const padItems = await getPopularProducts(limit - recommendations.length, padExcludeList);
    recommendations.push(...padItems);
  }

  const executionTime = Date.now() - startTime;

  // Cache result
  recCache.set(userId, recommendations);

  return {
    recommendations,
    benchmark: {
      timeMs: executionTime,
      cacheHit: false,
      coldStart: false,
    },
  };
}

module.exports = {
  recordView,
  getPopularProducts,
  getBrowsingHistoryRecommendations,
  getWishlistRecommendations,
  getCategoryRecommendations,
  getSimilarProducts,
  generateRecommendations,
  recCache, // export cache to allow testing / manual invalidation
};
