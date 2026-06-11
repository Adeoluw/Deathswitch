import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/authenticate";
import { prisma } from "../db/client";
import { logger } from "../utils/logger";
import { hasDeposits } from "../services/mantle";

const router = Router();

router.get("/", authenticate, async (req: Request, res: Response) => {
  try {
    const sw = await prisma.switch.findUnique({ where: { userId: req.auth!.userId } });
    if (!sw) {
      res.status(404).json({ success: false, error: "Switch not found" });
      return;
    }
    const beneficiaries = await prisma.beneficiary.findMany({ where: { switchId: sw.id } });
    res.json({
      success: true,
      data: beneficiaries.map((b: { id: string; label: string; walletAddress: string; basisPoints: number; tokens: string[] }) => ({
        id: b.id,
        label: b.label,
        walletAddress: b.walletAddress,
        basisPoints: b.basisPoints,
        tokens: b.tokens,
      })),
    });
  } catch (err) {
    logger.error({ err }, "GET /beneficiaries error");
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

router.post("/", authenticate, async (req: Request, res: Response) => {
  try {
    const { walletAddress, label, basisPoints, tokens } = req.body as {
      walletAddress?: string;
      label?: string;
      basisPoints?: number;
      tokens?: string[];
    };

    if (!walletAddress || !label || basisPoints === undefined || !tokens) {
      res
        .status(400)
        .json({ success: false, error: "walletAddress, label, basisPoints, tokens required" });
      return;
    }

    const sw = await prisma.switch.findUnique({
      where: { userId: req.auth!.userId },
      include: { beneficiaries: true },
    });
    if (!sw) {
      res.status(404).json({ success: false, error: "Switch not found" });
      return;
    }

    // Enforce "deposit first": no allocations can be set until the switch
    // contract actually holds funds.
    const existingTokens = sw.beneficiaries.flatMap((b: { tokens: string[] }) => b.tokens ?? []);
    const tokensToCheck = [...new Set([...existingTokens, ...tokens])];
    const funded = await hasDeposits(sw.contractAddress, tokensToCheck);
    if (!funded) {
      res.status(400).json({
        success: false,
        error: "No assets detected in your DeathSwitch contract yet. Deposit funds first, then set up beneficiary allocations.",
      });
      return;
    }

    const currentTotal = sw.beneficiaries.reduce((sum: number, b: { basisPoints: number }) => sum + b.basisPoints, 0);
    if (currentTotal + basisPoints > 10000) {
      res.status(400).json({
        success: false,
        error: `Total basisPoints would exceed 10000 (current: ${currentTotal})`,
      });
      return;
    }

    // On-chain tx is already sent by the frontend before this call.
    // We only persist to the DB here.
    const { txHash } = req.body as { txHash?: string };

    const beneficiary = await prisma.beneficiary.create({
      data: { switchId: sw.id, walletAddress, label, basisPoints, tokens },
    });

    res.status(201).json({
      success: true,
      data: { id: beneficiary.id, walletAddress, label, basisPoints, tokens, txHash },
    });
  } catch (err) {
    logger.error({ err }, "POST /beneficiaries error");
    const msg = err instanceof Error ? err.message : "Failed to add beneficiary";
    res.status(500).json({ success: false, error: msg });
  }
});

router.delete("/:id", authenticate, async (req: Request, res: Response) => {
  try {
    const sw = await prisma.switch.findUnique({ where: { userId: req.auth!.userId } });
    if (!sw) {
      res.status(404).json({ success: false, error: "Switch not found" });
      return;
    }

    const beneficiary = await prisma.beneficiary.findFirst({
      where: { id: String(req.params.id), switchId: sw.id },
    });
    if (!beneficiary) {
      res.status(404).json({ success: false, error: "Beneficiary not found" });
      return;
    }

    // On-chain tx is already sent by the frontend before this call.
    // We only delete from the DB here.
    await prisma.beneficiary.delete({ where: { id: beneficiary.id } });

    res.json({ success: true, data: {} });
  } catch (err) {
    logger.error({ err }, "DELETE /beneficiaries/:id error");
    const msg = err instanceof Error ? err.message : "Failed to remove beneficiary";
    res.status(500).json({ success: false, error: msg });
  }
});

export default router;
