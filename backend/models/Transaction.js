const mongoose = require("mongoose");

const TransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    transactionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    invoiceId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "INR",
    },
    paymentMethod: {
      type: String,
      enum: ["card", "upi", "netbanking", "wallet"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "success", "failed", "refunded"],
      default: "pending",
    },
    description: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

// Optimize database queries for filters, sorting, and pagination
TransactionSchema.index({ userId: 1, createdAt: -1 });
TransactionSchema.index({ status: 1, createdAt: -1 });
TransactionSchema.index({ userId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("Transaction", TransactionSchema);
