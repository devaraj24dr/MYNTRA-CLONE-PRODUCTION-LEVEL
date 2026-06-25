const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Transaction = require("../models/Transaction");
const User = require("../models/User");
const ExportService = require("../services/ExportService");
const ReceiptService = require("../services/ReceiptService");
const WebhookService = require("../services/WebhookService");

/**
   Helper to parse filter queries from query params.
 */
function parseFilterQuery(req) {
  const { userId, status, paymentMethod, search, startDate, endDate } = req.query;
  const query = {};

  if (userId) {
    query.userId = new mongoose.Types.ObjectId(userId);
  }

  if (status && status !== "all") {
    query.status = status;
  }

  if (paymentMethod && paymentMethod !== "all") {
    query.paymentMethod = paymentMethod;
  }

  if (search) {
    query.$or = [
      { transactionId: { $regex: search, $options: "i" } },
      { invoiceId: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) {
      query.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      query.createdAt.$lte = new Date(endDate);
    }
  }

  return query;
}

/**
   Helper to parse sorting from query params.
 */
function parseSortQuery(req) {
  const { sortBy } = req.query;
  let sort = { createdAt: -1 }; // Default newest first

  if (sortBy === "oldest") {
    sort = { createdAt: 1 };
  } else if (sortBy === "highestAmount") {
    sort = { amount: -1 };
  } else if (sortBy === "lowestAmount") {
    sort = { amount: 1 };
  }

  return sort;
}

// 1. GET /transactions (Paginated, Searchable, Filtered, Sorted)
router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = parseFilterQuery(req);
    const sort = parseSortQuery(req);

    const transactions = await Transaction.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    const totalCount = await Transaction.countDocuments(query);
    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      success: true,
      transactions,
      page,
      totalPages,
      totalCount,
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// 2. GET /transactions/analytics (Financial telemetry summary)
router.get("/analytics", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: "User ID is required for analytics." });
    }

    const stats = await Transaction.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
    ]);

    let totalTransactions = 0;
    let successfulCount = 0;
    let successfulAmount = 0;
    let failedCount = 0;
    let refundedCount = 0;
    let refundedAmount = 0;

    stats.forEach((stat) => {
      totalTransactions += stat.count;
      if (stat._id === "success") {
        successfulCount = stat.count;
        successfulAmount = stat.totalAmount;
      } else if (stat._id === "failed") {
        failedCount = stat.count;
      } else if (stat._id === "refunded") {
        refundedCount = stat.count;
        refundedAmount = stat.totalAmount;
      }
    });

    res.json({
      success: true,
      analytics: {
        totalTransactions,
        successfulCount,
        successfulAmount,
        failedCount,
        refundedCount,
        refundedAmount,
      },
    });
  } catch (error) {
    console.error("Error loading transaction analytics:", error);
    res.status(500).json({ error: "Failed to load analytics data." });
  }
});

// 3. GET /transactions/export/csv (Memory-safe cursor-streamed CSV download)
// Auth guard: userId is required to scope export to a specific user's data
router.get("/export/csv", async (req, res) => {
  if (!req.query.userId) {
    return res.status(401).json({ error: "Unauthorized: userId is required to export transactions." });
  }
  try {
    const query = parseFilterQuery(req);
    const sort = parseSortQuery(req);
    await ExportService.streamTransactionsCSV(query, sort, res);
  } catch (error) {
    console.error("Error exporting CSV:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to stream CSV data." });
    }
  }
});

// 4. GET /transactions/:id/receipt (Streamed A4 PDF Invoice)
router.get("/:id/receipt", async (req, res) => {
  try {
    const { id } = req.params;
    const transaction = await Transaction.findById(id);

    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found." });
    }

    const user = await User.findById(transaction.userId);
    if (!user) {
      return res.status(404).json({ error: "User associated with transaction not found." });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=receipt_${transaction.invoiceId}.pdf`
    );

    ReceiptService.generateReceiptPDF(transaction, user, res);
  } catch (error) {
    console.error("Error generating receipt PDF:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to generate receipt PDF." });
    }
  }
});

// 5. POST /payments/webhook — mounted at /payments in server.js, so path here is /webhook
// Uses raw body for HMAC signature verification before JSON parsing occurs
router.post("/webhook", async (req, res) => {
  try {
    // Pass the raw body string for HMAC verification (populated by express.raw middleware in server.js)
    const rawBody = req.rawBody || JSON.stringify(req.body);
    const result = await WebhookService.processWebhook(req.body, req, rawBody);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error processing webhook:", error);
    const status = error.message.includes("signature") ? 403 : 500;
    res.status(status).json({ error: error.message || "Failed to process webhook." });
  }
});

module.exports = router;

