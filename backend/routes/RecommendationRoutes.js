const express = require("express");
const router = express.Router();
const RecommendationService = require("../services/RecommendationService");
const RecommendationAnalytics = require("../models/RecommendationAnalytics");

/**
 * POST /recommendations/view
 * Record a user product view.
 */
router.post("/view", async (req, res) => {
  const { userId, productId } = req.body;
  if (!userId || !productId) {
    return res.status(400).json({ message: "userId and productId are required." });
  }

  try {
    const view = await RecommendationService.recordView(userId, productId);
    return res.status(200).json({ success: true, view });
  } catch (error) {
    console.error("Error in /recommendations/view:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
});

/**
 * GET /recommendations/popular
 * Fetch globally popular products.
 */
router.get("/popular", async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  try {
    const products = await RecommendationService.getPopularProducts(limit);
    return res.status(200).json(products);
  } catch (error) {
    console.error("Error in /recommendations/popular:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
});

/**
 * GET /recommendations/similar/:productId
 * Fetch similar products (for Product Detail Screen).
 */
router.get("/similar/:productId", async (req, res) => {
  const { productId } = req.params;
  const userId = req.query.userId || null;
  const limit = parseInt(req.query.limit) || 6;

  try {
    const products = await RecommendationService.getSimilarProducts(productId, userId, limit);
    return res.status(200).json(products);
  } catch (error) {
    console.error("Error in /recommendations/similar:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
});

/**
 * POST /recommendations/analytics
 * Track recommendation impressions (clicked = false) and clicks (clicked = true).
 */
router.post("/analytics", async (req, res) => {
  const { userId, recommendationId, clicked } = req.body;
  if (!userId || !recommendationId) {
    return res.status(400).json({ message: "userId and recommendationId are required." });
  }

  try {
    // If it's a click, we can try to find an existing impression in the last 5 minutes and update it
    let analyticsRecord;
    if (clicked) {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      analyticsRecord = await RecommendationAnalytics.findOneAndUpdate(
        {
          userId,
          recommendationId,
          clicked: false,
          createdAt: { $gte: fiveMinutesAgo }
        },
        { $set: { clicked: true } },
        { new: true }
      );
    }

    if (!analyticsRecord) {
      analyticsRecord = await RecommendationAnalytics.create({
        userId,
        recommendationId,
        clicked: !!clicked
      });
    }

    return res.status(200).json({ success: true, analytics: analyticsRecord });
  } catch (error) {
    console.error("Error in /recommendations/analytics:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
});

/**
 * GET /recommendations/:userId
 * Fetch hybrid personalized recommendations for a user.
 */
router.get("/:userId", async (req, res) => {
  const { userId } = req.params;
  const limit = parseInt(req.query.limit) || 10;

  try {
    const result = await RecommendationService.generateRecommendations(userId, limit);
    return res.status(200).json(result);
  } catch (error) {
    console.error(`Error generating recommendations for user ${userId}:`, error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
});

module.exports = router;
