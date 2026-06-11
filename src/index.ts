import express from "express";
import path from "path";
import { config } from "./config";
import { logger } from "./utils/logger";
import { errorHandler } from "./middleware/errorHandler";
import authRoutes from "./routes/auth";
import switchRoutes from "./routes/switch";
import beneficiaryRoutes from "./routes/beneficiaries";
import assetRoutes from "./routes/assets";
import checkinRoutes from "./routes/checkin";
import { startWatchdog } from "./services/watchdog";

const app = express();

app.use(express.json());

// Serve the frontend
app.use(express.static(path.join(__dirname, "../public")));

// CORS — allow the bundled frontend served from any origin
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") {
    res.status(204).send();
    return;
  }
  next();
});

app.get("/health", (_req, res) => res.json({ success: true, data: { status: "ok" } }));

app.use("/auth", authRoutes);
app.use("/switch", switchRoutes);
app.use("/beneficiaries", beneficiaryRoutes);
app.use("/assets", assetRoutes);
app.use("/checkin", checkinRoutes);

app.use(errorHandler);

app.listen(config.PORT, () => {
  logger.info({ port: config.PORT, env: config.NODE_ENV }, "DeathSwitch API started");
  if (config.NODE_ENV !== "test") {
    startWatchdog();
  }
});

export default app;
