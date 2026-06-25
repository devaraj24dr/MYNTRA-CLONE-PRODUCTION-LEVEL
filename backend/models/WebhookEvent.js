const mongoose = require("mongoose");

const WebhookEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true, // Guarantees uniqueness for idempotency
      trim: true,
    },
    provider: {
      type: String,
      default: "stripe",
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "processed", "failed"],
      default: "pending",
    },
    processedAt: {
      type: Date,
    },
    errorMessage: {
      type: String,
    },
  },
  { timestamps: true }
);


module.exports = mongoose.model("WebhookEvent", WebhookEventSchema);
