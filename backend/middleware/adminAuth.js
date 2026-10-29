
const sessionService = require("../services/sessionService");

async function requireAdmin(req, res, next) {
  try {
    const sessionId = req.headers["x-session-id"];

    if (!sessionId) {
      return res.status(401).json({
        message: "Admin session is required",
      });
    }

    const session = await sessionService.getSession(sessionId);

    if (!session || session.isGuest === "true" || session.role !== "admin") {
      return res.status(403).json({
        message: "Admin access denied",
      });
    }

    req.adminSession = session;
    next();
  } catch (error) {
    console.error("Admin authentication error:", error.message);
    res.status(500).json({ message: "Authentication failed" });
  }
}

module.exports = requireAdmin;
