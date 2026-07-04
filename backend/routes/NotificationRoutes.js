const express = require("express");
const DeviceToken = require("../models/DeviceToken");
const User = require("../models/User");
const Notification = require("../models/Notification");
const NotificationJob = require("../models/NotificationJob");
const QueueService = require("../services/QueueService");
const PushReceiptService = require("../services/PushReceiptService");

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
    const inactiveDevicesCount = await DeviceToken.countDocuments({ isActive: false });

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

    // Count failed jobs permanently (exhausted all attempts)
    const permanentlyFailedJobsCount = await NotificationJob.countDocuments({
      status: "failed",
    });

    // Count skipped notifications (rate-limited or preference-skipped)
    const skippedCount = await Notification.countDocuments({
      skippedAt: { $ne: null },
    });

    // Count opened notifications
    const openedCount = await Notification.countDocuments({
      openedAt: { $ne: null },
    });

    // Count clicked notifications
    const clickedCount = await Notification.countDocuments({
      clickedAt: { $ne: null },
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

    const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);

    res.status(200).json({
      success: true,
      analytics: {
        devicesRegistered: totalDevicesCount,
        devicesDeactivated: inactiveDevicesCount,
        notifications: {
          total,
          ...statusCounts,
          skipped: skippedCount,
          opened: openedCount,
          clicked: clickedCount,
          // Engagement rates (guard against division by zero)
          openRate: total > 0 ? ((openedCount / total) * 100).toFixed(1) + "%" : "0%",
          clickRate: total > 0 ? ((clickedCount / total) * 100).toFixed(1) + "%" : "0%",
        },
        jobs: {
          retriedCount: retriedJobsCount,
          permanentlyFailed: permanentlyFailedJobsCount,
        },
        receipts: PushReceiptService.getStats(),
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

/**
 * GET /notifications/queue-stats
 * Returns real-time statistics about the notification job queue.
 * Useful for monitoring dashboards and operations teams.
 */
router.get("/queue-stats", async (req, res) => {
  try {
    const [pending, processing, completed, failed, stuck] = await Promise.all([
      NotificationJob.countDocuments({ status: "pending" }),
      NotificationJob.countDocuments({ status: "processing" }),
      NotificationJob.countDocuments({ status: "completed" }),
      NotificationJob.countDocuments({ status: "failed" }),
      // "Stuck" = processing state locked for > 2 minutes (worker crash recovery indicator)
      NotificationJob.countDocuments({
        status: "processing",
        lockedAt: { $lt: new Date(Date.now() - 120000) },
      }),
    ]);

    const receiptsStats = PushReceiptService.getStats();

    res.status(200).json({
      success: true,
      queue: {
        pending,
        processing,
        completed,
        failed,
        stuck,
        total: pending + processing + completed + failed,
      },
      receipts: receiptsStats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[NotificationRoutes] Error fetching queue stats:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * POST /notifications/track-open
 * Tracks when a user opens/views a notification.
 * Called from the frontend notification response handler.
 */
router.post("/track-open", async (req, res) => {
  const { notificationId } = req.body;

  if (!notificationId) {
    return res.status(400).json({ error: "notificationId is required" });
  }

  try {
    const updated = await Notification.findByIdAndUpdate(
      notificationId,
      { openedAt: new Date() },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: "Notification not found" });
    }

    console.log(`[NotificationRoutes] 👁️ Notification opened: ${notificationId}`);
    res.status(200).json({ success: true, openedAt: updated.openedAt });
  } catch (error) {
    console.error("[NotificationRoutes] Error tracking open:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * POST /notifications/track-click
 * Tracks when a user clicks/taps a notification to navigate.
 * Called from the deep-link handler in useNotifications hook.
 */
router.post("/track-click", async (req, res) => {
  const { notificationId } = req.body;

  if (!notificationId) {
    return res.status(400).json({ error: "notificationId is required" });
  }

  try {
    const updated = await Notification.findByIdAndUpdate(
      notificationId,
      { clickedAt: new Date() },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: "Notification not found" });
    }

    console.log(`[NotificationRoutes] 👆 Notification clicked: ${notificationId}`);
    res.status(200).json({ success: true, clickedAt: updated.clickedAt });
  } catch (error) {
    console.error("[NotificationRoutes] Error tracking click:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * GET /notifications/process-receipts
 * Triggers async Expo push receipt polling.
 * Should be called ~15 minutes after batch sends (via cron or Vercel cron).
 */
router.get("/process-receipts", async (req, res) => {
  try {
    const result = await PushReceiptService.pollReceipts();
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("[NotificationRoutes] Error processing receipts:", error);
    res.status(500).json({ error: "Internal Server Error", message: error.message });
  }
});

module.exports = router;
