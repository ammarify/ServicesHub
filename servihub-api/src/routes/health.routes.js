import { Router } from "express";
import { env } from "../config/env.js";
import { getHealth } from "../controllers/health.controller.js";
import { ApiError } from "../utils/ApiError.js";

const router = Router();

router.get("/", getHealth);

// With DEBUG_PROXY_HEADERS=true: the caller's address as the API sees it,
// next to the raw forwarding headers. If "ip" isn't the caller's public
// address, TRUST_PROXY doesn't match the number of proxies in front of the
// API (rate limits would then lump visitors together). Off by default.
router.get("/client", (req, res) => {
  if (!env.DEBUG_PROXY_HEADERS) {
    throw new ApiError(404, `Route not found: GET ${req.originalUrl}`);
  }
  res.status(200).json({
    ip: req.ip,
    trustProxy: env.TRUST_PROXY,
    forwardedFor: req.get("x-forwarded-for") ?? null,
    realIp: req.get("x-real-ip") ?? null,
  });
});

export default router;
