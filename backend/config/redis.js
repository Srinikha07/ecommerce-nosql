
const { createClient } = require("redis");

const redisClient = createClient({
    url: process.env.REDIS_URL
});

redisClient.on("error", (error) => {
    console.error("Node Redis error:", error.message);
});

redisClient.on("ready", () => {
    console.log("Node Redis is ready.");
});

module.exports = redisClient;
