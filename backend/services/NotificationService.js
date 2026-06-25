const { Expo } = require("expo-server-sdk");
const DeviceToken = require("../models/DeviceToken");
const User = require("../models/User");
const Notification = require("../models/Notification");
const RateLimiter = require("./RateLimiter");

// Initialize Expo SDK client
const expo = new Expo();

// Map notification event types to User notification preference fields
const EVENT_TO_PREFERENCE_MAP = {
  "Order Placed": "orderUpdates",
  "Order Confirmed": "orderUpdates",
  "Order Shipped": "orderUpdates",
  "Order Delivered": "orderUpdates",
  "Wishlist Price Drop": "priceDrops",
  "Back In Stock": "promotions",
  "Flash Sales": "promotions",
  "Cart Abandonment": "cartReminders",
};

class NotificationService {
  /**
   * Helper to verify if a user allows notifications of a specific event type.
   * @param {string} userId - The user ID to check.
   * @param {string} eventType - The notification event type.
   * @returns {Promise<boolean>} - True if notifications are enabled.
   */
  static async checkUserPreferences(userId, eventType) {
    if (!userId) return true; // Default to true for guest users

    const user = await User.findById(userId);
    if (!user) return false;

    // Get the preference field mapped to the event type
    const preferenceField = EVENT_TO_PREFERENCE_MAP[eventType];
    if (!preferenceField) return true; // Default to true if not mapped

    // Return the preference value (default to true if missing)
    if (user.notificationPreferences && user.notificationPreferences[preferenceField] !== undefined) {
      return user.notificationPreferences[preferenceField];
    }
    return true;
  }

  /**
   * Cleans up invalid tokens from the database.
   * @param {string} token - The invalid push token.
   */
  static async removeInvalidToken(token) {
    try {
      const result = await DeviceToken.deleteOne({ token });
      if (result.deletedCount > 0) {
        console.log(`[NotificationService] 🗑️ Automatically removed invalid push token: ${token}`);
      }
    } catch (error) {
      console.error(`[NotificationService] Error removing invalid token ${token}:`, error);
    }
  }

  /**
   * Sends a single notification log to its targeted device tokens.
   * @param {string} notificationId - The MongoDB Notification ID.
   * @returns {Promise<{status: string, message: string}>}
   */
  static async sendNotification(notificationId) {
    const notification = await Notification.findById(notificationId);
    if (!notification) {
      throw new Error(`Notification record with ID ${notificationId} not found`);
    }

    const { userId, title, body, eventType, data } = notification;

    // 1. Validate User Notification Preferences
    if (userId) {
      const isEnabled = await this.checkUserPreferences(userId, eventType);
      if (!isEnabled) {
        console.log(`[NotificationService] 🚫 Notification skipped: User ${userId} has disabled preference for ${eventType}`);
        notification.status = "failed";
        notification.errorMessage = `User disabled notifications for preference category ${EVENT_TO_PREFERENCE_MAP[eventType]}`;
        await notification.save();
        return { status: "skipped", message: "User disabled preference" };
      }

      // 2. Validate Rate Limiting
      const isLimited = await RateLimiter.isRateLimited(userId, eventType);
      if (isLimited) {
        console.log(`[NotificationService] ⏳ Notification skipped: Rate limit exceeded for user ${userId} on ${eventType}`);
        notification.status = "failed";
        notification.errorMessage = "Rate limit exceeded for promotional notifications";
        await notification.save();
        return { status: "skipped", message: "Rate limit exceeded" };
      }
    }

    // 3. Retrieve active device tokens for the user
    let devices = [];
    if (userId) {
      devices = await DeviceToken.find({ userId, isActive: true });
    } else if (data && data.tokens) {
      // Allow broadcasting to specific tokens passed in metadata
      devices = await DeviceToken.find({ token: { $in: data.tokens }, isActive: true });
    } else {
      // Broadcast to all active devices (fallback for public announcements/Flash Sales)
      devices = await DeviceToken.find({ isActive: true });
    }

    if (devices.length === 0) {
      console.log(`[NotificationService] ⚠️ No active device tokens found for target.`);
      notification.status = "failed";
      notification.errorMessage = "No active device tokens found";
      await notification.save();
      return { status: "failed", message: "No tokens found" };
    }

    // 4. Construct Expo Messages
    const messages = [];
    const tokenToDeviceMap = {};

    for (const device of devices) {
      const pushToken = device.token;

      // Validate Expo token format
      if (!Expo.isExpoPushToken(pushToken)) {
        console.warn(`[NotificationService] invalid Expo token: ${pushToken}`);
        await this.removeInvalidToken(pushToken);
        continue;
      }

      tokenToDeviceMap[pushToken] = device;

      messages.push({
        to: pushToken,
        sound: "default",
        title: title,
        body: body,
        data: { ...data, eventType, notificationId: notification._id.toString() },
        priority: "high",
        channelId: "default",
      });
    }

    if (messages.length === 0) {
      notification.status = "failed";
      notification.errorMessage = "No valid device tokens left after validation";
      await notification.save();
      return { status: "failed", message: "No valid tokens" };
    }

    // 5. Send push notifications in recommended batches of 100
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];
    let sentSuccessCount = 0;
    let sentFailureCount = 0;
    const errorsList = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error("[NotificationService] Error sending chunk:", error);
        errorsList.push(error.message);
        sentFailureCount += chunk.length;
      }
    }

    // 6. Process Ticket Receipts to identify immediately invalid tokens
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      const message = messages[i];
      const token = message.to;

      if (ticket.status === "ok") {
        sentSuccessCount++;
      } else {
        sentFailureCount++;
        const errDetails = ticket.details;
        const errCode = errDetails ? errDetails.error : "UnknownError";
        console.error(`[NotificationService] Ticket error for token ${token}: code = ${errCode}`);

        if (errCode === "DeviceNotRegistered") {
          // Token is no longer active, clean it up!
          await this.removeInvalidToken(token);
        } else {
          errorsList.push(`Token error: ${errCode}`);
        }
      }
    }

    // 7. Update Notification Status
    if (sentSuccessCount > 0) {
      notification.status = "sent";
      notification.sentAt = new Date();
      if (errorsList.length > 0) {
        notification.errorMessage = `Partial failure: ${errorsList.join(", ")}`;
      }
      await notification.save();
      return {
        status: "success",
        message: `Successfully sent to ${sentSuccessCount} devices. Failed for ${sentFailureCount} devices.`,
      };
    } else {
      notification.status = "failed";
      notification.errorMessage = errorsList.join(", ") || "All tokens failed delivery";
      await notification.save();
      throw new Error(notification.errorMessage);
    }
  }
}

module.exports = NotificationService;
