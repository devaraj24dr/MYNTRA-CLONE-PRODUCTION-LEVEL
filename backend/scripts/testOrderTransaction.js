const mongoose = require("mongoose");
const dotenv = require("dotenv");
const http = require("http");
const User = require("../models/User");
const Product = require("../models/Product");
const Bag = require("../models/Bag");
const Transaction = require("../models/Transaction");
const AuditLog = require("../models/AuditLog");

dotenv.config();

function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const postData = JSON.stringify(body);

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 80,
      path: parsedUrl.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
      },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          resolve({
            status: res.statusCode,
            body: JSON.parse(data),
          });
        } catch {
          resolve({
            status: res.statusCode,
            body: data,
          });
        }
      });
    });

    req.on("error", (e) => {
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

async function runTest() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected.");

  try {
    // 1. Get or create a test user
    let user = await User.findOne();
    if (!user) {
      user = await User.create({
        name: "Test User",
        email: `test_${Date.now()}@example.com`,
        password: "password123",
      });
      console.log("Created test user:", user.email);
    } else {
      console.log("Using existing user:", user.email);
    }

    // 2. Get or create a test product
    let product = await Product.findOne();
    if (!product) {
      product = await Product.create({
        name: "Test Product",
        price: 1500,
        description: "A wonderful test product",
        category: "Test",
        image: "test.jpg",
      });
      console.log("Created test product:", product.name);
    } else {
      console.log("Using existing product:", product.name);
    }

    // 3. Clear bag and add item
    await Bag.deleteMany({ userId: user._id });
    await Bag.create({
      userId: user._id,
      productId: product._id,
      size: "M",
      quantity: 1,
    });
    console.log("Added product to bag.");

    // 4. Simulate POST to /Order/create/:userId
    console.log(`Sending order creation request for user ${user._id}...`);
    const res = await postJson(`http://localhost:5000/Order/create/${user._id}`, {
      shippingAddress: "123 Test Street, Bangalore",
      paymentMethod: "UPI",
    });

    console.log("Response Status:", res.status);
    console.log("Response Body:", res.body);

    if (res.status !== 200) {
      throw new Error(`Failed to place order: ${JSON.stringify(res.body)}`);
    }

    // 5. Verify transaction was created
    console.log("Verifying Transaction database entry...");
    const transaction = await Transaction.findOne({ userId: user._id }).sort({ createdAt: -1 });
    if (!transaction) {
      throw new Error("No Transaction record found for this user!");
    }
    console.log("Found Transaction:", {
      id: transaction._id,
      transactionId: transaction.transactionId,
      invoiceId: transaction.invoiceId,
      amount: transaction.amount,
      status: transaction.status,
    });

    // 6. Verify audit log was written
    console.log("Verifying AuditLog database entry...");
    const audit = await AuditLog.findOne({ transactionId: transaction._id });
    if (!audit) {
      throw new Error("No AuditLog record found for this transaction!");
    }
    console.log("Found AuditLog:", {
      id: audit._id,
      action: audit.action,
      metadata: audit.metadata,
    });

    console.log("\n✅ Order-Transaction integration test PASSED successfully!");
  } catch (error) {
    console.error("\n❌ Test FAILED:", error);
  } finally {
    await mongoose.connect(process.env.MONGO_URI);
    // Make sure we delete the order and transaction we just created to keep DB clean
    console.log("Cleaning up test data...");
    const user = await User.findOne();
    if (user) {
      const transaction = await Transaction.findOne({ userId: user._id }).sort({ createdAt: -1 });
      if (transaction) {
        await AuditLog.deleteMany({ transactionId: transaction._id });
        await Transaction.deleteOne({ _id: transaction._id });
      }
    }
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

runTest();
