import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/authenticate";
import { prisma } from "../db/client";
import { logger } from "../utils/logger";

const router = Router();

// Frontend signs and broadcasts the checkIn() tx itself.
// This endpoint just syncs the result to the database.
router.post("/", authenticate, async (req: Request, res: Response) => {
  try {
    const sw = await prisma.switch.findUnique({ where: { userId: req.auth!.userId } });
    if (!sw) {
      res.status(404).json({ success: false, error: "Switch not found" });
      return;
    }
    if (sw.status === "TRIGGERED") {
      res.status(400).json({ success: false, error: "Switch already triggered" });
      return;
    }

    const { txHash } = req.body as { txHash?: string };

    const now = new Date();
    const nextCheckInDue = new Date(now.getTime() + sw.checkInIntervalSecs * 1000);

    await prisma.switch.update({
      where: { id: sw.id },
      data: {
        lastCheckIn: now,
        nextCheckInDue,
        escalationStage: 0,
        status: "ACTIVE",
      },
    });

    res.json({
      success: true,
      data: {
        txHash: txHash ?? "synced",
        nextCheckInDue: nextCheckInDue.toISOString(),
      },
    });
  } catch (err) {
    logger.error({ err }, "POST /checkin error");
    const msg = err instanceof Error ? err.message : "Check-in failed";
    res.status(500).json({ success: false, error: msg });
  }
});

export default router;
