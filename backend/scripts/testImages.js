const http = require("https");

const urls = [
  "https://images.unsplash.com/photo-1618244972963-dbad0c4abf18?w=500", // Current Women
  "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=500", // Option A (shopping woman)
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500", // Option B (portrait woman)
  "https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?w=500", // Option C (clothing)
  "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=500"  // Option D (fashion model)
];

function checkUrl(url) {
  return new Promise((resolve) => {
    const req = http.request(url, { method: "HEAD" }, (res) => {
      resolve({ url, status: res.statusCode });
    });
    req.on("error", (e) => resolve({ url, status: 500, error: e.message }));
    req.end();
  });
}

async function run() {
  for (const url of urls) {
    const res = await checkUrl(url);
    console.log(`${res.status} - ${res.url}`);
  }
}

run();
