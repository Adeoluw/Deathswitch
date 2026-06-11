import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { deployContracts, deployMockERC20 } from "./helpers";

describe("DeathSwitch", function () {
  describe("Check-in", function () {
    it("Owner can check in and reset the deadline", async function () {
      const { ds, owner } = await deployContracts();
      const before = await ds.lastCheckIn();
      await time.increase(1000);
      await ds.connect(owner).checkIn();
      const after = await ds.lastCheckIn();
      expect(after).to.be.gt(before);
    });

    it("Non-owner cannot call checkIn", async function () {
      const { ds, addr1 } = await deployContracts();
      await expect(ds.connect(addr1).checkIn()).to.be.revertedWith("DeathSwitch: not owner");
    });
  });

  describe("Access control", function () {
    it("Non-owner cannot addBeneficiary", async function () {
      const { ds, addr1, addr2 } = await deployContracts();
      await expect(
        ds.connect(addr1).addBeneficiary(addr2.address, 5000, "Test")
      ).to.be.revertedWith("DeathSwitch: not owner");
    });

    it("Non-owner cannot withdrawAll", async function () {
      const { ds, addr1 } = await deployContracts();
      await expect(ds.connect(addr1).withdrawAll()).to.be.revertedWith("DeathSwitch: not owner");
    });
  });

  describe("Beneficiary management", function () {
    it("basisPoints must sum to exactly 10000 before trigger", async function () {
      const { ds, owner, addr1, addr2, checkInInterval, gracePeriod } = await deployContracts();
      await ds.connect(owner).addBeneficiary(addr1.address, 5000, "Alice");
      await ds.connect(owner).addBeneficiary(addr2.address, 4000, "Bob");
      // total = 9000, trigger should revert
      await time.increase(checkInInterval + gracePeriod + 1);
      await expect(ds.trigger()).to.be.revertedWith(
        "DeathSwitch: basisPoints must sum to 10000"
      );
    });
  });

  describe("Trigger", function () {
    it("trigger() reverts if called before grace period expires", async function () {
      const { ds, owner, addr1, addr2 } = await deployContracts();
      await ds.connect(owner).addBeneficiary(addr1.address, 6000, "Alice");
      await ds.connect(owner).addBeneficiary(addr2.address, 4000, "Bob");
      await expect(ds.trigger()).to.be.revertedWith(
        "DeathSwitch: grace period not elapsed"
      );
    });

    it("trigger() succeeds after time-travel past grace period", async function () {
      const { ds, owner, addr1, addr2, checkInInterval, gracePeriod } = await deployContracts();
      await ds.connect(owner).addBeneficiary(addr1.address, 6000, "Alice");
      await ds.connect(owner).addBeneficiary(addr2.address, 4000, "Bob");
      await time.increase(checkInInterval + gracePeriod + 1);
      await expect(ds.trigger()).to.emit(ds, "Triggered");
      expect(await ds.triggered()).to.be.true;
    });

    it("Native MNT distributes correctly at 60/40", async function () {
      const { ds, owner, addr1, addr2, checkInInterval, gracePeriod } = await deployContracts();
      await ds.connect(owner).addBeneficiary(addr1.address, 6000, "Alice");
      await ds.connect(owner).addBeneficiary(addr2.address, 4000, "Bob");
      const deposit = ethers.parseEther("1.0");
      await ds.connect(owner).depositNative({ value: deposit });

      const bal1Before = await ethers.provider.getBalance(addr1.address);
      const bal2Before = await ethers.provider.getBalance(addr2.address);

      await time.increase(checkInInterval + gracePeriod + 1);
      await ds.trigger();

      const bal1After = await ethers.provider.getBalance(addr1.address);
      const bal2After = await ethers.provider.getBalance(addr2.address);

      expect(bal1After - bal1Before).to.equal(ethers.parseEther("0.6"));
      expect(bal2After - bal2Before).to.equal(ethers.parseEther("0.4"));
    });

    it("ERC-20 distributes correctly to beneficiaries", async function () {
      const { ds, owner, addr1, addr2, checkInInterval, gracePeriod } = await deployContracts();
      const token = await deployMockERC20();

      const amount = ethers.parseUnits("1000", 6);
      await token.mint(owner.address, amount);
      await token.connect(owner).approve(await ds.getAddress(), amount);

      await ds.connect(owner).addBeneficiary(addr1.address, 6000, "Alice");
      await ds.connect(owner).addBeneficiary(addr2.address, 4000, "Bob");
      await ds.connect(owner).depositERC20(await token.getAddress(), amount);

      await time.increase(checkInInterval + gracePeriod + 1);
      await ds.trigger();

      expect(await token.balanceOf(addr1.address)).to.equal(ethers.parseUnits("600", 6));
      expect(await token.balanceOf(addr2.address)).to.equal(ethers.parseUnits("400", 6));
    });
  });

  describe("Deposits and withdrawals", function () {
    it("Owner can depositERC20 and withdrawAll before trigger", async function () {
      const { ds, owner } = await deployContracts();
      const token = await deployMockERC20();
      const amount = ethers.parseUnits("500", 6);
      await token.mint(owner.address, amount);
      await token.connect(owner).approve(await ds.getAddress(), amount);
      await ds.connect(owner).depositERC20(await token.getAddress(), amount);
      expect(await token.balanceOf(await ds.getAddress())).to.equal(amount);

      await ds.connect(owner).withdrawAll();
      expect(await token.balanceOf(await ds.getAddress())).to.equal(0);
      expect(await token.balanceOf(owner.address)).to.equal(amount);
    });

    it("withdrawAll reverts after trigger", async function () {
      const { ds, owner, addr1, addr2, checkInInterval, gracePeriod } = await deployContracts();
      await ds.connect(owner).addBeneficiary(addr1.address, 6000, "Alice");
      await ds.connect(owner).addBeneficiary(addr2.address, 4000, "Bob");
      await time.increase(checkInInterval + gracePeriod + 1);
      await ds.trigger();
      await expect(ds.connect(owner).withdrawAll()).to.be.revertedWith(
        "DeathSwitch: already triggered"
      );
    });
  });

  describe("Factory", function () {
    it("Factory creates unique switch per user", async function () {
      const { factory, owner, addr1 } = await deployContracts();
      const ownerSwitch = await factory.getUserSwitch(owner.address);
      expect(ownerSwitch).to.not.equal(ethers.ZeroAddress);

      await factory.connect(addr1).createSwitch(7 * 24 * 3600, 30 * 24 * 3600);
      const addr1Switch = await factory.getUserSwitch(addr1.address);
      expect(addr1Switch).to.not.equal(ethers.ZeroAddress);
      expect(ownerSwitch).to.not.equal(addr1Switch);
    });
  });
});
