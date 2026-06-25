const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const userrouter = require("./routes/Userroutes");
const categoryrouter = require("./routes/Categoryroutes");
const productrouter = require("./routes/Productroutes");
const Bagroutes = require("./routes/Bagroutes");
const Wishlistroutes = require("./routes/Wishlistroutes");
const OrderRoutes = require("./routes/OrderRoutes");
const recentlyViewedRouter = require("./routes/RecentlyViewedRoutes");
const NotificationRouter = require("./routes/NotificationRoutes");
const TransactionRouter = require("./routes/TransactionRoutes");
const CartRouter = require("./routes/CartRoutes");
const RecommendationRouter = require("./routes/RecommendationRoutes");
const QueueService = require("./services/QueueService");
const cors = require('cors');
dotenv.config();

// Validate environment variables on startup
const requiredEnvVars = ["MONGO_URI"];
const missingEnvVars = requiredEnvVars.filter((varName) => !process.env[varName]);
if (missingEnvVars.length > 0) {
  console.error(`❌ FATAL STARTUP ERROR: Missing required environment variable(s): ${missingEnvVars.join(", ")}`);
  throw new Error(`Startup failed: missing environment variables ${missingEnvVars.join(", ")}`);
}

const app = express();
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

// Configure Production CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["*"];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, postman)
    if (!origin) return callback(null, true);
    
    // Check if the origin is allowed or if wildcard is enabled
    if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true,
}));

app.get("/", (req, res) => {
  res.send("✅ Myntra backend in working");
});
app.use("/user", userrouter);
app.use("/category", categoryrouter);
app.use("/product", productrouter);
app.use("/bag", Bagroutes);
app.use("/wishlist", Wishlistroutes);
app.use("/Order", OrderRoutes);
app.use("/recently-viewed", recentlyViewedRouter);
app.use("/notifications", NotificationRouter);
app.use("/transactions", TransactionRouter);
app.use("/payments", TransactionRouter);
app.use("/cart", CartRouter);
app.use("/recommendations", RecommendationRouter);
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("Mongodb connected");
    // Start background Job Queue worker
    QueueService.start();
  })
  .catch((err) => console.log(err));

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
}

module.exports = app;
