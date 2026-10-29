
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
  // FR-4.2: Validate checkout details
  if (!sessionId || !userId) {
    throw new Error('Session ID and user ID are required');
  }

  if (
    !shippingAddress ||
    typeof shippingAddress.line1 !== 'string' ||
    !shippingAddress.line1.trim() ||
    typeof shippingAddress.city !== 'string' ||
    !shippingAddress.city.trim() ||
    typeof shippingAddress.postalCode !== 'string' ||
    !shippingAddress.postalCode.trim() ||
    typeof shippingAddress.country !== 'string' ||
    !shippingAddress.country.trim()
  ) {
    throw new Error(
      'Complete shipping address is required: line1, city, postalCode and country'
    );
  }

  // 1. Get the cart from Redis
  const { items } = await cartService.getCart(sessionId);
  const productIds = Object.keys(items);

  if (productIds.length === 0) {
    throw new Error('Cart is empty');
  }

  // 2. Build order items from the cart snapshot
  const orderItems = productIds.map((productId) => ({
    productId,
    name: items[productId].name,
    priceAtPurchase: items[productId].price,
    quantity: items[productId].quantity,
  }));

  const total = orderItems.reduce(
    (sum, item) => sum + item.priceAtPurchase * item.quantity,
    0
  );

  // 3. Create the order in MongoDB
  const order = await Order.create({
    orderId: generateOrderId(),
    userId,
    items: orderItems,
    shippingAddress,
    total: Number(total.toFixed(2)),
    status: 'placed',
  });

  // 4. Write PURCHASED relationships in Neo4j
  const neoSession = driver.session();

  try {
    for (const item of orderItems) {
      await neoSession.run(
        `MERGE (c:Customer {customerId: $userId})
         MERGE (p:Product {productId: $productId})
         SET p.name = $name, p.price = $price
         MERGE (c)-[:PURCHASED {
           orderId: $orderId,
           quantity: $quantity,
           timestamp: datetime()
         }]->(p)`,
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
    await neoSession.close();
  }

  // 5. Clear the cart after successful checkout
  await cartService.clearCart(sessionId);

  return order;
}

module.exports = { checkout };
