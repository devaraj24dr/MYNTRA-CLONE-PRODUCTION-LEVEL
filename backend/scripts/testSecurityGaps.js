const mongoose = require("mongoose");
const dotenv = require("dotenv");
const http = require("http");
const crypto = require("crypto");
const Transaction = require("../models/Transaction");
const WebhookService = require("../services/WebhookService");

dotenv.config();

function getRequest(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    }).on("error", (e) => resolve({ status: 500, error: e.message }));
  });
}

async function runTests() {
  console.log("=== Running Security Gap Verification ===");

  // Test 1: Unauthenticated CSV export request should be rejected with 401 Unauthorized
  console.log("\nTesting CSV Export without userId...");
  const csvRes = await getRequest("http://localhost:5000/transactions/export/csv");
  console.log("Response Status:", csvRes.status);
  console.log("Response Body:", csvRes.body);
  if (csvRes.status === 401) {
    console.log("✅ CSV Export properly blocked unauthorized access!");
  } else {
    console.error("❌ CSV Export security check FAILED!");
  }

  // Test 2: Webhook signature verification unit tests (run in-process to test WebhookService logic)
  console.log("\nTesting Webhook Signature Verification in-process...");
  
  const testSecret = "my_super_secret_signing_key";
  process.env.WEBHOOK_SECRET = testSecret;

  const payload = {
    eventId: `evt_sig_test_${Date.now()}`,
    type: "payment.succeeded",
    data: { transactionId: "txn_dummy" }
  };
  const payloadStr = JSON.stringify(payload);

  // A. Verify signature with missing header
  const mockReqNoSig = {
    headers: {}
  };
  const isNoSigValid = WebhookService.verifySignature(mockReqNoSig, payloadStr);
  console.log("No signature header valid?", isNoSigValid);
  if (isNoSigValid === false) {
    console.log("✅ Webhook correctly rejected unsigned payload!");
  } else {
    console.error("❌ Webhook unsigned payload check FAILED!");
  }

  // B. Verify signature with invalid header
  const mockReqBadSig = {
    headers: {
      "x-webhook-signature": "bad_signature_hash"
    }
  };
  const isBadSigValid = WebhookService.verifySignature(mockReqBadSig, payloadStr);
  console.log("Bad signature header valid?", isBadSigValid);
  if (isBadSigValid === false) {
    console.log("✅ Webhook correctly rejected invalid signature!");
  } else {
    console.error("❌ Webhook invalid signature check FAILED!");
  }

  // C. Verify signature with VALID header
  const validSignature = crypto
    .createHmac("sha256", testSecret)
    .update(payloadStr, "utf8")
    .digest("hex");

  const mockReqValidSig = {
    headers: {
      "x-webhook-signature": validSignature
    }
  };
  const isValidSigValid = WebhookService.verifySignature(mockReqValidSig, payloadStr);
  console.log("Valid signature header valid?", isValidSigValid);
  if (isValidSigValid === true) {
    console.log("✅ Webhook accepted signed payload successfully!");
  } else {
    console.error("❌ Webhook valid signature check FAILED!");
  }

  // Reset environment
  delete process.env.WEBHOOK_SECRET;
}

runTests();
