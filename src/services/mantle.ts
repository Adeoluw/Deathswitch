import { ethers } from "ethers";
import { config } from "../config";
import { logger } from "../utils/logger";

const DEATHSWITCH_ABI = [
  "function checkIn() external",
  "function addBeneficiary(address wallet, uint256 basisPoints, string calldata label) external",
  "function removeBeneficiary(address wallet) external",
  "function setTokenAllocation(address token, address[] calldata beneficiaryWallets) external",
  "function depositNative() external payable",
  "function depositERC20(address token, uint256 amount) external",
  "function withdrawAll() external",
  "function trigger() external",
  "function getSwitchStatus() external view returns (uint256 lastCheckIn, uint256 nextCheckInDeadline, uint256 triggerDeadline, bool triggered, uint256 totalBeneficiaries)",
  "function getBeneficiaries() external view returns (tuple(address wallet, uint256 basisPoints, string label)[])",
  "event CheckIn(address indexed owner, uint256 timestamp)",
  "event Triggered(uint256 timestamp)",
];

const FACTORY_ABI = [
  "function createSwitch(uint256 checkInInterval, uint256 gracePeriod) external returns (address)",
  "function getUserSwitch(address owner) external view returns (address)",
  "event SwitchCreated(address indexed owner, address indexed switchAddress)",
];

const ERC20_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
];

export function getProvider(): ethers.JsonRpcProvider {
  // The app and its contracts currently only run on Mantle Sepolia testnet,
  // regardless of NODE_ENV — using mainnet here would always show 0 balances.
  return new ethers.JsonRpcProvider(config.MANTLE_TESTNET_RPC_URL);
}

export function getBackendWallet(): ethers.Wallet {
  if (!config.BACKEND_WALLET_PRIVATE_KEY) {
    throw new Error("BACKEND_WALLET_PRIVATE_KEY is not configured in .env");
  }
  return new ethers.Wallet(config.BACKEND_WALLET_PRIVATE_KEY, getProvider());
}

export function getFactoryContract(
  signerOrProvider?: ethers.Signer | ethers.Provider
): ethers.Contract {
  if (!config.FACTORY_CONTRACT_ADDRESS) {
    throw new Error("FACTORY_CONTRACT_ADDRESS is not configured in .env");
  }
  return new ethers.Contract(
    config.FACTORY_CONTRACT_ADDRESS,
    FACTORY_ABI,
    signerOrProvider ?? getProvider()
  );
}

export function getSwitchContract(
  address: string,
  signerOrProvider?: ethers.Signer | ethers.Provider
): ethers.Contract {
  return new ethers.Contract(address, DEATHSWITCH_ABI, signerOrProvider ?? getProvider());
}

export function getERC20Contract(
  address: string,
  signerOrProvider?: ethers.Signer | ethers.Provider
): ethers.Contract {
  return new ethers.Contract(address, ERC20_ABI, signerOrProvider ?? getProvider());
}

export async function createSwitchOnChain(
  checkInIntervalSecs: number,
  gracePeriodSecs: number
): Promise<{ contractAddress: string; txHash: string }> {
  const wallet = getBackendWallet();
  const factory = getFactoryContract(wallet);
  const tx = await (factory.createSwitch as (a: number, b: number) => Promise<ethers.ContractTransactionResponse>)(
    checkInIntervalSecs,
    gracePeriodSecs
  );
  const receipt = await tx.wait();
  if (!receipt) throw new Error("No receipt for createSwitch");

  const iface = new ethers.Interface(FACTORY_ABI);
  let contractAddress = "";
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
      if (parsed?.name === "SwitchCreated") {
        contractAddress = parsed.args.switchAddress as string;
        break;
      }
    } catch {}
  }
  if (!contractAddress) throw new Error("SwitchCreated event not found in receipt");
  return { contractAddress, txHash: receipt.hash };
}

export async function checkInOnChain(contractAddress: string): Promise<string> {
  const wallet = getBackendWallet();
  const ds = getSwitchContract(contractAddress, wallet);
  const tx = await (ds.checkIn as () => Promise<ethers.ContractTransactionResponse>)();
  const receipt = await tx.wait();
  if (!receipt) throw new Error("No receipt for checkIn");
  return receipt.hash;
}

export async function addBeneficiaryOnChain(
  contractAddress: string,
  wallet: string,
  basisPoints: number,
  label: string
): Promise<string> {
  const signer = getBackendWallet();
  const ds = getSwitchContract(contractAddress, signer);
  const tx = await (
    ds.addBeneficiary as (
      w: string,
      bp: number,
      l: string
    ) => Promise<ethers.ContractTransactionResponse>
  )(wallet, basisPoints, label);
  const receipt = await tx.wait();
  if (!receipt) throw new Error("No receipt");
  return receipt.hash;
}

export async function removeBeneficiaryOnChain(
  contractAddress: string,
  wallet: string
): Promise<string> {
  const signer = getBackendWallet();
  const ds = getSwitchContract(contractAddress, signer);
  const tx = await (
    ds.removeBeneficiary as (w: string) => Promise<ethers.ContractTransactionResponse>
  )(wallet);
  const receipt = await tx.wait();
  if (!receipt) throw new Error("No receipt");
  return receipt.hash;
}

export async function triggerOnChain(contractAddress: string): Promise<string> {
  const wallet = getBackendWallet();
  const ds = getSwitchContract(contractAddress, wallet);
  const tx = await (ds.trigger as () => Promise<ethers.ContractTransactionResponse>)();
  const receipt = await tx.wait();
  if (!receipt) throw new Error("No receipt");
  return receipt.hash;
}

export async function getSwitchStatusOnChain(contractAddress: string) {
  const ds = getSwitchContract(contractAddress);
  const status = await (
    ds.getSwitchStatus as () => Promise<[bigint, bigint, bigint, boolean, bigint]>
  )();
  return {
    lastCheckIn: Number(status[0]),
    nextCheckInDeadline: Number(status[1]),
    triggerDeadline: Number(status[2]),
    triggered: status[3],
    totalBeneficiaries: Number(status[4]),
  };
}

// Returns true if the switch contract holds any native MNT or any of the given
// ERC20 tokens. Used to gate a switch from going live until it's actually funded.
export async function hasDeposits(contractAddress: string, tokens: string[]): Promise<boolean> {
  const provider = getProvider();

  const nativeBalance = await provider.getBalance(contractAddress);
  if (nativeBalance > 0n) return true;

  const uniqueTokens = [...new Set(tokens.filter((t) => t && t !== ethers.ZeroAddress))];
  for (const token of uniqueTokens) {
    try {
      const erc20 = getERC20Contract(token, provider);
      const bal = await (erc20.balanceOf as (a: string) => Promise<bigint>)(contractAddress);
      if (bal > 0n) return true;
    } catch {
      // ignore unreadable tokens
    }
  }
  return false;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 1000
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      logger.warn({ attempt, err }, "On-chain call failed, retrying...");
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, baseDelayMs * Math.pow(2, attempt - 1)));
      }
    }
  }
  throw lastError;
}
