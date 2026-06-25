const NotificationJob = require("../models/NotificationJob");
const Notification = require("../models/Notification");
const NotificationService = require("./NotificationService");

class QueueService {
  constructor() {
    this.intervalId = null;
  }

  /**
   * Starts the background queue worker poller.
   */
  static start() {
    if (this.intervalId) {
      console.log("[QueueService] Worker is already running.");
      return;
    }

    console.log("[QueueService] ⚙️ Starting Notification Queue Worker...");
    // Run the job check every 5 seconds
    this.intervalId = setInterval(() => {
      this.processJobs().catch((err) => {
        console.error("[QueueService] Error in poller loop:", err);
      });
    }, 5000);
  }

  /**
   * Stops the background queue worker poller.
   */
  static stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("[QueueService] 🛑 Notification Queue Worker stopped.");
    }
  }

  /**
   * Polls and processes pending jobs from MongoDB.
   */
  static async processJobs() {
    const workerId = `worker-${process.pid}-${Date.now()}`;
    let processedCount = 0;

    // Process a max batch of 5 jobs per tick to prevent resource hogging
    while (processedCount < 5) {
      // Atomic query to lock a job for this worker
      const job = await NotificationJob.findOneAndUpdate(
        {
          status: "pending",
          attempts: { $lt: 3 }, // Max 3 attempts (attempts 0, 1, 2)
          runAt: { $lte: new Date() },
          $or: [
            { lockedAt: null },
            { lockedAt: { $lt: new Date(Date.now() - 60000) } }, // Recovery: unlock jobs stuck for > 60s
          ],
        },
        {
          status: "processing",
          lockedAt: new Date(),
          lockedBy: workerId,
        },
        {
          new: true,
          sort: { runAt: 1 }, // FIFO: process older jobs first
        }
      );

      if (!job) {
        // No more eligible jobs in this poller tick
        break;
      }

      processedCount++;
      // Execute the job asynchronously to keep the worker polling
      this.executeJob(job).catch((err) => {
        console.error(`[QueueService] Fatal error processing job ${job._id}:`, err);
      });
    }
  }

  /**
   * Executes a single locked notification job.
   * @param {object} job - The Mongoose job document.
   */
  static async executeJob(job) {
    console.log(`[QueueService] 🚀 Processing job ${job._id} for notification ${job.notificationId} (Attempt: ${job.attempts + 1})`);

    try {
      // 1. Increment attempts immediately
      job.attempts += 1;
      await job.save();

      // 2. Dispatch to NotificationService
      const result = await NotificationService.sendNotification(job.notificationId);

      // 3. Mark job as completed
      job.status = "completed";
      job.lockedAt = null;
      job.lockedBy = null;
      await job.save();

      console.log(`[QueueService] ✅ Job ${job._id} completed successfully: ${result.message || ""}`);
    } catch (error) {
      console.error(`[QueueService] ❌ Job ${job._id} execution failed: ${error.message}`);

      job.lastError = error.message;
      job.lockedAt = null;
      job.lockedBy = null;

      // 4. Retry Logic & Exponential Backoff
      if (job.attempts >= job.maxAttempts) {
        job.status = "failed";
        console.error(`[QueueService] 💀 Job ${job._id} failed after ${job.attempts} attempts. Aborting.`);

        // Also update the underlying notification log to failed
        await Notification.findByIdAndUpdate(job.notificationId, {
          status: "failed",
          errorMessage: `Failed after maximum retry attempts. Last error: ${error.message}`,
        });
      } else {
        job.status = "pending";
        // Exponential backoff: 2^attempts * 10 seconds (e.g. 20s, 40s)
        const backoffSeconds = Math.pow(2, job.attempts) * 10;
        job.runAt = new Date(Date.now() + backoffSeconds * 1000);

        console.log(`[QueueService] ⏳ Job ${job._id} scheduled for retry in ${backoffSeconds}s (at ${job.runAt.toISOString()})`);
      }

      await job.save();
    }
  }

  /**
   * Utility to queue a new notification.
   * @param {string} userId - Target User ID.
   * @param {string} title - Notification Title.
   * @param {string} body - Notification Body.
   * @param {string} eventType - The notification event type.
   * @param {object} data - Payload data.
   * @param {Date} runAt - Scheduled execution time.
   */
  static async queueNotification(userId, title, body, eventType, data = {}, runAt = new Date()) {
    try {
      // Create the notification record
      const notification = await Notification.create({
        userId,
        title,
        body,
        eventType,
        data,
        status: "pending",
        scheduledAt: runAt,
      });

      // Create the job record
      const job = await NotificationJob.create({
        notificationId: notification._id,
        status: "pending",
        runAt: runAt,
        attempts: 0,
        maxAttempts: 3,
      });

      console.log(`[QueueService] 📥 Queued notification ${notification._id} under Job ${job._id} (Event: ${eventType}, Scheduled for: ${runAt.toISOString()})`);
      return { notification, job };
    } catch (error) {
      console.error("[QueueService] Error queuing notification:", error);
      throw error;
    }
  }
}

module.exports = QueueService;
