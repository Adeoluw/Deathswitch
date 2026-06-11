import { run, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const deploymentPath = path.join(__dirname, `../deployments/${network.name}.json`);
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`No deployment found for network: ${network.name}`);
  }
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8")) as {
    factoryAddress: string;
  };
  console.log(`Verifying DeathSwitchFactory at ${deployment.factoryAddress}...`);
  await run("verify:verify", {
    address: deployment.factoryAddress,
    constructorArguments: [],
  });
  console.log("Verification complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
