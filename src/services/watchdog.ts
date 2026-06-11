import cron from "node-cron";
import { prisma } from "../db/client";
import { triggerOnChain, retryWithBackoff, getSwitchStatusOnChain, getSwitchContract, hasDeposits } from "./mantle";
import {
  sendOverdueEmail,
  sendUrgentEmail,
  sendFinalNoticeEmail,
  sendAdminAlert,
} from "./notifications";
import { logger } from "../utils/logger";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export async function runWatchdog(): Promise<void> {
  logger.info("Watchdog: starting run");
  const now = new Date();

  // Activate PENDING switches: the countdown should not start (and the switch
  // should not be eligible for escalation/trigger) until it has been funded
  // AND beneficiary allocations sum to exactly 100%.
  const pendingSwitches = await prisma.switch.findMany({
    where: { status: "PENDING" },
    include: { beneficiaries: true },
  });

  for (const sw of pendingSwitches) {
    try {
      const totalBasisPoints = sw.beneficiaries.reduce((sum, b) => sum + b.basisPoints, 0);
      if (totalBasisPoints !== 10000) continue;

      const tokens = sw.beneficiaries.flatMap((b) => b.tokens ?? []);
      const funded = await hasDeposits(sw.contractAddress, tokens);
      if (!funded) continue;

      const now2 = new Date();
      await prisma.switch.update({
        where: { id: sw.id },
        data: {
          status: "ACTIVE",
          escalationStage: 0,
          lastCheckIn: now2,
          nextCheckInDue: new Date(now2.getTime() + sw.checkInIntervalSecs * 1000),
        },
      });
      logger.info({ switchId: sw.id }, "Watchdog: switch funded & fully allocated — countdown started, status=ACTIVE");
    } catch (err) {
      logger.error({ err, switchId: sw.id }, "Watchdog: error checking PENDING switch");
    }
  }

  const overdueSwitches = await prisma.switch.findMany({
    where: {
      status: { in: ["ACTIVE", "GRACE_PERIOD"] },
      nextCheckInDue: { lt: now },
    },
    include: { user: true, notificationLogs: true },
  });

  logger.info({ count: overdueSwitches.length }, "Watchdog: overdue switches found");

  for (const sw of overdueSwitches) {
    try {
      const elapsed = now.getTime() - (sw.nextCheckInDue?.getTime() ?? 0);

      // Stage thresholds scale with this switch's own grace period instead of
      // fixed 7/14-day constants: Stage 2 at 50% of the grace period elapsed,
      // Stage 3 at 90% of the grace period elapsed (Stage 4 fires at 100%, i.e.
      // when the on-chain trigger deadline passes).
      const graceMs = sw.gracePeriodSecs * 1000;
      const STAGE2_THRESHOLD_MS = graceMs * 0.5;
      const STAGE3_THRESHOLD_MS = graceMs * 0.9;

      // Daily reminder (stage 0): repeats every 24h while overdue, on top of the
      // one-time staged emails below.
      if (elapsed >= 0) {
        const dailyLogs = sw.notificationLogs
          .filter((l: { stage: number; success: boolean; sentAt: Date }) => l.stage === 0 && l.success)
          .sort((a: { sentAt: Date }, b: { sentAt: Date }) => b.sentAt.getTime() - a.sentAt.getTime());
        const lastSent = dailyLogs[0]?.sentAt;
        if (!lastSent || now.getTime() - lastSent.getTime() >= ONE_DAY_MS) {
          let success = false;
          let error: string | undefined;
          try {
            const email = sw.notificationEmail ?? sw.user.walletAddress;
            await sendOverdueEmail(email, sw.user.walletAddress);
            success = true;
          } catch (err: unknown) {
            error = err instanceof Error ? err.message : String(err);
            logger.error({ err, switchId: sw.id }, "Daily overdue reminder email failed");
          }
          await prisma.notificationLog.create({
            data: { switchId: sw.id, stage: 0, channel: "EMAIL", success, error },
          });
        }
      }

      // Stage 1: email
      if (elapsed >= 0 && sw.escalationStage < 1) {
        const alreadySent = sw.notificationLogs.some((l: { stage: number; success: boolean }) => l.stage === 1 && l.success);
        if (!alreadySent) {
          let success = false;
          let error: string | undefined;
          try {
            const email = sw.notificationEmail ?? sw.user.walletAddress;
            await sendOverdueEmail(email, sw.user.walletAddress);
            success = true;
          } catch (err: unknown) {
            error = err instanceof Error ? err.message : String(err);
            logger.error({ err, switchId: sw.id }, "Stage 1 email failed");
          }
          await prisma.$transaction([
            prisma.notificationLog.create({
              data: { switchId: sw.id, stage: 1, channel: "EMAIL", success, error },
            }),
            prisma.switch.update({
              where: { id: sw.id },
              data: { escalationStage: 1, status: "GRACE_PERIOD" },
            }),
          ]);
        }
      }

      // Stage 2: urgent email reminder
      if (elapsed >= STAGE2_THRESHOLD_MS && sw.escalationStage < 2) {
        const alreadySent = sw.notificationLogs.some((l: { stage: number; success: boolean }) => l.stage === 2 && l.success);
        if (!alreadySent) {
          let success = false;
          let error: string | undefined;
          try {
            const email = sw.notificationEmail ?? sw.user.walletAddress;
            await sendUrgentEmail(email, sw.user.walletAddress);
            success = true;
          } catch (err: unknown) {
            error = err instanceof Error ? err.message : String(err);
            logger.error({ err, switchId: sw.id }, "Stage 2 urgent email failed");
          }
          await prisma.$transaction([
            prisma.notificationLog.create({
              data: { switchId: sw.id, stage: 2, channel: "EMAIL", success, error },
            }),
            prisma.switch.update({
              where: { id: sw.id },
              data: { escalationStage: 2 },
            }),
          ]);
        }
      }

      // Stage 3: final notice email
      if (elapsed >= STAGE3_THRESHOLD_MS && sw.escalationStage < 3) {
        const alreadySent = sw.notificationLogs.some((l: { stage: number; success: boolean }) => l.stage === 3 && l.success);
        if (!alreadySent) {
          let success = false;
          let error: string | undefined;
          try {
            const email = sw.notificationEmail ?? sw.user.walletAddress;
            await sendFinalNoticeEmail(email, sw.user.walletAddress);
            success = true;
          } catch (err: unknown) {
            error = err instanceof Error ? err.message : String(err);
            logger.error({ err, switchId: sw.id }, "Stage 3 final notice email failed");
          }
          await prisma.$transaction([
            prisma.notificationLog.create({
              data: { switchId: sw.id, stage: 3, channel: "EMAIL", success, error },
            }),
            prisma.switch.update({
              where: { id: sw.id },
              data: { escalationStage: 3 },
            }),
          ]);
        }
      }

      // Stage 4: on-chain trigger
      // Use the on-chain triggerDeadline (lastCheckIn + onChainInterval + onChainGrace)
      // NOT the DB gracePeriodSecs — settings changes only affect reminder schedule, not the contract.
      let onChainStatus: Awaited<ReturnType<typeof getSwitchStatusOnChain>> | null = null;
      try {
        onChainStatus = await getSwitchStatusOnChain(sw.contractAddress);
      } catch (err) {
        logger.warn({ err, switchId: sw.id }, "Watchdog: could not read on-chain status for Stage 4 check");
      }

      // If on-chain already triggered, sync DB and skip
      if (onChainStatus?.triggered && sw.status !== "TRIGGERED") {
        await prisma.switch.update({
          where: { id: sw.id },
          data: { status: "TRIGGERED", escalationStage: 4 },
        });
        logger.info({ switchId: sw.id }, "Watchdog: synced triggered state from on-chain");
        continue;
      }

      const nowSecs = Math.floor(Date.now() / 1000);
      const onChainDeadlinePassed = onChainStatus
        ? nowSecs > onChainStatus.triggerDeadline
        : elapsed >= sw.gracePeriodSecs * 1000; // fallback to DB value if RPC fails

      if (onChainDeadlinePassed && sw.escalationStage < 4) {
        const alreadyTriggered = sw.notificationLogs.some((l: { stage: number; success: boolean }) => l.stage === 4 && l.success);
        if (!alreadyTriggered) {
          // Pre-flight check: verify beneficiary total is exactly 10000 basisPoints
          // The contract requires this — if not met, trigger() will revert.
          let totalBasisPoints = 0;
          try {
            const ds = getSwitchContract(sw.contractAddress);
            const benes = await (ds.getBeneficiaries as () => Promise<Array<{ basisPoints: bigint }>>)();
            totalBasisPoints = benes.reduce((sum, b) => sum + Number(b.basisPoints), 0);
          } catch (err) {
            logger.warn({ err, switchId: sw.id }, "Watchdog: could not read on-chain beneficiaries");
          }

          if (totalBasisPoints !== 10000) {
            logger.error(
              { switchId: sw.id, totalBasisPoints },
              `Watchdog: cannot trigger — beneficiary basisPoints sum to ${totalBasisPoints}/10000 (must equal 10000). ` +
              `Owner must update allocations so they total exactly 100%.`
            );
            await sendAdminAlert(
              "DeathSwitch: trigger blocked — allocation incomplete",
              `Switch ${sw.id} (${sw.contractAddress}) cannot be triggered.\n` +
              `Beneficiary basis points sum to ${totalBasisPoints}/10000 (need exactly 10000).\n` +
              `The owner must update allocations so they total exactly 100%.`
            ).catch(() => {});
            // Skip trigger attempt — it would just waste gas and revert
          } else {
            let success = false;
            let error: string | undefined;
            try {
              await retryWithBackoff(() => triggerOnChain(sw.contractAddress));
              success = true;
            } catch (err: unknown) {
              error = err instanceof Error ? err.message : String(err);
              logger.error({ err, switchId: sw.id }, "Stage 4 on-chain trigger failed");
              await sendAdminAlert(
                "DeathSwitch: trigger failed",
                `Switch ${sw.id} (${sw.contractAddress}) trigger failed after retries: ${error}`
              ).catch(() => {});
            }
            await prisma.$transaction([
              prisma.notificationLog.create({
                data: { switchId: sw.id, stage: 4, channel: "EMAIL", success, error },
              }),
              ...(success
                ? [
                    prisma.switch.update({
                      where: { id: sw.id },
                      data: { escalationStage: 4, status: "TRIGGERED" },
                    }),
                  ]
                : []),
            ]);
          }
        }
      } else if (!onChainDeadlinePassed && onChainStatus) {
        const secsLeft = onChainStatus.triggerDeadline - nowSecs;
        logger.info(
          { switchId: sw.id, secsLeft, triggerDeadline: new Date(onChainStatus.triggerDeadline * 1000).toISOString() },
          `Watchdog: on-chain trigger deadline not yet reached (${Math.round(secsLeft / 3600)}h left)`
        );
      }
    } catch (err) {
      logger.error({ err, switchId: sw.id }, "Watchdog: unexpected error processing switch");
    }
  }

  logger.info("Watchdog: run complete");
}

export function startWatchdog(): void {
  // Run every minute so short-interval test switches get triggered quickly.
  // For production with 7-day intervals every 15 min would be fine,
  // but 1-min cadence is cheap and catches edge cases faster.
  cron.schedule("* * * * *", () => {
    runWatchdog().catch((err) => {
      logger.error({ err }, "Watchdog cron error");
    });
  });
  logger.info("Watchdog: cron started (every minute)");
}
