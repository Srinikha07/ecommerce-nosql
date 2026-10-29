
require("dotenv").config();

const redis = require("./config/redisClient");
const crypto = require("crypto");

async function main() {
  const sessionId = crypto.randomBytes(16).toString("hex");
  const now = new Date().toISOString();

  await redis.hset(`session:${sessionId}`, {
    userId: "ADMIN001",
    email: "admin@shopease.demo",
    role: "admin",
    isGuest: "false",
    createdAt: now,
    lastActive: now,
  });

  await redis.expire(`session:${sessionId}`, 1800);

  console.log("Demo admin session created.");
  console.log("Session ID:", sessionId);
  console.log("Valid for 30 minutes.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await redis.quit();
  });
