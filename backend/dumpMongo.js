require('dotenv').config();
const fs = require('fs');
const mongoose = require('mongoose');
const connectMongoDB = require('./config/mongodb');
const Product = require('./models/Product');
const Order = require('./models/Order');

async function dumpMongo() {
  await connectMongoDB();

  const products = await Product.find().lean();
  const orders = await Order.find().lean();

  fs.writeFileSync('./dumps/mongodb_products.json', JSON.stringify(products, null, 2));
  fs.writeFileSync('./dumps/mongodb_orders.json', JSON.stringify(orders, null, 2));

  console.log(`Dumped ${products.length} products and ${orders.length} orders.`);
  await mongoose.disconnect();
  process.exit(0);
}

dumpMongo().catch((err) => {
  console.error('Dump failed:', err);
  process.exit(1);
});