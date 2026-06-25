const mongoose = require("mongoose");

const DeviceTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, // Allow guest notifications or pre-login tokens
    },
    token: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    deviceType: {
      type: String,
      enum: ["ios", "android", "web", "unknown"],
      default: "unknown",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastUsedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Index on userId for fetching all tokens belonging to a user
DeviceTokenSchema.index({ userId: 1 });

module.exports = mongoose.model("DeviceToken", DeviceTokenSchema);
