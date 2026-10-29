require("dotenv").config();

const express = require("express");
const cors = require("cors");
const connectMongoDB = require("./config/mongodb");
const recommendationRoutes = require('./routes/recommendationRoutes');
const productRoutes = require("./routes/productRoutes");
const sessionService = require("./services/sessionService");
const cartService = require("./services/cartService");
const checkoutService = require("./services/checkoutService");
const cartRoutes = require("./routes/cartRoutes");
const app = express();
const redis = require("./config/redisClient");
const Order = require("./models/Order");
const requireAdmin = require("./middleware/adminAuth");
//const redisClient = require("./config/redis");
app.use(cors());
app.use(express.json());

app.use("/api/products", productRoutes);
app.use('/api/recommendations', recommendationRoutes);
connectMongoDB();
app.use("/api/cart", cartRoutes);
app.get("/", (req, res) => {
    res.json({
        message: "E-Commerce NoSQL Backend is running!"
    });
});

app.get('/health/redis', async (req, res) => {
  const pong = await redis.ping();
  res.json({ redis: pong });
});

app.get('/session/guest', async (req, res) => {
  const sessionId = await sessionService.createGuestSession();
  res.json({ sessionId });
});

app.get('/session/:id', async (req, res) => {
  const session = await sessionService.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found or expired' });
  res.json(session);
});

app.delete('/session/:id', async (req, res) => {
  await sessionService.destroySession(req.params.id);
  res.json({ loggedOut: true });
});

app.post('/cart/:sessionId/items', async (req, res) => {
  const { productId, quantity, price, name } = req.body;
  await cartService.addOrUpdateItem(req.params.sessionId, productId, quantity, price, name);
  res.json({ added: true });
});

app.get('/cart/:sessionId', async (req, res) => {
  const cart = await cartService.getCart(req.params.sessionId);
  res.json(cart);
});

app.delete('/cart/:sessionId/items/:productId', async (req, res) => {
  await cartService.removeItem(req.params.sessionId, req.params.productId);
  res.json({ removed: true });
});

app.delete('/cart/:sessionId', async (req, res) => {
  await cartService.clearCart(req.params.sessionId);
  res.json({ cleared: true });
});

app.post('/checkout/:sessionId', async (req, res) => {
  try {
    const { userId, shippingAddress } = req.body;
    const order = await checkoutService.checkout(req.params.sessionId, userId, shippingAddress);
    res.status(201).json({ order });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
// FR-4.5: Get order history for a customer
app.get("/orders/:userId", async (req, res) => {
    try {
        const orders = await Order.find({
            userId: req.params.userId
        })
        .sort({ createdAt: -1 })
        .lean();

        res.json({
            userId: req.params.userId,
            totalOrders: orders.length,
            orders
        });
    } catch (error) {
        console.error("Order history error:", error.message);
        res.status(500).json({
            message: "Failed to retrieve order history"
        });
    }
});

// FR-6.3: Admin views all orders
app.get("/admin/orders", requireAdmin, async (req, res) => {
  try {
    const orders = await Order.find({})
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      totalOrders: orders.length,
      orders,
    });
  } catch (error) {
    console.error("Admin orders error:", error.message);
    res.status(500).json({ message: "Failed to retrieve all orders" });
  }
});

// FR-6.4: Admin searches for an order by ID and views its status
app.get("/admin/orders/:orderId", requireAdmin, async (req, res) => {
  try {
    const order = await Order.findOne({
      orderId: req.params.orderId,
    }).lean();

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.json({
      orderId: order.orderId,
      userId: order.userId,
      status: order.status,
      total: order.total,
      createdAt: order.createdAt,
      order,
    });
  } catch (error) {
    console.error("Admin order lookup error:", error.message);
    res.status(500).json({ message: "Failed to retrieve order" });
  }
});
// FR-6.2: Admin views customers found in orders
app.get("/admin/users", requireAdmin, async (req, res) => {
    try {
        const userIds = await Order.distinct("userId");

        res.json({
            totalUsers: userIds.length,
            users: userIds.map(userId => ({ userId }))
        });
    } catch (error) {
        console.error("Admin users error:", error.message);
        res.status(500).json({ message: "Failed to retrieve users" });
    }
});
// FR-6.4: View a specific order's status
app.get("/admin/orders/:orderId", requireAdmin, async (req, res) => {
    try {
        const order = await Order.findOne({
            orderId: req.params.orderId
        }).lean();

        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        res.json({
            orderId: order.orderId,
            status: order.status
        });
    } catch (error) {
        res.status(500).json({ message: "Failed to retrieve order status" });
    }
});

// Admin updates order status
app.patch("/admin/orders/:orderId/status", requireAdmin, async (req, res) => {
    try {
        const allowedStatuses = [
            "placed",
            "processing",
            "shipped",
            "delivered",
            "cancelled"
        ];

        const { status } = req.body;

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                message: "Invalid status",
                allowedStatuses
            });
        }

        const order = await Order.findOneAndUpdate(
            { orderId: req.params.orderId },
            { $set: { status } },
            { new: true, runValidators: true }
        );

        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        res.json({
            message: "Order status updated successfully",
            orderId: order.orderId,
            status: order.status
        });
    } catch (error) {
        console.error("Status update error:", error.message);
        res.status(500).json({ message: "Failed to update order status" });
    }
});
const PORT = 5000;
async function startServer() {
    try {
         
        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error.message);
        process.exit(1);
    }
}

startServer();