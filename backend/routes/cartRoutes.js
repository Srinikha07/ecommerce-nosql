
const express = require("express");
const redisClient = require("../config/redis");
const Product = require("../models/Product");

const router = express.Router();

const getCartKey = (customerId) => `cart:${customerId}`;

async function getCart(customerId) {
  const items = await redisClient.hGetAll(getCartKey(customerId));

  return Object.entries(items).map(([productId, value]) => {
    const item = JSON.parse(value);

    return {
      productId,
      ...item,
      quantity: Number(item.quantity),
    };
  });
}

// GET /api/cart/:customerId
router.get("/:customerId", async (req, res) => {
  try {
    const items = await getCart(req.params.customerId);

    res.json({
      customerId: req.params.customerId,
      items,
      totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
      totalPrice: items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      ),
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to retrieve cart",
      error: error.message,
    });
  }
});

// POST /api/cart/:customerId
// Body: { "productId": "P001", "quantity": 1 }
router.post("/:customerId", async (req, res) => {
  try {
    const { productId } = req.body;
    const quantity = Number(req.body.quantity ?? 1);

    if (!productId || !Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({
        message: "Provide a productId and a positive whole-number quantity.",
      });
    }

    const product = await Product.findOne({ productId });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const existingValue = await redisClient.hGet(
      getCartKey(req.params.customerId),
      productId
    );

    const existing = existingValue ? JSON.parse(existingValue) : null;
    const newQuantity = (existing?.quantity ?? 0) + quantity;

    if (newQuantity > Number(product.stock)) {
      return res.status(400).json({
        message: `Only ${product.stock} units are currently in stock.`,
      });
    }

    const item = {
      name: product.name,
      price: Number(product.price),
      quantity: newQuantity,
    };

    await redisClient.hSet(
      getCartKey(req.params.customerId),
      productId,
      JSON.stringify(item)
    );

    res.status(200).json({
      message: "Product added to cart",
      productId,
      item,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to add product to cart",
      error: error.message,
    });
  }
});

// PUT /api/cart/:customerId/:productId
// Body: { "quantity": 2 }
router.put("/:customerId/:productId", async (req, res) => {
  try {
    const { customerId, productId } = req.params;
    const quantity = Number(req.body.quantity);

    if (!Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({
        message: "Quantity must be a positive whole number.",
      });
    }

    const product = await Product.findOne({ productId });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (quantity > Number(product.stock)) {
      return res.status(400).json({
        message: `Only ${product.stock} units are currently in stock.`,
      });
    }

    const key = getCartKey(customerId);
    const existingValue = await redisClient.hGet(key, productId);

    if (!existingValue) {
      return res.status(404).json({
        message: "Product is not in the cart.",
      });
    }

    const item = {
      name: product.name,
      price: Number(product.price),
      quantity,
    };

    await redisClient.hSet(key, productId, JSON.stringify(item));

    res.json({ message: "Cart quantity updated", productId, item });
  } catch (error) {
    res.status(500).json({
      message: "Failed to update cart",
      error: error.message,
    });
  }
});

// DELETE /api/cart/:customerId/:productId
router.delete("/:customerId/:productId", async (req, res) => {
  try {
    const removed = await redisClient.hDel(
      getCartKey(req.params.customerId),
      req.params.productId
    );

    if (!removed) {
      return res.status(404).json({
        message: "Product is not in the cart.",
      });
    }

    res.json({ message: "Product removed from cart" });
  } catch (error) {
    res.status(500).json({
      message: "Failed to remove product from cart",
      error: error.message,
    });
  }
});

// DELETE /api/cart/:customerId
router.delete("/:customerId", async (req, res) => {
  try {
    await redisClient.del(getCartKey(req.params.customerId));
    res.json({ message: "Cart cleared" });
  } catch (error) {
    res.status(500).json({
      message: "Failed to clear cart",
      error: error.message,
    });
  }
});

module.exports = router;
