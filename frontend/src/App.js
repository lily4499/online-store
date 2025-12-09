import React, { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [data, setData] = useState({
    products: [],
    users: [],
    orders: [],
    loading: true,
    error: ""
  });

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [prodRes, userRes, orderRes] = await Promise.all([
          fetch("/api/products"),
          fetch("/api/users"),
          fetch("/api/orders")
        ]);

        const products = await prodRes.json().catch(() => []);
        const users = await userRes.json().catch(() => []);
        const orders = await orderRes.json().catch(() => []);

        setData({
          products,
          users,
          orders,
          loading: false,
          error: ""
        });
      } catch (err) {
        console.error(err);
        setData(d => ({
          ...d,
          loading: false,
          error: "Failed to reach one or more services"
        }));
      }
    };

    fetchAll();
  }, []);

  return (
    <div style={{ textAlign: "center", marginTop: "40px" }}>
      <h1>Welcome to Liliane’s DevOps Portfolio 🌍</h1>
      <p>Frontend running in Docker + Kubernetes</p>

      {data.loading && <p>Loading data from microservices…</p>}
      {data.error && <p style={{ color: "red" }}>{data.error}</p>}

      {!data.loading && !data.error && (
        <div
          style={{
            marginTop: "40px",
            textAlign: "left",
            maxWidth: "900px",
            marginInline: "auto"
          }}
        >
          <h2>📦 Products</h2>
          <pre>{JSON.stringify(data.products, null, 2) || "No products"}</pre>

          <h2>👤 Users</h2>
          <pre>{JSON.stringify(data.users, null, 2) || "No users"}</pre>

          <h2>🧾 Orders</h2>
          <pre>{JSON.stringify(data.orders, null, 2) || "No orders"}</pre>
        </div>
      )}
    </div>
  );
}

export default App;

