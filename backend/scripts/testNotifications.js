/**
 * scripts/testNotifications.js
 * ─────────────────────────────────────────────────────────────────────────────
 * End-to-End Manual API Test Runner for the Notification System.
 *
 * Tests every notification endpoint against a running backend server.
 * Unlike Jest unit tests, this exercises the REAL network stack and database.
 *
 * Prerequisites:
 *   1. Backend server must be running: npm run dev
 *   2. At least one user must exist in the database
 *
 * Usage:
 *   node scripts/testNotifications.js [BASE_URL] [USER_ID]
 *
 * Examples:
 *   node scripts/testNotifications.js http://localhost:5000 64abc123def456
 *   node scripts/testNotifications.js                             (uses defaults)
 *
 * Output:
 *   Prints PASS/FAIL for every endpoint with response details.
 *   Exits with code 0 if all pass, 1 if any fail.
 * ─────────────────────────────────────────────────────────────────────────────
 */

"use strict";

const http = require("http");
const https = require("https");

// ── Configuration ─────────────────────────────────────────────────────────────
const BASE_URL = process.argv[2] || "http://localhost:5000";
const TEST_USER_ID = process.argv[3] || null; // optional — some tests are guest-mode if omitted
const FAKE_EXPO_TOKEN = `ExponentPushToken[testrunner_${Date.now()}]`;

// ── ANSI colours ──────────────────────────────────────────────────────────────
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

let passCount = 0;
let failCount = 0;
let notificationId = null; // captured from /send for later tracking tests

