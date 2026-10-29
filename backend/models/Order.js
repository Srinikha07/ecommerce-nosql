const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  sku: String,
  name: String,
  priceAtPurchase: { type: Number, required: true },
  quantity: { type: Number, required: true },
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  items: [orderItemSchema],
  shippingAddress: {
    line1: String,
    city: String,
    postalCode: String,
    country: String,
  },
  total: { type: Number, required: true },
  status: { type: String, default: 'placed' },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Order', orderSchema);