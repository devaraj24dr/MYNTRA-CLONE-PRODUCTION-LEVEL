const mongoose = require("mongoose");

const AuditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, // Null indicates automated system action
    },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
      required: true,
    },
    action: {
      type: String,
      enum: [
        "Transaction Created",
        "Payment Success",
        "Payment Failure",
        "Refund Initiated",
        "Refund Completed",
      ],
      required: true,
    },
    ipAddress: {
      type: String,
      default: "",
    },
    userAgent: {
      type: String,
      default: "",
    },
    metadata: {
      type: Object,
      default: {},
    },
  },
  { timestamps: true }
);

// Indexes for audit trail searches
AuditLogSchema.index({ transactionId: 1, createdAt: -1 });
AuditLogSchema.index({ userId: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model("AuditLog", AuditLogSchema);
