require('dotenv').config();
const mongoose = require('mongoose');
const connectMongoDB = require('./config/mongodb');
const Product = require('./models/Product');
const driver = require('./config/neo4j');

async function syncProducts() {
  await connectMongoDB();
  const products = await Product.find();
  console.log(`Found ${products.length} products in MongoDB. Syncing to Neo4j...`);

  const session = driver.session();
  try {
    for (const p of products) {
      await session.run(
        `MERGE (prod:Product {productId: $productId})
         SET prod.name = $name, prod.price = $price`,
        {
          productId: p.productId,
          name: p.name,
          price: p.price,
        }
      );
      console.log(`Synced ${p.productId} - ${p.name}`);
    }
  } finally {
    await session.close();
  }

  console.log('Sync complete.');
  await mongoose.disconnect();
  process.exit(0);
}

syncProducts().catch((err) => {
  console.error('Sync failed:', err);
  process.exit(1);
});