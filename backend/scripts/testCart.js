/**
 * testCart.js — Integration test suite for the Concurrency-Safe Cart system.
 */

const mongoose = require("mongoose");
const dotenv = require("dotenv");
const http = require("http");
const path = require("path");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

// ── Inline HTTP helpers ──────────────────────────────────────────
function apiRequest(method, path, body = null) {
  return new Promise((resolve) => {
    const postData = body ? JSON.stringify(body) : null;
    const options = {
      hostname: "localhost",
      port: 5000,
      path,
      method,
      headers: {
        "Content-Type": "application/json",
        ...(postData ? { "Content-Length": Buffer.byteLength(postData) } : {}),
      },
    };
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on("error", (e) => resolve({ status: 500, error: e.message }));
    if (postData) req.write(postData);
    req.end();
  });
}

const get  = (path)        => apiRequest("GET",    path);
const post = (path, body)  => apiRequest("POST",   path, body);
const put  = (path, body)  => apiRequest("PUT",    path, body);
const del  = (path, body)  => apiRequest("DELETE", path, body);

// ── Test runner ──────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(condition, label, detail = "") {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

// ── Main ─────────────────────────────────────────────────────────
async function run() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected.\n");

  const User    = require("../models/User");
  const Product = require("../models/Product");
  const Cart    = require("../models/Cart");
  const CartAudit = require("../models/CartAudit");
  const Order   = require("../models/Order");

  // ── Setup: get or create test user and two products ─────────────
  let user = await User.findOne({ email: "carttest@myntra.dev" });
  if (!user) {
    user = await User.create({
      fullName: "Cart Tester",
      email: "carttest@myntra.dev",
      password: "test1234",
    });
  }
  const userId = user._id.toString();
  console.log(`Using test user: ${user.email} (${userId})\n`);

  // Clean slate
  await Cart.deleteMany({ userId: user._id });
  await CartAudit.deleteMany({ userId: user._id });
  await Order.deleteMany({ userId: user._id });

  // Ensure product has stock + isActive
  let product = await Product.findOne();
  if (!product) {
    product = await Product.create({
      name: "Casual White T-Shirt",
      brand: "Roadster",
      price: 499,
      discount: "10%",
      description: "Comfortable t-shirt",
      sizes: ["S", "M", "L"],
      images: ["https://picsum.photos/200"],
      stock: 10,
      isActive: true,
    });
  }
  await Product.updateOne({ _id: product._id }, { $set: { stock: 10, isActive: true } });
  const productId = product._id.toString();

  // ════════════════════════════════════════════════════════════════
  // TEST 1: Add item — creates cart on first add
  // ════════════════════════════════════════════════════════════════
  console.log("TEST 1: Add item to empty cart");
  const add1 = await post("/cart/add", { userId, productId, size: "M", quantity: 1, version: 0 });
  assert(add1.status === 200, "Status 200");
  assert(add1.body.cart?.activeItems?.length === 1, "Cart has 1 item");
  assert(add1.body.cart?.version === 1, "Version incremented to 1");
  let currentVersion = add1.body.cart?.version ?? 0;
  const itemId = add1.body.cart?.activeItems?.[0]?._id;
  console.log();

  // ════════════════════════════════════════════════════════════════
  // TEST 2: Deduplication — same product+size → increments quantity
  // ════════════════════════════════════════════════════════════════
  console.log("TEST 2: Add same product+size again (deduplication)");
  const add2 = await post("/cart/add", { userId, productId, size: "M", quantity: 2, version: currentVersion });
  assert(add2.status === 200, "Status 200");
  assert(add2.body.cart?.activeItems?.length === 1, "Still only 1 line item (no duplicate row)");
  assert(add2.body.cart?.activeItems[0]?.quantity === 3, "Quantity incremented to 3");
  currentVersion = add2.body.cart.version;
  console.log();

  // ════════════════════════════════════════════════════════════════
  // TEST 3: Quantity update
  // ════════════════════════════════════════════════════════════════
  console.log("TEST 3: Update item quantity");
  const upd1 = await put("/cart/update", { userId, itemId, quantity: 2, version: currentVersion });
  assert(upd1.status === 200, "Status 200");
  assert(upd1.body.cart?.activeItems[0]?.quantity === 2, "Quantity updated to 2");
  currentVersion = upd1.body.cart.version;
  console.log();

  // ════════════════════════════════════════════════════════════════
  // TEST 4: Save For Later
  // ════════════════════════════════════════════════════════════════
  console.log("TEST 4: Save item for later");
  const save1 = await post("/cart/save-for-later", { userId, itemId, version: currentVersion });
  assert(save1.status === 200, "Status 200");
  assert(save1.body.cart?.activeItems?.length === 0, "Active cart is now empty");
  assert(save1.body.cart?.savedItems?.length === 1, "Saved items has 1 entry");
  currentVersion = save1.body.cart.version;
  const savedItemId = save1.body.cart.savedItems[0]._id;
  console.log();

  // ════════════════════════════════════════════════════════════════
  // TEST 5: Cart totals exclude saved items
  // ════════════════════════════════════════════════════════════════
  console.log("TEST 5: Saved items excluded from totals");
  const cartFetch = await get(`/cart/${userId}`);
  assert(cartFetch.status === 200, "Status 200");
  assert(cartFetch.body.totals?.itemCount === 0, "itemCount is 0 (saved item not counted)");
  assert(cartFetch.body.totals?.activeTotal === 0, "activeTotal is 0");
  console.log();

  // ════════════════════════════════════════════════════════════════
  // TEST 6: Move To Cart
  // ════════════════════════════════════════════════════════════════
  console.log("TEST 6: Move saved item back to cart");
  const move1 = await post("/cart/move-to-cart", { userId, savedItemId, version: currentVersion });
  assert(move1.status === 200, "Status 200");
  assert(move1.body.cart?.activeItems?.length === 1, "Active cart has 1 item again");
  assert(move1.body.cart?.savedItems?.length === 0, "Saved items empty");
  currentVersion = move1.body.cart.version;
  const itemId2 = move1.body.cart.activeItems[0]._id;
  console.log();

  // ════════════════════════════════════════════════════════════════
  // TEST 7: Remove item
  // ════════════════════════════════════════════════════════════════
  console.log("TEST 7: Remove item from cart");
  const rem1 = await del("/cart/remove", { userId, itemId: itemId2, version: currentVersion });
  assert(rem1.status === 200, "Status 200");
  assert(rem1.body.cart?.activeItems?.length === 0, "Cart is empty after remove");
  currentVersion = rem1.body.cart.version;
  console.log();

  // ════════════════════════════════════════════════════════════════
  // TEST 8: Optimistic locking — concurrent update conflict
  // ════════════════════════════════════════════════════════════════
  console.log("TEST 8: Concurrent conflict detection (optimistic locking)");
  const addFresh = await post("/cart/add", { userId, productId, size: "L", quantity: 1, version: currentVersion });
  assert(addFresh.status === 200, "Added item for conflict test");
  currentVersion = addFresh.body.cart.version;
  const freshItemId = addFresh.body.cart.activeItems[0]._id;

  // "Device A" updates with correct version
  const devA = await put("/cart/update", { userId, itemId: freshItemId, quantity: 3, version: currentVersion });
  assert(devA.status === 200, "Device A update succeeded");

  // "Device B" tries to update with old (stale) version
  const devB = await put("/cart/update", { userId, itemId: freshItemId, quantity: 5, version: currentVersion });
  assert(devB.status === 409, "Device B receives 409 Conflict");
  assert(devB.body.conflict === true, "Conflict flag is true");
  assert(typeof devB.body.serverCart === "object", "Server cart returned for re-sync");
  currentVersion = devA.body.cart.version;
  console.log();

  // ════════════════════════════════════════════════════════════════
  // TEST 9: Multi-device sync simulation
  // ════════════════════════════════════════════════════════════════
  console.log("TEST 9: Multi-device sync — client re-syncs after conflict");
  const syncedVersion = devB.body.serverCart.version;
  const syncedItemId  = devB.body.serverCart.activeItems[0]?._id;
  assert(syncedVersion === currentVersion, "Client synced to correct server version");
  assert(syncedItemId !== undefined, "Client has valid item ID from server cart");

  // Retry with synced version — should succeed
  const retry = await put("/cart/update", { userId, itemId: syncedItemId, quantity: 5, version: syncedVersion });
  assert(retry.status === 200, "Retry with synced version succeeded");
  currentVersion = retry.body.cart.version;
  console.log();

  // ════════════════════════════════════════════════════════════════
  // TEST 10: Checkout validation — stock check
  // ════════════════════════════════════════════════════════════════
  console.log("TEST 10: Checkout validation — out of stock");
  await Product.updateOne({ _id: product._id }, { $set: { stock: 2 } }); // current quantity in cart is 5
  const val1 = await post("/cart/validate", { userId });
  assert(val1.status === 200, "Validate endpoint responded");
  assert(val1.body.valid === false, "Validation failed (stock too low)");
  assert(val1.body.errors?.some((e) => e.type === "OUT_OF_STOCK"), "OUT_OF_STOCK error present");
  await Product.updateOne({ _id: product._id }, { $set: { stock: 10 } });
  console.log();

  // ════════════════════════════════════════════════════════════════
  // TEST 11: Checkout validation — price change detection
  // ════════════════════════════════════════════════════════════════
  console.log("TEST 11: Checkout validation — price change detection");
  const cartDoc = await Cart.findOne({ userId: user._id });
  const currentItem = cartDoc.activeItems[0];
  // Artificially set priceAtAdd to differ from product.price
  await Cart.updateOne(
    { userId: user._id, "activeItems._id": currentItem._id },
    { $set: { "activeItems.$.priceAtAdd": 9999 } }
  );
  const val2 = await post("/cart/validate", { userId });
  assert(val2.status === 200, "Validate endpoint responded");
  assert(val2.body.warnings?.some((w) => w.type === "PRICE_CHANGED"), "PRICE_CHANGED warning present");
  console.log();

  // ════════════════════════════════════════════════════════════════
  // TEST 12: Price Refresh API
  // ════════════════════════════════════════════════════════════════
  console.log("TEST 12: Price Refresh API /cart/refresh-prices");
  const refRes = await post("/cart/refresh-prices", { userId, version: currentVersion });
  assert(refRes.status === 200, "Refresh prices responded 200");
  assert(refRes.body.cart.activeItems[0].priceAtAdd === product.price, "priceAtAdd restored to live product price");
  currentVersion = refRes.body.cart.version;
  console.log();

  // ════════════════════════════════════════════════════════════════
  // TEST 13: Checkout validation — discontinued product
  // ════════════════════════════════════════════════════════════════
  console.log("TEST 13: Checkout validation — discontinued product");
  await Product.updateOne({ _id: product._id }, { $set: { isActive: false } });
  const val3 = await post("/cart/validate", { userId });
  assert(val3.status === 200, "Validate endpoint responded");
  assert(val3.body.valid === false, "Validation failed (product discontinued)");
  assert(val3.body.errors?.some((e) => e.type === "DISCONTINUED"), "DISCONTINUED error present");
  await Product.updateOne({ _id: product._id }, { $set: { isActive: true } });
  console.log();

  // ════════════════════════════════════════════════════════════════
  // TEST 14: Sync API
  // ════════════════════════════════════════════════════════════════
  console.log("TEST 14: Sync API /cart/sync");
  const syncRes = await post("/cart/sync", { userId, version: currentVersion });
  assert(syncRes.status === 200, "Sync responded 200");
  assert(syncRes.body.cart.version === currentVersion, "Sync returned correct version");
  console.log();

  // ════════════════════════════════════════════════════════════════
  // TEST 15: Checkout Order Placement & Stock Decrement (Transaction)
  // ════════════════════════════════════════════════════════════════
  console.log("TEST 15: Order Placement Transaction");
  // Set quantity in cart to 2
  const finalCart = await Cart.findOne({ userId });
  const itemToOrder = finalCart.activeItems[0];
  const updQty = await put("/cart/update", { userId, itemId: itemToOrder._id, quantity: 2, version: currentVersion });
  currentVersion = updQty.body.cart.version;

  // Set product stock to 5
  await Product.updateOne({ _id: product._id }, { $set: { stock: 5 } });

  // Place order
  const orderRes = await post(`/Order/create/${userId}`, {
    shippingAddress: "Tester Road, Bangalore, Karnataka, 560001, India",
    paymentMethod: "Card",
  });
  assert(orderRes.status === 200, "Order placed successfully");
  assert(orderRes.body.orderId !== undefined, "Order ID generated");

  // Verify stock decremented (5 - 2 = 3)
  const updatedProduct = await Product.findById(productId);
  assert(updatedProduct.stock === 3, `Stock decremented correctly to ${updatedProduct.stock}`);

  // Verify cart active items cleared
  const clearedCart = await Cart.findOne({ userId });
  assert(clearedCart.activeItems.length === 0, "Active cart items cleared after checkout");
  console.log();

  // ════════════════════════════════════════════════════════════════
  // TEST 16: CartAudit — verify audit entries exist
  // ════════════════════════════════════════════════════════════════
  console.log("TEST 16: CartAudit logging");
  const audits = await CartAudit.find({ userId: user._id }).sort({ createdAt: 1 });
  const auditActions = audits.map((a) => a.action);
  assert(auditActions.includes("Add Item"), "Add Item audited");
  assert(auditActions.includes("Quantity Change"), "Quantity Change audited");
  assert(auditActions.includes("Remove Item") || auditActions.includes("Checkout Validation"), "Remove Item or Checkout Validation audited");
  assert(audits.every(a => a.quantity !== undefined), "Quantity field present in all audits");
  assert(audits.every(a => a.timestamp !== undefined), "Timestamp field present in all audits");
  console.log(`  Audit entries recorded: ${audits.length}`);
  console.log();

  // ════════════════════════════════════════════════════════════════
  // Cleanup test data
  // ════════════════════════════════════════════════════════════════
  await Cart.deleteMany({ userId: user._id });
  await CartAudit.deleteMany({ userId: user._id });
  await Order.deleteMany({ userId: user._id });
  console.log("Test data cleaned up.\n");

  // ── Summary ────────────────────────────────────────────────────
  console.log("═══════════════════════════════════════════");
  console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log("  🎉 All tests passed!");
  } else {
    console.log("  ⚠️  Some tests failed. See above for details.");
  }
  console.log("═══════════════════════════════════════════");

  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("Unexpected test error:", err);
  mongoose.disconnect();
  process.exit(1);
});
