const Transaction = require("../models/Transaction");

class ExportService {
  /**
   * Streams transactions from MongoDB directly into the HTTP response stream in CSV format.
   * @param {object} query - Mongoose search/filter filter query.
   * @param {object} sort - Sorting options for the search.
   * @param {object} res - Express Response object.
   */
  static async streamTransactionsCSV(query, sort, res) {
    try {
      // Set appropriate CSV streaming download headers
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=transactions_export_${Date.now()}.csv`
      );

      // Write CSV headers row
      res.write("Transaction ID,Invoice ID,User ID,User Email,Amount,Currency,Payment Method,Status,Description,Created At\n");

      // Retrieve cursor stream from Mongoose query
      const cursor = Transaction.find(query)
        .populate("userId", "email fullName")
        .sort(sort)
        .cursor();

      // Stream records line-by-line using eachAsync iterator
      await cursor.eachAsync(async (doc) => {
        const email = doc.userId ? doc.userId.email : "N/A";
        const userIdString = doc.userId ? doc.userId._id.toString() : "N/A";

        // Escape helper for CSV quotes/newlines
        const csvEscape = (val) => {
          if (val === null || val === undefined) return "";
          const str = String(val).replace(/"/g, '""');
          return `"${str}"`;
        };

        const row = [
          csvEscape(doc.transactionId),
          csvEscape(doc.invoiceId),
          csvEscape(userIdString),
          csvEscape(email),
          doc.amount,
          csvEscape(doc.currency),
          csvEscape(doc.paymentMethod),
          csvEscape(doc.status),
          csvEscape(doc.description),
          csvEscape(doc.createdAt ? doc.createdAt.toISOString() : ""),
        ].join(",") + "\n";

        res.write(row);
      });

      // Finish the response stream
      res.end();
    } catch (error) {
      console.error("[ExportService] CSV streaming error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to export transactions CSV." });
      }
    }
  }
}

module.exports = ExportService;
