const express = require("express");
const Wishlist = require("../models/Wishlist");
const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { userId, productId } = req.body;
    if (!userId || !productId) {
      return res.status(400).json({ message: "userId and productId are required." });
    }

    // Check if already wishlisted
    const existing = await Wishlist.findOne({ userId, productId });
    if (existing) {
      // Toggle: remove it if already wishlisted
      await Wishlist.findByIdAndDelete(existing._id);
      return res.status(200).json({ message: "Removed from wishlist", removed: true });
    }

    // Add to wishlist
    const newItem = await Wishlist.create({ userId, productId });
    return res.status(200).json({ ...newItem.toObject(), removed: false });
  } catch (error) {
    console.log("Wishlist POST error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

router.get("/:userid", async (req, res) => {
  try {
    const bag = await Wishlist.find({ userId: req.params.userid }).populate(
      "productId"
    );
    
    // Filter out items where the product was deleted or does not exist
    const validBag = bag.filter((item) => item.productId);
    
    // Clean up orphan entries from the database asynchronously
    const orphanIds = bag.filter((item) => !item.productId).map((item) => item._id);
    if (orphanIds.length > 0) {
      Wishlist.deleteMany({ _id: { $in: orphanIds } }).catch(err => 
        console.error("Error cleaning up orphan wishlists:", err)
      );
    }
    
    res.status(200).json(validBag);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

router.delete("/:itemid", async (req, res) => {
  try {
    await Wishlist.findByIdAndDelete(req.params.itemid);
    res.status(200).json({ message: "Item removed from Wishlist" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Error removing item from Wishlist" });
  }
});
module.exports = router;
