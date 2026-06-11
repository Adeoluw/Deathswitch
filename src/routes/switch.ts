import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/authenticate";
import { prisma } from "../db/client";
import { getSwitchStatusOnChain, triggerOnChain, retryWithBackoff, getSwitchContract } from "../services/mantle";
import { logger } from "../utils/logger";

const router = Router();

function formatSwitchId(id: string): string {
  const digits = id.replace(/\D/g, "").slice(0, 4);
  const num = parseInt(digits || "1", 10);
  return `DS-${String(num).padStart(4, "0")}`;
}

router.get("/", authenticate, async (req: Request, res: Response) => {
  try {
    const sw = await prisma.switch.findUnique({
      where: { userId: req.auth!.userId },
      include: { beneficiaries: true },
    });
    if (!sw) {
      res.status(404).json({ success: false, error: "No switch found" });
      return;
    }

    let onChainStatus: Awaited<ReturnType<typeof getSwitchStatusOnChain>> | null = null;
    try {
      onChainStatus = await getSwitchStatusOnChain(sw.contractAddress);
    } catch (err) {
      logger.warn({ err }, "Failed to read on-chain status, falling back to DB values");
    }

    // Auto-sync: if on-chain shows triggered but DB doesn't, update DB immediately
    if (onChainStatus?.triggered && sw.status !== "TRIGGERED") {
      await prisma.switch.update({
        where: { id: sw.id },
        data: { status: "TRIGGERED", escalationStage: 4 },
      });
      sw.status = "TRIGGERED";
      sw.escalationStage = 4;
      logger.info({ switchId: sw.id }, "GET /switch: synced triggered state from on-chain");
    }

    const lastCheckIn = onChainStatus
      ? new Date(onChainStatus.lastCheckIn * 1000).toISOString()
      : sw.lastCheckIn?.toISOString() ?? new Date().toISOString();

    const nextCheckInDue = sw.nextCheckInDue?.toISOString() ?? new Date().toISOString();

    const gracePeriodDue = onChainStatus
      ? new Date(onChainStatus.triggerDeadline * 1000).toISOString()
      : new Date(Date.now() + sw.gracePeriodSecs * 1000).toISOString();

    // Compute seconds until on-chain trigger deadline (negative = already past)
    const nowSecs = Math.floor(Date.now() / 1000);
    const triggerDeadlineSecs = onChainStatus?.triggerDeadline ?? null;
    const secsUntilTrigger = triggerDeadlineSecs !== null ? triggerDeadlineSecs - nowSecs : null;

    res.json({
      success: true,
      data: {
        switchId: formatSwitchId(sw.id),
        contractAddress: sw.contractAddress,
        status: sw.status,
        lastCheckIn,
        nextCheckInDue,
        gracePeriodDue,
        escalationStage: sw.escalationStage,
        checkInIntervalSecs: sw.checkInIntervalSecs,
        gracePeriodSecs: sw.gracePeriodSecs,
        // On-chain trigger info
        onChainTriggered: onChainStatus?.triggered ?? null,
        triggerDeadlineTimestamp: triggerDeadlineSecs !== null ? new Date(triggerDeadlineSecs * 1000).toISOString() : null,
        secsUntilTrigger,
        beneficiaries: sw.beneficiaries.map((b: { id: string; label: string; walletAddress: string; basisPoints: number; tokens: string[] }) => ({
          id: b.id,
          label: b.label,
          walletAddress: b.walletAddress,
          basisPoints: b.basisPoints,
          tokens: b.tokens,
        })),
      },
    });
  } catch (err) {
    logger.error({ err }, "GET /switch error");
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// TEMPORARY DEBUG ENDPOINT — remove after diagnosing production deploy issue.
// Returns the raw Switch+User row for a wallet address (case-insensitive), no auth.
router.get("/debug/:walletAddress", async (req: Request, res: Response) => {
  try {
    const wallet = String(req.params.walletAddress).toLowerCase();
    const user = await prisma.user.findUnique({
      where: { walletAddress: wallet },
      include: { switch: { include: { beneficiaries: true } } },
    });
    res.json({ success: true, data: user });
  } catch (err) {
    logger.error({ err }, "GET /switch/debug error");
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// Frontend deploys the contract itself (user signs with their wallet),
// then calls this endpoint to register the deployed address in the DB.
router.post("/create", authenticate, async (req: Request, res: Response) => {
  try {
    const existing = await prisma.switch.findUnique({ where: { userId: req.auth!.userId } });
    if (existing) {
      res.status(409).json({ success: false, error: "Switch already exists" });
      return;
    }

    const { contractAddress, checkInIntervalSecs = 604800, gracePeriodSecs = 2592000 } = req.body as {
      contractAddress: string;
      checkInIntervalSecs?: number;
      gracePeriodSecs?: number;
    };

    if (!contractAddress) {
      res.status(400).json({ success: false, error: "contractAddress is required" });
      return;
    }

    // Read actual on-chain lastCheckIn so nextCheckInDue is aligned with on-chain state
    let onChainLastCheckIn = Date.now();
    try {
      const onChainStatus = await getSwitchStatusOnChain(contractAddress);
      onChainLastCheckIn = onChainStatus.lastCheckIn * 1000;
    } catch (err) {
      logger.warn({ err }, "POST /switch/create: could not read on-chain lastCheckIn, using now");
    }

    const nextCheckInDue = new Date(onChainLastCheckIn + checkInIntervalSecs * 1000);

    const sw = await prisma.switch.create({
      data: {
        userId: req.auth!.userId,
        contractAddress,
        checkInIntervalSecs,
        gracePeriodSecs,
        lastCheckIn: new Date(onChainLastCheckIn),
        nextCheckInDue,
        status: "PENDING",
      },
    });

    res.status(201).json({
      success: true,
      data: { switchId: formatSwitchId(sw.id), contractAddress },
    });
  } catch (err) {
    logger.error({ err }, "POST /switch/create error");
    const msg = err instanceof Error ? err.message : "Failed to create switch";
    res.status(500).json({ success: false, error: msg });
  }
});

// DELETE /switch — wipes the DB record so the user can register a new contract.
// This does NOT affect any on-chain state; the old contract remains on-chain.
router.delete("/", authenticate, async (req: Request, res: Response) => {
  try {
    const sw = await prisma.switch.findUnique({ where: { userId: req.auth!.userId } });
    if (!sw) {
      res.status(404).json({ success: false, error: "No switch found" });
      return;
    }
    await prisma.$transaction([
      prisma.notificationLog.deleteMany({ where: { switchId: sw.id } }),
      prisma.beneficiary.deleteMany({ where: { switchId: sw.id } }),
      prisma.switch.delete({ where: { id: sw.id } }),
    ]);
    res.json({ success: true, data: { deleted: sw.id } });
  } catch (err) {
    logger.error({ err }, "DELETE /switch error");
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// POST /switch/force-trigger — manually attempt trigger for testing.
// Checks on-chain state, runs the same pre-flight checks as the watchdog, returns detailed error.
router.post("/force-trigger", authenticate, async (req: Request, res: Response) => {
  try {
    const sw = await prisma.switch.findUnique({
      where: { userId: req.auth!.userId },
      include: { beneficiaries: true },
    });
    if (!sw) {
      res.status(404).json({ success: false, error: "No switch found" });
      return;
    }

    // 1. Read on-chain status
    let onChainStatus: Awaited<ReturnType<typeof getSwitchStatusOnChain>> | null = null;
    try {
      onChainStatus = await getSwitchStatusOnChain(sw.contractAddress);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(503).json({ success: false, error: `Cannot read on-chain status: ${msg}` });
      return;
    }

    // 2. Already triggered?
    if (onChainStatus.triggered) {
      await prisma.switch.update({
        where: { id: sw.id },
        data: { status: "TRIGGERED", escalationStage: 4 },
      });
      res.json({ success: true, alreadyTriggered: true, message: "Contract is already triggered on-chain. DB synced." });
      return;
    }

    // 3. Check on-chain deadline
    const nowSecs = Math.floor(Date.now() / 1000);
    const secsRemaining = onChainStatus.triggerDeadline - nowSecs;
    if (secsRemaining > 0) {
      res.status(400).json({
        success: false,
        error: `On-chain trigger deadline not reached yet. ${secsRemaining}s remaining (deadline: ${new Date(onChainStatus.triggerDeadline * 1000).toISOString()}).`,
        secsRemaining,
        triggerDeadline: new Date(onChainStatus.triggerDeadline * 1000).toISOString(),
      });
      return;
    }

    // 4. Pre-flight: check beneficiary basisPoints sum to 10000
    let totalBasisPoints = 0;
    try {
      const ds = getSwitchContract(sw.contractAddress);
      const benes = await (ds.getBeneficiaries as () => Promise<Array<{ basisPoints: bigint }>>)();
      totalBasisPoints = benes.reduce((sum, b) => sum + Number(b.basisPoints), 0);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(503).json({ success: false, error: `Cannot read on-chain beneficiaries: ${msg}` });
      return;
    }

    if (totalBasisPoints !== 10000) {
      res.status(400).json({
        success: false,
        error: `Beneficiary allocations sum to ${totalBasisPoints}/10000 basisPoints. They must total exactly 10000 (100%) before trigger() can succeed.`,
        totalBasisPoints,
      });
      return;
    }

    // 5. Attempt trigger
    try {
      const txHash = await retryWithBackoff(() => triggerOnChain(sw.contractAddress));
      await prisma.$transaction([
        prisma.notificationLog.create({
          data: { switchId: sw.id, stage: 4, channel: "EMAIL", success: true },
        }),
        prisma.switch.update({
          where: { id: sw.id },
          data: { escalationStage: 4, status: "TRIGGERED" },
        }),
      ]);
      logger.info({ switchId: sw.id, txHash }, "force-trigger: success");
      res.json({ success: true, txHash, message: "Trigger executed on-chain. Assets distributed." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ err, switchId: sw.id }, "force-trigger: on-chain call failed");
      res.status(500).json({ success: false, error: `trigger() reverted: ${msg}` });
    }
  } catch (err) {
    logger.error({ err }, "POST /switch/force-trigger error");
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

router.patch("/settings", authenticate, async (req: Request, res: Response) => {
  try {
    const { notificationEmail, notificationPhone, checkInIntervalSecs, gracePeriodSecs } = req.body as {
      notificationEmail?: string;
      notificationPhone?: string;
      checkInIntervalSecs?: number;
      gracePeriodSecs?: number;
    };

    const sw = await prisma.switch.findUnique({ where: { userId: req.auth!.userId } });
    if (!sw) {
      res.status(404).json({ success: false, error: "Switch not found" });
      return;
    }

    const newInterval = checkInIntervalSecs ?? sw.checkInIntervalSecs;
    const nextCheckInDue = checkInIntervalSecs
      ? new Date(Date.now() + checkInIntervalSecs * 1000)
      : undefined;

    const updated = await prisma.switch.update({
      where: { id: sw.id },
      data: {
        ...(notificationEmail !== undefined && { notificationEmail }),
        ...(notificationPhone !== undefined && { notificationPhone }),
        ...(checkInIntervalSecs !== undefined && { checkInIntervalSecs, nextCheckInDue }),
        ...(gracePeriodSecs    !== undefined && { gracePeriodSecs }),
      },
    });

    res.json({ success: true, data: { id: updated.id, checkInIntervalSecs: newInterval } });
  } catch (err) {
    logger.error({ err }, "PATCH /switch/settings error");
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

export default router;
