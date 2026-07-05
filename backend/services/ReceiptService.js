const PDFDocument = require("pdfkit");

class ReceiptService {
  /**
   * Generates a beautifully formatted PDF receipt and pipes it to an output stream.
   * @param {object} transaction - The Mongoose transaction document.
   * @param {object} user - The Mongoose user document.
   * @param {object} outputStream - The stream to write the PDF data to (e.g. res).
   */
  static generateReceiptPDF(transaction, user, outputStream) {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    doc.pipe(outputStream);

    // Color Palette matching Myntra design style
    const primaryColor = "#FF3F6C"; // Myntra Pink
    const textColor = "#1A1A1A";
    const lightTextColor = "#666666";
    const dividerColor = "#E9ECEF";

    // --- Header ---
    doc.fontSize(22).fillColor(primaryColor).text("MYNTRA CLONE", 50, 50);
    doc.fontSize(9).fillColor(lightTextColor).text("Myntra Clone E-Commerce Pvt. Ltd.", 50, 80);
    doc.text("100 Corporate Blvd, Silicon Valley, CA", 50, 93);
    doc.text("Support: billing@myntraclone.com", 50, 106);

    doc.fontSize(18).fillColor(textColor).text("INVOICE RECEIPT", 380, 50, { align: "right" });
    
    // Draw Divider Line
    doc.strokeColor(dividerColor).lineWidth(1).moveTo(50, 130).lineTo(545, 130).stroke();

    // --- Details Grid ---
    const detailsY = 150;
    
    // Billed To (Left column)
    doc.fontSize(10).fillColor(textColor).text("BILLED TO:", 50, detailsY, { underline: true });
    const billedToText = [
      `Name: ${user.fullName || "Valued Customer"}`,
      `Email: ${user.email}`
    ].join("\n");
    doc.text(billedToText, 50, detailsY + 20, { width: 280 });
    
    // Invoice details (Right column)
    doc.fontSize(10).fillColor(textColor).text("INVOICE DETAILS:", 350, detailsY, { underline: true });
    const invoiceDetailsText = [
      `Invoice Number:\n${transaction.invoiceId}`,
      `Transaction ID:\n${transaction.transactionId}`,
      `Date: ${new Date(transaction.createdAt).toLocaleString()}`,
      `Payment Method: ${transaction.paymentMethod.toUpperCase()}`,
      `Status: ${transaction.status.toUpperCase()}`
    ].join("\n");
    doc.text(invoiceDetailsText, 350, detailsY + 20, { width: 195 });

    // Draw Divider Line
    doc.strokeColor(dividerColor).lineWidth(1).moveTo(50, 270).lineTo(545, 270).stroke();

    // --- Table Headers ---
    const tableHeaderY = 290;
    doc.fontSize(10).fillColor(textColor);
    doc.text("Description", 60, tableHeaderY);
    doc.text("Qty", 350, tableHeaderY, { align: "center" });
    doc.text("Amount", 480, tableHeaderY, { align: "right" });

    // Table divider line
    doc.strokeColor(dividerColor).lineWidth(1).moveTo(50, tableHeaderY + 15).lineTo(545, tableHeaderY + 15).stroke();

    // --- Table Content ---
    const tableRowY = tableHeaderY + 25;
    doc.fontSize(10).fillColor(lightTextColor);
    doc.text(transaction.description || "Items Purchased", 60, tableRowY);
    doc.text("1", 350, tableRowY, { align: "center" });
    doc.text(`INR ${transaction.amount.toFixed(2)}`, 480, tableRowY, { align: "right" });

    // Row divider line
    doc.strokeColor(dividerColor).lineWidth(1).moveTo(50, tableRowY + 15).lineTo(545, tableRowY + 15).stroke();

    // --- Billing summary ---
    const summaryY = tableRowY + 40;
    doc.fontSize(11).fillColor(textColor).font("Helvetica-Bold").text("TOTAL AMOUNT:", 250, summaryY, { width: 220, align: "right" });
    doc.fontSize(11).fillColor(primaryColor).font("Helvetica-Bold").text(`INR ${transaction.amount.toFixed(2)}`, 480, summaryY, { align: "right" });
    doc.font("Helvetica");

    // --- Footer ---
    const footerY = 650;
    doc.strokeColor(dividerColor).lineWidth(1).moveTo(50, footerY).lineTo(545, footerY).stroke();
    
    doc.fontSize(9).fillColor(lightTextColor).text("Thank you for shopping with us! If you have any questions about this invoice,", 50, footerY + 15, { align: "center" });
    doc.text("please contact our support desk.", 50, footerY + 28, { align: "center" });
    
    // Complete drawing
    doc.end();
  }
}

module.exports = ReceiptService;
