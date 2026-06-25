const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

// Resolve schemas
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const AuditLog = require("../models/AuditLog");
const WebhookEvent = require("../models/WebhookEvent");

// Load backend .env config
dotenv.config({ path: path.join(__dirname, "../.env") });

async function seed() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is missing from environment variables.");
    process.exit(1);
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected successfully.");

  // 1. Fetch or create a mock user for transaction owner mapping
  let user = await User.findOne();
  if (!user) {
    user = await User.create({
      name: "Devaraj P",
      email: "devaraj@myntraclone.com",
      password: "$2a$10$X1j4W9m1K4p7/r3s5t6u7v8w9x0y1z2a3b4c5d6e7f8g9h0i1j2k3", // mock hash
    });
    console.log(`Created mock user: ${user.email} (${user._id})`);
  } else {
    console.log(`Using existing user: ${user.email} (${user._id})`);
  }

  // 2. Clear old transactions, audit logs, and webhook events
  console.log("Purging old transaction history, audit logs, and webhook records...");
  await Transaction.deleteMany({ userId: user._id });
  await AuditLog.deleteMany({});
  await WebhookEvent.deleteMany({});

  // 3. Generate 10,000 mock transactions
  const totalCount = 10000;
  const batchSize = 1000;
  const paymentMethods = ["card", "upi", "netbanking", "wallet"];
  const statuses = ["success", "failed", "refunded"];
  const items = [
    "Roadster Men Slim Fit Casual Shirt",
    "Nike Air Max Alpha Sneakers",
    "Levis 511 Slim Jeans",
    "Sony WH-CH720N Wireless Headphones",
    "HRX Training Dry-Fit T-Shirt",
    "Boat Wave Flex Connect Smartwatch",
    "Puma Roadster Running Shoes",
    "OnePlus Nord CE 3 Lite Phone Cover",
  ];

  console.log(`Starting generation of ${totalCount} transactions...`);
  const startTime = Date.now();

  for (let i = 0; i < totalCount; i += batchSize) {
    const batch = [];
    const timestampBase = Date.now();

    for (let j = 0; j < batchSize; j++) {
      const index = i + j;
      const amount = Math.floor(Math.random() * 4500) + 299; // Rs. 299 to 4799
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
      const itemDesc = items[Math.floor(Math.random() * items.length)];

      // Disperse dates randomly over the last 90 days
      const daysOffset = Math.floor(Math.random() * 90);
      const hoursOffset = Math.floor(Math.random() * 24);
      const minutesOffset = Math.floor(Math.random() * 60);
      const createdAt = new Date(
        timestampBase - (daysOffset * 24 * 60 * 60 * 1000 + hoursOffset * 60 * 60 * 1000 + minutesOffset * 60 * 1000)
      );

      // Unique Txn ID format: txn_<timestamp>_<incrementalIndex>
      const transactionId = `txn_${timestampBase - daysOffset * 10000}_${index}`;
      const invoiceId = `inv_${timestampBase - daysOffset * 10000}_${index}`;

      batch.push({
        userId: user._id,
        transactionId,
        invoiceId,
        amount,
        currency: "INR",
        paymentMethod,
        status,
        description: `Order Purchase - ${itemDesc}`,
        createdAt,
      });
    }

    await Transaction.insertMany(batch);
    console.log(`Generated and saved batch ${i + batchSize}/${totalCount}...`);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`🎉 Success! Seeded 10,000 transactions in ${duration}s.`);

  // Close connection
  mongoose.connection.close();
}

seed().catch((err) => {
  console.error("Seeding crashed:", err);
  mongoose.connection.close();
});
