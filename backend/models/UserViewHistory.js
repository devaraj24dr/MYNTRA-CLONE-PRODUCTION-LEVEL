const mongoose = require("mongoose");

const UserViewHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    viewedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  { timestamps: true }
);

// Compounding unique index to ensure deduplication (only one unique entry per user/product)
UserViewHistorySchema.index({ userId: 1, productId: 1 }, { unique: true });

// Index for sorting user's most recent views
UserViewHistorySchema.index({ userId: 1, viewedAt: -1 });

// TTL index to automatically expire history after 30 days (30 * 24 * 3600 seconds)
UserViewHistorySchema.index({ viewedAt: 1 }, { expireAfterSeconds: 2592000 });

module.exports = mongoose.model("UserViewHistory", UserViewHistorySchema);
