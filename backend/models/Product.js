const mongoose = require("mongoose");
const ProductSchema = new mongoose.Schema(
  {
    name: String,
    brand: String,
    price: Number,
    discount: String,
    description: String,
    sizes: [String],
    images: [String],
    // Inventory & availability — defaults ensure legacy products pass validation
    stock: { type: Number, default: 999, min: 0 },
    isActive: { type: Boolean, default: true },
    category: { type: String, index: true },
  },
  { timestamps: true }
);

ProductSchema.index({ isActive: 1 });

module.exports = mongoose.model("Product", ProductSchema);
