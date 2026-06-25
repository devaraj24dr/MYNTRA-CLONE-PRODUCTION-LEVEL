const express = require("express");
const Order = require("../models/Order");
const Cart = require("../models/Cart");
const Product = require("../models/Product");
const Transaction = require("../models/Transaction");
const AuditService = require("../services/AuditService");
const CheckoutValidationService = require("../services/CheckoutValidationService");
const crypto = require("crypto");
const router = express.Router();
const mongoose = require("mongoose");

function genrateRandomTracking() {
  const carriers = ["Delhivery", "Bluedart", "Ecom Express", "XpressBees"];
  const statusOptions = [
    "Shipped",
    "Out for Delivery",
    "Delivered",
    "In Transit",
  ];
  const locations = ["Mumbai", "Delhi", "Bangalore", "Hyderabad", "Pune"];
  const randomcarrier = carriers[Math.floor(Math.random() * carriers.length)];
  const randomstatusOptions =
    statusOptions[Math.floor(Math.random() * statusOptions.length)];
  const randomlocations =
    locations[Math.floor(Math.random() * locations.length)];

  return {
    number: "TRK" + Math.floor(Math.random() * 10000000),
    carrier: randomcarrier,
    estimatedDelivery: new Date(
      Date.now() + 5 * 24 * 60 * 60 * 1000
    ).toISOString(),
    currentLocation: randomlocations,
    status: randomstatusOptions,
    timeline: [
      {
        status: "Order placed",
        location: "Warehouse",
        timestamp: new Date().toISOString(),
      },
      {
        status: randomstatusOptions,
        location: randomlocations,
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

router.post("/create/:userId", async (req, res) => {
  const userid = req.params.userId;
  if (!userid) {
    return res.status(400).json({ message: "userId is required" });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Fetch cart with activeItems populated
    const cart = await Cart.findOne({ userId: userid }).populate("activeItems.productId").session(session);
    if (!cart || cart.activeItems.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "No items in the active cart" });
    }

    // 2. Validate stock, price, and availability
    const validation = await CheckoutValidationService.validateCart(cart.activeItems);
    if (!validation.valid || validation.warnings.length > 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Checkout validation failed",
        errors: validation.errors,
        warnings: validation.warnings,
      });
    }

    // 3. Map order items and calculate total
    const orderitems = cart.activeItems.map((item) => ({
      productId: item.productId._id,
      size: item.size,
      price: item.productId.price,
      quantity: item.quantity,
    }));

    const total = orderitems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    // 4. Update product stock atomically
    for (const item of cart.activeItems) {
      const updatedProduct = await Product.findOneAndUpdate(
        { _id: item.productId._id, stock: { $gte: item.quantity }, isActive: true },
        { $inc: { stock: -item.quantity } },
        { session, new: true }
      );
      if (!updatedProduct) {
        throw new Error(`Insufficient stock or discontinued product for "${item.productId.name || 'product'}"`);
      }
    }

    // 5. Create and save order
    const newOrder = new Order({
      userId: userid,
      date: new Date().toISOString(),
      status: "Processing",
      items: orderitems,
      total: total,
      shippingAddress: req.body.shippingAddress,
      paymentMethod: req.body.paymentMethod,
      tracking: genrateRandomTracking(),
    });
    await newOrder.save({ session });

    // 6. Clear cart's activeItems and increment cart version (optimistic locking)
    cart.activeItems = [];
    cart.version += 1;
    cart.lastSyncedAt = new Date();
    await cart.save({ session });

    // 7. Create transaction and log audit
    const transactionId = `txn_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const invoiceId = `inv_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const paymentMethod = (req.body.paymentMethod || "card").toLowerCase();
    const validMethods = ["card", "upi", "netbanking", "wallet"];
    const safeMethod = validMethods.includes(paymentMethod) ? paymentMethod : "card";

    await Transaction.create(
      [
        {
          userId: userid,
          transactionId,
          invoiceId,
          amount: total,
          currency: "INR",
          paymentMethod: safeMethod,
          status: "success",
          description: `Order #${newOrder._id} — ${orderitems.length} item(s)`,
        },
      ],
      { session }
    );

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    // Audit transaction asynchronously after success
    try {
      await AuditService.log(
        "Transaction Created",
        transactionId,
        userid,
        { orderId: newOrder._id, invoiceId, transactionId },
        req
      );
    } catch (auditErr) {
      console.error("[OrderRoutes] Failed to log checkout transaction audit:", auditErr);
    }

    res.status(200).json({
      message: "Order placed successfully",
      orderId: newOrder._id,
      transactionId,
      invoiceId,
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("[OrderRoutes] Checkout transaction aborted:", error.message);
    return res.status(500).json({ message: error.message || "Something went wrong during checkout" });
  }
});

router.get("/user/:userid", async (req, res) => {
  try {
    const order = await Order.find({ userId: req.params.userid }).populate(
      "items.productId"
    );
    res.status(200).json(order);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

module.exports = router;