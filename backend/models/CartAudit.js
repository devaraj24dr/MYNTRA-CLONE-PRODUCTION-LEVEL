const mongoose = require("mongoose");

const CartAuditSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      enum: [
        "Add Item",
        "Remove Item",
        "Quantity Change",
        "Save For Later",
        "Move To Cart",
        "Checkout Validation",
      ],
      required: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: false, // Checkout Validation might not be associated with a single product
    },
    quantity: {
      type: Number,
      default: 0,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    // Version of the cart AFTER this action was applied
    cartVersionAfter: {
      type: Number,
      required: true,
    },
    metadata: {
      type: Object,
      default: {},
    },
    ipAddress: {
      type: String,
      default: "",
    },
    userAgent: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

// Indexes for efficient audit trail queries
CartAuditSchema.index({ userId: 1, createdAt: -1 });
CartAuditSchema.index({ productId: 1, createdAt: -1 });
CartAuditSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model("CartAudit", CartAuditSchema);
