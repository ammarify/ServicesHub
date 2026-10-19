import mongoose from "mongoose";

// Used by load balancers / uptime checks. Reports 503 while the database
// connection is down so an orchestrator can route traffic elsewhere.
export function getHealth(req, res) {
  const dbConnected = mongoose.connection.readyState === 1;
  res.status(dbConnected ? 200 : 503).json({
    status: dbConnected ? "ok" : "degraded",
    db: dbConnected ? "connected" : "disconnected",
    uptime: process.uptime(),
  });
}
