const express = require("express");
const router = express.Router();
const CartService = require("../services/CartService");
const CheckoutValidationService = require("../services/CheckoutValidationService");

// ─────────────────────────────────────────────────────────────────
// Helper: uniform conflict response
// ─────────────────────────────────────────────────────────────────
function sendConflict(res, result) {
  return res.status(409).json({
    conflict: true,
    message: "Cart was updated by another session. Please sync and retry.",
    serverVersion: result.serverVersion,
    serverCart: result.serverCart,
  });
}

// ─────────────────────────────────────────────────────────────────
// GET /cart/:userId or GET /cart?userId=...
// Returns full cart with populated product details + computed totals
// ─────────────────────────────────────────────────────────────────
async function getCartHandler(req, res) {
  try {
    const userId = req.params.userId || req.query.userId;
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }
    const cart = await CartService.getCart(userId);

    // Compute active-item totals server-side
    const activeTotal = cart.activeItems.reduce((sum, item) => {
      const price = item.productId?.price ?? item.priceAtAdd ?? 0;
      return sum + price * item.quantity;
    }, 0);

    const itemCount = cart.activeItems.reduce((sum, item) => sum + item.quantity, 0);

    res.json({
      cart,
      totals: {
        itemCount,
        activeTotal: Math.round(activeTotal * 100) / 100,
        savedCount: cart.savedItems.length,
      },
    });
  } catch (err) {
    console.error("[CartRoutes] GET /cart error:", err);
    res.status(500).json({ error: "Failed to fetch cart" });
  }
}

router.get("/:userId", getCartHandler);
router.get("/", getCartHandler);

// ─────────────────────────────────────────────────────────────────
// POST /cart/add
// Body: { userId, productId, size, quantity, version }
// ─────────────────────────────────────────────────────────────────
router.post("/add", async (req, res) => {
  try {
    const { userId, productId, size, quantity = 1, version = 0 } = req.body;

    if (!userId || !productId || !size) {
      return res.status(400).json({ error: "userId, productId, and size are required" });
    }

    const result = await CartService.addItem(userId, productId, size, quantity, version, req);

    if (result.conflict) return sendConflict(res, result);
    if (result.error) return res.status(result.status || 400).json({ error: result.error });

    res.json({ success: true, cart: result.cart, version: result.cart.version });
  } catch (err) {
    console.error("[CartRoutes] POST /cart/add error:", err);
    res.status(500).json({ error: "Failed to add item to cart" });
  }
});

// ─────────────────────────────────────────────────────────────────
// PUT /cart/update
// Body: { userId, itemId, quantity, version }
// quantity === 0 removes the item
// ─────────────────────────────────────────────────────────────────
router.put("/update", async (req, res) => {
  try {
    const { userId, itemId, quantity, version } = req.body;

    if (!userId || !itemId || quantity === undefined || version === undefined) {
      return res.status(400).json({ error: "userId, itemId, quantity, and version are required" });
    }

    const result = await CartService.updateQuantity(userId, itemId, quantity, version, req);

    if (result.conflict) return sendConflict(res, result);
    if (result.error) return res.status(result.status || 400).json({ error: result.error });

    res.json({ success: true, cart: result.cart, version: result.cart.version });
  } catch (err) {
    console.error("[CartRoutes] PUT /cart/update error:", err);
    res.status(500).json({ error: "Failed to update cart item" });
  }
});