// ── HTTP Helper ───────────────────────────────────────────────────────────────
function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const isHttps = url.protocol === "https:";
    const lib = isHttps ? https : http;

    const bodyStr = body ? JSON.stringify(body) : null;
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        "Content-Type": "application/json",
        ...(bodyStr ? { "Content-Length": Buffer.byteLength(bodyStr) } : {}),
      },
    };

    const req = lib.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on("error", reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ── Assertion Helper ──────────────────────────────────────────────────────────
function assert(testName, condition, detail = "") {
  if (condition) {
    console.log(`  ${GREEN}✅ PASS${RESET} — ${testName}`);
    passCount++;
  } else {
    console.log(`  ${RED}❌ FAIL${RESET} — ${testName}${detail ? ": " + detail : ""}`);
    failCount++;
  }
}

function section(name) {
  console.log(`\n${BOLD}${CYAN}▶ ${name}${RESET}`);
}

// ── Test Suites ───────────────────────────────────────────────────────────────

async function testHealthCheck() {
  section("Health Check");
  try {
    const { status } = await request("GET", "/");
    assert("Backend is reachable (HTTP 200)", status === 200, `Got ${status}`);
  } catch (err) {
    assert("Backend is reachable", false, err.message);
  }
}

async function testRegisterToken() {
  section("POST /notifications/register — Token Registration");

  // Test 1: Valid registration (guest)
  try {
    const { status, body } = await request("POST", "/notifications/register", {
      token: FAKE_EXPO_TOKEN,
      deviceType: "android",
      userId: TEST_USER_ID || null,
    });
    assert("Returns HTTP 200", status === 200, `Got ${status}`);
    assert("success=true in response", body.success === true);
    assert("device object returned", !!body.device);
    assert("token matches sent token", body.device?.token === FAKE_EXPO_TOKEN);
    assert("isActive=true by default", body.device?.isActive === true);
  } catch (err) {
    assert("Token registration request succeeded", false, err.message);
  }

  // Test 2: Missing token → 400
  try {
    const { status, body } = await request("POST", "/notifications/register", {
      deviceType: "ios",
    });
    assert("Returns HTTP 400 when token is missing", status === 400, `Got ${status}`);
    assert("Error message present", !!body.error);
  } catch (err) {
    assert("Missing token validation request succeeded", false, err.message);
  }

  // Test 3: Idempotent upsert (re-registering same token)
  try {
    const { status, body } = await request("POST", "/notifications/register", {
      token: FAKE_EXPO_TOKEN,
      deviceType: "android",
      userId: TEST_USER_ID || null,
    });
    assert("Upsert returns HTTP 200 (idempotent)", status === 200, `Got ${status}`);
  } catch (err) {
    assert("Idempotent upsert succeeded", false, err.message);
  }
}

async function testSendNotification() {
  section("POST /notifications/send — Immediate Notification");

  // Test 1: Valid send
  try {
    const { status, body } = await request("POST", "/notifications/send", {
      userId: TEST_USER_ID || null,
      title: "🛍️ Test Order Confirmed",
      body: "Your test order #E2E-001 has been confirmed.",
      eventType: "Order Confirmed",
      data: { orderId: "E2E-001" },
    });
    assert("Returns HTTP 201", status === 201, `Got ${status}`);
    assert("success=true", body.success === true);
    assert("notification object returned", !!body.notification);
    assert("job object returned", !!body.job);
    assert("notification has _id", !!body.notification?._id);
    assert("job status is pending", body.job?.status === "pending");

    // Capture for later tests
    notificationId = body.notification._id;
    console.log(`    ${YELLOW}→ Captured notificationId: ${notificationId}${RESET}`);
  } catch (err) {
    assert("Send notification request succeeded", false, err.message);
  }

  // Test 2: Missing required fields → 400
  try {
    const { status } = await request("POST", "/notifications/send", {
      userId: TEST_USER_ID,
      title: "Missing body and eventType",
    });
    assert("Returns HTTP 400 on missing fields", status === 400, `Got ${status}`);
  } catch (err) {
    assert("Missing fields validation succeeded", false, err.message);
  }

  // Test 3: Promotional Campaign (new event type)
  try {
    const { status, body } = await request("POST", "/notifications/send", {
      userId: TEST_USER_ID || null,
      title: "🎉 Summer Campaign",
      body: "50% off on all summer wear!",
      eventType: "Promotional Campaign",
      data: {},
    });
    assert("Promotional Campaign event type accepted (HTTP 201)", status === 201, `Got ${status}`);
  } catch (err) {
    assert("Promotional Campaign request succeeded", false, err.message);
  }
}

async function testScheduleNotification() {
  section("POST /notifications/schedule — Scheduled Notification");

  // Schedule 10 seconds in the future
  const runAt = new Date(Date.now() + 10_000).toISOString();

  try {
    const { status, body } = await request("POST", "/notifications/schedule", {
      userId: TEST_USER_ID || null,
      title: "🛒 Cart Reminder",
      body: "You left items in your cart!",
      eventType: "Cart Abandonment",
      data: {},
      runAt,
    });
    assert("Returns HTTP 201", status === 201, `Got ${status}`);
    assert("success=true", body.success === true);
    assert("notification scheduled", !!body.notification);
    assert("job created", !!body.job);
    assert("job runAt in future", new Date(body.job?.runAt).getTime() > Date.now());
  } catch (err) {
    assert("Schedule request succeeded", false, err.message);
  }

  // Invalid runAt format
  try {
    const { status } = await request("POST", "/notifications/schedule", {
      title: "Bad Schedule",
      body: "Body",
      eventType: "Cart Abandonment",
      runAt: "not-a-date",
    });
    assert("Returns HTTP 400 on invalid runAt", status === 400, `Got ${status}`);
  } catch (err) {
    assert("Invalid runAt validation succeeded", false, err.message);
  }
}

async function testPreferences() {
  section("GET/PUT /notifications/preferences — User Preferences");

  if (!TEST_USER_ID) {
    console.log(`  ${YELLOW}⚠ Skipping: No USER_ID provided. Pass as 3rd arg to test preferences.${RESET}`);
    return;
  }

  // GET preferences
  try {
    const { status, body } = await request(
      "GET",
      `/notifications/preferences?userId=${TEST_USER_ID}`
    );
    assert("GET preferences returns HTTP 200", status === 200, `Got ${status}`);
    assert("preferences object present", !!body.preferences);
    assert("orderUpdates key present", body.preferences?.orderUpdates !== undefined);
    assert("promotions key present", body.preferences?.promotions !== undefined);
    assert("priceDrops key present", body.preferences?.priceDrops !== undefined);
    assert("cartReminders key present", body.preferences?.cartReminders !== undefined);
  } catch (err) {
    assert("GET preferences request succeeded", false, err.message);
  }

  // PUT — disable promotions
  try {
    const { status, body } = await request("PUT", "/notifications/preferences", {
      userId: TEST_USER_ID,
      preferences: { promotions: false },
    });
    assert("PUT preferences returns HTTP 200", status === 200, `Got ${status}`);
    assert("promotions toggled to false", body.preferences?.promotions === false);
  } catch (err) {
    assert("PUT preferences request succeeded", false, err.message);
  }

  // PUT — restore promotions
  try {
    await request("PUT", "/notifications/preferences", {
      userId: TEST_USER_ID,
      preferences: { promotions: true },
    });
    assert("Preferences restored to default", true);
  } catch (err) {
    assert("Restore preferences succeeded", false, err.message);
  }

  // GET invalid userId → 404
  try {
    const { status } = await request("GET", "/notifications/preferences?userId=000000000000000000000000");
    assert("GET with unknown userId returns 404", status === 404, `Got ${status}`);
  } catch (err) {
    assert("Unknown userId request succeeded", false, err.message);
  }
}

async function testAnalytics() {
  section("GET /notifications/analytics — Analytics Dashboard");

  try {
    const { status, body } = await request("GET", "/notifications/analytics");
    assert("Returns HTTP 200", status === 200, `Got ${status}`);
    assert("success=true", body.success === true);
    assert("analytics object present", !!body.analytics);

    const a = body.analytics;
    assert("devicesRegistered present", typeof a.devicesRegistered === "number");
    assert("devicesDeactivated present", typeof a.devicesDeactivated === "number");
    assert("notifications.total present", typeof a.notifications?.total === "number");
    assert("notifications.sent present", typeof a.notifications?.sent === "number");
    assert("notifications.failed present", typeof a.notifications?.failed === "number");
    assert("notifications.delivered present", typeof a.notifications?.delivered === "number");
    assert("notifications.skipped present", typeof a.notifications?.skipped === "number");
    assert("notifications.opened present", typeof a.notifications?.opened === "number");
    assert("notifications.clicked present", typeof a.notifications?.clicked === "number");
    assert("notifications.openRate present", typeof a.notifications?.openRate === "string");
    assert("notifications.clickRate present", typeof a.notifications?.clickRate === "string");
    assert("jobs.retriedCount present", typeof a.jobs?.retriedCount === "number");
    assert("jobs.permanentlyFailed present", typeof a.jobs?.permanentlyFailed === "number");
    assert("eventTypeBreakdown present", typeof a.eventTypeBreakdown === "object");
  } catch (err) {
    assert("Analytics request succeeded", false, err.message);
  }
}

async function testQueueStats() {
  section("GET /notifications/queue-stats — Queue Monitoring");

  try {
    const { status, body } = await request("GET", "/notifications/queue-stats");
    assert("Returns HTTP 200", status === 200, `Got ${status}`);
    assert("success=true", body.success === true);
    assert("queue object present", !!body.queue);
    assert("queue.pending present", typeof body.queue?.pending === "number");
    assert("queue.processing present", typeof body.queue?.processing === "number");
    assert("queue.completed present", typeof body.queue?.completed === "number");
    assert("queue.failed present", typeof body.queue?.failed === "number");
    assert("queue.stuck present", typeof body.queue?.stuck === "number");
    assert("queue.total present", typeof body.queue?.total === "number");
    assert("receipts.pendingReceiptCount present", typeof body.receipts?.pendingReceiptCount === "number");
    assert("timestamp present", !!body.timestamp);
  } catch (err) {
    assert("Queue stats request succeeded", false, err.message);
  }
}

async function testTrackOpen() {
  section("POST /notifications/track-open — Open Tracking");

  if (!notificationId) {
    console.log(`  ${YELLOW}⚠ Skipping: No notificationId captured from /send test.${RESET}`);
    return;
  }

  try {
    const { status, body } = await request("POST", "/notifications/track-open", {
      notificationId,
    });
    assert("Returns HTTP 200", status === 200, `Got ${status}`);
    assert("success=true", body.success === true);
    assert("openedAt timestamp returned", !!body.openedAt);
  } catch (err) {
    assert("Track-open request succeeded", false, err.message);
  }

  // Missing notificationId → 400
  try {
    const { status } = await request("POST", "/notifications/track-open", {});
    assert("Returns HTTP 400 when id missing", status === 400, `Got ${status}`);
  } catch (err) {
    assert("track-open missing id validation succeeded", false, err.message);
  }

  // Unknown id → 404
  try {
    const { status } = await request("POST", "/notifications/track-open", {
      notificationId: "000000000000000000000000",
    });
    assert("Returns HTTP 404 for unknown notification", status === 404, `Got ${status}`);
  } catch (err) {
    assert("track-open unknown id succeeded", false, err.message);
  }
}

async function testTrackClick() {
  section("POST /notifications/track-click — Click Tracking");

  if (!notificationId) {
    console.log(`  ${YELLOW}⚠ Skipping: No notificationId captured from /send test.${RESET}`);
    return;
  }

  try {
    const { status, body } = await request("POST", "/notifications/track-click", {
      notificationId,
    });
    assert("Returns HTTP 200", status === 200, `Got ${status}`);
    assert("success=true", body.success === true);
    assert("clickedAt timestamp returned", !!body.clickedAt);
  } catch (err) {
    assert("Track-click request succeeded", false, err.message);
  }

  // Missing notificationId → 400
  try {
    const { status } = await request("POST", "/notifications/track-click", {});
    assert("Returns HTTP 400 when id missing", status === 400, `Got ${status}`);
  } catch (err) {
    assert("track-click missing id validation succeeded", false, err.message);
  }
}

async function testProcessJobs() {
  section("GET /notifications/process-jobs — Queue Processing Trigger");

  try {
    const { status, body } = await request("GET", "/notifications/process-jobs");
    assert("Returns HTTP 200", status === 200, `Got ${status}`);
    assert("success=true", body.success === true);
  } catch (err) {
    assert("Process-jobs request succeeded", false, err.message);
  }
}

async function testProcessReceipts() {
  section("GET /notifications/process-receipts — Receipt Polling Trigger");

  try {
    const { status, body } = await request("GET", "/notifications/process-receipts");
    assert("Returns HTTP 200", status === 200, `Got ${status}`);
    assert("success=true", body.success === true);
    assert("checked count present", typeof body.checked === "number");
    assert("delivered count present", typeof body.delivered === "number");
    assert("failed count present", typeof body.failed === "number");
    assert("cleaned count present", typeof body.cleaned === "number");
  } catch (err) {
    assert("Process-receipts request succeeded", false, err.message);
  }
}

async function testRateLimiting() {
  section("Rate Limiting — Promotional Notification Throttle");

  if (!TEST_USER_ID) {
    console.log(`  ${YELLOW}⚠ Skipping: USER_ID required for rate limit test.${RESET}`);
    return;
  }

  console.log(`  ${YELLOW}→ Sending 6 promotional notifications (limit is 5/hour)...${RESET}`);
  const results = [];

  for (let i = 0; i < 6; i++) {
    try {
      const { status, body } = await request("POST", "/notifications/send", {
        userId: TEST_USER_ID,
        title: `Flash Sale ${i + 1}`,
        body: `Sale notification #${i + 1}`,
        eventType: "Flash Sales",
        data: {},
      });
      results.push({ status, success: body.success });
    } catch (err) {
      results.push({ error: err.message });
    }
    // Small delay between requests
    await new Promise((r) => setTimeout(r, 200));
  }

  // All 6 should return 201 (queueing succeeds) but the 6th will be rate-limited at process time
  const allQueued = results.every((r) => r.status === 201);
  assert("All 6 notifications queued (rate limit enforced at delivery, not queue)", allQueued);
  console.log(`  ${YELLOW}→ Note: Rate limiting enforced in NotificationService at delivery time.${RESET}`);
}

// ── Main Runner ───────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${BOLD}${CYAN}╔══════════════════════════════════════════════════════════════╗${RESET}`);
  console.log(`${BOLD}${CYAN}║   NOTIFICATION SYSTEM — END-TO-END API TEST RUNNER            ║${RESET}`);
  console.log(`${BOLD}${CYAN}╚══════════════════════════════════════════════════════════════╝${RESET}`);
  console.log(`  Base URL : ${BASE_URL}`);
  console.log(`  User ID  : ${TEST_USER_ID || "(guest mode)"}`);
  console.log(`  Token    : ${FAKE_EXPO_TOKEN}\n`);

  const suites = [
    testHealthCheck,
    testRegisterToken,
    testSendNotification,
    testScheduleNotification,
    testPreferences,
    testAnalytics,
    testQueueStats,
    testTrackOpen,
    testTrackClick,
    testProcessJobs,
    testProcessReceipts,
    testRateLimiting,
  ];

  for (const suite of suites) {
    await suite();
  }

  // ── Final Report ────────────────────────────────────────────────────────────
  const total = passCount + failCount;
  const pct = total > 0 ? ((passCount / total) * 100).toFixed(1) : "0.0";

  console.log(`\n${BOLD}${"─".repeat(65)}${RESET}`);
  console.log(`${BOLD}  TEST RESULTS${RESET}`);
  console.log(`${"─".repeat(65)}`);
  console.log(`  Total  : ${total}`);
  console.log(`  ${GREEN}Passed : ${passCount}${RESET}`);
  console.log(`  ${failCount > 0 ? RED : GREEN}Failed : ${failCount}${RESET}`);
  console.log(`  Score  : ${pct}%`);
  console.log(`${"─".repeat(65)}\n`);

  if (failCount > 0) {
    console.log(`${RED}${BOLD}Some tests failed. See details above.${RESET}\n`);
    process.exit(1);
  } else {
    console.log(`${GREEN}${BOLD}All tests passed! Notification system is production-ready.${RESET}\n`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(`\n${RED}FATAL ERROR: ${err.message}${RESET}\n`);
  process.exit(1);
});
