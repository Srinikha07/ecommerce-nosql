const crypto = require('crypto');
const cartService = require('./cartService');
const Order = require('../models/Order');
const driver = require('../config/neo4j');

function generateOrderId() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = crypto.randomBytes(2).toString('hex');
  return `ORD-${date}-${rand}`;
}

async function checkout(sessionId, userId, shippingAddress) {
  // 1. Get the cart from Redis
  const { items } = await cartService.getCart(sessionId);
  const productIds = Object.keys(items);

  if (productIds.length === 0) {
    throw new Error('Cart is empty');
  }

  // 2. Build order items from cart snapshot
  const orderItems = productIds.map((productId) => ({
    productId,
    name: items[productId].name,
    priceAtPurchase: items[productId].price,
    quantity: items[productId].quantity,
  }));

  const total = orderItems.reduce((sum, i) => sum + i.priceAtPurchase * i.quantity, 0);

  // 3. Create the order in MongoDB
  const order = await Order.create({
    orderId: generateOrderId(),
    userId,
    items: orderItems,
    shippingAddress,
    total: Number(total.toFixed(2)),
    status: 'placed',
  });

  // 4. Write :PURCHASED relationships in Neo4j
  const session = driver.session();
  try {
    for (const item of orderItems) {
      await session.run(
        `MERGE (c:Customer {customerId: $userId})
         MERGE (p:Product {productId: $productId})
	 SET p.name = $name, p.price = $price
         MERGE (c)-[:PURCHASED {orderId: $orderId, quantity: $quantity, timestamp: datetime()}]->(p)`,
        {
          userId,
          productId: item.productId,
          name: item.name,
          price: item.priceAtPurchase,
          orderId: order.orderId,
          quantity: item.quantity,
        }
      );
    }
  } finally {
    await session.close();
  }

  // 5. Clear the cart in Redis
  await cartService.clearCart(sessionId);

  return order;
}

module.exports = { checkout };