const express = require("express");
const mongoose = require("mongoose");
const client = require("prom-client");          // ⭐ Prometheus client
require("dotenv").config();

const app = express();
app.use(express.json());

/* -------------------- Prometheus Metrics -------------------- */

// Registry
const register = new client.Registry();

// Default Node.js process metrics (CPU, memory, GC, event loop, etc.)
client.collectDefaultMetrics({ register });

// Histogram for HTTP latency
const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request latency for product-service",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5]
});

// Counter for total HTTP requests
const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total HTTP requests for product-service",
  labelNames: ["method", "route", "status_code"]
});

// Register metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestsTotal);

// Middleware to time every request
app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();

  res.on("finish", () => {
    const route = req.route ? req.route.path : req.path;

    const labels = {
      method: req.method,
      route,
      status_code: res.statusCode
    };

    end(labels);                  // record duration
    httpRequestsTotal.inc(labels); // increment counter
  });

  next();
});

// /metrics endpoint for Prometheus
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

// Schema
const ProductSchema = new mongoose.Schema({
  name: String,
  price: Number,
  stock: Number
});
const Product = mongoose.model("Product", ProductSchema);

// Mongo connection
mongoose
  .connect(process.env.DB_URI)
  .then(() => console.log("✅ Product Service connected to MongoDB"))
  .catch(err => console.error("❌ Mongo error (product-service):", err));

// Health
app.get("/", (req, res) => res.send("Product Service Running ✅"));

// API (frontend & order-service)
app.post("/api/products", async (req, res) => {
  const product = new Product(req.body);
  await product.save();
  res.json({ message: "✅ Product added", product });
});

app.get("/api/products", async (req, res) => {
  const products = await Product.find();
  res.json(products);
});

const PORT = 8081;
app.listen(PORT, () => console.log(`Product Service on port ${PORT}`));






















// const express = require("express");
// const mongoose = require("mongoose");
// require("dotenv").config();

// const app = express();
// app.use(express.json());

// // Schema
// const ProductSchema = new mongoose.Schema({
//   name: String,
//   price: Number,
//   stock: Number
// });
// const Product = mongoose.model("Product", ProductSchema);

// // Mongo connection
// mongoose
//   .connect(process.env.DB_URI)
//   .then(() => console.log("✅ Product Service connected to MongoDB"))
//   .catch(err => console.error("❌ Mongo error (product-service):", err));

// // Health
// app.get("/", (req, res) => res.send("Product Service Running ✅"));

// // API (frontend & order-service)
// app.post("/api/products", async (req, res) => {
//   const product = new Product(req.body);
//   await product.save();
//   res.json({ message: "✅ Product added", product });
// });

// app.get("/api/products", async (req, res) => {
//   const products = await Product.find();
//   res.json(products);
// });

// const PORT = 8081;
// app.listen(PORT, () => console.log(`Product Service on port ${PORT}`));

