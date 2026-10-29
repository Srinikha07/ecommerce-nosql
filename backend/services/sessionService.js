const crypto = require('crypto');
const redis = require('../config/redisClient');

const SESSION_TTL = 1800; // 30 minutes, matches your schema doc

// Generate a new session ID (called on first visit, guest or logged in)
function generateSessionId() {
  return crypto.randomBytes(16).toString('hex');
}

// Create a guest session (no login)
async function createGuestSession() {
  const sessionId = generateSessionId();
  const now = new Date().toISOString();

  await redis.hset(`session:${sessionId}`, {
    isGuest: 'true',
    createdAt: now,
    lastActive: now,
  });
  await redis.expire(`session:${sessionId}`, SESSION_TTL);

  return sessionId;
}

// Create a logged-in session (called after successful login against MongoDB)
async function createUserSession(userId, email, role) {
  const sessionId = generateSessionId();
  const now = new Date().toISOString();

  await redis.hset(`session:${sessionId}`, {
    userId,
    email,
    role,
    isGuest: 'false',
    createdAt: now,
    lastActive: now,
  });
  await redis.expire(`session:${sessionId}`, SESSION_TTL);

  return sessionId;
}

// Fetch a session and refresh its TTL (sliding expiry, per FR-1.3)
async function getSession(sessionId) {
  const session = await redis.hgetall(`session:${sessionId}`);

  if (!session || Object.keys(session).length === 0) {
    return null; // expired or never existed
  }

  await redis.hset(`session:${sessionId}`, 'lastActive', new Date().toISOString());
  await redis.expire(`session:${sessionId}`, SESSION_TTL);

  return session;
}

// Log out — invalidate the session (FR-1.4)
async function destroySession(sessionId) {
  await redis.del(`session:${sessionId}`);
}

module.exports = {
  generateSessionId,
  createGuestSession,
  createUserSession,
  getSession,
  destroySession,
};