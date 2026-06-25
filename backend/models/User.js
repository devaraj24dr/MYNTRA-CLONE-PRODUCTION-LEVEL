const mongoose = require("mongoose");
const UserSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    notificationPreferences: {
      orderUpdates: { type: Boolean, default: true },
      promotions: { type: Boolean, default: true },
      priceDrops: { type: Boolean, default: true },
      cartReminders: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
