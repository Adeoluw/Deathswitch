import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/authenticate";
import { prisma } from "../db/client";
import { getProvider, getERC20Contract } from "../services/mantle";
import { ethers } from "ethers";
import { logger } from "../utils/logger";

const router = Router();

// Known ERC-20 tokens on Mantle — update addresses for mainnet
const KNOWN_TOKENS: Record<string, { symbol: string; decimals: number; geckoId: string }> = {
  "0x09Bc4E0D864854c6aFB6eB9A9cdF58aC190D0dF9": {
    symbol: "USDC",
    decimals: 6,
    geckoId: "usd-coin",
  },
  "0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8": {
    symbol: "wBTC",
    decimals: 8,
    geckoId: "wrapped-bitcoin",
  },
  "0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb9": {
    symbol: "MNT token",
    decimals: 18,
    geckoId: "mantle",
  },
};

async function fetchUsdPrices(geckoIds: string[]): Promise<Record<string, number>> {
  if (geckoIds.length === 0) return {};
  const ids = geckoIds.join(",");
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`
    );
    const data = (await res.json()) as Record<string, { usd: number }>;
    const prices: Record<string, number> = {};
    for (const [id, val] of Object.entries(data)) {
      prices[id] = val.usd;
    }
    return prices;
  } catch (err) {
    logger.warn({ err }, "CoinGecko price fetch failed");
    return {};
  }
}

router.get("/", authenticate, async (req: Request, res: Response) => {
  try {
    const sw = await prisma.switch.findUnique({ where: { userId: req.auth!.userId } });
    if (!sw) {
      res.status(404).json({ success: false, error: "Switch not found" });
      return;
    }

    const provider = getProvider();
    const allGeckoIds = [
      "mantle",
      ...new Set(Object.values(KNOWN_TOKENS).map((t) => t.geckoId)),
    ];
    const prices = await fetchUsdPrices(allGeckoIds);

    const assets: {
      symbol: string;
      balance: string;
      usdPrice: number;
      usdValue: number;
      contractAddress: string | null;
      decimals: number;
    }[] = [];

    // Native MNT
    const nativeBal = await provider.getBalance(sw.contractAddress);
    const nativeFormatted = ethers.formatEther(nativeBal);
    const mntPrice = prices["mantle"] ?? 0;
    assets.push({
      symbol: "MNT",
      balance: nativeFormatted,
      usdPrice: mntPrice,
      usdValue: parseFloat(nativeFormatted) * mntPrice,
      contractAddress: null,
      decimals: 18,
    });

    // ERC-20 tokens
    for (const [tokenAddress, meta] of Object.entries(KNOWN_TOKENS)) {
      try {
        const contract = getERC20Contract(tokenAddress);
        const bal = await (contract.balanceOf as (a: string) => Promise<bigint>)(
          sw.contractAddress
        );
        const formatted = ethers.formatUnits(bal, meta.decimals);
        const price = prices[meta.geckoId] ?? 0;
        assets.push({
          symbol: meta.symbol,
          balance: formatted,
          usdPrice: price,
          usdValue: parseFloat(formatted) * price,
          contractAddress: tokenAddress,
          decimals: meta.decimals,
        });
      } catch (err) {
        logger.warn({ err, tokenAddress }, "Failed to fetch ERC-20 balance");
      }
    }

    const totalUsdValue = assets.reduce((sum, a) => sum + a.usdValue, 0);
    res.json({ success: true, data: { assets, totalUsdValue } });
  } catch (err) {
    logger.error({ err }, "GET /assets error");
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

export default router;
