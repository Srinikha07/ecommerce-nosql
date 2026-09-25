require('dotenv').config();
const fs = require('fs');
const redis = require('./config/redisClient');

async function dumpRedis() {
  const sessionKeys = await redis.keys('session:*');
  const cartKeys = await redis.keys('cart:*');

  const sessions = {};
  for (const key of sessionKeys) {
    sessions[key] = await redis.hgetall(key);
  }

  const carts = {};
  for (const key of cartKeys) {
    carts[key] = await redis.hgetall(key);
  }

  fs.writeFileSync('./dumps/redis_sessions.json', JSON.stringify(sessions, null, 2));
  fs.writeFileSync('./dumps/redis_carts.json', JSON.stringify(carts, null, 2));

  console.log(`Dumped ${sessionKeys.length} sessions and ${cartKeys.length} carts.`);
  process.exit(0);
}

dumpRedis().catch((err) => {
  console.error('Dump failed:', err);
  process.exit(1);
});