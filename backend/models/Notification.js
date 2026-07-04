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
        "Promotional Campaign",  // Added: covers generic marketing campaigns
      ],
      required: true,
    },
    data: {
      type: Object,
      default: {},
    },
    // payload is an alias to data for requirement compliance
    payload: {
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
    // Analytics tracking timestamps
    skippedAt: {
      type: Date,
      default: null,
    },
    openedAt: {
      type: Date,
      default: null,
    },
    clickedAt: {
      type: Date,
      default: null,
    },
    // Track how many times this notification was retried
    retryCount: {
      type: Number,
      default: 0,
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
