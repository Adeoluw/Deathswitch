import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import * as dotenv from "dotenv";
dotenv.config();

// ── Compiled contract artifacts ──
const FACTORY_ARTIFACT = path.join(__dirname, "../artifacts/contracts/DeathSwitchFactory.sol/DeathSwitchFactory.json");

function prompt(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    if (hidden) {
      // Hide input for private key
      process.stdout.write(question);
      let input = "";
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", function handler(char: string) {
        if (char === "\n" || char === "\r" || char === "") {
          if (char === "") process.exit(); // Ctrl+C
          process.stdout.write("\n");
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener("data", handler);
          rl.close();
          resolve(input);
        } else if (char === "") {
          // Backspace
          if (input.length > 0) {
            input = input.slice(0, -1);
            process.stdout.write("\b \b");
          }
        } else {
          input += char;
          process.stdout.write("*");
        }
      });
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}

async function main() {
  const networkArg = process.argv[2] || "testnet";
  const isTestnet = networkArg !== "mainnet";

  const rpcUrl = isTestnet
    ? (process.env.MANTLE_TESTNET_RPC_URL || "https://rpc.sepolia.mantle.xyz")
    : (process.env.MANTLE_RPC_URL || "https://rpc.mantle.xyz");

  const networkName = isTestnet ? "Mantle Sepolia (testnet)" : "Mantle Mainnet";
  const networkKey  = isTestnet ? "mantle_testnet" : "mantle_mainnet";

  console.log(`\n⚰️  DeathSwitch Contract Deployer`);
  console.log(`   Network : ${networkName}`);
  console.log(`   RPC     : ${rpcUrl}\n`);

  // ── Ask for private key ──
  const privateKey = await prompt("Paste your wallet private key (input hidden): ", true);
  if (!privateKey || privateKey.length < 10) {
    console.error("❌  No private key provided.");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey.startsWith("0x") ? privateKey : "0x" + privateKey, provider);
  const address = await wallet.getAddress();

  console.log(`\n   Deployer: ${address}`);

  // Check balance
  const balance = await provider.getBalance(address);
  const balanceEth = ethers.formatEther(balance);
  console.log(`   Balance : ${balanceEth} MNT`);

  if (balance === 0n) {
    console.error(`\n❌  Wallet has no MNT for gas.`);
    if (isTestnet) console.error(`   Get free testnet MNT at: https://faucet.sepolia.mantle.xyz`);
    process.exit(1);
  }

  if (!isTestnet) {
    const confirm = await prompt(`\n⚠️  You are deploying to MAINNET with real funds. Type "yes" to confirm: `);
    if (confirm.toLowerCase() !== "yes") {
      console.log("Aborted.");
      process.exit(0);
    }
  }

  // ── Load artifact ──
  if (!fs.existsSync(FACTORY_ARTIFACT)) {
    console.error("❌  Contract artifact not found. Run: npx hardhat compile");
    process.exit(1);
  }
  const artifact = JSON.parse(fs.readFileSync(FACTORY_ARTIFACT, "utf8"));

  // ── Deploy ──
  console.log("\n🚀  Deploying DeathSwitchFactory...");
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy();
  console.log(`   Tx hash : ${contract.deploymentTransaction()?.hash}`);
  console.log("   Waiting for confirmation...");
  await contract.waitForDeployment();
  const factoryAddress = await contract.getAddress();

  console.log(`\n✅  DeathSwitchFactory deployed!`);
  console.log(`   Address : ${factoryAddress}`);
  console.log(`   Explorer: ${isTestnet
    ? `https://explorer.sepolia.mantle.xyz/address/${factoryAddress}`
    : `https://explorer.mantle.xyz/address/${factoryAddress}`
  }`);

  // ── Save deployment info ──
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir);
  const deploymentInfo = {
    network: networkKey,
    factoryAddress,
    deployer: address,
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(deploymentsDir, `${networkKey}.json`),
    JSON.stringify(deploymentInfo, null, 2)
  );

  // ── Auto-update .env ──
  const envPath = path.join(__dirname, "../.env");
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, "utf8");
    if (envContent.includes("FACTORY_CONTRACT_ADDRESS=")) {
      envContent = envContent.replace(/FACTORY_CONTRACT_ADDRESS=.*/,`FACTORY_CONTRACT_ADDRESS=${factoryAddress}`);
    } else {
      envContent += `\nFACTORY_CONTRACT_ADDRESS=${factoryAddress}`;
    }
    fs.writeFileSync(envPath, envContent);
    console.log(`\n✅  FACTORY_CONTRACT_ADDRESS automatically saved to .env`);
  }

  console.log(`\n🎉  Done! Copy this address into the app when prompted:`);
  console.log(`   ${factoryAddress}\n`);
}

main().catch((err) => {
  console.error("Deploy failed:", err.message);
  process.exit(1);
});
