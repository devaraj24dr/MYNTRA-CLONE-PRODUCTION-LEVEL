const mongoose = require("mongoose");

// Sub-schema for a single cart line item (active or saved)
const CartItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    size: {
      type: String,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      max: 10,
    },
    // Price captured at the time the item was added — used to detect price changes
    priceAtAdd: {
      type: Number,
      required: true,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true } // keep sub-document _id for item-level operations
);

const CartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // One cart document per user
    },

    // Optimistic locking — incremented on every successful write
    version: {
      type: Number,
      default: 0,
    },

    // Active cart items — contribute to totals
    activeItems: [CartItemSchema],

    // Save-for-later items — excluded from totals
    savedItems: [CartItemSchema],

    // Timestamp of last cross-device sync
    lastSyncedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// --- Indexes ---
// Primary lookup: one cart per user
CartSchema.index({ userId: 1 }, { unique: true });

// Speed up item lookups by productId within carts
CartSchema.index({ "activeItems.productId": 1 });
CartSchema.index({ "savedItems.productId": 1 });

// Version index for optimistic locking conflict detection
CartSchema.index({ userId: 1, version: 1 });
CartSchema.index({ version: 1 });

// Index for updatedAt sorting/sync
CartSchema.index({ updatedAt: 1 });

module.exports = mongoose.model("Cart", CartSchema);
