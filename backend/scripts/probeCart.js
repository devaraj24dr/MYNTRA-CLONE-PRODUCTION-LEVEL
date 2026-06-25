const http = require("http");

function probe(method, path, body) {
  return new Promise((resolve) => {
    const postData = body ? JSON.stringify(body) : null;
    const options = {
      hostname: "localhost",
      port: 5000,
      path,
      method,
      headers: {
        "Content-Type": "application/json",
        ...(postData ? { "Content-Length": Buffer.byteLength(postData) } : {}),
      },
    };
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on("error", (e) => resolve({ status: 500, error: e.message }));
    if (postData) req.write(postData);
    req.end();
  });
}

async function run() {
  // Use REAL IDs from the DB
  const userId  = "6a2a710ec7d4266439cc7d33"; // carttest@myntra.dev
  const productId = "6a2a51a671f726d965be0980"; // Casual White T-Shirt

  console.log("Testing /cart/add with real IDs...");
  const r = await probe("POST", "/cart/add", { userId, productId, size: "M", quantity: 1, version: 0 });
  console.log("Status:", r.status);
  console.log("Body:", JSON.stringify(r.body, null, 2).slice(0, 500));
}

run();
