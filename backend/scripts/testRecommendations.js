const mongoose = require("mongoose");
const dotenv = require("dotenv");
const http = require("http");
const User = require("../models/User");
const Product = require("../models/Product");
const Wishlist = require("../models/Wishlist");
const Cart = require("../models/Cart");
const Order = require("../models/Order");
const UserViewHistory = require("../models/UserViewHistory");
const RecommendationAnalytics = require("../models/RecommendationAnalytics");
const RecommendationService = require("../services/RecommendationService");

dotenv.config();

function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const postData = JSON.stringify(body);

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 80,
      path: parsedUrl.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
      },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on("error", (e) => reject(e));
    req.write(postData);
    req.end();
  });
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on("error", (e) => reject(e));
  });
}

async function runTests() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected.");

  let testUserId;
  let products = [];

  try {
    // 1. Setup/Get Test User
    let user = await User.findOne({ email: "rectest@myntra.dev" });
    if (!user) {
      user = await User.create({
        fullName: "Rec Test User",
        email: "rectest@myntra.dev",
        password: "password123",
      });
    }
    testUserId = user._id;
    console.log(`Using Test User ID: ${testUserId}`);

    // Fetch seeded products
    products = await Product.find({ isActive: true });
    if (products.length < 5) {
      console.log("Not enough products. Re-seeding...");
      const seed = require("../seed");
      await seed();
      products = await Product.find({ isActive: true });
    }
    console.log(`Seeded Products Count: ${products.length}`);

    // Clean up previous test runs for this user
    await UserViewHistory.deleteMany({ userId: testUserId });
    await Wishlist.deleteMany({ userId: testUserId });
    await Cart.deleteMany({ userId: testUserId });
    await Order.deleteMany({ userId: testUserId });
    await RecommendationAnalytics.deleteMany({ userId: testUserId });
    RecommendationService.recCache.clear();

    // ─────────────────────────────────────────────
    // TEST 1: View History Logging & Uniqueness
    // ─────────────────────────────────────────────
    console.log("\nTEST 1: View History Logging & Uniqueness...");
    const productA = products[0];
    const productB = products[1];

    // Log view twice for productA via service
    await RecommendationService.recordView(testUserId, productA._id);
    await RecommendationService.recordView(testUserId, productA._id);

    const historyAfterA = await UserViewHistory.find({ userId: testUserId });
    if (historyAfterA.length !== 1) {
      throw new Error(`Expected exactly 1 view history record (uniqueness/deduplication failed). Found: ${historyAfterA.length}`);
    }
    console.log("  ✅ View history deduplication working.");

    // Log view for productB
    await RecommendationService.recordView(testUserId, productB._id);
    const historyAfterB = await UserViewHistory.find({ userId: testUserId });
    if (historyAfterB.length !== 2) {
      throw new Error(`Expected exactly 2 view history records. Found: ${historyAfterB.length}`);
    }
    console.log("  ✅ Multiple unique product views tracked correctly.");

    // ─────────────────────────────────────────────
    // TEST 2: Capping view history at last 50 entries
    // ─────────────────────────────────────────────
    console.log("\nTEST 2: View History Capping...");
    // Let's create 55 fake products or simulate logging views for 55 distinct items
    const originalCount = await UserViewHistory.countDocuments({ userId: testUserId });
    
    // We will generate 55 dummy products for this test to avoid messing up main catalog
    const dummyProducts = [];
    for (let i = 0; i < 55; i++) {
      dummyProducts.push({
        name: `Dummy Product ${i}`,
        brand: "DummyBrand",
        price: 999,
        category: "Men",
        isActive: true,
      });
    }
    const insertedDummies = await Product.insertMany(dummyProducts);
    
    // Record views for all 55 dummy products
    for (const dummy of insertedDummies) {
      await RecommendationService.recordView(testUserId, dummy._id);
    }

    const historyCount = await UserViewHistory.countDocuments({ userId: testUserId });
    if (historyCount > 50) {
      throw new Error(`History limit capping failed. Found ${historyCount} records (expected <= 50).`);
    }
    console.log(`  ✅ Capping successful. Total views in database: ${historyCount}`);

    // Clean up dummies
    await Product.deleteMany({ brand: "DummyBrand" });
    await UserViewHistory.deleteMany({ userId: testUserId });

    // ─────────────────────────────────────────────
    // TEST 3: Recommendation Cache & Invalidation
    // ─────────────────────────────────────────────
    console.log("\nTEST 3: Recommendation Caching & Invalidation...");
    
    // First generation (Cache Miss)
    const run1 = await RecommendationService.generateRecommendations(testUserId, 4);
    if (run1.benchmark.cacheHit !== false) {
      throw new Error("Expected cacheHit to be false on first run.");
    }
    console.log(`  ✅ Run 1 (Cache Miss) complete in ${run1.benchmark.timeMs}ms.`);

    // Second generation (Cache Hit)
    const run2 = await RecommendationService.generateRecommendations(testUserId, 4);
    if (run2.benchmark.cacheHit !== true) {
      throw new Error("Expected cacheHit to be true on second run.");
    }
    console.log(`  ✅ Run 2 (Cache Hit) complete in ${run2.benchmark.timeMs}ms.`);

    // Record view to invalidate cache
    await RecommendationService.recordView(testUserId, productA._id);
    
    // Third generation (Cache Miss due to Invalidation)
    const run3 = await RecommendationService.generateRecommendations(testUserId, 4);
    if (run3.benchmark.cacheHit !== false) {
      throw new Error("Expected cacheHit to be false after invalidation.");
    }
    console.log(`  ✅ Cache invalidation successful on view tracking.`);

    // ─────────────────────────────────────────────
    // TEST 4: Cold Start Handler
    // ─────────────────────────────────────────────
    console.log("\nTEST 4: Cold Start Handler...");
    const coldUser = await User.create({
      fullName: "Cold Start User",
      email: `cold_${Date.now()}@myntra.dev`,
      password: "password123",
    });

    const coldRecs = await RecommendationService.generateRecommendations(coldUser._id, 4);
    if (coldRecs.benchmark.coldStart !== true || coldRecs.recommendations.length === 0) {
      throw new Error("Cold start handling failed. Should return popular fallback products.");
    }
    console.log(`  ✅ Cold start fallback triggered. Returned ${coldRecs.recommendations.length} trending items.`);
    await User.deleteOne({ _id: coldUser._id });

    // ─────────────────────────────────────────────
    // TEST 5: Cart & Purchase Exclusions
    // ─────────────────────────────────────────────
    console.log("\nTEST 5: Cart & Purchase Exclusions...");
    const targetProduct = products[2]; // Let's use this for exclusion test
    
    // Put target product in user's cart
    await Cart.create({
      userId: testUserId,
      version: 1,
      activeItems: [
        {
          productId: targetProduct._id,
          size: "M",
          quantity: 1,
          priceAtAdd: targetProduct.price,
        }
      ]
    });

    RecommendationService.recCache.clear();
    const recsWithCartExclusion = await RecommendationService.generateRecommendations(testUserId, 10);
    const hasCartItem = recsWithCartExclusion.recommendations.some(r => r._id.toString() === targetProduct._id.toString());
    if (hasCartItem) {
      throw new Error("Cart exclusion failed. Recommended product that is already in user's active cart.");
    }
    console.log("  ✅ Cart exclusion verified.");

    // Clear cart and purchase a product instead
    await Cart.deleteMany({ userId: testUserId });
    const purchasedProduct = products[3];
    await Order.create({
      userId: testUserId,
      date: new Date().toLocaleDateString(),
      status: "Placed",
      items: [
        {
          productId: purchasedProduct._id,
          size: "L",
          price: purchasedProduct.price,
          quantity: 1,
        }
      ],
      total: purchasedProduct.price,
    });

    RecommendationService.recCache.clear();
    const recsWithPurchaseExclusion = await RecommendationService.generateRecommendations(testUserId, 10);
    const hasPurchasedItem = recsWithPurchaseExclusion.recommendations.some(r => r._id.toString() === purchasedProduct._id.toString());
    if (hasPurchasedItem) {
      throw new Error("Purchase exclusion failed. Recommended product that was already purchased.");
    }
    console.log("  ✅ Purchased items exclusion verified.");
    await Order.deleteMany({ userId: testUserId });

    // ─────────────────────────────────────────────
    // TEST 6: API Integration
    // ─────────────────────────────────────────────
    console.log("\nTEST 6: API Integration Verification...");
    
    // Test POST /recommendations/view
    const apiViewRes = await postJson("http://localhost:5000/recommendations/view", {
      userId: testUserId.toString(),
      productId: productB._id.toString(),
    });
    if (apiViewRes.status !== 200 || !apiViewRes.body.success) {
      throw new Error(`POST /recommendations/view failed: ${JSON.stringify(apiViewRes.body)}`);
    }
    console.log("  ✅ POST /recommendations/view endpoint responded 200");

    // Test GET /recommendations/popular
    const apiPopRes = await getJson("http://localhost:5000/recommendations/popular?limit=3");
    if (apiPopRes.status !== 200 || apiPopRes.body.length === 0) {
      throw new Error(`GET /recommendations/popular failed: ${JSON.stringify(apiPopRes.body)}`);
    }
    console.log(`  ✅ GET /recommendations/popular responded 200. Returned: ${apiPopRes.body.length} products.`);

    // Test GET /recommendations/:userId
    const apiUserRes = await getJson(`http://localhost:5000/recommendations/${testUserId}?limit=4`);
    if (apiUserRes.status !== 200 || !apiUserRes.body.recommendations) {
      throw new Error(`GET /recommendations/:userId failed: ${JSON.stringify(apiUserRes.body)}`);
    }
    console.log(`  ✅ GET /recommendations/:userId responded 200. Recs count: ${apiUserRes.body.recommendations.length}`);

    // Test GET /recommendations/similar/:productId
    const apiSimRes = await getJson(`http://localhost:5000/recommendations/similar/${productA._id}?userId=${testUserId}`);
    if (apiSimRes.status !== 200 || apiSimRes.body.length === 0) {
      throw new Error(`GET /recommendations/similar/:productId failed: ${JSON.stringify(apiSimRes.body)}`);
    }
    console.log(`  ✅ GET /recommendations/similar/:productId responded 200. Similar count: ${apiSimRes.body.length}`);

    // Test POST /recommendations/analytics (Impression)
    const apiImpRes = await postJson("http://localhost:5000/recommendations/analytics", {
      userId: testUserId.toString(),
      recommendationId: productA._id.toString(),
      clicked: false,
    });
    if (apiImpRes.status !== 200 || !apiImpRes.body.success) {
      throw new Error(`POST /recommendations/analytics impression failed: ${JSON.stringify(apiImpRes.body)}`);
    }
    console.log("  ✅ Recommendation impression tracked successfully.");

    // Test POST /recommendations/analytics (Click conversion)
    const apiClickRes = await postJson("http://localhost:5000/recommendations/analytics", {
      userId: testUserId.toString(),
      recommendationId: productA._id.toString(),
      clicked: true,
    });
    if (apiClickRes.status !== 200 || !apiClickRes.body.success) {
      throw new Error(`POST /recommendations/analytics click failed: ${JSON.stringify(apiClickRes.body)}`);
    }
    console.log("  ✅ Recommendation click conversion tracked successfully.");

    // ─────────────────────────────────────────────
    // TEST 7: Query Speeds and Benchmarking
    // ─────────────────────────────────────────────
    console.log("\nTEST 7: Performance Benchmarking (Response Times)...");
    const iterations = 50;
    let totalTime = 0;

    for (let i = 0; i < iterations; i++) {
      // Clear cache so we check actual DB query execution speed
      RecommendationService.recCache.clear();
      const start = Date.now();
      await RecommendationService.generateRecommendations(testUserId, 6);
      totalTime += (Date.now() - start);
    }
    
    const avgTime = totalTime / iterations;
    console.log(`  📊 Average recommendation latency (DB roundtrip, cache disabled): ${avgTime.toFixed(2)}ms`);
    if (avgTime > 200) {
      throw new Error(`Average query latency is ${avgTime}ms, exceeding the 200ms target limit!`);
    }
    console.log("  ✅ Benchmark performance met target latency (< 200ms) successfully!");

    console.log("\n═══════════════════════════════════════════");
    console.log("  RESULTS: All Personalization Engine tests PASSED!");
    console.log("═══════════════════════════════════════════");

  } catch (error) {
    console.error("\n❌ Test FAILED:", error);
  } finally {
    // Clean up
    console.log("Cleaning up test records...");
    if (testUserId) {
      await UserViewHistory.deleteMany({ userId: testUserId });
      await Wishlist.deleteMany({ userId: testUserId });
      await Cart.deleteMany({ userId: testUserId });
      await Order.deleteMany({ userId: testUserId });
      await RecommendationAnalytics.deleteMany({ userId: testUserId });
      await User.deleteOne({ _id: testUserId });
    }
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

runTests();
