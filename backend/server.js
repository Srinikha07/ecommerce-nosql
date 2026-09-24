require("dotenv").config();

const express = require("express");
const cors = require("cors");
const redis = require("./config/redisClient");
const connectMongoDB = require("./config/mongodb");
const recommendationRoutes = require('./routes/recommendationRoutes');
const productRoutes = require("./routes/productRoutes");
const sessionService = require("./services/sessionService");
const cartService = require("./services/cartService");
const checkoutService = require("./services/checkoutService");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/products", productRoutes);
app.use('/api/recommendations', recommendationRoutes);
connectMongoDB();

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

const PORT = 5000;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});