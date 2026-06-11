import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

export async function deployContracts() {
  const [owner, addr1, addr2, addr3] = await ethers.getSigners();

  const Factory = await ethers.getContractFactory("DeathSwitchFactory");
  const factory = await Factory.deploy();

  const checkInInterval = 7 * 24 * 3600;
  const gracePeriod = 30 * 24 * 3600;

  await factory.connect(owner).createSwitch(checkInInterval, gracePeriod);
  const switchAddress = await factory.getUserSwitch(owner.address);
  const ds = await ethers.getContractAt("DeathSwitch", switchAddress);

  return { factory, ds, owner, addr1, addr2, addr3, checkInInterval, gracePeriod };
}

export async function deployMockERC20() {
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const token = await MockERC20.deploy("Mock USDC", "USDC", 6);
  return token;
}

export { time };
