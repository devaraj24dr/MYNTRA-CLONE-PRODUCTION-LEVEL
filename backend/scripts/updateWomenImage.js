const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Category = require("../models/Category");

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB.");

  const result = await Category.updateOne(
    { name: "Women" },
    { $set: { image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=500&auto=format&fit=crop" } }
  );

  console.log("Updated category result:", result);
  await mongoose.disconnect();
}

run();
