
import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";

const API_BASE = "http://localhost:5000/api";

const EMPTY_FORM = {
  productId: "",
  name: "",
  category: "",
  brand: "",
  price: "",
  stock: "",
  description: "",
};

function App() {
  const [role, setRole] = useState("customer");
  const [selectedCustomer, setSelectedCustomer] = useState("C001");
  const customers = [
    { id: "C001", name: "Arun" },
    //{ id: "C002", name: "Priya" },
    { id: "C003", name: "Rahul" },
    { id: "C005",name: "Test Customer (No Purchase History)"},
  ];
  const [products, setProducts] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [sessionId, setSessionId] = useState("");
  const [cart, setCart] = useState({ items: {}, subtotal: 0 });
  const [cartLoading, setCartLoading] = useState(false);
  const [cartError, setCartError] = useState("");
  const [cartMessage, setCartMessage] = useState("");
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [shipping, setShipping] = useState({
    line1: "", city: "", postalCode: "", country: "India",
  });
  const [latestOrder, setLatestOrder] = useState(null);
  const [orderHistory, setOrderHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [adminSessionInput, setAdminSessionInput] = useState("");
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminOrders, setAdminOrders] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [adminMessage, setAdminMessage] = useState("");
  const [statusDrafts, setStatusDrafts] = useState({});
  const orderStatuses = ["placed", "processing", "shipped", "delivered", "cancelled"];

  const fetchAdminData = async () => {
    const adminId = adminSessionInput.trim();
    if (!adminId) {
      setAdminError("Enter your admin session ID first.");
      setAdminMessage("");
      return;
    }
    setAdminLoading(true);
    setAdminError("");
    setAdminMessage("");
    const headers = { "x-session-id": adminId };
    try {
      const [usersResponse, ordersResponse] = await Promise.all([
        fetch("http://localhost:5000/admin/users", { headers }),
        fetch("http://localhost:5000/admin/orders", { headers }),
      ]);
      const [usersData, ordersData] = await Promise.all([
        usersResponse.json(), ordersResponse.json(),
      ]);
      if (!usersResponse.ok) throw new Error(usersData.message || "Could not load users.");
      if (!ordersResponse.ok) throw new Error(ordersData.message || "Could not load orders.");
      const users = Array.isArray(usersData.users) ? usersData.users : [];
      const orders = Array.isArray(ordersData.orders) ? ordersData.orders : [];
      setAdminUsers(users);
      setAdminOrders(orders);
      setStatusDrafts(Object.fromEntries(orders.map((order) => [order.orderId, order.status || "placed"])));
      setAdminMessage("Admin data loaded successfully.");
    } catch (err) {
      setAdminError(err.message || "Could not load admin data. Check the session ID and backend.");
      setAdminUsers([]);
      setAdminOrders([]);
    } finally {
      setAdminLoading(false);
    }
  };

  const handleAdminStatusSave = async (orderId) => {
    const adminId = adminSessionInput.trim();
    const status = statusDrafts[orderId];
    if (!adminId) {
      setAdminError("Enter your admin session ID first.");
      return;
    }
    setAdminLoading(true);
    setAdminError("");
    setAdminMessage("");
    try {
      const response = await fetch(`http://localhost:5000/admin/orders/${encodeURIComponent(orderId)}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-session-id": adminId },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not update order status.");
      setAdminOrders((current) => current.map((order) => order.orderId === orderId ? { ...order, status: data.status } : order));
      setStatusDrafts((current) => ({ ...current, [orderId]: data.status }));
      setAdminMessage(`Order ${orderId} status updated to ${data.status}.`);
    } catch (err) {
      setAdminError(err.message || "Could not update order status.");
    } finally {
      setAdminLoading(false);
    }
  };

  // Read the product list from MongoDB through the Express API.
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE}/products`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not load products.");
      }

      const list = Array.isArray(data)
        ? data
        : data.products ?? data.data ?? [];

      setProducts(list);
    } catch (err) {
      setError(
        err.message ||
          "Could not connect to the backend. Check that the server is running."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRecommendations = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_BASE}/recommendations/${encodeURIComponent(selectedCustomer)}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not load recommendations.");
      }

      const list = Array.isArray(data)
        ? data
        : data.recommendations ?? data.data ?? [];

      setRecommendations(list);
    } catch (err) {
      console.error("Recommendation loading failed:", err);
    }
  }, [selectedCustomer]);

  useEffect(() => {
    let cancelled = false;

    const initialiseGuestCart = async () => {
      try {
        const sessionStorageKey = `shopeaseSessionId_${selectedCustomer}`;
        let savedSessionId = window.localStorage.getItem(sessionStorageKey);
        // Reuse the original session for C001 so existing cart data is preserved.
        if (!savedSessionId && selectedCustomer === "C001") {
          savedSessionId = window.localStorage.getItem("shopeaseSessionId");
        }

        if (!savedSessionId) {
          const response = await fetch("http://localhost:5000/session/guest");
          const data = await response.json();
          if (!response.ok || !data.sessionId) {
            throw new Error(data.error || "Could not create a guest session.");
          }
          savedSessionId = data.sessionId;
          window.localStorage.setItem(sessionStorageKey, savedSessionId);
          if (selectedCustomer === "C001") {
            window.localStorage.setItem("shopeaseSessionId", savedSessionId);
          }
        }

        if (!cancelled) {
          setSessionId(savedSessionId);
          await fetchCart(savedSessionId);
        }
      } catch (err) {
        if (!cancelled) {
          setCartError(err.message || "Could not initialise the Redis cart.");
        }
      }
    };

    fetchProducts();
    fetchRecommendations();
    initialiseGuestCart();

    return () => {
      cancelled = true;
    };
  }, [fetchProducts, fetchRecommendations, selectedCustomer]);

  const fetchCart = useCallback(async (activeSessionId) => {
    if (!activeSessionId) return;
    setCartLoading(true);
    setCartError("");

    try {
      const response = await fetch(
        `http://localhost:5000/cart/${encodeURIComponent(activeSessionId)}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load the cart.");
      }

      setCart({
        items: data.items && typeof data.items === "object" ? data.items : {},
        subtotal: Number(data.subtotal || 0),
      });
    } catch (err) {
      setCartError(err.message || "Could not load the Redis cart.");
    } finally {
      setCartLoading(false);
    }
  }, []);

  const handleAddToCart = async (product) => {
    if (!sessionId) {
      setCartError("Guest session is not ready yet. Please try again.");
      return;
    }
    if (!product.productId) {
      setCartError("This product has no product ID and cannot be added.");
      return;
    }

    setCartError("");
    setCartMessage("");

    const existingQuantity = Number(cart.items?.[product.productId]?.quantity || 0);
    const payload = {
      productId: product.productId,
      quantity: existingQuantity + 1,
      price: Number(product.price || 0),
      name: product.name || "Product",
    };

    try {
      const response = await fetch(
        `http://localhost:5000/cart/${encodeURIComponent(sessionId)}/items`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not add the product to the cart.");
      }

      await fetchCart(sessionId);
      setCartMessage(`${product.name} added to your cart.`);
    } catch (err) {
      setCartError(err.message || "Could not add the product to the cart.");
    }
  };

  const handleRemoveFromCart = async (productId) => {
    if (!sessionId) return;
    setCartError("");
    setCartMessage("");

    try {
      const response = await fetch(
        `http://localhost:5000/cart/${encodeURIComponent(sessionId)}/items/${encodeURIComponent(productId)}`,
        { method: "DELETE" }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not remove the item.");
      }

      await fetchCart(sessionId);
      setCartMessage("Item removed from your cart.");
    } catch (err) {
      setCartError(err.message || "Could not remove the item.");
    }
  };

  const handleClearCart = async () => {
    if (!sessionId) return;
    if (Object.keys(cart.items || {}).length === 0) return;

    setCartError("");
    setCartMessage("");

    try {
      const response = await fetch(
        `http://localhost:5000/cart/${encodeURIComponent(sessionId)}`,
        { method: "DELETE" }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not clear the cart.");
      }

      await fetchCart(sessionId);
      setCartMessage("Your cart has been cleared.");
    } catch (err) {
      setCartError(err.message || "Could not clear the cart.");
    }
  };

  const handleQuantityChange = async (productId, nextQuantity) => {
    const item = cart.items?.[productId];
    if (!item || !sessionId) return;
    if (nextQuantity < 1) {
      await handleRemoveFromCart(productId);
      return;
    }
    setCartError("");
    setCartMessage("");
    try {
      const response = await fetch(
        `http://localhost:5000/cart/${encodeURIComponent(sessionId)}/items`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId,
            quantity: nextQuantity,
            price: Number(item.price),
            name: item.name || productId,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update quantity.");
      await fetchCart(sessionId);
      setCartMessage("Cart quantity updated.");
    } catch (err) {
      setCartError(err.message || "Could not update quantity.");
    }
  };

  const handleCheckout = async (event) => {
    event.preventDefault();
    if (!sessionId || Object.keys(cart.items || {}).length === 0) {
      setCartError("Add at least one item before checkout.");
      return;
    }
    setCheckoutLoading(true);
    setCartError("");
    setCartMessage("");
    try {
      const response = await fetch(
        `http://localhost:5000/checkout/${encodeURIComponent(sessionId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: selectedCustomer, shippingAddress: shipping }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Checkout failed.");
      const order = data.order;
      if (!order?.orderId) throw new Error("Checkout succeeded but no order was returned.");
      setLatestOrder(order);
      setShowCheckout(false);
      setShowHistory(false);
      await fetchCart(sessionId);
      setCartMessage("Order placed. Your bill is ready.");
    } catch (err) {
      setCartError(err.message || "Checkout failed.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const fetchOrderHistory = async () => {
    setHistoryLoading(true);
    setCartError("");
    try {
      const response = await fetch(`http://localhost:5000/orders/${encodeURIComponent(selectedCustomer)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error || "Could not load order history.");
      setOrderHistory(Array.isArray(data.orders) ? data.orders : []);
      setShowHistory(true);
      setLatestOrder(null);
    } catch (err) {
      setCartError(err.message || "Could not load order history.");
    } finally {
      setHistoryLoading(false);
    }
  };

  const formatDate = (date) => date
    ? new Date(date).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : "—";

  const categories = useMemo(() => {
    return [
      "All",
      ...new Set(
        products
          .map((product) => product.category)
          .filter(Boolean)
      ),
    ];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        !query ||
        [
          product.productId,
          product.name,
          product.brand,
          product.category,
          product.description,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));

      const matchesCategory =
        selectedCategory === "All" ||
        product.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, selectedCategory]);

  const totalStock = products.reduce(
    (sum, product) => sum + Number(product.stock || 0),
    0
  );

  // Reset the filters and reload every product from the backend.
  const handleRefresh = async () => {
    setSearchTerm("");
    setSelectedCategory("All");
    setMessage("");
    setError("");
    cancelEdit();
    await fetchProducts();
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  // Clicking Edit copies that product's values into the form.
  const handleEdit = (product) => {
    setEditingId(product.productId);

    setForm({
      productId: product.productId ?? "",
      name: product.name ?? "",
      category: product.category ?? "",
      brand: product.brand ?? "",
      price: String(product.price ?? ""),
      stock: String(product.stock ?? ""),
      description: product.description ?? "",
    });

    setMessage("");
    setError("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
  };

  // POST creates a product; PUT updates the existing product.
  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    const payload = {
      productId: form.productId.trim(),
      name: form.name.trim(),
      category: form.category.trim(),
      brand: form.brand.trim(),
      price: Number(form.price),
      stock: Number(form.stock),
      description: form.description.trim(),
    };

    if (
      !payload.productId ||
      !payload.name ||
      !payload.category ||
      !payload.brand ||
      form.price === "" ||
      form.stock === ""
    ) {
      setError("Please fill in all required fields.");
      setSaving(false);
      return;
    }

    if (
      !Number.isFinite(payload.price) ||
      payload.price < 0 ||
      !Number.isInteger(payload.stock) ||
      payload.stock < 0
    ) {
      setError("Price must be non-negative and stock must be a whole number.");
      setSaving(false);
      return;
    }

    try {
      const isEditing = editingId !== null;
      const url = isEditing
        ? `${API_BASE}/products/${encodeURIComponent(editingId)}`
        : `${API_BASE}/products`;

      const response = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            (isEditing ? "Could not update product." : "Could not add product.")
        );
      }

      setMessage(
        isEditing
          ? "Product updated successfully."
          : "Product added successfully."
      );

      cancelEdit();
      setSearchTerm("");
      setSelectedCategory("All");

      await fetchProducts();
    } catch (err) {
      setError(err.message || "Something went wrong while saving.");
    } finally {
      setSaving(false);
    }
  };

  // Delete a product using its productId, not its MongoDB _id.
  const handleDelete = async (product) => {
    const productId = product.productId;

    if (!productId) {
      setError("This product has no productId and cannot be deleted.");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete "${product.name}" (${productId})?`
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_BASE}/products/${encodeURIComponent(productId)}`,
        { method: "DELETE" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not delete product.");
      }

      if (editingId === productId) {
        cancelEdit();
      }

      setMessage(`"${product.name}" was deleted successfully.`);
      await fetchProducts();
    } catch (err) {
      setError(err.message || "Something went wrong while deleting.");
    }
  };

  useEffect(() => {
    if (!cartMessage) return;
    const timeoutId = window.setTimeout(() => setCartMessage(""), 2800);
    return () => window.clearTimeout(timeoutId);
  }, [cartMessage]);

  const formatPrice = (price) =>
    `₹${Number(price || 0).toLocaleString("en-IN")}`;

  return (
    <main className="app-shell">
      {cartMessage && (
        <div className="cart-toast" role="status" aria-live="polite">
          <span className="cart-toast-check">✓</span>
          <span>{cartMessage}</span>
        </div>
      )}
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">S</span>
          <div>
            <h1>ShopEase</h1>
            <p>Polyglot Persistence E-commerce</p>
          </div>
        </div>

        {role === "customer" && (
          <label className="customer-picker">
            <span>Demo customer</span>
            <select
              value={selectedCustomer}
              onChange={(event) => {
                const nextCustomer = event.target.value;
                setSelectedCustomer(nextCustomer);
                setCart({ items: {}, subtotal: 0 });
                setRecommendations([]);
                setCartError("");
                setCartMessage("");
                setLatestOrder(null);
                setOrderHistory([]);
                setShowCheckout(false);
                setShowHistory(false);
              }}
              aria-label="Switch customer"
            >
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.id} — {customer.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="role-switcher" aria-label="Choose dashboard">
          <button
            type="button"
            className={`button ${role === "customer" ? "button-primary" : "button-secondary"}`}
            onClick={() => { setRole("customer"); cancelEdit(); setError(""); setMessage(""); }}
          >
            Customer Dashboard
          </button>
          <button
            type="button"
            className={`button ${role === "provider" ? "button-primary" : "button-secondary"}`}
            onClick={() => { setRole("provider"); setError(""); setMessage(""); }}
          >
            Provider Dashboard
          </button>
          <button
            type="button"
            className={`button ${role === "admin" ? "button-primary" : "button-secondary"}`}
            onClick={() => { setRole("admin"); setError(""); setMessage(""); setAdminError(""); setAdminMessage(""); }}
          >
            Admin Dashboard
          </button>
          <button
            type="button"
            className="button button-secondary"
            onClick={handleRefresh}
            disabled={loading}
          >
            ↻ Refresh Products
          </button>
        </div>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">{role === "customer" ? "CUSTOMER DASHBOARD" : role === "provider" ? "PROVIDER DASHBOARD" : "ADMIN DASHBOARD"}</p>
          <h2>{role === "customer" ? "Explore Products" : role === "provider" ? "Manage Your Catalogue" : "Manage Users & Orders"}</h2>
          <p className="muted">
            {role === "customer"
              ? "Browse products, manage your Redis shopping cart, and discover personalized recommendations."
              : role === "provider"
                ? "Add new products and manage your MongoDB product catalogue. Customer shopping controls are hidden in this dashboard."
                : "View customer IDs, inspect all orders, and update order statuses stored in MongoDB."}
          </p>
        </div>
      </section>

      {role === "admin" && (
        <section className="panel admin-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">ADMIN ACCESS</p>
              <h2>Admin Dashboard</h2>
              <p className="muted">Enter the session ID generated by your backend's createAdminSession.js script.</p>
            </div>
            <button type="button" className="button button-secondary" onClick={fetchAdminData} disabled={adminLoading}>
              {adminLoading ? "Loading..." : "↻ Load / Refresh Data"}
            </button>
          </div>
          <div className="admin-connect-row">
            <label className="admin-session-field">
              <span>Admin session ID</span>
              <input
                type="password"
                value={adminSessionInput}
                onChange={(event) => setAdminSessionInput(event.target.value)}
                placeholder="Paste admin session ID here"
                autoComplete="off"
              />
            </label>
            <button type="button" className="button button-primary" onClick={fetchAdminData} disabled={adminLoading}>
              {adminLoading ? "Connecting..." : "Load Admin Data"}
            </button>
          </div>
          {adminError && <div className="notice notice-error" role="alert">{adminError}</div>}
          {adminMessage && <div className="notice notice-success" role="status">{adminMessage}</div>}

          <div className="admin-summary-grid">
            <article className="stat-card"><span>Customer IDs</span><strong>{adminUsers.length}</strong></article>
            <article className="stat-card"><span>Total Orders</span><strong>{adminOrders.length}</strong></article>
            <article className="stat-card"><span>Pending / Processing</span><strong>{adminOrders.filter((order) => ["placed", "processing"].includes(String(order.status || "placed").toLowerCase())).length}</strong></article>
          </div>

          <div className="admin-section-block">
            <div className="section-heading">
              <div><p className="eyebrow">FR-6.2</p><h2>Customer IDs</h2></div>
              <span className="count-pill">{adminUsers.length} found in orders</span>
            </div>
            {adminUsers.length === 0 ? <p className="empty-state">Load admin data to view customer IDs.</p> : (
              <div className="admin-users-grid">
                {adminUsers.map((user) => (
                  <article className="admin-user-card" key={user.userId}>
                    <span className="admin-user-avatar">{String(user.userId || "U").slice(0, 1)}</span>
                    <div><strong>{user.userId}</strong><span className="muted">Customer ID</span></div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="admin-section-block">
            <div className="section-heading">
              <div><p className="eyebrow">FR-6.3 · FR-6.4</p><h2>Order Management</h2></div>
              <span className="count-pill">{adminOrders.length} orders</span>
            </div>
            {adminOrders.length === 0 ? <p className="empty-state">Load admin data to view orders.</p> : (
              <div className="admin-orders-list">
                {adminOrders.map((order) => (
                  <article className="admin-order-card" key={order.orderId}>
                    <div className="admin-order-main">
                      <div><span className="history-order-label">ORDER ID</span><strong className="admin-order-id">{order.orderId}</strong><span className="history-status">{order.status || "placed"}</span></div>
                      <div className="admin-order-total"><span className="muted">Order total</span><strong>{formatPrice(order.total)}</strong></div>
                    </div>
                    <div className="admin-order-meta">
                      <span>Customer: <strong>{order.userId || "—"}</strong></span>
                      <span>Date: <strong>{formatDate(order.createdAt)}</strong></span>
                      <span>Items: <strong>{Array.isArray(order.items) ? order.items.length : 0}</strong></span>
                    </div>
                    <div className="admin-status-controls">
                      <label>Status
                        <select value={statusDrafts[order.orderId] || order.status || "placed"} onChange={(event) => setStatusDrafts((current) => ({ ...current, [order.orderId]: event.target.value }))}>
                          {orderStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                        </select>
                      </label>
                      <button type="button" className="button button-primary" onClick={() => handleAdminStatusSave(order.orderId)} disabled={adminLoading || (statusDrafts[order.orderId] || order.status || "placed") === (order.status || "placed")}>
                        Save Status
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <section className="stats-grid">
        <article className="stat-card">
          <span>Total Products</span>
          <strong>{products.length}</strong>
        </article>
        <article className="stat-card">
          <span>Categories</span>
          <strong>{Math.max(categories.length - 1, 0)}</strong>
        </article>
        <article className="stat-card">
          <span>Total Stock</span>
          <strong>{totalStock.toLocaleString("en-IN")}</strong>
        </article>
      </section>

      {error && (
        <div className="notice notice-error" role="alert">
          {error}
        </div>
      )}

      {message && (
        <div className="notice notice-success" role="status">
          {message}
        </div>
      )}

      {role === "customer" && <section className="panel cart-panel" id="shopping-cart">
        <div className="section-heading">
          <div>
            <p className="eyebrow">POWERED BY REDIS</p>
            <h2>Your Shopping Cart</h2>
            <p className="muted">
              Guest session cart stored in Redis. Session: {sessionId ? `${sessionId.slice(0, 8)}…` : "Starting..."}
            </p>
          </div>
          <div className="cart-heading-actions">
            <span className="count-pill">
              {Object.values(cart.items || {}).reduce((sum, item) => sum + Number(item.quantity || 0), 0)} items
            </span>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => fetchCart(sessionId)}
              disabled={!sessionId || cartLoading}
            >
              {cartLoading ? "Refreshing..." : "Refresh Cart"}
            </button>
            <button
              type="button"
              className="button button-danger"
              onClick={handleClearCart}
              disabled={!sessionId || cartLoading || Object.keys(cart.items || {}).length === 0}
            >
              Clear Cart
            </button>
          </div>
        </div>

        {cartError && <div className="notice notice-error" role="alert">{cartError}</div>}

        {cartLoading && Object.keys(cart.items || {}).length === 0 ? (
          <p className="empty-state">Loading your cart...</p>
        ) : Object.keys(cart.items || {}).length === 0 ? (
          <p className="empty-state">Your cart is empty. Add a product to get started.</p>
        ) : (
          <div className="cart-list">
            {Object.entries(cart.items).map(([productId, item]) => (
              <article className="cart-item" key={productId}>
                <div className="cart-item-info">
                  <strong>{item.name || productId}</strong>
                  <span className="muted">ID: {productId}</span>
                  <span>{formatPrice(item.price)} each</span>
                  <div className="quantity-control" aria-label={`Quantity for ${item.name || productId}`}>
                    <button type="button" aria-label="Decrease quantity" onClick={() => handleQuantityChange(productId, Number(item.quantity || 1) - 1)}>−</button>
                    <strong>{Number(item.quantity || 0)}</strong>
                    <button type="button" aria-label="Increase quantity" onClick={() => handleQuantityChange(productId, Number(item.quantity || 0) + 1)}>+</button>
                  </div>
                </div>
                <div className="cart-item-end">
                  <strong>{formatPrice(Number(item.quantity || 0) * Number(item.price || 0))}</strong>
                  <button
                    type="button"
                    className="button button-danger"
                    onClick={() => handleRemoveFromCart(productId)}
                  >
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="cart-total">
          <span>Subtotal</span>
          <strong>{formatPrice(cart.subtotal)}</strong>
        </div>
        {Object.keys(cart.items || {}).length === 0 && (
          <div className="cart-footer-actions">
            <button type="button" className="button button-secondary" onClick={fetchOrderHistory} disabled={historyLoading}>
              {historyLoading ? "Loading orders..." : "View Order History"}
            </button>
          </div>
        )}
        {Object.keys(cart.items || {}).length > 0 && (
          <div className="cart-footer-actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={fetchOrderHistory}
              disabled={historyLoading}
            >
              {historyLoading ? "Loading orders..." : "Order History"}
            </button>
            <button
              type="button"
              className="button button-primary"
              onClick={() => { setShowCheckout(true); setLatestOrder(null); setShowHistory(false); }}
            >
              Proceed to Checkout →
            </button>
          </div>
        )}
        {showCheckout && (
          <form className="checkout-form" onSubmit={handleCheckout}>
            <div className="section-heading">
              <div>
                <p className="eyebrow">ORDER DETAILS</p>
                <h2>Shipping Address</h2>
                <p className="muted">Customer ID: {selectedCustomer} · Payment is not required for this database prototype.</p>
              </div>
            </div>
            <div className="form-grid">
              <label className="full-width">Address line
                <input value={shipping.line1} required onChange={(e) => setShipping({ ...shipping, line1: e.target.value })} placeholder="House number, street" />
              </label>
              <label>City
                <input value={shipping.city} required onChange={(e) => setShipping({ ...shipping, city: e.target.value })} placeholder="City" />
              </label>
              <label>Postal code
                <input value={shipping.postalCode} required onChange={(e) => setShipping({ ...shipping, postalCode: e.target.value })} placeholder="Postal code" />
              </label>
              <label>Country
                <input value={shipping.country} required onChange={(e) => setShipping({ ...shipping, country: e.target.value })} />
              </label>
            </div>
            <div className="checkout-summary">
              <span>Order total</span><strong>{formatPrice(cart.subtotal)}</strong>
            </div>
            <div className="form-actions">
              <button type="submit" className="button button-primary" disabled={checkoutLoading}>
                {checkoutLoading ? "Generating bill..." : "Place Order & Generate Bill"}
              </button>
              <button type="button" className="button button-secondary" onClick={() => setShowCheckout(false)} disabled={checkoutLoading}>Cancel</button>
            </div>
          </form>
        )}
      </section>}

      {latestOrder && role === "customer" && (
        <section className="panel receipt-panel" id="order-bill">
          <div className="receipt-header">
            <div>
              <p className="eyebrow">SHOPEASE · ORDER CONFIRMATION</p>
              <h2>Bill Generated Successfully</h2>
              <p className="muted">Your order has been saved to MongoDB.</p>
            </div>
            <span className="order-status">{latestOrder.status || "placed"}</span>
          </div>
          <div className="receipt-meta">
            <div><span>Order ID</span><strong>{latestOrder.orderId}</strong></div>
            <div><span>Order date</span><strong>{formatDate(latestOrder.createdAt || new Date())}</strong></div>
            <div><span>Customer ID</span><strong>{latestOrder.userId || selectedCustomer}</strong></div>
          </div>
          <div className="receipt-address">
            <strong>Shipping address</strong>
            <p>{latestOrder.shippingAddress?.line1}, {latestOrder.shippingAddress?.city}, {latestOrder.shippingAddress?.postalCode}, {latestOrder.shippingAddress?.country}</p>
          </div>
          <div className="receipt-table-wrap">
            <table className="receipt-table">
              <thead><tr><th>Product</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead>
              <tbody>
                {(latestOrder.items || []).map((item, index) => (
                  <tr key={`${item.productId}-${index}`}>
                    <td>{item.name || item.productId}<small>{item.productId}</small></td>
                    <td>{item.quantity}</td>
                    <td>{formatPrice(item.priceAtPurchase)}</td>
                    <td>{formatPrice(Number(item.priceAtPurchase || 0) * Number(item.quantity || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="receipt-grand-total"><span>Total</span><strong>{formatPrice(latestOrder.total)}</strong></div>
          <p className="receipt-note">Payment gateway is not part of this database implementation. This receipt confirms the order record.</p>
          <div className="form-actions no-print">
            <button type="button" className="button button-primary" onClick={() => window.print()}>Print / Save as PDF</button>
            <button type="button" className="button button-secondary" onClick={fetchOrderHistory}>View Order History</button>
            <button type="button" className="button button-secondary" onClick={() => setLatestOrder(null)}>Continue Shopping</button>
          </div>
        </section>
      )}

      {showHistory && role === "customer" && (
        <section className="panel receipt-panel" id="order-history">
          <div className="section-heading">
            <div><p className="eyebrow">MONGODB · SAVED ORDERS</p><h2>Order History</h2></div>
            <button type="button" className="button button-secondary" onClick={() => setShowHistory(false)}>Close</button>
          </div>
          {orderHistory.length === 0 ? <p className="empty-state">No previous orders found.</p> : (
            <div className="history-list">
              {orderHistory.map((order) => (
                <article className="history-item" key={order.orderId}>
                  <div className="history-card-heading">
                    <span className="history-order-label">ORDER ID</span>
                    <strong className="history-order-id">{order.orderId}</strong>
                    <span className={`history-status ${String(order.status || "placed").toLowerCase()}`}>{order.status || "placed"}</span>
                  </div>
                  <div className="history-card-details">
                    <div className="history-detail"><span>Order date</span><strong>{formatDate(order.createdAt)}</strong></div>
                    <div className="history-detail"><span>Products</span><strong>{(order.items || []).length} product line(s)</strong></div>
                    <div className="history-detail history-total"><span>Order total</span><strong>{formatPrice(order.total)}</strong></div>
                  </div>
                  <div className="history-card-actions">
                    <button type="button" className="button button-secondary" onClick={() => { setLatestOrder(order); setShowHistory(false); }}>View Bill</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {role === "provider" && <section className="panel form-panel" id="product-form">
        <div className="section-heading">
          <div>
            <p className="eyebrow">
              {editingId !== null ? "EDIT PRODUCT" : "PRODUCT MANAGEMENT"}
            </p>
            <h2>
              {editingId !== null ? "Update Product" : "Add a Product"}
            </h2>
          </div>

          {editingId !== null && (
            <button
              type="button"
              className="button button-secondary"
              onClick={cancelEdit}
            >
              Cancel Edit
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <label>
              Product ID *
              <input
                name="productId"
                value={form.productId}
                onChange={handleInputChange}
                placeholder="e.g. P012"
                disabled={editingId !== null || saving}
                required
              />
            </label>

            <label>
              Product Name *
              <input
                name="name"
                value={form.name}
                onChange={handleInputChange}
                placeholder="Product name"
                disabled={saving}
                required
              />
            </label>

            <label>
              Category *
              <input
                name="category"
                value={form.category}
                onChange={handleInputChange}
                placeholder="e.g. Electronics"
                disabled={saving}
                required
              />
            </label>

            <label>
              Brand *
              <input
                name="brand"
                value={form.brand}
                onChange={handleInputChange}
                placeholder="Brand name"
                disabled={saving}
                required
              />
            </label>

            <label>
              Price (₹) *
              <input
                name="price"
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={handleInputChange}
                placeholder="e.g. 2499"
                disabled={saving}
                required
              />
            </label>

            <label>
              Stock *
              <input
                name="stock"
                type="number"
                min="0"
                step="1"
                value={form.stock}
                onChange={handleInputChange}
                placeholder="e.g. 50"
                disabled={saving}
                required
              />
            </label>

            <label className="full-width">
              Description
              <textarea
                name="description"
                value={form.description}
                onChange={handleInputChange}
                placeholder="Describe the product"
                rows="3"
                disabled={saving}
              />
            </label>
          </div>

          <div className="form-actions">
            <button
              className="button button-primary"
              type="submit"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : editingId !== null
                  ? "Save Changes"
                  : "Add Product"}
            </button>

            {editingId !== null && (
              <span className="muted">
                Editing product ID: {editingId}
              </span>
            )}
          </div>
        </form>
      </section>}

      {role !== "admin" && <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">MONGODB PRODUCT CATALOGUE</p>
            <h2>All Products</h2>
          </div>
          <span className="count-pill">
            {filteredProducts.length} shown
          </span>
        </div>

        <div className="toolbar">
          <input
            className="search-input"
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by name, ID, brand or category..."
            aria-label="Search products"
          />

          <select
            value={selectedCategory}
            onChange={(event) => setSelectedCategory(event.target.value)}
            aria-label="Filter by category"
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {category === "All" ? "All Categories" : category}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="button button-secondary"
            onClick={handleRefresh}
          >
            Reset Filters
          </button>
        </div>

        {loading ? (
          <p className="empty-state">Loading products...</p>
        ) : filteredProducts.length === 0 ? (
          <div className="empty-state">
            <h3>No products found</h3>
            <p>Try a different search or reset your filters.</p>
            <button
              type="button"
              className="button button-secondary"
              onClick={handleRefresh}
            >
              Show All Products
            </button>
          </div>
        ) : (
          <div className="product-grid">
            {filteredProducts.map((product) => (
              <article
                className="product-card"
                key={product.productId || product._id}
              >
                <div className="product-card-top">
                  <span className="product-icon">◇</span>
                  <span className="category-pill">
                    {product.category || "Uncategorized"}
                  </span>
                </div>

                <p className="product-id">
                  ID: {product.productId || "N/A"}
                </p>
                <h3>{product.name}</h3>
                <p className="product-brand">
                  {product.brand || "No brand specified"}
                </p>
                <p className="product-description">
                  {product.description || "No description available."}
                </p>

                <div className="product-details">
                  <strong>{formatPrice(product.price)}</strong>
                  <span>Stock: {product.stock ?? 0}</span>
                </div>

                <div className="product-actions">
                  {role === "customer" ? (
                    <button
                      type="button"
                      className="button button-primary"
                      onClick={() => handleAddToCart(product)}
                      disabled={!sessionId || Number(product.stock || 0) <= 0}
                    >
                      {Number(product.stock || 0) <= 0 ? "Out of Stock" : "Add to Cart"}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="button button-secondary"
                        onClick={() => handleEdit(product)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="button button-danger"
                        onClick={() => handleDelete(product)}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>}

      {role === "customer" && <section className="recommendation-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">POWERED BY NEO4J</p>
            <h2>Recommended For You</h2>
            <p className="muted">
              Recommendations based on the selected customer’s product relationships.
            </p>
          </div>
          <span className="count-pill">Customer {selectedCustomer}</span>
        </div>

        {recommendations.length === 0 ? (
          <p className="muted">
            No recommendations returned. Check the Neo4j recommendation API.
          </p>
        ) : (
          <div className="product-grid recommendation-grid">
            {recommendations.map((item) => (
              <article
                className="product-card recommendation-card"
                key={item.productId || item._id || item.name}
              >
                <div className="product-card-top">
                  <span className="product-icon">✧</span>
                  <span className="recommended-pill">Recommended</span>
                </div>
                <h3>{item.name}</h3>
                <p className="product-id">Product ID: {item.productId}</p>
                <p className="product-description">
                  Selected by the recommendation engine.
                </p>
                <div className="product-details">
                  <strong>{formatPrice(item.price)}</strong>
                  <span>
                    Score: {item.recommendationScore ?? item.score ?? "—"}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>}

      <footer className="footer">
        ShopEase · MongoDB Product Catalogue · Neo4j Recommendations · Redis Cart · {role === "customer" ? "Customer View" : role === "provider" ? "Provider View" : "Admin View"}
      </footer>
    </main>
  );
}

export default App;
