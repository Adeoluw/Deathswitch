import { Router, Request, Response } from "express";
import { randomBytes } from "crypto";
import jwt from "jsonwebtoken";
import { prisma } from "../db/client";
import { parseSiweMessage } from "../utils/siwe";
import { config } from "../config";
import { logger } from "../utils/logger";

const router = Router();

router.post("/nonce", async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.body as { walletAddress?: string };
    if (!walletAddress || typeof walletAddress !== "string") {
      res.status(400).json({ success: false, error: "walletAddress required" });
      return;
    }
    const normalized = walletAddress.toLowerCase();
    const nonce = randomBytes(16).toString("hex");

    await prisma.user.upsert({
      where: { walletAddress: normalized },
      update: { nonce },
      create: { walletAddress: normalized, nonce },
    });

    res.json({ success: true, data: { nonce } });
  } catch (err) {
    logger.error({ err }, "POST /auth/nonce error");
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

router.post("/verify", async (req: Request, res: Response) => {
  try {
    const { message, signature } = req.body as { message?: string; signature?: string };
    if (!message || !signature) {
      res.status(400).json({ success: false, error: "message and signature required" });
      return;
    }

    const { address, nonce } = await parseSiweMessage(message, signature);

    const user = await prisma.user.findUnique({ where: { walletAddress: address } });
    if (!user) {
      res.status(401).json({ success: false, error: "Unknown wallet" });
      return;
    }
    if (user.nonce !== nonce) {
      res.status(401).json({ success: false, error: "Nonce mismatch" });
      return;
    }

    const newNonce = randomBytes(16).toString("hex");
    await prisma.user.update({ where: { id: user.id }, data: { nonce: newNonce } });

    const sw = await prisma.switch.findUnique({ where: { userId: user.id } });
    const payload = { walletAddress: user.walletAddress, userId: user.id, switchId: sw?.id };
    const token = jwt.sign(payload, config.JWT_SECRET, { expiresIn: "7d" });

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.session.create({ data: { userId: user.id, token, expiresAt } });

    res.json({ success: true, data: { token, walletAddress: user.walletAddress } });
  } catch (err) {
    logger.error({ err }, "POST /auth/verify error");
    const msg = err instanceof Error ? err.message : "Auth failed";
    res.status(401).json({ success: false, error: msg });
  }
});

export default router;
