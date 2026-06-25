const crypto = require("crypto");
const WebhookEvent = require("../models/WebhookEvent");
const Transaction = require("../models/Transaction");
const AuditService = require("./AuditService");

class WebhookService {
  /**
   * Verifies the HMAC-SHA256 signature of an incoming webhook request.
   * Reads WEBHOOK_SECRET from env. If not set, skips verification (development mode).
   * @param {object} req - Express Request object.
   * @param {object} rawBody - Raw request body string (before JSON.parse).
   * @returns {boolean} true if valid or secret not configured, false if signature mismatch.
   */
  static verifySignature(req, rawBody) {
    const secret = process.env.WEBHOOK_SECRET;
    if (!secret) {
      // No secret configured — allow in development, warn in production
      if (process.env.NODE_ENV === "production") {
        console.warn("[WebhookService] WARNING: WEBHOOK_SECRET is not set in production!");
      }
      return true;
    }

    const signatureHeader =
      req.headers["x-webhook-signature"] ||
      req.headers["x-stripe-signature"] ||
      req.headers["x-razorpay-signature"] ||
      "";

    if (!signatureHeader) {
      console.error("[WebhookService] Missing signature header on webhook request.");
      return false;
    }

    // Compute expected HMAC-SHA256 over the raw request body
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(rawBody, "utf8")
      .digest("hex");

    // Use timingSafeEqual to prevent timing-based attacks
    try {
      const expected = Buffer.from(expectedSignature, "hex");
      const received = Buffer.from(
        signatureHeader.startsWith("sha256=")
          ? signatureHeader.slice(7)
          : signatureHeader,
        "hex"
      );
      if (expected.length !== received.length) return false;
      return crypto.timingSafeEqual(expected, received);
    } catch {
      return false;
    }
  }

  /**
   * Processes a webhook event idempotently.
   * @param {object} payload - Webhook JSON request payload.
   * @param {object} req - Express Request object (for signature verification and audit logs).
   * @param {string} rawBody - Raw body string for HMAC verification.
   * @returns {object} { success: boolean, duplicate: boolean, status: string }
   */
  static async processWebhook(payload, req = null, rawBody = "") {
    // Step 1: Verify HMAC signature before any processing
    if (req && !WebhookService.verifySignature(req, rawBody)) {
      throw new Error("Invalid webhook signature. Request rejected.");
    }

    const { eventId, type, data, provider = "stripe" } = payload;

    if (!eventId) {
      throw new Error("Webhook Event ID is required for idempotent tracking.");
    }

    let webhookEvent;
    try {
      // Attempt to register the event atomically
      webhookEvent = await WebhookEvent.create({
        eventId,
        provider,
        status: "pending",
      });
    } catch (err) {
      // 11000 is the MongoDB duplicate key error code (unique index constraint hit)
      if (err.code === 11000) {
        console.warn(`[WebhookService] ⚠️ Duplicate webhook event detected: ${eventId}`);
        const existingEvent = await WebhookEvent.findOne({ eventId });
        return {
          success: true,
          duplicate: true,
          status: existingEvent.status,
        };
      }
      throw err;
    }

    try {
      // Process business logic depending on the webhook event type
      const transactionIdStr = data.transactionId;
      const transaction = await Transaction.findOne({ transactionId: transactionIdStr });

      if (!transaction) {
        throw new Error(`Transaction with ID ${transactionIdStr} not found.`);
      }

      let newStatus = transaction.status;
      let auditAction = "";

      switch (type) {
        case "payment.succeeded":
          newStatus = "success";
          auditAction = "Payment Success";
          break;
        case "payment.failed":
          newStatus = "failed";
          auditAction = "Payment Failure";
          break;
        case "refund.initiated":
          newStatus = "pending"; // Keeps pending status until completed or mark as refund-initiated
          auditAction = "Refund Initiated";
          break;
        case "refund.completed":
          newStatus = "refunded";
          auditAction = "Refund Completed";
          break;
        default:
          console.warn(`[WebhookService] Unhandled event type: ${type}`);
          break;
      }

      // Update Transaction status
      if (newStatus !== transaction.status) {
        transaction.status = newStatus;
        await transaction.save();
      }

      // Write Audit Log
      if (auditAction) {
        await AuditService.log(
          auditAction,
          transaction._id,
          transaction.userId,
          { eventId, payload },
          req
        );
      }

      // Mark webhook as processed
      webhookEvent.status = "processed";
      webhookEvent.processedAt = new Date();
      await webhookEvent.save();

      return {
        success: true,
        duplicate: false,
        status: "processed",
      };
    } catch (error) {
      console.error(`[WebhookService] Webhook processing failed for event ${eventId}:`, error);
      webhookEvent.status = "failed";
      webhookEvent.errorMessage = error.message;
      await webhookEvent.save();
      throw error;
    }
  }
}

module.exports = WebhookService;
