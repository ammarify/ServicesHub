import { Router } from "express";
import { getPublicConfig } from "../controllers/config.controller.js";

const router = Router();

router.get("/", getPublicConfig);

export default router;
