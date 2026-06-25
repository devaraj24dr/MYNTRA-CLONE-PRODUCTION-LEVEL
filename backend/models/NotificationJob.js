const mongoose = require("mongoose");

const NotificationJobSchema = new mongoose.Schema(
  {
    notificationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Notification",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },
    runAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
      required: true,
    },
    maxAttempts: {
      type: Number,
      default: 3,
      required: true,
    },
    lastError: {
      type: String,
    },
    lockedAt: {
      type: Date,
      default: null,
    },
    lockedBy: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Indexes for queue queries
NotificationJobSchema.index({ status: 1, runAt: 1 });
NotificationJobSchema.index({ lockedAt: 1 });

module.exports = mongoose.model("NotificationJob", NotificationJobSchema);
