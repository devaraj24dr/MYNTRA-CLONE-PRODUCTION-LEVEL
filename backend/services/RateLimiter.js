const Notification = require("../models/Notification");

// Configuration limits
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.NOTIFICATION_LIMIT_WINDOW_MS) || 3600000; // 1 hour default
const RATE_LIMIT_MAX_PROMOTIONS = parseInt(process.env.NOTIFICATION_LIMIT_MAX_PROMOTIONS) || 5; // 5 promotional updates per hour

/**
 * Service to manage and enforce rate limits on push notifications.
 */
class RateLimiter {
  /**
   * Checks if a notification to a specific user should be rate-limited.
   * @param {string} userId - The target user ID.
   * @param {string} eventType - The notification event type.
   * @returns {Promise<boolean>} - True if rate-limited, false otherwise.
   */
  static async isRateLimited(userId, eventType) {
    // Order updates should bypass rate limiting to guarantee delivery of critical updates
    const bypassEvents = [
      "Order Placed",
      "Order Confirmed",
      "Order Shipped",
      "Order Delivered"
    ];

    if (bypassEvents.includes(eventType)) {
      return false;
    }

    if (!userId) {
      // Guest users without IDs are not rate-limited at the User model level,
      // but they can be restricted at the device token registry level if needed.
      return false;
    }

    // Calculate window start time
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);

    // Count promotional notifications sent to the user in this window
    const recentSentCount = await Notification.countDocuments({
      userId,
      eventType: { $nin: bypassEvents },
      status: "sent",
      sentAt: { $gte: windowStart }
    });

    return recentSentCount >= RATE_LIMIT_MAX_PROMOTIONS;
  }
}

module.exports = RateLimiter;
