const express = require("express");
const RecentlyViewed = require("../models/RecentlyViewed");
const router = express.Router();

// POST /recently-viewed - Add a single product or bulk sync recently viewed list
router.post("/", async (req, res) => {
  const { userId, productId, productIds } = req.body;

  if (!userId) {
    return res.status(400).json({ message: "userId is required" });
  }

  try {
    let recentlyViewed = await RecentlyViewed.findOne({ userId });

    if (!recentlyViewed) {
      recentlyViewed = new RecentlyViewed({ userId, products: [] });
    }

    if (productIds && Array.isArray(productIds)) {
      // Bulk sync mode: replace/merge the list with the client's merged list of IDs
      const newProducts = productIds.map(id => ({
        productId: id,
        viewedAt: new Date()
      }));

      recentlyViewed.products = newProducts.slice(0, 10);
    } else if (productId) {
      // Single product view mode
      // Remove if duplicate exists to push it to the top
      recentlyViewed.products = recentlyViewed.products.filter(
        (item) => item.productId && item.productId.toString() !== productId
      );

      // Add to the front
      recentlyViewed.products.unshift({ productId, viewedAt: new Date() });

      // Limit to 10 items
      if (recentlyViewed.products.length > 10) {
        recentlyViewed.products = recentlyViewed.products.slice(0, 10);
      }
    } else {
      return res.status(400).json({ message: "Either productId or productIds array is required" });
    }

    await recentlyViewed.save();
    
    // Return populated list
    const populated = await RecentlyViewed.findOne({ userId }).populate({
      path: "products.productId",
      model: "Product",
    });
    
    res.status(200).json(populated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

// GET /recently-viewed/:userId - Fetch recently viewed products
router.get("/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const recentlyViewed = await RecentlyViewed.findOne({ userId }).populate({
      path: "products.productId",
      model: "Product",
    });

    if (!recentlyViewed) {
      return res.status(200).json({ userId, products: [] });
    }

    // Filter out any entries where the referenced product no longer exists
    recentlyViewed.products = recentlyViewed.products.filter(item => item.productId != null);

    res.status(200).json(recentlyViewed);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

module.exports = router;
