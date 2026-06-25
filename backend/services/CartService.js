const Cart = require("../models/Cart");
const CartAudit = require("../models/CartAudit");
const Product = require("../models/Product");

/**
 * CartService — All business logic for the versioned cart system.
 *
 * OPTIMISTIC LOCKING PROTOCOL:
 *   Every mutating operation accepts a `clientVersion` parameter.
 *   The operation only proceeds if cart.version === clientVersion.
 *   On success, version is atomically incremented via $inc.
 *   On mismatch, a CONFLICT object is returned instead of throwing.
 *
 * CONFLICT RESOLUTION:
 *   The caller (route handler) detects { conflict: true } and returns
 *   HTTP 409 with the current server cart, so the client can re-sync
 *   its local state and retry if needed.
 */

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Atomically find-or-create a cart document for a user.
 * Uses findOneAndUpdate with upsert to be race-condition safe.
 */
async function getOrCreateCart(userId) {
  const cart = await Cart.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId, version: 0, activeItems: [], savedItems: [] } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).populate("activeItems.productId savedItems.productId");
  return cart;
}

/**
 * Write a CartAudit entry. Fire-and-forget — never blocks the main flow.
 */
async function audit(userId, action, productId, cartVersionAfter, metadata, req) {
  try {
    const quantity = metadata?.quantity || 0;
    await CartAudit.create({
      userId,
      action,
      productId,
      quantity,
      timestamp: new Date(),
      cartVersionAfter,
      metadata,
      ipAddress: req?.ip || req?.headers?.["x-forwarded-for"] || "",
      userAgent: req?.headers?.["user-agent"] || "",
    });
  } catch (err) {
    console.error("[CartAudit] Failed to write audit entry:", err.message);
  }
}

// ─────────────────────────────────────────────
// Exported Service Methods
// ─────────────────────────────────────────────

/**
 * GET: Return the user's full cart with populated product details.
 */
async function getCart(userId) {
  return await getOrCreateCart(userId);
}

/**
 * POST /cart/add
 * Add a product to the active cart.
 *  - If the same productId+size already exists → increment quantity (dedup).
 *  - Validates clientVersion for optimistic locking.
 *  - Records priceAtAdd from current product price.
 */
async function addItem(userId, productId, size, quantity, clientVersion, req) {
  const product = await Product.findById(productId);
  if (!product) return { error: "Product not found", status: 404 };

  // Ensure cart exists (upsert-safe, race-condition-safe)
  await Cart.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId, version: 0, activeItems: [], savedItems: [] } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Read the cart we just ensured exists
  const cart = await Cart.findOne({ userId });

  // If clientVersion is not provided, default to current server version to skip conflict check
  const versionToUse = clientVersion !== undefined ? clientVersion : cart.version;

  // For brand-new cart, versionToUse should match cart.version (both 0)
  if (cart.version !== versionToUse) {
    const serverCart = await getOrCreateCart(userId);
    return { conflict: true, serverVersion: cart.version, serverCart };
  }

  // Deduplication: check if item with same productId+size already exists
  const existingIdx = cart.activeItems.findIndex(
    (i) => i.productId.toString() === productId.toString() && i.size === size
  );

  let updatedCart;
  if (existingIdx !== -1) {
    const newQty = Math.min(cart.activeItems[existingIdx].quantity + quantity, 10);
    updatedCart = await Cart.findOneAndUpdate(
      { userId, version: versionToUse },
      {
        $set: { [`activeItems.${existingIdx}.quantity`]: newQty, lastSyncedAt: new Date() },
        $inc: { version: 1 },
      },
      { new: true }
    );
  } else {
    updatedCart = await Cart.findOneAndUpdate(
      { userId, version: versionToUse },
      {
        $push: { activeItems: { productId, size, quantity, priceAtAdd: product.price } },
        $inc: { version: 1 },
        $set: { lastSyncedAt: new Date() },
      },
      { new: true }
    );
  }

  if (!updatedCart) {
    const serverCart = await getOrCreateCart(userId);
    return { conflict: true, serverVersion: serverCart.version, serverCart };
  }

  await audit(userId, "Add Item", productId, updatedCart.version, { size, quantity }, req);
  return { cart: await getOrCreateCart(userId) };
}

/**
 * PUT /cart/update
 * Update quantity of an active cart item.
 * quantity === 0 is treated as remove.
 */
async function updateQuantity(userId, itemId, quantity, clientVersion, req) {
  const cart = await Cart.findOne({ userId });
  if (!cart) return { error: "Cart not found", status: 404 };

  if (cart.version !== clientVersion) {
    const serverCart = await getOrCreateCart(userId);
    return { conflict: true, serverVersion: cart.version, serverCart };
  }

  const item = cart.activeItems.id(itemId);
  if (!item) return { error: "Item not found in cart", status: 404 };

  const productId = item.productId;
  let updatedCart;

  if (quantity <= 0) {
    // Remove the item
    updatedCart = await Cart.findOneAndUpdate(
      { userId, version: clientVersion },
      { $pull: { activeItems: { _id: itemId } }, $inc: { version: 1 }, $set: { lastSyncedAt: new Date() } },
      { new: true }
    );
    if (updatedCart) {
      await audit(userId, "Remove Item", productId, updatedCart.version, { itemId, quantity: 0 }, req);
    }
  } else {
    // Update quantity
    const idx = cart.activeItems.findIndex((i) => i._id.toString() === itemId.toString());
    updatedCart = await Cart.findOneAndUpdate(
      { userId, version: clientVersion },
      {
        $set: { [`activeItems.${idx}.quantity`]: Math.min(quantity, 10), lastSyncedAt: new Date() },
        $inc: { version: 1 },
      },
      { new: true }
    );
    if (updatedCart) {
      await audit(userId, "Quantity Change", productId, updatedCart.version, { itemId, quantity }, req);
    }
  }

  if (!updatedCart) {
    const serverCart = await getOrCreateCart(userId);
    return { conflict: true, serverVersion: serverCart.version, serverCart };
  }

  return { cart: await getOrCreateCart(userId) };
}

