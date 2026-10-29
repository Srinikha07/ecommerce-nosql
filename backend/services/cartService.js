const redis = require('../config/redisClient');

const CART_TTL = 2700; // 45 minutes, per your schema doc

// Add or update an item in the cart (FR-3.1, FR-3.2)
async function addOrUpdateItem(sessionId, productId, quantity, price, name) {
  const item = JSON.stringify({ quantity, price, name });
  await redis.hset(`cart:${sessionId}`, productId, item);
  await redis.expire(`cart:${sessionId}`, CART_TTL);
}

// Remove an item from the cart (FR-3.3)
async function removeItem(sessionId, productId) {
  await redis.hdel(`cart:${sessionId}`, productId);
}

// Get the full cart, parsed, with a computed subtotal (FR-3.6)
async function getCart(sessionId) {
  const raw = await redis.hgetall(`cart:${sessionId}`);
  const items = {};
  let subtotal = 0;

  for (const [productId, itemJson] of Object.entries(raw)) {
    const item = JSON.parse(itemJson);
    items[productId] = item;
    subtotal += item.price * item.quantity;
  }

  return { items, subtotal: Number(subtotal.toFixed(2)) };
}

// Clear the cart after checkout (FR-4.4)
async function clearCart(sessionId) {
  await redis.del(`cart:${sessionId}`);
}

// Merge a guest cart into a user cart on login (FR-3.5)
async function mergeCart(guestSessionId, userSessionId) {
  const guestCart = await redis.hgetall(`cart:${guestSessionId}`);

  for (const [productId, itemJson] of Object.entries(guestCart)) {
    const guestItem = JSON.parse(itemJson);
    const existingRaw = await redis.hget(`cart:${userSessionId}`, productId);

    if (existingRaw) {
      const existingItem = JSON.parse(existingRaw);
      existingItem.quantity += guestItem.quantity;
      await redis.hset(`cart:${userSessionId}`, productId, JSON.stringify(existingItem));
    } else {
      await redis.hset(`cart:${userSessionId}`, productId, itemJson);
    }
  }

  await redis.del(`cart:${guestSessionId}`);
  await redis.expire(`cart:${userSessionId}`, CART_TTL);
}

module.exports = {
  addOrUpdateItem,
  removeItem,
  getCart,
  clearCart,
  mergeCart,
};