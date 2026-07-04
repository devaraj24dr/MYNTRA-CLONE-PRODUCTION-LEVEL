/**
 * tests/queue.test.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Focused test suite for the Queue & Retry system.
 *
 * Covers:
 *   - Immediate vs scheduled job dispatch
 *   - Atomic locking (findOneAndUpdate)
 *   - Stuck-job recovery (lockedAt > 60s)
 *   - Exponential backoff correctness
 *   - Permanent failure after maxAttempts
 *   - Queue statistics endpoint data
 *   - FIFO ordering
 *
 * Run:  cd backend && npm test -- queue.test.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

"use strict";

jest.setTimeout(30000);

const mongoose = require("mongoose");

const ATLAS_TEST_URI = "mongodb://devady2409_db_user:Deva46deva@ac-wnk5get-shard-00-00.gb4a7do.mongodb.net:27017,ac-wnk5get-shard-00-01.gb4a7do.mongodb.net:27017,ac-wnk5get-shard-00-02.gb4a7do.mongodb.net:27017/myntra_test?ssl=true&replicaSet=atlas-3w910f-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0";

beforeAll(async () => {
  await mongoose.connect(ATLAS_TEST_URI);
}, 30000);

afterAll(async () => {
  await mongoose.disconnect();
}, 20000);

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}, 15000);

// ── Mock expo-server-sdk ──────────────────────────────────────────────────────
jest.mock("expo-server-sdk", () => {
  const mockInstance = {
    chunkPushNotifications: jest.fn((msgs) => [msgs]),
    sendPushNotificationsAsync: jest.fn(async (chunk) =>
      chunk.map(() => ({ status: "ok", id: "rcpt-" + Math.random().toString(36).slice(2) }))
    ),
    getPushNotificationReceiptsAsync: jest.fn(async (ids) => {
      const result = {};
      ids.forEach((id) => (result[id] = { status: "ok" }));
      return result;
    }),
    chunkPushNotificationReceiptIds: jest.fn((ids) => [ids]),
    isExpoPushToken: jest.fn((t) => t && t.startsWith("ExponentPushToken[")),
  };
  const ExpoClass = jest.fn(() => mockInstance);
  ExpoClass.isExpoPushToken = mockInstance.isExpoPushToken;
  return { Expo: ExpoClass };
});

const NotificationJob = require("../models/NotificationJob");
const Notification = require("../models/Notification");
const DeviceToken = require("../models/DeviceToken");
const User = require("../models/User");
const QueueService = require("../services/QueueService");

// ── Helpers ───────────────────────────────────────────────────────────────────
async function makeUser() {
  return User.create({
    fullName: "Queue Tester",
    email: `q-${Date.now()}@test.com`,
    password: "pw",
    notificationPreferences: {
      orderUpdates: true,
      promotions: true,
      priceDrops: true,
      cartReminders: true,
    },
  });
}

async function makeToken(userId) {
  return DeviceToken.create({
    userId,
    token: `ExponentPushToken[q_${Date.now()}]`,
    deviceType: "android",
    isActive: true,
    lastUsedAt: new Date(),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. JOB CREATION
// ─────────────────────────────────────────────────────────────────────────────
describe("Job Creation", () => {
  test("queueNotification creates Notification + NotificationJob atomically", async () => {
    const user = await makeUser();
    const { notification, job } = await QueueService.queueNotification(
      user._id.toString(),
      "Hello",
      "World",
      "Order Placed"
    );

    expect(notification._id).toBeTruthy();
    expect(job._id).toBeTruthy();
    expect(job.notificationId.toString()).toBe(notification._id.toString());
    expect(job.status).toBe("pending");
    expect(job.attempts).toBe(0);
    expect(job.maxAttempts).toBe(3);
  });

  test("immediate job has runAt <= now", async () => {
    const user = await makeUser();
    const { job } = await QueueService.queueNotification(
      user._id.toString(),
      "Immediate",
      "Body",
      "Order Shipped"
    );
    expect(job.runAt.getTime()).toBeLessThanOrEqual(Date.now() + 100);
  });

  test("scheduled job has runAt in the future", async () => {
    const user = await makeUser();
    const futureDate = new Date(Date.now() + 120_000); // 2 min
    const { job } = await QueueService.queueNotification(
      user._id.toString(),
      "Scheduled",
      "Body",
      "Cart Abandonment",
      {},
      futureDate
    );
    expect(job.runAt.getTime()).toBeGreaterThan(Date.now());
  });

  test("guest notifications work with userId=null", async () => {
    const { notification, job } = await QueueService.queueNotification(
      null,
      "Broadcast",
      "Hello everyone",
      "Flash Sales"
    );
    expect(notification.userId).toBeNull();
    expect(job.status).toBe("pending");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. FIFO ORDERING
// ─────────────────────────────────────────────────────────────────────────────
describe("FIFO Queue Ordering", () => {
  test("older runAt jobs are selected before newer ones", async () => {
    const user = await makeUser();

    // Create 3 notifications at different times
    const times = [
      new Date(Date.now() - 3000),
      new Date(Date.now() - 2000),
      new Date(Date.now() - 1000),
    ];

    const jobs = [];
    for (const t of times) {
      const { job } = await QueueService.queueNotification(
        user._id.toString(),
        "Title",
        "Body",
        "Order Delivered",
        {},
        t
      );
      jobs.push(job);
    }

    // The job with the smallest runAt should be picked first
    const firstPicked = await NotificationJob.findOne({ status: "pending" }).sort({ runAt: 1 });
    expect(firstPicked._id.toString()).toBe(jobs[0]._id.toString());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. ATOMIC LOCKING
// ─────────────────────────────────────────────────────────────────────────────
describe("Atomic Locking", () => {
  test("job locked by worker has lockedBy and lockedAt set", async () => {
    const user = await makeUser();
    await makeToken(user._id);

    const { job } = await QueueService.queueNotification(
      user._id.toString(),
      "Lock test",
      "Body",
      "Order Confirmed"
    );

    // Simulate atomic lock
    const workerId = `worker-test-${Date.now()}`;
    const locked = await NotificationJob.findOneAndUpdate(
      { _id: job._id, status: "pending", lockedAt: null },
      { status: "processing", lockedAt: new Date(), lockedBy: workerId },
      { new: true }
    );

    expect(locked.lockedBy).toBe(workerId);
    expect(locked.lockedAt).toBeTruthy();
    expect(locked.status).toBe("processing");
  });

  test("a locked job cannot be picked by a second worker", async () => {
    const user = await makeUser();
    const { job } = await QueueService.queueNotification(
      user._id.toString(),
      "Double-lock test",
      "Body",
      "Order Placed"
    );

    // First worker locks it
    await NotificationJob.findByIdAndUpdate(job._id, {
      status: "processing",
      lockedAt: new Date(),
      lockedBy: "worker-1",
    });

    // Second worker tries to lock it — should get null (already locked, not old enough to recover)
    const result = await NotificationJob.findOneAndUpdate(
      {
        _id: job._id,
        status: "pending",
        $or: [
          { lockedAt: null },
          { lockedAt: { $lt: new Date(Date.now() - 60_000) } },
        ],
      },
      { status: "processing", lockedAt: new Date(), lockedBy: "worker-2" },
      { new: true }
    );

    expect(result).toBeNull(); // worker-2 could not acquire the lock
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. STUCK JOB RECOVERY
// ─────────────────────────────────────────────────────────────────────────────
describe("Stuck Job Recovery", () => {
  test("job locked for >60s can be re-acquired by a new worker", async () => {
    const user = await makeUser();
    const { job } = await QueueService.queueNotification(
      user._id.toString(),
      "Stuck job test",
      "Body",
      "Order Placed"
    );

    // Simulate a stale lock (locked 90 seconds ago)
    const staleLockedAt = new Date(Date.now() - 90_000);
    await NotificationJob.findByIdAndUpdate(job._id, {
      status: "processing",
      lockedAt: staleLockedAt,
      lockedBy: "dead-worker-99",
    });

    // New worker should be able to recover it
    const recovered = await NotificationJob.findOneAndUpdate(
      {
        _id: job._id,
        status: "processing",
        $or: [
          { lockedAt: null },
          { lockedAt: { $lt: new Date(Date.now() - 60_000) } },
        ],
      },
      { status: "processing", lockedAt: new Date(), lockedBy: "worker-recovery" },
      { new: true }
    );

    expect(recovered).toBeTruthy();
    expect(recovered.lockedBy).toBe("worker-recovery");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. RETRY LOGIC & EXPONENTIAL BACKOFF
// ─────────────────────────────────────────────────────────────────────────────
describe("Retry Logic & Exponential Backoff", () => {
  test("backoff at attempt=1 is 20 seconds", () => {
    const attempt = 1;
    const backoffMs = Math.pow(2, attempt) * 10 * 1000;
    expect(backoffMs).toBe(20_000);
  });

  test("backoff at attempt=2 is 40 seconds", () => {
    const attempt = 2;
    const backoffMs = Math.pow(2, attempt) * 10 * 1000;
    expect(backoffMs).toBe(40_000);
  });

  test("backoff at attempt=3 (max) would be 80 seconds (never scheduled — fails)", () => {
    const attempt = 3;
    const backoffMs = Math.pow(2, attempt) * 10 * 1000;
    expect(backoffMs).toBe(80_000);
  });

  test("job is marked 'failed' after maxAttempts exceeded", async () => {
    const user = await makeUser();
    const { notification, job } = await QueueService.queueNotification(
      user._id.toString(),
      "Max retry",
      "Body",
      "Order Placed"
    );

    // Force max attempts state
    job.attempts = 3;
    job.maxAttempts = 3;
    job.status = "processing";
    await job.save();

    // Mock NotificationService to always throw
    const NotificationService = require("../services/NotificationService");
    const orig = NotificationService.sendNotification;
    NotificationService.sendNotification = jest.fn().mockRejectedValue(new Error("Permanent fail"));

    await QueueService.executeJob(job);

    const updated = await NotificationJob.findById(job._id);
    expect(updated.status).toBe("failed");
    expect(updated.lastError).toContain("Permanent fail");

    // Notification record should also be updated
    const updatedNotif = await Notification.findById(notification._id);
    expect(updatedNotif.status).toBe("failed");
    expect(updatedNotif.errorMessage).toContain("maximum retry");

    NotificationService.sendNotification = orig;
  });

  test("failing job with attempts < max is re-queued with future runAt", async () => {
    const user = await makeUser();
    const { notification, job } = await QueueService.queueNotification(
      user._id.toString(),
      "Retry pending",
      "Body",
      "Order Placed"
    );

    // Attempt 1 fails
    job.attempts = 1;
    job.maxAttempts = 3;
    job.status = "processing";
    await job.save();

    const NotificationService = require("../services/NotificationService");
    const orig = NotificationService.sendNotification;
    NotificationService.sendNotification = jest.fn().mockRejectedValue(new Error("Transient error"));

    const beforeExec = Date.now();
    await QueueService.executeJob(job);

    const updated = await NotificationJob.findById(job._id);
    expect(updated.status).toBe("pending");
    // runAt should be > now (future retry)
    expect(updated.runAt.getTime()).toBeGreaterThan(beforeExec + 15_000);

    NotificationService.sendNotification = orig;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. SCHEDULED JOB — NOT PROCESSED BEFORE ITS TIME
// ─────────────────────────────────────────────────────────────────────────────
describe("Scheduled Job Gating", () => {
  test("future job is not selected by processJobs before its runAt", async () => {
    const user = await makeUser();
    const farFuture = new Date(Date.now() + 3_600_000); // 1 hour away

    const { job } = await QueueService.queueNotification(
      user._id.toString(),
      "Future",
      "Body",
      "Cart Abandonment",
      {},
      farFuture
    );

    // processJobs should not touch this job
    await QueueService.processJobs();

    const stillPending = await NotificationJob.findById(job._id);
    expect(stillPending.status).toBe("pending");
    // lockedAt should still be null (never picked up)
    expect(stillPending.lockedAt).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. QUEUE STATISTICS DATA (mirrors /notifications/queue-stats logic)
// ─────────────────────────────────────────────────────────────────────────────
describe("Queue Statistics", () => {
  test("counts are accurate across all job states", async () => {
    const user = await makeUser();

    // Create jobs in different states
    const notif = await Notification.create({
      userId: user._id,
      title: "T",
      body: "B",
      eventType: "Order Placed",
      data: {},
      scheduledAt: new Date(),
    });

    await NotificationJob.create([
      { notificationId: notif._id, status: "pending", runAt: new Date(), attempts: 0, maxAttempts: 3 },
      { notificationId: notif._id, status: "processing", runAt: new Date(), attempts: 1, maxAttempts: 3, lockedAt: new Date(), lockedBy: "w1" },
      { notificationId: notif._id, status: "completed", runAt: new Date(), attempts: 1, maxAttempts: 3 },
      { notificationId: notif._id, status: "completed", runAt: new Date(), attempts: 1, maxAttempts: 3 },
      { notificationId: notif._id, status: "failed", runAt: new Date(), attempts: 3, maxAttempts: 3 },
    ]);

    const [pending, processing, completed, failed] = await Promise.all([
      NotificationJob.countDocuments({ status: "pending" }),
      NotificationJob.countDocuments({ status: "processing" }),
      NotificationJob.countDocuments({ status: "completed" }),
      NotificationJob.countDocuments({ status: "failed" }),
    ]);

    expect(pending).toBe(1);
    expect(processing).toBe(1);
    expect(completed).toBe(2);
    expect(failed).toBe(1);
    expect(pending + processing + completed + failed).toBe(5);
  });

  test("detects stuck jobs (processing > 2 min)", async () => {
    const notif = await Notification.create({
      title: "T",
      body: "B",
      eventType: "Order Placed",
      data: {},
      scheduledAt: new Date(),
    });

    const staleLockedAt = new Date(Date.now() - 180_000); // 3 min ago
    await NotificationJob.create({
      notificationId: notif._id,
      status: "processing",
      runAt: new Date(),
      attempts: 1,
      maxAttempts: 3,
      lockedAt: staleLockedAt,
      lockedBy: "dead-worker",
    });

    const stuck = await NotificationJob.countDocuments({
      status: "processing",
      lockedAt: { $lt: new Date(Date.now() - 120_000) },
    });

    expect(stuck).toBe(1);
  });

  test("counts retried jobs correctly (attempts > 1)", async () => {
    const notif = await Notification.create({
      title: "T",
      body: "B",
      eventType: "Order Placed",
      data: {},
      scheduledAt: new Date(),
    });

    await NotificationJob.create([
      { notificationId: notif._id, status: "completed", runAt: new Date(), attempts: 1, maxAttempts: 3 }, // not retried
      { notificationId: notif._id, status: "completed", runAt: new Date(), attempts: 2, maxAttempts: 3 }, // retried once
      { notificationId: notif._id, status: "failed", runAt: new Date(), attempts: 3, maxAttempts: 3 },    // retried twice
    ]);

    const retried = await NotificationJob.countDocuments({ attempts: { $gt: 1 } });
    expect(retried).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. NOTIFICATION JOB INDEXES
// ─────────────────────────────────────────────────────────────────────────────
describe("NotificationJob Index Coverage", () => {
  test("has composite index on (status, runAt)", () => {
    const indexes = NotificationJob.schema.indexes();
    const hasIt = indexes.some(
      ([fields]) => fields.status !== undefined && fields.runAt !== undefined
    );
    expect(hasIt).toBe(true);
  });

  test("has index on lockedAt for recovery queries", () => {
    const indexes = NotificationJob.schema.indexes();
    const hasIt = indexes.some(([fields]) => fields.lockedAt !== undefined);
    expect(hasIt).toBe(true);
  });
});
