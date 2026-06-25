const mongoose = require("mongoose");

const RecommendationAnalyticsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recommendationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    clicked: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  { timestamps: true }
);

// Indexes for fast querying & analytics reporting
RecommendationAnalyticsSchema.index({ userId: 1 });
RecommendationAnalyticsSchema.index({ recommendationId: 1 });
RecommendationAnalyticsSchema.index({ userId: 1, recommendationId: 1, clicked: 1 });
RecommendationAnalyticsSchema.index({ createdAt: 1 });

module.exports = mongoose.model("RecommendationAnalytics", RecommendationAnalyticsSchema);