/**
 * DELETE /cart/remove
 * Remove an active cart item by itemId.
 */
async function removeItem(userId, itemId, clientVersion, req) {
  const cart = await Cart.findOne({ userId });
  if (!cart) return { error: "Cart not found", status: 404 };

  if (cart.version !== clientVersion) {
    const serverCart = await getOrCreateCart(userId);
    return { conflict: true, serverVersion: cart.version, serverCart };
  }

  const item = cart.activeItems.id(itemId);
  if (!item) return { error: "Item not found in cart", status: 404 };

  const productId = item.productId;

  const updatedCart = await Cart.findOneAndUpdate(
    { userId, version: clientVersion },
    { $pull: { activeItems: { _id: itemId } }, $inc: { version: 1 }, $set: { lastSyncedAt: new Date() } },
    { new: true }
  );

  if (!updatedCart) {
    const serverCart = await getOrCreateCart(userId);
    return { conflict: true, serverVersion: serverCart.version, serverCart };
  }

  await audit(userId, "Remove Item", productId, updatedCart.version, { itemId, quantity: 0 }, req);
  return { cart: await getOrCreateCart(userId) };
}

/**
 * POST /cart/save-for-later
 * Move an active item → savedItems[].
 */
async function moveToSaveForLater(userId, itemId, clientVersion, req) {
  const cart = await Cart.findOne({ userId });
  if (!cart) return { error: "Cart not found", status: 404 };

  if (cart.version !== clientVersion) {
    const serverCart = await getOrCreateCart(userId);
    return { conflict: true, serverVersion: cart.version, serverCart };
  }

  const item = cart.activeItems.id(itemId);
  if (!item) return { error: "Item not found in active cart", status: 404 };

  const savedItem = {
    productId: item.productId,
    size: item.size,
    quantity: item.quantity,
    priceAtAdd: item.priceAtAdd,
    addedAt: new Date(),
  };
  const productId = item.productId;

  const updatedCart = await Cart.findOneAndUpdate(
    { userId, version: clientVersion },
    {
      $pull: { activeItems: { _id: itemId } },
      $push: { savedItems: savedItem },
      $inc: { version: 1 },
      $set: { lastSyncedAt: new Date() },
    },
    { new: true }
  );

  if (!updatedCart) {
    const serverCart = await getOrCreateCart(userId);
    return { conflict: true, serverVersion: serverCart.version, serverCart };
  }

  await audit(userId, "Save For Later", productId, updatedCart.version, { itemId, quantity: item.quantity }, req);
  return { cart: await getOrCreateCart(userId) };
}

/**
 * POST /cart/move-to-cart
 * Move a saved item → activeItems[] (active cart).
 */
async function moveToCart(userId, savedItemId, clientVersion, req) {
  const cart = await Cart.findOne({ userId });
  if (!cart) return { error: "Cart not found", status: 404 };

  if (cart.version !== clientVersion) {
    const serverCart = await getOrCreateCart(userId);
    return { conflict: true, serverVersion: cart.version, serverCart };
  }

  const savedItem = cart.savedItems.id(savedItemId);
  if (!savedItem) return { error: "Item not found in saved list", status: 404 };

  const productId = savedItem.productId;

  // Check for deduplication in active items
  const existingIdx = cart.activeItems.findIndex(
    (i) => i.productId.toString() === productId.toString() && i.size === savedItem.size
  );

  let updatedCart;
  if (existingIdx !== -1) {
    // Merge quantities
    const newQty = Math.min(cart.activeItems[existingIdx].quantity + savedItem.quantity, 10);
    updatedCart = await Cart.findOneAndUpdate(
      { userId, version: clientVersion },
      {
        $set: { [`activeItems.${existingIdx}.quantity`]: newQty, lastSyncedAt: new Date() },
        $pull: { savedItems: { _id: savedItemId } },
        $inc: { version: 1 },
      },
      { new: true }
    );
  } else {
    const activeItem = {
      productId: savedItem.productId,
      size: savedItem.size,
      quantity: savedItem.quantity,
      priceAtAdd: savedItem.priceAtAdd,
      addedAt: new Date(),
    };
    updatedCart = await Cart.findOneAndUpdate(
      { userId, version: clientVersion },
      {
        $pull: { savedItems: { _id: savedItemId } },
        $push: { activeItems: activeItem },
        $inc: { version: 1 },
        $set: { lastSyncedAt: new Date() },
      },
      { new: true }
    );
  }

  if (!updatedCart) {
    const serverCart = await getOrCreateCart(userId);
    return { conflict: true, serverVersion: serverCart.version, serverCart };
  }

  await audit(userId, "Move To Cart", productId, updatedCart.version, { savedItemId, quantity: savedItem.quantity }, req);
  return { cart: await getOrCreateCart(userId) };
}

/**
 * Synchronize cart client version with server.
 */
async function synchronizeCart(userId, clientVersion) {
  const cart = await getOrCreateCart(userId);
  if (clientVersion !== undefined && cart.version !== clientVersion) {
    return { conflict: true, serverVersion: cart.version, serverCart: cart };
  }
  return { cart };
}

module.exports = {
  getCart,
  addItem,
  updateQuantity,
  removeItem,
  moveToSaveForLater,
  moveToCart,
  synchronizeCart,
};
