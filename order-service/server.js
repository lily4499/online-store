const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");
const client = require("prom-client");          // ⭐ Prometheus client
require("dotenv").config();

const app = express();
app.use(express.json());

/* -------------------- Prometheus Metrics -------------------- */

// Create a registry
const register = new client.Registry();

// Collect default metrics (CPU, memory, event loop, etc. for this process)
client.collectDefaultMetrics({ register });

// Histogram for HTTP latency
const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request latency for order-service",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5]
});

// Counter for total HTTP requests
const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total HTTP requests for order-service",
  labelNames: ["method", "route", "status_code"]
});

// Register the metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestsTotal);

// Middleware to measure every request
app.use((req, res, next) => {
  // Start timer for this request
  const end = httpRequestDuration.startTimer();

  res.on("finish", () => {
    const route = req.route ? req.route.path : req.path;

    const labels = {
      method: req.method,
      route,
      status_code: res.statusCode
    };

    // Stop the timer and record duration
    end(labels);

    // Increment total requests counter
    httpRequestsTotal.inc(labels);
  });

  next();
});

// /metrics endpoint for Prometheus to scrape
app.get("/metrics", async (req, res) => {
  try {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    console.error("Error generating metrics:", err);
    res.status(500).end();
  }
});

/* -------------------- Mongoose / Business Logic -------------------- */

const OrderSchema = new mongoose.Schema({
  userId: String,
  productIds: [String],
  total: Number,
  status: { type: String, default: "Created" }
});
const Order = mongoose.model("Order", OrderSchema);

// DB
mongoose
  .connect(process.env.DB_URI)
  .then(() => console.log("✅ Order Service connected to MongoDB"))
  .catch(err => console.error("❌ DB error (order-service):", err));

const PRODUCT_SERVICE_URL =
  process.env.PRODUCT_SERVICE_URL || "http://product-service:8081";

// Health
app.get("/", (req, res) => res.send("Order Service Running ✅"));

// Create order
app.post("/api/orders", async (req, res) => {
  const { userId, productIds } = req.body;
  try {
    const productRes = await axios.get(`${PRODUCT_SERVICE_URL}/api/products`);
    const allProducts = productRes.data;

    const selected = allProducts.filter(p =>
      productIds.includes(String(p._id))
    );
    const total = selected.reduce(
      (sum, p) => sum + Number(p.price || 0),
      0
    );

    const order = new Order({ userId, productIds, total });
    await order.save();

    res.json({ message: "✅ Order created", total, orderId: order._id });
  } catch (err) {
    console.error("Error creating order:", err);
    res.status(500).json({ error: "Error creating order" });
  }
});

// List orders
app.get("/api/orders", async (req, res) => {
  const orders = await Order.find();
  res.json(orders);
});

/* -------------------- Start Server -------------------- */

const PORT = 8082;
app.listen(PORT, () => console.log(`Order Service on port ${PORT}`));




// const express = require("express");
// const mongoose = require("mongoose");
// const axios = require("axios");
// require("dotenv").config();

// const app = express();
// app.use(express.json());

// const OrderSchema = new mongoose.Schema({
//   userId: String,
//   productIds: [String],
//   total: Number,
//   status: { type: String, default: "Created" }
// });
// const Order = mongoose.model("Order", OrderSchema);

// // DB
// mongoose
//   .connect(process.env.DB_URI)
//   .then(() => console.log("✅ Order Service connected to MongoDB"))
//   .catch(err => console.error("❌ DB error (order-service):", err));

// const PRODUCT_SERVICE_URL =
//   process.env.PRODUCT_SERVICE_URL || "http://product-service:8081";

// // Health
// app.get("/", (req, res) => res.send("Order Service Running ✅"));

// // Create order
// app.post("/api/orders", async (req, res) => {
//   const { userId, productIds } = req.body;
//   try {
//     const productRes = await axios.get(`${PRODUCT_SERVICE_URL}/api/products`);
//     const allProducts = productRes.data;

//     const selected = allProducts.filter(p =>
//       productIds.includes(String(p._id))
//     );
//     const total = selected.reduce(
//       (sum, p) => sum + Number(p.price || 0),
//       0
//     );

//     const order = new Order({ userId, productIds, total });
//     await order.save();

//     res.json({ message: "✅ Order created", total, orderId: order._id });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Error creating order" });
//   }
// });

// // List orders
// app.get("/api/orders", async (req, res) => {
//   const orders = await Order.find();
//   res.json(orders);
// });

// const PORT = 8082;
// app.listen(PORT, () => console.log(`Order Service on port ${PORT}`));
