/**
 * PushReceiptService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Polls the Expo Push Receipt API to confirm delivery status of previously
 * sent notifications.  This is the SECOND step in Expo's two-ticket model:
 *
 *   Step 1 → expo.sendPushNotificationsAsync()  returns "tickets"
 *   Step 2 → expo.getPushNotificationReceiptsAsync() returns "receipts"
 *
 * Receipts confirm whether Apple/Google actually delivered the message.
 * "DeviceNotRegistered" receipts trigger automatic token deactivation.
 *
 * Invoked either:
 *   a) Periodically by server.js (setInterval every 15 min in dev mode)
 *   b) Via GET /notifications/process-receipts endpoint (for serverless/cron)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { Expo } = require("expo-server-sdk");
const DeviceToken = require("../models/DeviceToken");
const Notification = require("../models/Notification");
const NotificationJob = require("../models/NotificationJob");

const expo = new Expo();

// Maximum number of receipt IDs to fetch in one batch (Expo limit)
const RECEIPT_BATCH_SIZE = 300;

class PushReceiptService {
  /**
   * Stores pending receipt IDs for later resolution.
   * In a production system, these would be persisted in Redis or MongoDB.
   * Here we use an in-memory Map keyed by receiptId → { token, notificationId }.
   */
  static pendingReceipts = new Map();

  /**
   * Registers a list of ticket results from sendPushNotificationsAsync.
   * Called by NotificationService after each send batch.
   *
   * @param {Array} tickets  - Array of Expo send tickets
   * @param {Array} messages - Corresponding messages (parallel index)
   * @param {string} notificationId - MongoDB Notification._id
   */
  static registerTickets(tickets, messages, notificationId) {
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      const message = messages[i];

      // Only "ok" tickets have receipt IDs to poll later
      if (ticket.status === "ok" && ticket.id) {
        PushReceiptService.pendingReceipts.set(ticket.id, {
          token: message.to,
          notificationId: notificationId ? notificationId.toString() : null,
        });
      }
    }

    console.log(
      `[PushReceiptService] 📋 Registered ${PushReceiptService.pendingReceipts.size} pending receipt(s) for polling.`
    );
  }

  /**
   * Polls Expo's receipt endpoint for all pending receipts.
   * Should be run after a ~15 minute delay (Expo's recommended window).
   *
   * @returns {Promise<{ checked: number, delivered: number, failed: number, cleaned: number }>}
   */
  static async pollReceipts() {
    const receiptIds = Array.from(PushReceiptService.pendingReceipts.keys());

    if (receiptIds.length === 0) {
      console.log("[PushReceiptService] No pending receipts to poll.");
      return { checked: 0, delivered: 0, failed: 0, cleaned: 0 };
    }

    console.log(
      `[PushReceiptService] 🔍 Polling ${receiptIds.length} receipt(s) from Expo...`
    );

    let checked = 0;
    let delivered = 0;
    let failed = 0;
    let cleaned = 0;

    // Split into chunks (Expo recommends ≤ 300 per request)
    const chunks = expo.chunkPushNotificationReceiptIds(receiptIds);

    for (const chunk of chunks) {
      try {
        const receipts = await expo.getPushNotificationReceiptsAsync(chunk);
        checked += chunk.length;

        for (const receiptId of chunk) {
          const receipt = receipts[receiptId];
          const meta = PushReceiptService.pendingReceipts.get(receiptId);

          if (!receipt || !meta) continue;

          if (receipt.status === "ok") {
            delivered++;

            // Update notification status to "delivered" if we have the ID
            if (meta.notificationId) {
              await Notification.findByIdAndUpdate(meta.notificationId, {
                status: "delivered",
              }).catch(() => {}); // non-critical — don't throw
            }
          } else if (receipt.status === "error") {
            failed++;
            const errCode = receipt.details?.error;

            console.error(
              `[PushReceiptService] ❌ Receipt error for token ${meta.token}: ${errCode}`
            );

            if (errCode === "DeviceNotRegistered") {
              // Deactivate — do NOT hard-delete (audit trail preserved)
              await PushReceiptService.deactivateToken(meta.token);
              cleaned++;
            }

            // Log error on notification record
            if (meta.notificationId) {
              await Notification.findByIdAndUpdate(meta.notificationId, {
                status: "failed",
                errorMessage: `Expo receipt error: ${errCode}`,
              }).catch(() => {});
            }
          }

          // Remove from pending map regardless of outcome
          PushReceiptService.pendingReceipts.delete(receiptId);
        }
      } catch (err) {
        console.error("[PushReceiptService] Error fetching receipt chunk:", err.message);
        // Don't remove from map — will retry on next poll
      }
    }

    console.log(
      `[PushReceiptService] ✅ Poll complete — Checked: ${checked}, Delivered: ${delivered}, Failed: ${failed}, Tokens cleaned: ${cleaned}`
    );

    return { checked, delivered, failed, cleaned };
  }

  /**
   * Deactivates a push token when Expo signals it is no longer valid.
   * Sets isActive=false rather than deleting to preserve audit history.
   *
   * @param {string} token - The Expo push token to deactivate
   */
  static async deactivateToken(token) {
    try {
      const result = await DeviceToken.findOneAndUpdate(
        { token },
        { isActive: false, lastUsedAt: new Date() },
        { new: true }
      );

      if (result) {
        console.log(
          `[PushReceiptService] 🔕 Token deactivated (DeviceNotRegistered): ${token}`
        );
      }
    } catch (err) {
      console.error(`[PushReceiptService] Error deactivating token ${token}:`, err.message);
    }
  }

  /**
   * Returns current stats about pending receipts buffer.
   */
  static getStats() {
    return {
      pendingReceiptCount: PushReceiptService.pendingReceipts.size,
      receiptIds: Array.from(PushReceiptService.pendingReceipts.keys()).slice(0, 10), // first 10 only
    };
  }
}

module.exports = PushReceiptService;
