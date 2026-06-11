import { logger } from "../utils/logger";

// Render's free tier spins a web service down after ~15 minutes without inbound
// HTTP traffic. While spun down, the in-process watchdog cron does NOT run, so
// switch triggers and escalation emails would be delayed until the next request
// wakes the service. A request to the service's OWN public URL counts as inbound
// traffic, so periodically pinging /health from inside the process keeps it
// awake (and the watchdog ticking) with no external dependency.
//
// This is a best-effort safety net. For maximum reliability on the free tier you
// should ALSO configure an external uptime pinger (see README) so the service is
// woken even if the process itself ever goes fully down.
const PING_INTERVAL_MS = 10 * 60 * 1000; // 10 min — comfortably under the ~15 min idle window

export function startKeepAlive(): void {
  // Render injects RENDER_EXTERNAL_URL automatically; fall back to a configured
  // SELF_URL if present. If neither is set (e.g. local dev), do nothing.
  const baseUrl = process.env.RENDER_EXTERNAL_URL || process.env.SELF_URL;
  if (!baseUrl) {
    logger.info("KeepAlive: no RENDER_EXTERNAL_URL/SELF_URL set — self-ping disabled (fine for local dev)");
    return;
  }

  const healthUrl = `${baseUrl.replace(/\/$/, "")}/health`;

  setInterval(() => {
    fetch(healthUrl)
      .then((res) => logger.debug({ status: res.status }, "KeepAlive: self-ping ok"))
      .catch((err) => logger.warn({ err }, "KeepAlive: self-ping failed"));
  }, PING_INTERVAL_MS);

  logger.info({ healthUrl, everyMinutes: PING_INTERVAL_MS / 60000 }, "KeepAlive: self-ping started");
}
