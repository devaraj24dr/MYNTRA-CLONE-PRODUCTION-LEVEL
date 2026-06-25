const express = require("express");
const DeviceToken = require("../models/DeviceToken");
const User = require("../models/User");
const Notification = require("../models/Notification");
const NotificationJob = require("../models/NotificationJob");
const QueueService = require("../services/QueueService");

const router = express.Router();

/**
 * POST /notifications/register
 * Registers or updates a device's push token.
 */
router.post("/register", async (req, res) => {
  const { token, deviceType, userId } = req.body;

  if (!token) {
    return res.status(400).json({ error: "Token is required" });
  }

  try {
    // Upsert the token to avoid duplicate records
    const updatedDevice = await DeviceToken.findOneAndUpdate(
      { token },
      {
        userId: userId || null,
        deviceType: deviceType || "unknown",
        isActive: true,
        lastUsedAt: new Date(),
      },
      { new: true, upsert: true }
    );

    console.log(`[NotificationRoutes] Device token registered: ${token} (User: ${userId || "Guest"})`);
    res.status(200).json({ success: true, device: updatedDevice });
  } catch (error) {
    console.error("[NotificationRoutes] Error in /register:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * POST /notifications/send
 * Instantly queues a push notification for processing.
 */
router.post("/send", async (req, res) => {
  const { userId, title, body, eventType, data } = req.body;

  if (!title || !body || !eventType) {
    return res.status(400).json({ error: "title, body, and eventType are required" });
  }

  try {
    const result = await QueueService.queueNotification(
      userId || null,
      title,
      body,
      eventType,
      data || {}
    );

    // Asynchronously process jobs in serverless environments
    QueueService.processJobs().catch((err) => {
      console.error("[NotificationRoutes] Error processing jobs after send:", err);
    });

    res.status(201).json({
      success: true,
      message: "Notification queued and processing initiated.",
      notification: result.notification,
      job: result.job,
    });
  } catch (error) {
    console.error("[NotificationRoutes] Error in /send:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * POST /notifications/schedule
 * Schedules a notification for a future date/time.
 */
router.post("/schedule", async (req, res) => {
  const { userId, title, body, eventType, data, runAt } = req.body;

  if (!title || !body || !eventType || !runAt) {
    return res.status(400).json({ error: "title, body, eventType, and runAt are required" });
  }

  try {
    const runDate = new Date(runAt);
    if (isNaN(runDate.getTime())) {
      return res.status(400).json({ error: "Invalid runAt date format" });
    }

    const result = await QueueService.queueNotification(
      userId || null,
      title,
      body,
      eventType,
      data || {},
      runDate
    );

    res.status(201).json({
      success: true,
      message: `Notification successfully scheduled for ${runDate.toISOString()}`,
      notification: result.notification,
      job: result.job,
    });
  } catch (error) {
    console.error("[NotificationRoutes] Error in /schedule:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * GET /notifications/preferences
 * Returns the preferences of a user.
 */
router.get("/preferences", async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: "userId query parameter is required" });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({
      success: true,
      preferences: user.notificationPreferences || {
        orderUpdates: true,
        promotions: true,
        priceDrops: true,
        cartReminders: true,
      },
    });
  } catch (error) {
    console.error("[NotificationRoutes] Error fetching preferences:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * PUT /notifications/preferences
 * Updates notification preferences for a user.
 */
router.put("/preferences", async (req, res) => {
  const { userId, preferences } = req.body;

  if (!userId || !preferences) {
    return res.status(400).json({ error: "userId and preferences are required" });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Merge preferences
    user.notificationPreferences = {
      orderUpdates: preferences.orderUpdates !== undefined ? preferences.orderUpdates : user.notificationPreferences.orderUpdates,
      promotions: preferences.promotions !== undefined ? preferences.promotions : user.notificationPreferences.promotions,
      priceDrops: preferences.priceDrops !== undefined ? preferences.priceDrops : user.notificationPreferences.priceDrops,
      cartReminders: preferences.cartReminders !== undefined ? preferences.cartReminders : user.notificationPreferences.cartReminders,
    };

    await user.save();

    console.log(`[NotificationRoutes] Updated preferences for user ${userId}:`, user.notificationPreferences);
    res.status(200).json({ success: true, preferences: user.notificationPreferences });
  } catch (error) {
    console.error("[NotificationRoutes] Error updating preferences:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * GET /notifications/analytics
 * Aggregates notification metrics: Sent, Delivered, Failed, and Retried.
 */
router.get("/analytics", async (req, res) => {
  try {
    const totalDevicesCount = await DeviceToken.countDocuments({ isActive: true });
    
    // Aggregation for notification statuses
    const notificationStats = await Notification.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Aggregation for event types
    const eventStats = await Notification.aggregate([
      {
        $group: {
          _id: "$eventType",
          count: { $sum: 1 },
        },
      },
    ]);

    // Count retried jobs (attempts > 1)
    const retriedJobsCount = await NotificationJob.countDocuments({
      attempts: { $gt: 1 },
    });

    const statusCounts = { pending: 0, sent: 0, failed: 0, delivered: 0 };
    notificationStats.forEach((stat) => {
      if (statusCounts[stat._id] !== undefined) {
        statusCounts[stat._id] = stat.count;
      }
    });

    const eventCounts = {};
    eventStats.forEach((stat) => {
      eventCounts[stat._id] = stat.count;
    });

    res.status(200).json({
      success: true,
      analytics: {
        devicesRegistered: totalDevicesCount,
        notifications: {
          total: Object.values(statusCounts).reduce((a, b) => a + b, 0),
          ...statusCounts,
        },
        jobs: {
          retriedCount: retriedJobsCount,
        },
        eventTypeBreakdown: eventCounts,
      },
    });
  } catch (error) {
    console.error("[NotificationRoutes] Error fetching analytics:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * GET /notifications/process-jobs
 * Endpoint for cron jobs to process pending notifications.
 */
router.get("/process-jobs", async (req, res) => {
  try {
    await QueueService.processJobs();
    res.status(200).json({ success: true, message: "Queue processing completed." });
  } catch (error) {
    console.error("[NotificationRoutes] Error in /process-jobs:", error);
    res.status(500).json({ error: "Internal Server Error", message: error.message });
  }
});

module.exports = router;