// ─────────────────────────────────────────────────────────────────
// DELETE /cart/remove
// Body: { userId, itemId, version }
// ─────────────────────────────────────────────────────────────────
router.delete("/remove", async (req, res) => {
  try {
    const { userId, itemId, version } = req.body;

    if (!userId || !itemId || version === undefined) {
      return res.status(400).json({ error: "userId, itemId, and version are required" });
    }

    const result = await CartService.removeItem(userId, itemId, version, req);

    if (result.conflict) return sendConflict(res, result);
    if (result.error) return res.status(result.status || 400).json({ error: result.error });

    res.json({ success: true, cart: result.cart, version: result.cart.version });
  } catch (err) {
    console.error("[CartRoutes] DELETE /cart/remove error:", err);
    res.status(500).json({ error: "Failed to remove item from cart" });
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /cart/save-for-later
// Body: { userId, itemId, version }
// Moves item from activeItems[] → savedItems[]
// ─────────────────────────────────────────────────────────────────
router.post("/save-for-later", async (req, res) => {
  try {
    const { userId, itemId, version } = req.body;

    if (!userId || !itemId || version === undefined) {
      return res.status(400).json({ error: "userId, itemId, and version are required" });
    }

    const result = await CartService.moveToSaveForLater(userId, itemId, version, req);

    if (result.conflict) return sendConflict(res, result);
    if (result.error) return res.status(result.status || 400).json({ error: result.error });

    res.json({ success: true, cart: result.cart, version: result.cart.version });
  } catch (err) {
    console.error("[CartRoutes] POST /cart/save-for-later error:", err);
    res.status(500).json({ error: "Failed to save item for later" });
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /cart/move-to-cart
// Body: { userId, savedItemId, version }
// Moves item from savedItems[] → activeItems[]
// ─────────────────────────────────────────────────────────────────
router.post("/move-to-cart", async (req, res) => {
  try {
    const { userId, savedItemId, version } = req.body;

    if (!userId || !savedItemId || version === undefined) {
      return res.status(400).json({ error: "userId, savedItemId, and version are required" });
    }

    const result = await CartService.moveToCart(userId, savedItemId, version, req);

    if (result.conflict) return sendConflict(res, result);
    if (result.error) return res.status(result.status || 400).json({ error: result.error });

    res.json({ success: true, cart: result.cart, version: result.cart.version });
  } catch (err) {
    console.error("[CartRoutes] POST /cart/move-to-cart error:", err);
    res.status(500).json({ error: "Failed to move item to cart" });
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /cart/validate
// Body: { userId }
// Pre-checkout validation: stock, price changes, discontinued products
// ─────────────────────────────────────────────────────────────────
router.post("/validate", async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const cart = await CartService.getCart(userId);

    if (!cart || cart.activeItems.length === 0) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    const validation = await CheckoutValidationService.validateCart(cart.activeItems);

    // Audit the validation attempt (Requirement #15)
    const CartAudit = require("../models/CartAudit");
    await CartAudit.create({
      userId,
      action: "Checkout Validation",
      cartVersionAfter: cart.version,
      timestamp: new Date(),
      metadata: { valid: validation.valid, errorsCount: validation.errors.length, warningsCount: validation.warnings.length },
      ipAddress: req.ip || req.headers?.["x-forwarded-for"] || "",
      userAgent: req.headers?.["user-agent"] || "",
    });

    res.json({
      ...validation,
      cartVersion: cart.version,
    });
  } catch (err) {
    console.error("[CartRoutes] POST /cart/validate error:", err);
    res.status(500).json({ error: "Failed to validate cart" });
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /cart/refresh-prices
// Body: { userId, version }
// Updates activeItems prices to current catalog prices
// ─────────────────────────────────────────────────────────────────
router.post("/refresh-prices", async (req, res) => {
  try {
    const { userId, version } = req.body;
    if (!userId || version === undefined) {
      return res.status(400).json({ error: "userId and version are required" });
    }

    const Cart = require("../models/Cart");
    const Product = require("../models/Product");

    const cart = await Cart.findOne({ userId });
    if (!cart) return res.status(404).json({ error: "Cart not found" });

    if (cart.version !== version) {
      const serverCart = await CartService.getCart(userId);
      return sendConflict(res, { serverVersion: cart.version, serverCart });
    }

    // Fetch live catalog details for items in cart
    const productIds = cart.activeItems.map((item) => item.productId);
    const products = await Product.find({ _id: { $in: productIds } }).lean();
    const productMap = Object.fromEntries(products.map((p) => [p._id.toString(), p]));

    // Update prices
    for (const item of cart.activeItems) {
      const liveProd = productMap[item.productId.toString()];
      if (liveProd) {
        item.priceAtAdd = liveProd.price;
      }
    }

    cart.version += 1;
    cart.lastSyncedAt = new Date();
    await cart.save();

    const updatedCart = await CartService.getCart(userId);
    res.json({ success: true, cart: updatedCart, version: updatedCart.version });
  } catch (err) {
    console.error("[CartRoutes] POST /cart/refresh-prices error:", err);
    res.status(500).json({ error: "Failed to refresh cart prices" });
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /cart/sync
// Body: { userId, version }
// ─────────────────────────────────────────────────────────────────
router.post("/sync", async (req, res) => {
  try {
    const { userId, version } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const result = await CartService.synchronizeCart(userId, version);
    if (result.conflict) return sendConflict(res, result);

    res.json({ success: true, cart: result.cart, version: result.cart.version });
  } catch (err) {
    console.error("[CartRoutes] POST /cart/sync error:", err);
    res.status(500).json({ error: "Failed to sync cart" });
  }
});

module.exports = router;
