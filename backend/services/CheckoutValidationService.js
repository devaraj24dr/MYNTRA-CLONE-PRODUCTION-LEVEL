const Product = require("../models/Product");

/**
 * CheckoutValidationService
 *
 * Validates every active cart item against the live product catalog before
 * a checkout attempt is allowed to proceed. Returns a structured
 * { valid: boolean, errors: ValidationError[] } response.
 *
 * ValidationError shape:
 * {
 *   type: "OUT_OF_STOCK" | "PRICE_CHANGED" | "DISCONTINUED",
 *   itemId: ObjectId,
 *   productId: ObjectId,
 *   productName: string,
 *   detail: string,           // human-readable message
 *   currentPrice?: number,    // for PRICE_CHANGED
 *   priceAtAdd?: number,      // for PRICE_CHANGED
 *   currentStock?: number,    // for OUT_OF_STOCK
 *   requiredQuantity?: number // for OUT_OF_STOCK
 * }
 */

/**
 * Validate all active cart items before checkout.
 * @param {Array} items - Cart.activeItems[] array (populated productId)
 * @returns {{ valid: boolean, errors: Array, warnings: Array }}
 */
async function validateCart(items) {
  if (!items || items.length === 0) {
    return { valid: false, errors: [{ type: "EMPTY_CART", detail: "Cart is empty" }], warnings: [] };
  }

  // Fetch all products fresh from DB in one query
  const productIds = items.map((i) => i.productId._id || i.productId);
  const products = await Product.find({ _id: { $in: productIds } }).lean();
  const productMap = Object.fromEntries(products.map((p) => [p._id.toString(), p]));

  const errors = [];
  const warnings = [];

  for (const item of items) {
    const pid = (item.productId._id || item.productId).toString();
    const product = productMap[pid];

    // 1. Product no longer exists
    if (!product) {
      errors.push({
        type: "DISCONTINUED",
        itemId: item._id,
        productId: pid,
        productName: item.productId?.name || "Unknown Product",
        detail: "This product no longer exists and cannot be purchased.",
      });
      continue;
    }

    // 2. Discontinued / inactive product
    if (product.isActive === false) {
      errors.push({
        type: "DISCONTINUED",
        itemId: item._id,
        productId: pid,
        productName: product.name,
        detail: `"${product.name}" has been discontinued and cannot be purchased.`,
      });
    }

    // 3. Out of stock
    const availableStock = product.stock ?? 999;
    if (availableStock < item.quantity) {
      errors.push({
        type: "OUT_OF_STOCK",
        itemId: item._id,
        productId: pid,
        productName: product.name,
        currentStock: availableStock,
        requiredQuantity: item.quantity,
        detail: `"${product.name}" only has ${availableStock} unit(s) in stock (you need ${item.quantity}).`,
      });
    }

    // 4. Price changed since added to cart
    if (product.price !== item.priceAtAdd) {
      const direction = product.price > item.priceAtAdd ? "increased" : "decreased";
      warnings.push({
        type: "PRICE_CHANGED",
        itemId: item._id,
        productId: pid,
        productName: product.name,
        priceAtAdd: item.priceAtAdd,
        currentPrice: product.price,
        detail: `Price of "${product.name}" has ${direction} from ₹${item.priceAtAdd} to ₹${product.price}.`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    totalItems: items.length,
    validatedAt: new Date().toISOString(),
  };
}

/**
 * Validate stock only (lightweight check used internally).
 */
async function validateStock(items) {
  const result = await validateCart(items);
  return {
    valid: !result.errors.some((e) => e.type === "OUT_OF_STOCK"),
    stockErrors: result.errors.filter((e) => e.type === "OUT_OF_STOCK"),
  };
}

/**
 * Validate product availability only.
 */
async function validateAvailability(items) {
  const result = await validateCart(items);
  return {
    valid: !result.errors.some((e) => e.type === "DISCONTINUED"),
    availabilityErrors: result.errors.filter((e) => e.type === "DISCONTINUED"),
  };
}

/**
 * Validate price changes only.
 */
async function validatePrices(items) {
  const result = await validateCart(items);
  return {
    valid: !result.warnings.some((w) => w.type === "PRICE_CHANGED"),
    priceErrors: result.warnings.filter((w) => w.type === "PRICE_CHANGED"),
  };
}

module.exports = {
  validateCart,
  validateStock,
  validateAvailability,
  validatePrices,
};
