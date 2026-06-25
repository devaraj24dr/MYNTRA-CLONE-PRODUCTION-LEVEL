const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // Optional for broadcast/guest notifications
    },
    title: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      required: true,
    },
    eventType: {
      type: String,
      enum: [
        "Order Placed",
        "Order Confirmed",
        "Order Shipped",
        "Order Delivered",
        "Wishlist Price Drop",
        "Back In Stock",
        "Flash Sales",
        "Cart Abandonment",
      ],
      required: true,
    },
    data: {
      type: Object,
      default: {},
    },
    status: {
      type: String,
      enum: ["pending", "sent", "failed", "delivered"],
      default: "pending",
    },
    sentAt: {
      type: Date,
    },
    scheduledAt: {
      type: Date,
      default: Date.now,
    },
    errorMessage: {
      type: String,
    },
  },
  { timestamps: true }
);

// Indexes for analytics and queries
NotificationSchema.index({ userId: 1 });
NotificationSchema.index({ eventType: 1 });
NotificationSchema.index({ status: 1 });
NotificationSchema.index({ scheduledAt: 1 });

module.exports = mongoose.model("Notification", NotificationSchema);
