const mongoose = require("mongoose");

const WishlistSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  },
  { timestamps: true }
);

WishlistSchema.index({ userId: 1, productId: 1 }, { unique: true });
WishlistSchema.index({ productId: 1 });

module.exports = mongoose.model("Wishlist", WishlistSchema);
